/* =========================================================
   FT TRAINING — Treinos do dia (tela da TV do box)
   Lê /api/treinos a cada 5 min, troca de dia sozinho, ajusta o tamanho
   da letra para o treino caber inteiro na tela e mantém a tela acesa.
   Escrito sem sintaxe nova (?. ??) para rodar em navegador de Smart TV.
   ========================================================= */
(function () {
  var FUSO = 'America/Sao_Paulo';
  var ATUALIZA_MS = 5 * 60 * 1000;
  var VOLTA_PARA_HOJE_MS = 3 * 60 * 1000;
  var CACHE = 'ft-treinos-ultimo';

  var $ = function (s) { return document.querySelector(s); };
  var quadro = $('#quadro');
  var dataFixa = new URLSearchParams(location.search).get('data'); // ?data=AAAA-MM-DD para conferir outro dia
  var dataVista = dataFixa;   // null = hoje
  var hojeServidor = null;
  var timerVolta = null;

  // ---------- datas ----------
  function hojeLocal() {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    } catch (e) {
      var d = new Date();
      return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    }
  }
  function somaDias(iso, n) {
    var d = new Date(iso + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function fmt(iso, opcoes) {
    opcoes.timeZone = 'UTC';
    return new Intl.DateTimeFormat('pt-BR', opcoes).format(new Date(iso + 'T12:00:00Z'));
  }
  function horaAgora(comSegundos) {
    var o = { hour: '2-digit', minute: '2-digit', hour12: false };
    if (comSegundos) o.second = '2-digit';
    try { o.timeZone = FUSO; return new Intl.DateTimeFormat('pt-BR', o).format(new Date()); } catch (e) {
      delete o.timeZone; return new Intl.DateTimeFormat('pt-BR', o).format(new Date());
    }
  }

  // ---------- desenho ----------
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  function bloco(b) {
    var s = el('section', 'bloco');
    if (b.titulo) s.appendChild(el('h3', null, b.titulo));
    s.appendChild(el('p', null, b.texto));
    return s;
  }

  function desenhar(r) {
    var iso = r.data;
    var semana = fmt(iso, { weekday: 'long' });
    $('#dia-semana').textContent = semana.charAt(0).toUpperCase() + semana.slice(1);
    $('#data').textContent = fmt(iso, { day: '2-digit', month: 'short' }).replace('.', '').replace(' de ', ' ');
    $('#outro-dia').hidden = iso === r.hoje;
    document.title = 'Treinos ' + fmt(iso, { day: '2-digit', month: '2-digit' }) + ' | FT Training';

    quadro.innerHTML = '';
    var treinos = r.treinos || [];

    if (!treinos.length) {
      var v = el('div', 'tv__vazio');
      v.appendChild(el('h2', null, iso === r.hoje ? 'Treino de hoje ainda não foi lançado' : 'Nenhum treino nesta data'));
      v.appendChild(el('p', 'mono', 'Procurando ' + fmt(iso, { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' na planilha'));
      quadro.appendChild(v);
      ajustar();
      return;
    }

    var grade;
    if (treinos.length === 1) {
      // um treino só: cada bloco (aquecimento, força, WOD...) vira uma coluna
      var t = treinos[0];
      if (t.titulo) quadro.appendChild(el('h2', 'tv__modalidade', t.titulo));
      var n = t.blocos.length;
      grade = el('div', 'tv__grade tv__grade--' + (n <= 4 ? n : Math.min(4, Math.ceil(n / 2))));
      t.blocos.forEach(function (b) { grade.appendChild(bloco(b)); });
    } else {
      // vários treinos no dia (ex.: Hyrox e Power): um por coluna
      grade = el('div', 'tv__grade tv__grade--' + Math.min(4, treinos.length));
      treinos.forEach(function (t) {
        var col = el('div', 'tv__coluna');
        if (t.titulo) col.appendChild(el('h2', 'tv__modalidade', t.titulo));
        t.blocos.forEach(function (b) { col.appendChild(bloco(b)); });
        grade.appendChild(col);
      });
    }
    quadro.appendChild(grade);
    ajustar();
  }

  // Maior letra em que o treino inteiro cabe na tela (só na TV/tela deitada)
  var modoTV = window.matchMedia('(min-width: 900px) and (orientation: landscape)');
  function transborda() {
    if (quadro.scrollHeight > quadro.clientHeight + 1) return true;
    var bs = quadro.querySelectorAll('.bloco');
    for (var i = 0; i < bs.length; i++) if (bs[i].scrollHeight > bs[i].clientHeight + 1) return true;
    return false;
  }
  function ajustar() {
    var corpo = document.body.style;
    if (!modoTV.matches) { corpo.removeProperty('--fs'); return; }
    var lo = 12, hi = Math.max(24, Math.round(window.innerHeight / 7));
    while (hi - lo > 1) {
      var meio = Math.floor((lo + hi) / 2);
      corpo.setProperty('--fs', meio + 'px');
      if (transborda()) hi = meio; else lo = meio;
    }
    corpo.setProperty('--fs', lo + 'px');
  }
  var timerAjuste;
  window.addEventListener('resize', function () { clearTimeout(timerAjuste); timerAjuste = setTimeout(ajustar, 150); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(ajustar);

  // ---------- dados ----------
  function status(txt) { $('#status').textContent = txt; }

  function carregar() {
    var url = '/api/treinos' + (dataVista ? '?data=' + dataVista : '');
    return fetch(url, { credentials: 'same-origin', cache: 'no-store' }).then(function (r) {
      if (r.status === 401) { location.replace('/entrar?volta=' + encodeURIComponent(location.pathname + location.search)); return; }
      return r.json().then(function (j) {
        if (j.semPlanilha) {
          quadro.innerHTML = '';
          var v = el('div', 'tv__vazio');
          v.appendChild(el('h2', null, 'Nenhuma planilha ligada ainda'));
          v.appendChild(el('p', 'mono', 'Cole o link da planilha de treinos para começar'));
          var a = el('a', 'btn btn--yellow', 'Ligar planilha');
          a.href = '/planilha';
          v.appendChild(a);
          quadro.appendChild(v);
          status('');
          return;
        }
        if (!r.ok) throw new Error(j.erro || 'Erro ' + r.status);
        hojeServidor = j.hoje;
        desenhar(j);
        status('Planilha lida às ' + horaAgora() + ' · atualiza a cada 5 min');
        if (!dataVista) { try { localStorage.setItem(CACHE, JSON.stringify(j)); } catch (e) {} }
      });
    }).catch(function (e) {
      // sem internet: mantém o que já está na tela (ou o último treino salvo)
      if (!quadro.children.length) {
        var salvo = null;
        try { salvo = JSON.parse(localStorage.getItem(CACHE) || 'null'); } catch (x) {}
        if (salvo && salvo.data === hojeLocal()) desenhar(salvo);
        else {
          quadro.innerHTML = '';
          var v = el('div', 'tv__vazio');
          v.appendChild(el('h2', null, 'Não consegui carregar o treino'));
          v.appendChild(el('p', 'mono', e.message));
          quadro.appendChild(v);
        }
      }
      status('Sem conexão com a planilha (' + horaAgora() + ') · tentando de novo');
    });
  }

  function irPara(iso) {
    dataVista = iso && iso !== (hojeServidor || hojeLocal()) ? iso : null;
    clearTimeout(timerVolta);
    if (dataVista && !dataFixa) timerVolta = setTimeout(function () { irPara(null); }, VOLTA_PARA_HOJE_MS);
    carregar();
  }
  var base = function () { return dataVista || hojeServidor || hojeLocal(); };

  // ---------- relógio, troca de dia, recarga diária ----------
  var ultimoDia = hojeLocal();
  function tique() {
    $('#relogio').textContent = horaAgora();
    var hoje = hojeLocal();
    if (hoje !== ultimoDia) { ultimoDia = hoje; if (!dataFixa) irPara(null); }
    // 05:00: recarrega a página inteira (pega atualizações do site e limpa a memória da TV)
    if (horaAgora() === '05:00') {
      try {
        if (sessionStorage.getItem('ft-recarga-' + hoje)) return;
        sessionStorage.setItem('ft-recarga-' + hoje, '1');
      } catch (e) { return; }
      location.reload();
    }
  }
  setInterval(tique, 1000);
  tique();
  setInterval(carregar, ATUALIZA_MS);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { carregar(); manterAcesa(); } });

  // ---------- controles ----------
  $('#anterior').addEventListener('click', function () { irPara(somaDias(base(), -1)); });
  $('#proximo').addEventListener('click', function () { irPara(somaDias(base(), 1)); });
  $('#hoje').addEventListener('click', function () { irPara(null); });
  $('#sair').addEventListener('click', function () {
    fetch('/api/auth/sair', { method: 'POST', credentials: 'same-origin' }).then(function () { location.href = '/'; });
  });

  var telaCheia = $('#tela-cheia');
  function alternarTelaCheia() {
    var d = document, de = d.documentElement;
    if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    else if (de.requestFullscreen || de.webkitRequestFullscreen) (de.requestFullscreen || de.webkitRequestFullscreen).call(de);
  }
  telaCheia.addEventListener('click', alternarTelaCheia);
  document.addEventListener('fullscreenchange', function () {
    telaCheia.textContent = document.fullscreenElement ? 'Sair da tela cheia' : 'Tela cheia';
    setTimeout(ajustar, 200);
  });

  // setas do controle remoto / teclado
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') irPara(somaDias(base(), -1));
    else if (e.key === 'ArrowRight') irPara(somaDias(base(), 1));
    else if (e.key === 'f' || e.key === 'F') alternarTelaCheia();
  });

  // esconde controles e cursor quando ninguém mexe
  var timerOcioso;
  function acordar() {
    document.body.classList.remove('ocioso');
    clearTimeout(timerOcioso);
    timerOcioso = setTimeout(function () { document.body.classList.add('ocioso'); }, 4000);
  }
  ['mousemove', 'keydown', 'touchstart', 'click'].forEach(function (ev) { document.addEventListener(ev, acordar, { passive: true }); });
  acordar();

  // ---------- tela sempre acesa ----------
  var trava = null;
  function manterAcesa() {
    if (!('wakeLock' in navigator) || trava) return;
    navigator.wakeLock.request('screen').then(function (t) {
      trava = t;
      t.addEventListener('release', function () { trava = null; });
    }).catch(function () {});
  }
  manterAcesa();
  document.addEventListener('click', manterAcesa);

  carregar();
})();

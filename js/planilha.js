/* Área do coach → ligar a planilha de treinos (Google Sheets privada).
   Dois jeitos: entrar com a conta Google e escolher a planilha no Google Picker,
   ou compartilhar com o robô do site e colar o link. */
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var form = $('#form');
  var campoUrl = $('#url');
  var campoAba = $('#aba');
  var modoAtual = 'google';   // aba escolhida na tela
  var ultimo = null;          // último link salvo (para trocar de aba da planilha)

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function dataBR(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : ''; }
  function erro(msg) { $('#erro').textContent = msg || ''; }
  function aviso(msg, tipo) {
    var a = $('#aviso');
    a.hidden = !msg;
    a.textContent = msg || '';
    a.className = 'cfg__aviso-topo ' + (tipo || '');
  }

  function api(url, metodo, dados) {
    return fetch(url, {
      method: metodo || 'GET',
      credentials: 'same-origin',
      headers: dados ? { 'Content-Type': 'application/json' } : {},
      body: dados ? JSON.stringify(dados) : undefined
    }).then(function (r) {
      if (r.status === 401 && url === '/api/planilha') { location.replace('/entrar?volta=/planilha'); return new Promise(function () {}); }
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.erro || 'Algo deu errado. Tente de novo.');
        return j;
      });
    });
  }

  // ---------- telas ----------
  function escolherModo(modo) {
    modoAtual = modo;
    ['google', 'robo'].forEach(function (m) {
      $('#tab-' + m).setAttribute('aria-selected', String(m === modo));
      $('#modo-' + m).hidden = m !== modo;
    });
    erro('');
  }
  $('#tab-google').addEventListener('click', function () { escolherModo('google'); });
  $('#tab-robo').addEventListener('click', function () { escolherModo('robo'); });

  function mostrarAtual(c) {
    $('#atual').hidden = !c;
    if (!c) return;
    $('#atual-link').textContent = c.nome;
    $('#atual-link').href = c.url;
    $('#atual-aba').textContent = 'Aba: ' + c.aba + (c.modo === 'google' ? ' · pela conta Google' : ' · pelo robô');
  }

  function mostrarConta(g) {
    $('#g-off').hidden = g.configurado;
    $('#g-desconectado').hidden = !g.configurado || g.conectado;
    $('#g-conectado').hidden = !g.configurado || !g.conectado;
    $('#g-email').textContent = g.email || '';
  }

  function mostrarAbas(abas, atual) {
    var varias = abas && abas.length > 1;
    $('#aba-box').hidden = !varias;
    if (!varias) return;
    campoAba.innerHTML = '';
    abas.forEach(function (n) {
      var o = el('option', null, n);
      o.value = n;
      if (n === atual) o.selected = true;
      campoAba.appendChild(o);
    });
  }

  function mostrarPrevia(p) {
    var r = p.datas
      ? p.datas + ' treinos com data encontrados (coluna "' + p.colunaData + '").'
      : 'Não achei nenhuma coluna com datas. A planilha precisa de uma coluna "Data" (ex.: 15/10/2026).';
    if (p.colunas && p.colunas.length) r += ' Colunas: ' + p.colunas.join(' · ') + '.';
    $('#resumo').textContent = r;

    var box = $('#previa-treinos');
    box.innerHTML = '';
    if (p.treinos.length) {
      box.appendChild(el('p', 'mono', 'Treino de hoje (' + dataBR(p.hoje) + ')'));
      p.treinos.forEach(function (t) {
        if (t.titulo) box.appendChild(el('h3', 'cfg__modalidade', t.titulo));
        t.blocos.forEach(function (b) {
          var d = el('div', 'cfg__bloco');
          if (b.titulo) d.appendChild(el('b', 'mono', b.titulo));
          d.appendChild(el('p', null, b.texto));
          box.appendChild(d);
        });
      });
    } else {
      box.appendChild(el('p', 'cfg__vazio', 'Nenhum treino com a data de hoje (' + dataBR(p.hoje) + ').' +
        (p.proxima ? ' Próximo treino na planilha: ' + dataBR(p.proxima) + '.' : '')));
    }
    $('#previa').hidden = false;
  }

  // ---------- salvar e testar ----------
  function salvar(url, modo, aba, botao) {
    var txt = botao && botao.textContent;
    erro('');
    $('#previa').hidden = true;
    if (botao) { botao.disabled = true; botao.textContent = 'Testando…'; }
    return api('/api/planilha', 'POST', { url: url, modo: modo, aba: aba || undefined }).then(function (j) {
      ultimo = { url: url, modo: modo };
      mostrarAtual(j.config);
      mostrarAbas(j.abas, j.config.aba);
      mostrarPrevia(j.previa);
    }).catch(function (e) { erro(e.message); })
      .then(function () { if (botao) { botao.disabled = false; botao.textContent = txt; } });
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    salvar(campoUrl.value.trim(), 'robo', null, form.querySelector('button[type=submit]'));
  });
  campoAba.addEventListener('change', function () {
    if (ultimo) salvar(ultimo.url, ultimo.modo, campoAba.value);
  });

  // ---------- Google Picker ----------
  var gapiPronto = null;
  function carregarPicker() {
    if (gapiPronto) return gapiPronto;
    gapiPronto = new Promise(function (ok, falha) {
      var s = document.createElement('script');
      s.src = 'https://apis.google.com/js/api.js';
      s.onload = function () { window.gapi.load('picker', { callback: ok, onerror: falha }); };
      s.onerror = function () { gapiPronto = null; falha(new Error('Não consegui abrir a janela do Google. Confira a internet.')); };
      document.head.appendChild(s);
    });
    return gapiPronto;
  }

  $('#g-escolher').addEventListener('click', function () {
    var b = this;
    erro('');
    b.disabled = true;
    Promise.all([api('/api/google/conta', 'POST'), carregarPicker()]).then(function (r) {
      var cred = r[0], P = window.google.picker;
      var visao = new P.DocsView(P.ViewId.SPREADSHEETS).setMode(P.DocsViewMode.LIST).setIncludeFolders(true);
      new P.PickerBuilder()
        .addView(visao)
        .setOAuthToken(cred.token)
        .setDeveloperKey(cred.apiKey)
        .setAppId(cred.appId)
        .setLocale('pt-BR')
        .setTitle('Escolha a planilha de treinos')
        .setCallback(function (d) {
          if (d.action === P.Action.PICKED && d.docs && d.docs[0]) {
            var doc = d.docs[0];
            salvar(doc.url || 'https://docs.google.com/spreadsheets/d/' + doc.id + '/edit', 'google', null, b);
          }
        })
        .build()
        .setVisible(true);
    }).catch(function (e) { erro(e.message); })
      .then(function () { b.disabled = false; });
  });

  $('#g-sair').addEventListener('click', function () {
    if (!confirm('Desconectar sua conta Google? Se a planilha foi ligada por ela, a TV para de mostrar os treinos.')) return;
    api('/api/google/conta', 'DELETE').then(function () { return carregar(); })
      .then(function () { aviso('Conta Google desconectada.', 'ok'); })
      .catch(function (e) { erro(e.message); });
  });

  // ---------- robô ----------
  $('#copiar').addEventListener('click', function () {
    var b = this, txt = $('#robo').textContent;
    var feito = function () { b.textContent = 'Copiado ✓'; setTimeout(function () { b.textContent = 'Copiar'; }, 2000); };
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(feito);
    else { var r = document.createRange(); r.selectNode($('#robo')); getSelection().removeAllRanges(); getSelection().addRange(r); document.execCommand('copy'); feito(); }
  });

  $('#desconectar').addEventListener('click', function () {
    if (!confirm('Desconectar a planilha? A TV para de mostrar os treinos até você ligar uma planilha de novo.')) return;
    api('/api/planilha', 'DELETE').then(function () {
      mostrarAtual(null);
      $('#previa').hidden = true;
      $('#aba-box').hidden = true;
      campoUrl.value = '';
      ultimo = null;
    }).catch(function (e) { erro(e.message); });
  });

  // ---------- início ----------
  function carregar() {
    return Promise.all([api('/api/planilha'), api('/api/google/conta').catch(function () { return { configurado: false }; })]).then(function (r) {
      var p = r[0], g = r[1];
      $('#carregando').hidden = true;
      $('#conteudo').hidden = false;
      $('#robo').textContent = p.robo || '';
      $('#robo-box').hidden = !p.robo;
      $('#sem-robo').hidden = !!p.robo;
      mostrarAtual(p.config);
      mostrarConta(g);
      if (p.config) {
        ultimo = { url: p.config.url, modo: p.config.modo };
        if (p.config.modo === 'robo') campoUrl.value = p.config.url;
      }
      // abre na opção já em uso; se não houver, no Google (quando configurado)
      escolherModo(p.config ? p.config.modo : (g.configurado ? 'google' : 'robo'));
    });
  }

  carregar().then(function () {
    var q = new URLSearchParams(location.search);
    if (q.get('google') === 'conectado') { aviso('Conta Google conectada. Agora escolha a planilha.', 'ok'); escolherModo('google'); }
    if (q.get('google') === 'erro') { aviso(q.get('msg') || 'Não foi possível conectar ao Google.', 'ruim'); escolherModo('google'); }
    if (q.get('google')) history.replaceState(null, '', '/planilha');
  }).catch(function (e) { $('#carregando').textContent = e.message; });
})();

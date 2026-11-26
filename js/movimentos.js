/* Página /movimentos: lista em ordem alfabética, busca e vídeo que só carrega quando a pessoa abre. */
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var sem = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
  var TODOS = [];

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  var letraDe = function (nome) { var l = sem(nome).charAt(0).toUpperCase(); return /[A-Z]/.test(l) ? l : '#'; };

  // Player: YouTube sem cookies de rastreio ou o arquivo enviado pelo coach
  function player(m) {
    var box = el('div', 'mov__video');
    if (m.youtube) {
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + m.youtube + '?rel=0&modestbranding=1&playsinline=1';
      f.title = 'Vídeo: ' + m.nome;
      f.allow = 'accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen';
      f.allowFullscreen = true;
      f.loading = 'lazy';
      box.appendChild(f);
    } else {
      var v = document.createElement('video');
      v.src = m.video; v.controls = true; v.preload = 'metadata'; v.playsInline = true;
      box.appendChild(v);
    }
    return box;
  }

  function item(m) {
    var d = el('details', 'mov');
    var s = el('summary');
    s.appendChild(el('span', null, m.nome));
    s.appendChild(el('span', 'mov__ver', m.video ? 'Ver vídeo' : 'Ver'));
    d.appendChild(s);
    var corpo = el('div', 'mov__corpo');
    d.appendChild(corpo);
    d.addEventListener('toggle', function () {
      if (d.open && !corpo.childNodes.length) {
        if (m.video) corpo.appendChild(player(m));
        if (m.orientacoes) corpo.appendChild(el('p', 'mov__dica', m.orientacoes));
        if (!m.video && !m.orientacoes) corpo.appendChild(el('p', 'mov__sem', 'Vídeo em breve.'));
      }
      // fechou: tira o player para o vídeo parar
      if (!d.open && corpo.childNodes.length) corpo.textContent = '';
    });
    return d;
  }

  function desenhar() {
    var busca = sem($('#busca').value.trim());
    var lista = TODOS.filter(function (m) { return !busca || sem(m.nome + ' ' + m.orientacoes).indexOf(busca) >= 0; });
    var grupos = {}, ordem = [];
    lista.forEach(function (m) {
      var l = letraDe(m.nome);
      if (!grupos[l]) { grupos[l] = []; ordem.push(l); }
      grupos[l].push(m);
    });

    var alvo = $('#lista');
    alvo.textContent = '';
    ordem.forEach(function (l) {
      var g = el('section', 'movs__grupo');
      g.id = 'letra-' + l;
      g.appendChild(el('h2', 'movs__letra', l));
      var itens = el('div', 'movs__itens');
      grupos[l].forEach(function (m) { itens.appendChild(item(m)); });
      g.appendChild(itens);
      alvo.appendChild(g);
    });

    var nav = $('#letras');
    nav.textContent = '';
    ordem.forEach(function (l) {
      var a = el('a', null, l);
      a.href = '#letra-' + l;
      nav.appendChild(a);
    });

    $('#status').textContent = lista.length
      ? (busca ? lista.length + (lista.length === 1 ? ' movimento encontrado' : ' movimentos encontrados') : lista.length + ' movimentos')
      : 'Nenhum movimento com esse nome. Tente outra palavra (ex.: "agachamento", "burpee").';
    // busca com um resultado só: já abre o vídeo
    if (busca && lista.length === 1) { var d = alvo.querySelector('details'); if (d) d.open = true; }
  }

  var timer;
  $('#busca').addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(desenhar, 120); });

  fetch('/api/movimentos', { credentials: 'same-origin' })
    .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.erro || 'Erro'); return j; }); })
    .then(function (j) { TODOS = j.movimentos || []; desenhar(); })
    .catch(function () { $('#status').textContent = 'Não consegui carregar os movimentos agora. Tente de novo em instantes.'; });
})();

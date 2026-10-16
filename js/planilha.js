/* Área do coach → ligar a planilha de treinos (Google Sheets privada, lida pelo robô do site). */
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var form = $('#form');
  var campoUrl = $('#url');
  var campoAba = $('#aba');

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function dataBR(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : ''; }
  function erro(msg) { form.querySelector('.login__erro').textContent = msg || ''; }

  function mostrarAtual(c) {
    $('#atual').hidden = !c;
    if (!c) return;
    $('#atual-link').textContent = c.nome;
    $('#atual-link').href = c.url;
    $('#atual-aba').textContent = 'Aba: ' + c.aba;
    if (!campoUrl.value) campoUrl.value = c.url;
  }

  function mostrarAbas(abas, atual) {
    var varias = abas && abas.length > 1;
    campoAba.hidden = $('#aba-label').hidden = !varias;
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

  function api(metodo, dados) {
    return fetch('/api/planilha', {
      method: metodo,
      credentials: 'same-origin',
      headers: dados ? { 'Content-Type': 'application/json' } : {},
      body: dados ? JSON.stringify(dados) : undefined
    }).then(function (r) {
      if (r.status === 401) { location.replace('/entrar?volta=/planilha'); return new Promise(function () {}); }
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.erro || 'Algo deu errado. Tente de novo.'); throw e; }
        return j;
      });
    });
  }

  api('GET').then(function (j) {
    $('#carregando').hidden = true;
    $('#conteudo').hidden = false;
    $('#robo').textContent = j.robo || '';
    $('#robo-box').hidden = !j.robo;
    $('#sem-robo').hidden = !!j.robo;
    mostrarAtual(j.config);
  }).catch(function (e) { $('#carregando').textContent = e.message; });

  $('#copiar').addEventListener('click', function () {
    var b = this, txt = $('#robo').textContent;
    var feito = function () { b.textContent = 'Copiado ✓'; setTimeout(function () { b.textContent = 'Copiar'; }, 2000); };
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(feito);
    else { var r = document.createRange(); r.selectNode($('#robo')); getSelection().removeAllRanges(); getSelection().addRange(r); document.execCommand('copy'); feito(); }
  });

  function salvar(aba) {
    var b = form.querySelector('button[type=submit]');
    erro('');
    $('#previa').hidden = true;
    b.disabled = true; b.textContent = 'Testando…';
    api('POST', { url: campoUrl.value.trim(), aba: aba || undefined }).then(function (j) {
      mostrarAtual(j.config);
      mostrarAbas(j.abas, j.config.aba);
      mostrarPrevia(j.previa);
    }).catch(function (e) { erro(e.message); })
      .then(function () { b.disabled = false; b.textContent = 'Salvar e testar'; });
  }

  form.addEventListener('submit', function (ev) { ev.preventDefault(); salvar(campoAba.hidden ? null : campoAba.value); });
  campoUrl.addEventListener('input', function () { campoAba.hidden = $('#aba-label').hidden = true; });
  campoAba.addEventListener('change', function () { salvar(campoAba.value); });
})();

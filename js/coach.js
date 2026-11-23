/* Painel do coach: alunos, convites, semana de cada aluno e modelos de treino.
   Rotas pelo #: #alunos · #aluno/ID · #templates · #template/ID (ou #template/novo) */
(function () {
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return [].slice.call((el || document).querySelectorAll(s)); };
  var DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var MODALIDADE = { musculacao: 'Musculação', corrida: 'Corrida', hyrox: 'Hyrox', outro: 'Outro' };

  var R = null;            // resumo (eu, alunos, equipe, convites, templates, pedidos, exercicios)
  var semanaAluno = {};    // aluno id → segunda-feira mostrada

  // ---------- utilidades ----------
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  var dt = function (iso) { return new Date(iso + 'T12:00:00Z'); };
  function somaDias(iso, n) { var d = dt(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function curta(iso) { var d = dt(iso); return d.getUTCDate() + ' ' + MESES[d.getUTCMonth()]; }
  function quando(ts) {
    if (!ts) return 'nunca entrou';
    var dias = Math.floor((Date.now() - new Date(ts)) / 864e5);
    return dias <= 0 ? 'entrou hoje' : dias === 1 ? 'entrou ontem' : 'entrou há ' + dias + ' dias';
  }

  function api(metodo, corpo, query) {
    var op = { method: metodo, credentials: 'same-origin', cache: 'no-store', headers: {} };
    if (corpo) { op.headers['Content-Type'] = 'application/json'; op.body = JSON.stringify(corpo); }
    return fetch('/api/coach' + (query || ''), op).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401) { location.replace('/entrar?volta=' + encodeURIComponent('/coach' + location.hash)); return new Promise(function () {}); }
        if (!r.ok) { var e = new Error(j.erro || 'Algo deu errado. Tente de novo.'); e.status = r.status; throw e; }
        return j;
      });
    });
  }
  var acao = function (nome, dados) { dados = dados || {}; dados.acao = nome; return api('POST', dados); };

  var timerMsg;
  function msg(texto, tipo) {
    var m = $('#msg');
    m.textContent = texto;
    m.className = 'coach__msg' + (tipo ? ' coach__msg--' + tipo : '');
    m.hidden = !texto;
    clearTimeout(timerMsg);
    if (texto && tipo !== 'erro') timerMsg = setTimeout(function () { m.hidden = true; }, 4000);
  }
  var erro = function (e) { msg(e.message, 'erro'); };

  function ocupado(btn, sim) {
    if (!btn) return;
    btn.disabled = sim;
    if (!btn.dataset.txt) btn.dataset.txt = btn.textContent;
    btn.textContent = sim ? 'Aguarde…' : btn.dataset.txt;
  }

  var nomeDe = function (id) {
    var p = (R.equipe || []).filter(function (x) { return x.id === id; })[0];
    return p ? (p.nome || p.email) : '';
  };
  var admin = function () { return R && R.eu.papel === 'admin'; };

  // ---------- resumo ----------
  function carregarResumo() {
    return api('GET', null, '?acao=resumo').then(function (j) {
      R = j;
      $('#ola').textContent = 'Olá, ' + ((j.eu.nome || '').split(' ')[0] || 'coach');
      document.body.classList.toggle('eh-admin', admin());
      $$('.sel-coach').forEach(function (s) {
        s.textContent = '';
        j.equipe.forEach(function (p) {
          var o = el('option', null, (p.nome || p.email) + (p.id === j.eu.id ? ' (você)' : ''));
          o.value = p.id;
          s.appendChild(o);
        });
        s.value = j.eu.id;
      });
      var dl = $('#lista-exercicios');
      dl.textContent = '';
      j.exercicios.forEach(function (n) { var o = el('option'); o.value = n; dl.appendChild(o); });
      return j;
    });
  }

  function desenharAlunos() {
    var semTreino = R.alunos.filter(function (a) { return !a.semana.treinos; }).length;
    var feitos = R.alunos.reduce(function (s, a) { return s + a.semana.feitos; }, 0);
    var marcados = R.alunos.reduce(function (s, a) { return s + a.semana.treinos; }, 0);
    var stats = $('#stats');
    stats.textContent = '';
    [['Alunos ativos', R.alunos.length, ''],
     ['Sem treino nesta semana', semTreino, semTreino ? 'alerta' : ''],
     ['Treinos feitos / marcados', feitos + ' / ' + marcados, ''],
     admin() ? ['Pedidos de acesso', R.pedidos.length, R.pedidos.length ? 'alerta' : ''] : ['Convites pendentes', R.convites.length, '']
    ].forEach(function (s) {
      var c = el('div', 'stat' + (s[2] ? ' stat--' + s[2] : ''));
      c.appendChild(el('b', null, String(s[1])));
      c.appendChild(el('span', 'mono', s[0]));
      stats.appendChild(c);
    });

    // pedidos (admin)
    var ped = $('#pedidos');
    ped.textContent = '';
    $('#c-pedidos').hidden = !admin() || !R.pedidos.length;
    R.pedidos.forEach(function (p) {
      var li = el('li', 'linha');
      var info = el('div', 'linha__info');
      info.appendChild(el('b', null, p.nome || p.email));
      info.appendChild(el('span', null, p.email + ' · ' + quando(p.ultimo_acesso_em)));
      li.appendChild(info);
      var sel = el('select', 'sel-coach-pedido');
      sel.setAttribute('aria-label', 'Coach de ' + (p.nome || p.email));
      R.equipe.forEach(function (c) { var o = el('option', null, c.nome || c.email); o.value = c.id; sel.appendChild(o); });
      sel.value = R.eu.id;
      var b = el('button', 'btn btn--yellow btn--sm', 'Liberar');
      b.type = 'button';
      b.addEventListener('click', function () {
        ocupado(b, true);
        acao('liberar', { id: p.id, papel: 'aluno', coach_id: sel.value })
          .then(function () { msg((p.nome || p.email) + ' liberado.', 'ok'); return atualizar(); })
          .catch(function (e) { erro(e); ocupado(b, false); });
      });
      var act = el('div', 'linha__acoes');
      act.appendChild(sel); act.appendChild(b);
      li.appendChild(act);
      ped.appendChild(li);
    });

    // convites
    var conv = $('#convites');
    conv.textContent = '';
    $('#c-convites').hidden = !R.convites.length;
    R.convites.forEach(function (c) {
      var li = el('li', 'linha');
      var info = el('div', 'linha__info');
      info.appendChild(el('b', null, c.nome || c.email));
      info.appendChild(el('span', null, c.email + (c.papel !== 'aluno' ? ' · ' + c.papel : (admin() && c.coach_id ? ' · ' + nomeDe(c.coach_id) : ''))));
      li.appendChild(info);
      var b = el('button', 'link mono', 'Cancelar');
      b.type = 'button';
      b.addEventListener('click', function () {
        if (!confirmar(b)) return;
        acao('cancelar_convite', { email: c.email }).then(atualizar).catch(erro);
      });
      li.appendChild(b);
      conv.appendChild(li);
    });

    listarAlunos();
  }

  // pede um segundo clique em vez de abrir uma janela de confirmação
  function confirmar(b) {
    if (b.dataset.confirma) return true;
    b.dataset.confirma = '1';
    var txt = b.textContent;
    b.textContent = 'Confirmar?';
    setTimeout(function () { delete b.dataset.confirma; b.textContent = txt; }, 3000);
    return false;
  }

  function listarAlunos() {
    var termo = $('#busca').value.trim().toLowerCase();
    var ul = $('#alunos');
    ul.textContent = '';
    var lista = R.alunos.filter(function (a) { return !termo || (a.nome + ' ' + a.email).toLowerCase().indexOf(termo) >= 0; });
    $('#n-alunos').textContent = R.alunos.length ? '(' + R.alunos.length + ')' : '';
    if (!lista.length) {
      ul.appendChild(el('li', 'linhas__vazio', R.alunos.length ? 'Nenhum aluno encontrado.' : 'Nenhum aluno ainda. Convide pelo e-mail Google.'));
      return;
    }
    lista.forEach(function (a) {
      var li = el('li');
      var link = el('a', 'linha linha--link');
      link.href = '#aluno/' + a.id;
      var info = el('div', 'linha__info');
      info.appendChild(el('b', null, a.nome || a.email));
      info.appendChild(el('span', null, a.email + (admin() && a.coach_id && a.coach_id !== R.eu.id ? ' · ' + nomeDe(a.coach_id) : '') + ' · ' + quando(a.ultimo_acesso_em)));
      link.appendChild(info);
      var s = a.semana;
      link.appendChild(el('span', 'pilula' + (s.treinos ? '' : ' pilula--alerta'), s.treinos ? s.feitos + '/' + s.treinos + ' feitos' : 'sem treino'));
      li.appendChild(link);
      ul.appendChild(li);
    });
  }

  $('#busca').addEventListener('input', listarAlunos);

  // papel ≠ aluno não tem coach
  var fConv = $('#f-convidar');
  fConv.papel.addEventListener('change', function () { $('.so-aluno', fConv).hidden = fConv.papel.value !== 'aluno'; });
  fConv.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var b = $('button[type=submit]', fConv);
    var dados = { email: fConv.email.value.trim(), nome: fConv.nome.value.trim() };
    if (admin()) { dados.papel = fConv.papel.value; dados.coach_id = fConv.coach_id.value; }
    ocupado(b, true);
    acao('convidar', dados).then(function (j) {
      msg(j.liberado ? 'Acesso liberado: a pessoa já tinha entrado antes e já pode usar.' : 'Convite criado. Avise a pessoa para entrar em fttraining.com.br/entrar com essa conta Google.', 'ok');
      fConv.reset();
      $('.so-aluno', fConv).hidden = false;
      if (admin()) fConv.coach_id.value = R.eu.id;
      return atualizar();
    }).catch(erro).then(function () { ocupado(b, false); });
  });

  // ---------- semana de um aluno ----------
  function abrirAluno(id) {
    var a = R.alunos.filter(function (x) { return x.id === id; })[0];
    $('#a-nome').textContent = a ? (a.nome || a.email) : 'Aluno';
    $('#a-email').textContent = a ? a.email : '';
    var cal = $('#calendario');
    cal.textContent = '';
    cal.appendChild(el('p', 'linhas__vazio', 'Carregando…'));
    var semana = semanaAluno[id];
    return api('GET', null, '?acao=semana&aluno=' + encodeURIComponent(id) + (semana ? '&semana=' + semana : '')).then(function (j) {
      semanaAluno[id] = j.semana.de;
      desenharSemana(j);
    }).catch(function (e) { cal.textContent = ''; erro(e); });
  }

  function desenharSemana(j) {
    var a = j.aluno;
    $('#a-nome').textContent = a.nome || a.email;
    $('#a-email').textContent = a.email + (admin() && a.coach_id ? ' · coach: ' + nomeDe(a.coach_id) : '');
    var atual = j.semana.de <= j.hoje && j.hoje <= j.semana.ate;
    $('#a-rotulo').textContent = atual ? 'Esta semana' : (j.semana.de > j.hoje ? 'Próxima' : 'Anterior');
    $('#a-periodo').textContent = curta(j.semana.de) + ' – ' + curta(j.semana.ate);

    var porDia = {};
    j.treinos.forEach(function (t) { (porDia[t.data] = porDia[t.data] || []).push(t); });

    var cal = $('#calendario');
    cal.textContent = '';
    for (var i = 0; i < 7; i++) cal.appendChild(diaDoCalendario(a, somaDias(j.semana.de, i), porDia, j.hoje));
    $('#a-copiar').disabled = !j.treinos.length;
  }

  function diaDoCalendario(aluno, iso, porDia, hoje) {
    var col = el('section', 'cal-dia' + (iso === hoje ? ' cal-dia--hoje' : ''));
    var cab = el('header', 'cal-dia__cab');
    cab.appendChild(el('b', null, DIAS[dt(iso).getUTCDay()]));
    cab.appendChild(el('span', 'mono', curta(iso)));
    col.appendChild(cab);

    (porDia[iso] || []).forEach(function (t) {
      var c = el('article', 'cal-treino' + (t.registro ? ' cal-treino--feito' : ''));
      var topo = el('div', 'cal-treino__topo');
      topo.appendChild(el('span', 'mono', MODALIDADE[t.modalidade] || ''));
      var x = el('button', 'cal-treino__del', '×');
      x.type = 'button';
      x.title = 'Tirar este treino do dia';
      x.setAttribute('aria-label', 'Tirar ' + t.nome + ' do dia');
      x.addEventListener('click', function () {
        if (!confirmar(x)) return;
        acao('remover_treino', { id: t.id }).then(function () { abrirAluno(aluno.id); atualizar(true); }).catch(erro);
      });
      topo.appendChild(x);
      c.appendChild(topo);
      c.appendChild(el('b', null, t.nome));
      if (t.registro) {
        var r = t.registro;
        var feito = ['✓ Feito',
          r.esforco ? 'esforço ' + r.esforco + '/10' : '',
          r.duracao_min ? r.duracao_min + ' min' : '',
          r.distancia_km ? String(r.distancia_km).replace('.', ',') + ' km' : ''
        ].filter(Boolean).join(' · ');
        c.appendChild(el('span', 'cal-treino__feito mono', feito));
        if (r.comentario) c.appendChild(el('p', 'cal-treino__coment', '“' + r.comentario + '”'));
      }
      col.appendChild(c);
    });

    var sel = el('select', 'cal-dia__add');
    sel.setAttribute('aria-label', 'Adicionar treino em ' + curta(iso));
    var o0 = el('option', null, '+ Treino');
    o0.value = '';
    sel.appendChild(o0);
    R.templates.forEach(function (t) {
      var o = el('option', null, t.nome + (t.nome_tecnico ? ' · ' + t.nome_tecnico : ''));
      o.value = t.id;
      sel.appendChild(o);
    });
    if (!R.templates.length) { o0.textContent = 'Crie um treino primeiro'; sel.disabled = true; }
    sel.addEventListener('change', function () {
      if (!sel.value) return;
      sel.disabled = true;
      acao('agendar', { aluno_id: aluno.id, data: iso, template_id: sel.value })
        .then(function () { abrirAluno(aluno.id); atualizar(true); })
        .catch(function (e) { erro(e); sel.disabled = false; sel.value = ''; });
    });
    col.appendChild(sel);
    return col;
  }

  function idDaRota() { return (location.hash.match(/^#aluno\/(.+)$/) || [])[1]; }

  $('#a-ant').addEventListener('click', function () { var id = idDaRota(); if (semanaAluno[id]) { semanaAluno[id] = somaDias(semanaAluno[id], -7); abrirAluno(id); } });
  $('#a-prox').addEventListener('click', function () { var id = idDaRota(); if (semanaAluno[id]) { semanaAluno[id] = somaDias(semanaAluno[id], 7); abrirAluno(id); } });
  $('#a-copiar').addEventListener('click', function () {
    var id = idDaRota(), de = semanaAluno[id], b = this;
    if (!de) return;
    ocupado(b, true);
    acao('copiar_semana', { aluno_id: id, de: de, para: somaDias(de, 7) }).then(function (j) {
      msg(j.copiados + (j.copiados === 1 ? ' treino copiado' : ' treinos copiados') + ' para a semana seguinte.', 'ok');
      semanaAluno[id] = somaDias(de, 7);
      abrirAluno(id);
      atualizar(true);
    }).catch(erro).then(function () { ocupado(b, false); });
  });
  $('#a-desativar').addEventListener('click', function () {
    var id = idDaRota(), b = this;
    if (!confirmar(b)) return;
    acao('desativar', { id: id }).then(function () {
      return atualizar(true).then(function () { irPara('#alunos', 'Acesso retirado.'); });
    }).catch(erro);
  });

  // ---------- modelos de treino ----------
  function desenharTemplates() {
    var ul = $('#templates');
    ul.textContent = '';
    if (!R.templates.length) { ul.appendChild(el('li', 'linhas__vazio', 'Nenhum treino ainda. Crie o primeiro em "+ Novo treino".')); return; }
    R.templates.forEach(function (t) {
      var li = el('li');
      var a = el('a', 'linha linha--link');
      a.href = '#template/' + t.id;
      var info = el('div', 'linha__info');
      info.appendChild(el('b', null, t.nome));
      info.appendChild(el('span', null, [t.nome_tecnico, t.tipo].filter(Boolean).join(' · ')));
      a.appendChild(info);
      a.appendChild(el('span', 'pilula', MODALIDADE[t.modalidade] || ''));
      li.appendChild(a);
      ul.appendChild(li);
    });
  }

  var fT = $('#f-template');
  var editando = null;

  function novaAtividade(lista, a) {
    var linha = $('#t-atividade').content.firstElementChild.cloneNode(true);
    a = a || {};
    $$('[data-k]', linha).forEach(function (i) { if (a[i.dataset.k] != null) i.value = a[i.dataset.k]; });
    $('.ativ__del', linha).addEventListener('click', function () { linha.remove(); });
    lista.appendChild(linha);
    return linha;
  }

  function novoBloco(b) {
    var bloco = $('#t-bloco').content.firstElementChild.cloneNode(true);
    b = b || { repetir: 1, atividades: [{}] };
    $('.bloco-ed__rep', bloco).value = b.repetir || 1;
    var lista = $('.bloco-ed__lista', bloco);
    (b.atividades && b.atividades.length ? b.atividades : [{}]).forEach(function (a) { novaAtividade(lista, a); });
    $('.bloco-ed__add', bloco).addEventListener('click', function () { $('input', novaAtividade(lista)).focus(); });
    $('.bloco-ed__del', bloco).addEventListener('click', function () { bloco.remove(); });
    $('#blocos').appendChild(bloco);
    return bloco;
  }

  $('#add-bloco').addEventListener('click', function () { $('input', $('.bloco-ed__lista', novoBloco())).focus(); });

  function abrirEditor(id) {
    editando = null;
    fT.reset();
    $('#blocos').textContent = '';
    $('#e-arquivar').hidden = true;
    if (id === 'novo') {
      $('#e-titulo').textContent = 'Novo treino';
      novoBloco();
      fT.nome.focus();
      return Promise.resolve();
    }
    $('#e-titulo').textContent = 'Carregando…';
    return api('GET', null, '?acao=template&id=' + encodeURIComponent(id)).then(function (j) {
      var t = j.template;
      editando = t.id;
      $('#e-titulo').textContent = t.nome;
      ['nome', 'nome_tecnico', 'modalidade', 'tipo', 'observacoes'].forEach(function (k) { fT[k].value = t[k] || ''; });
      var e = t.estrutura || {};
      fT.aquecimento_min.value = e.aquecimento_min || '';
      fT.desaquecimento_min.value = e.desaquecimento_min || '';
      (e.blocos && e.blocos.length ? e.blocos : [null]).forEach(novoBloco);
      $('#e-arquivar').hidden = false;
    }).catch(erro);
  }

  function lerEditor() {
    return {
      id: editando || undefined,
      nome: fT.nome.value, nome_tecnico: fT.nome_tecnico.value, modalidade: fT.modalidade.value,
      tipo: fT.tipo.value, observacoes: fT.observacoes.value,
      estrutura: {
        aquecimento_min: fT.aquecimento_min.value, desaquecimento_min: fT.desaquecimento_min.value,
        blocos: $$('.bloco-ed', fT).map(function (b) {
          return {
            repetir: $('.bloco-ed__rep', b).value,
            atividades: $$('.ativ', b).map(function (l) {
              var a = {};
              $$('[data-k]', l).forEach(function (i) { a[i.dataset.k] = i.value; });
              return a;
            })
          };
        })
      }
    };
  }

  fT.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (!fT.nome.value.trim()) { msg('Dê um nome ao treino.', 'erro'); fT.nome.focus(); return; }
    var b = $('button[type=submit]', fT);
    ocupado(b, true);
    acao('salvar_template', lerEditor()).then(function () {
      return atualizar(true).then(function () { irPara('#templates', 'Treino salvo.'); });
    }).catch(erro).then(function () { ocupado(b, false); });
  });

  $('#e-arquivar').addEventListener('click', function () {
    var b = this;
    if (!editando || !confirmar(b)) return;
    acao('arquivar_template', { id: editando }).then(function () {
      return atualizar(true).then(function () { irPara('#templates', 'Treino arquivado. Os dias que já usam ele continuam iguais.'); });
    }).catch(erro);
  });

  // ---------- TV: planilha × versão organizada pela IA ----------
  var semanaTV = null;   // segunda-feira mostrada; null = semana atual
  var ultimaTV = null;

  function textoFonte(f) {
    if (!f) return '';
    var partes = [];
    if (f.aviso) partes.push(f.aviso);
    f.treinos.forEach(function (t) {
      t.blocos.forEach(function (b) { partes.push((b.titulo ? b.titulo + '\n' : '') + b.texto); });
    });
    return partes.join('\n\n');
  }

  // prévia no mesmo estilo da TV (classes .bloco--ia)
  function previaIA(ia) {
    var box = el('div', 'tv-previa');
    if (!ia.partes.length) { box.appendChild(el('p', 'linhas__vazio', ia.aviso || 'Sem exercícios.')); return box; }
    ia.partes.forEach(function (p) {
      var s = el('section', 'bloco bloco--ia');
      if (p.nome) s.appendChild(el('h3', null, p.nome));
      if (p.formato) s.appendChild(el('p', 'bloco__formato', p.formato));
      var ul = el('ul', 'bloco__itens');
      p.itens.forEach(function (i) {
        var li = el('li');
        if (i.qtd) li.appendChild(el('span', 'bloco__qtd', i.qtd));
        var t = el('span', 'bloco__exercicio', i.texto || '');
        if (i.nota) t.appendChild(el('small', null, i.nota));
        li.appendChild(t);
        ul.appendChild(li);
      });
      s.appendChild(ul);
      if (p.nota) s.appendChild(el('p', 'bloco__nota', p.nota));
      box.appendChild(s);
    });
    return box;
  }

  function situacao(d) {
    var s = d.salvo;
    if (d.erro) return ['Erro ao ler a planilha', 'alerta'];
    if (!d.temTreino) return [s && s.valido && s.status === 'aprovado' ? 'Aprovado' : 'Sem treino na planilha', ''];
    if (!s) return ['Ainda não lido pela IA', ''];
    if (!s.valido) return ['A planilha mudou: leia de novo', 'alerta'];
    if (s.status === 'aprovado') return ['Aprovado · na TV', 'ok'];
    if (s.alertas && s.alertas.length) return ['Revisar antes de aprovar', 'alerta'];
    return ['Pronto para aprovar', ''];
  }

  function desenharTV(j) {
    ultimaTV = j;
    semanaTV = j.semana.de;
    var atual = j.semana.de <= j.hoje && j.hoje <= somaDias(j.semana.de, 6);
    $('#tv-rotulo').textContent = atual ? 'Esta semana' : (j.semana.de > j.hoje ? 'Próxima' : 'Anterior');
    $('#tv-periodo').textContent = curta(j.semana.de) + ' – ' + curta(j.semana.ate);
    var ler = $('#tv-ler');
    ler.disabled = !j.iaConfigurada;
    ler.title = j.iaConfigurada ? '' : 'A IA ainda não foi configurada no servidor (GEMINI_API_KEY).';

    var lista = $('#tv-dias');
    lista.textContent = '';
    if (!j.iaConfigurada) lista.appendChild(el('p', 'coach__msg coach__msg--erro', 'A IA ainda não foi configurada no servidor (GEMINI_API_KEY). A TV continua mostrando a planilha normalmente.'));

    var aprovaveis = [];
    j.dias.forEach(function (d) {
      var s = d.salvo;
      var sit = situacao(d);
      var card = el('article', 'card tv-dia');
      var topo = el('div', 'card__topo');
      var tit = el('div');
      var t0 = d.fonte && d.fonte.treinos[0];
      tit.appendChild(el('h2', null, DIAS[dt(d.data).getUTCDay()] + ' ' + curta(d.data)));
      tit.appendChild(el('p', 'card__ajuda', (t0 && t0.titulo) || (d.fonte && d.fonte.aviso) || ''));
      topo.appendChild(tit);
      topo.appendChild(el('span', 'pilula' + (sit[1] === 'alerta' ? ' pilula--alerta' : sit[1] === 'ok' ? ' pilula--ok' : ''), sit[0]));
      card.appendChild(topo);

      if (d.erro) { card.appendChild(el('p', 'card__ajuda', d.erro)); lista.appendChild(card); return; }

      var lados = el('div', 'tv-lados');
      var esq = el('div', 'tv-lado');
      esq.appendChild(el('p', 'mono tv-lado__rotulo', 'Na planilha'));
      esq.appendChild(el('pre', 'tv-fonte', textoFonte(d.fonte) || '(vazio)'));
      lados.appendChild(esq);
      var dir = el('div', 'tv-lado');
      dir.appendChild(el('p', 'mono tv-lado__rotulo', 'Na TV com a IA'));
      if (s && s.ia) dir.appendChild(previaIA(s.ia));
      else dir.appendChild(el('p', 'linhas__vazio', d.temTreino ? 'Toque em "Ler a semana com IA".' : 'Nada para organizar.'));
      lados.appendChild(dir);
      card.appendChild(lados);

      if (s && s.alertas && s.alertas.length && s.valido) {
        var al = el('ul', 'tv-alertas');
        s.alertas.forEach(function (a) { al.appendChild(el('li', null, a)); });
        card.appendChild(al);
      }

      var acoesDia = el('div', 'coach__acoes');
      if (s) {
        var desc = el('button', 'link mono', s.status === 'aprovado' ? 'Voltar para a planilha' : 'Descartar');
        desc.type = 'button';
        desc.addEventListener('click', function () {
          if (!confirmar(desc)) return;
          acao('tv_descartar', { data: d.data }).then(function () { abrirTV(); }).catch(erro);
        });
        acoesDia.appendChild(desc);
      }
      if (s && s.ia && s.valido && s.status !== 'aprovado' && s.ia.partes.length) {
        var ap = el('button', 'btn btn--yellow btn--sm', s.alertas && s.alertas.length ? 'Aprovar mesmo assim' : 'Aprovar');
        ap.type = 'button';
        ap.addEventListener('click', function () {
          ocupado(ap, true);
          acao('tv_aprovar', { datas: [d.data] }).then(function () { msg('Aprovado: já aparece assim na TV.', 'ok'); abrirTV(); })
            .catch(function (e) { erro(e); ocupado(ap, false); });
        });
        acoesDia.appendChild(ap);
        if (!(s.alertas && s.alertas.length)) aprovaveis.push(d.data);
      }
      if (acoesDia.children.length) card.appendChild(acoesDia);
      lista.appendChild(card);
    });

    var todos = $('#tv-aprovar-todos');
    todos.hidden = aprovaveis.length < 2;
    todos.dataset.datas = aprovaveis.join(',');
  }

  function abrirTV() {
    var lista = $('#tv-dias');
    if (!ultimaTV) { lista.textContent = ''; lista.appendChild(el('p', 'linhas__vazio', 'Lendo a planilha…')); }
    return api('GET', null, '?acao=tv' + (semanaTV ? '&semana=' + semanaTV : '')).then(desenharTV).catch(erro);
  }

  $('#tv-ant').addEventListener('click', function () { if (semanaTV) { semanaTV = somaDias(semanaTV, -7); abrirTV(); } });
  $('#tv-prox').addEventListener('click', function () { if (semanaTV) { semanaTV = somaDias(semanaTV, 7); abrirTV(); } });
  $('#tv-ler').addEventListener('click', function () {
    var b = this;
    ocupado(b, true);
    msg('A IA está lendo a semana. Isso leva uns segundos…');
    acao('tv_ler', { semana: semanaTV }).then(function (j) {
      desenharTV(j);
      msg(j.lidos ? 'Pronto: confira cada dia e aprove.' : 'Nenhum dia com treino para organizar nesta semana.', 'ok');
    }).catch(erro).then(function () { ocupado(b, false); });
  });
  $('#tv-aprovar-todos').addEventListener('click', function () {
    var b = this, datas = (b.dataset.datas || '').split(',').filter(Boolean);
    if (!datas.length) return;
    ocupado(b, true);
    acao('tv_aprovar', { datas: datas }).then(function () { msg('Dias aprovados: já aparecem assim na TV.', 'ok'); abrirTV(); })
      .catch(erro).then(function () { ocupado(b, false); });
  });

  // ---------- rotas ----------
  function mostrar(vista, aba) {
    $$('.vista').forEach(function (v) { v.hidden = v.id !== 'v-' + vista; });
    $$('.coach__abas a').forEach(function (a) { a.classList.toggle('ativa', a.dataset.aba === aba); });
  }

  function rota() {
    if (!R) return;
    var h = location.hash;
    var m;
    if ((m = h.match(/^#aluno\/(.+)$/))) { mostrar('aluno', 'alunos'); abrirAluno(m[1]); }
    else if ((m = h.match(/^#template\/(.+)$/))) { mostrar('editor', 'templates'); abrirEditor(m[1]); }
    else if (h === '#templates') { mostrar('templates', 'templates'); desenharTemplates(); }
    else if (h === '#tv') { mostrar('tv', 'tv'); abrirTV(); }
    else { mostrar('alunos', 'alunos'); desenharAlunos(); }
    window.scrollTo(0, 0);
  }

  // recarrega o resumo; "quieto" = só atualiza os dados sem trocar de tela
  function atualizar(quieto) {
    return carregarResumo().then(function () { if (!quieto) rota(); });
  }

  // aviso que deve aparecer depois de trocar de tela (a troca limpa o aviso anterior)
  var avisoDepois = null;
  function irPara(hash, texto) { avisoDepois = texto; location.hash = hash; }
  window.addEventListener('hashchange', function () {
    msg(avisoDepois || '', avisoDepois ? 'ok' : '');
    avisoDepois = null;
    rota();
  });

  $('#sair').addEventListener('click', function () {
    // apaga também os dados guardados no aparelho para usar sem internet
    var limpar = window.ftPwa ? window.ftPwa.limpar() : Promise.resolve();
    limpar.then(function () { return fetch('/api/auth/sair', { method: 'POST', credentials: 'same-origin' }); })
      .catch(function () {}).then(function () { location.replace('/'); });
  });

  carregarResumo().then(rota).catch(function (e) {
    mostrar('alunos', 'alunos');
    $('#stats').textContent = '';
    msg(e.message, 'erro');
    if (e.status === 403) {
      var a = el('a', 'btn btn--ghost', 'Ir para Meus treinos');
      a.href = '/aluno';
      $('#v-alunos').prepend(a);
    }
  });
})();

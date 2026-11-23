/* Área do aluno: treinos da semana montados pelo coach (seg → dom). */
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var MODALIDADE = { musculacao: 'Musculação', corrida: 'Corrida', hyrox: 'Hyrox', outro: 'Treino' };

  var semana = null; // segunda-feira mostrada (AAAA-MM-DD); null = semana atual
  var hoje = null;
  var consentido = false; // já concordou em guardar os registros (LGPD)?

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  var data = function (iso) { return new Date(iso + 'T12:00:00Z'); };
  function somaDias(iso, n) { var d = data(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function curta(iso) { var d = data(iso); return d.getUTCDate() + ' ' + MESES[d.getUTCMonth()]; }

  function segundos(s) {
    s = +s;
    if (!s) return '';
    if (s < 60) return s + 's';
    return Math.floor(s / 60) + "'" + (s % 60 ? (s % 60 < 10 ? '0' : '') + (s % 60) + '"' : '');
  }

  // "Elevação pélvica · Barra · 5 x 15 · 40 kg"
  function linhaAtividade(a) {
    var p = [a.nome || 'Atividade'];
    if (a.equipamento) p.push(a.equipamento);
    if (a.series && a.reps) p.push(a.series + ' x ' + a.reps);
    else if (a.reps) p.push(a.reps + ' reps');
    else if (a.series) p.push(a.series + ' séries');
    if (a.carga) p.push(a.carga);
    if (a.distancia_m) p.push(a.distancia_m >= 1000 ? (a.distancia_m / 1000).toString().replace('.', ',') + ' km' : a.distancia_m + ' m');
    if (a.tempo_s) p.push(segundos(a.tempo_s));
    if (a.descanso_s) p.push((/^descanso$/i.test(p[0]) ? '' : 'descanso ') + segundos(a.descanso_s));
    return p.join(' · ');
  }

  function cartaoTreino(t) {
    var c = el('article', 'treino' + (t.registro ? ' treino--feito' : ''));
    var topo = el('div', 'treino__topo');
    topo.appendChild(el('span', 'treino__modalidade mono', MODALIDADE[t.modalidade] || 'Treino'));
    if (t.registro) topo.appendChild(el('span', 'treino__feito mono', '✓ Feito'));
    c.appendChild(topo);
    c.appendChild(el('h3', null, t.nome));
    if (t.tipo) c.appendChild(el('p', 'treino__tipo', t.tipo));

    var e = t.estrutura || {};
    if (e.aquecimento_min) c.appendChild(el('p', 'treino__extra mono', 'Aquecimento · ' + e.aquecimento_min + ' min'));
    (e.blocos || []).forEach(function (b) {
      var bloco = el('div', 'treino__bloco');
      if (+b.repetir > 1) bloco.appendChild(el('p', 'treino__repetir mono', b.repetir + 'x'));
      var ul = el('ul');
      (b.atividades || []).forEach(function (a) {
        var li = el('li', null, linhaAtividade(a));
        if (a.obs) li.appendChild(el('small', null, a.obs));
        ul.appendChild(li);
      });
      bloco.appendChild(ul);
      c.appendChild(bloco);
    });
    if (e.desaquecimento_min) c.appendChild(el('p', 'treino__extra mono', 'Desaquecimento · ' + e.desaquecimento_min + ' min'));
    if (t.observacoes) c.appendChild(el('p', 'treino__obs', t.observacoes));
    c.appendChild(areaFeito(t));
    return c;
  }

  // ---------- marcar como feito ----------
  function num(v) { return v == null ? '' : String(v).replace('.', ','); }

  function resumoRegistro(r) {
    var p = [];
    if (r.esforco) p.push('esforço ' + r.esforco + '/10');
    if (r.duracao_min) p.push(r.duracao_min + ' min');
    if (r.distancia_km) p.push(num(r.distancia_km) + ' km');
    return p.join(' · ');
  }

  function areaFeito(t) {
    var area = el('div', 'feito');
    if (t.registro) {
      var r = t.registro;
      var linha = el('div', 'feito__resumo');
      linha.appendChild(el('span', 'mono', '✓ ' + (resumoRegistro(r) || 'Feito')));
      var editar = el('button', 'link mono', 'Editar');
      editar.type = 'button';
      editar.addEventListener('click', function () { area.replaceWith(formFeito(t)); });
      linha.appendChild(editar);
      area.appendChild(linha);
      if (r.comentario) area.appendChild(el('p', 'feito__coment', '“' + r.comentario + '”'));
      return area;
    }
    if (t.data > hoje) { area.appendChild(el('p', 'feito__depois mono', 'Marque como feito no dia')); return area; }
    var b = el('button', 'btn btn--yellow feito__btn', 'Marcar como feito');
    b.type = 'button';
    b.addEventListener('click', function () { area.replaceWith(formFeito(t)); });
    area.appendChild(b);
    return area;
  }

  function campo(rotulo, input) {
    var l = el('label', 'feito__campo');
    l.appendChild(el('span', 'mono', rotulo));
    l.appendChild(input);
    return l;
  }

  function formFeito(t) {
    var r = t.registro || {};
    var f = el('form', 'feito feito--form');
    f.noValidate = true;

    var escala = el('fieldset', 'esforco');
    escala.appendChild(el('legend', 'mono', 'Esforço (1 = leve · 10 = máximo)'));
    var notas = el('div', 'esforco__notas');
    for (var i = 1; i <= 10; i++) {
      var op = el('label', 'esforco__nota');
      var radio = el('input');
      radio.type = 'radio'; radio.name = 'esforco'; radio.value = i;
      if (+r.esforco === i) radio.checked = true;
      op.appendChild(radio);
      op.appendChild(el('span', null, String(i)));
      notas.appendChild(op);
    }
    escala.appendChild(notas);
    f.appendChild(escala);

    var linha = el('div', 'feito__linha');
    var tempo = el('input'); tempo.name = 'duracao_min'; tempo.type = 'number'; tempo.min = 1; tempo.max = 1440; tempo.inputMode = 'numeric'; tempo.placeholder = '45'; tempo.value = r.duracao_min || '';
    linha.appendChild(campo('Tempo (min)', tempo));
    if (t.modalidade === 'corrida' || t.modalidade === 'hyrox' || r.distancia_km) {
      var dist = el('input'); dist.name = 'distancia_km'; dist.inputMode = 'decimal'; dist.placeholder = '5,2'; dist.value = num(r.distancia_km);
      linha.appendChild(campo('Distância (km)', dist));
    }
    f.appendChild(linha);

    var coment = el('textarea'); coment.name = 'comentario'; coment.rows = 2; coment.maxLength = 2000;
    coment.placeholder = 'Como foi? Carga que usou, dor, o que achou… (opcional)';
    coment.value = r.comentario || '';
    f.appendChild(campo('Comentário para o coach', coment));

    if (!consentido) {
      var ok = el('label', 'feito__consentimento');
      var cb = el('input'); cb.type = 'checkbox'; cb.name = 'consentimento';
      ok.appendChild(cb);
      var txt = el('span', null, 'Concordo que a FT Training guarde esses registros (esforço, tempo e comentários) para acompanhar meus treinos, conforme a ');
      var link = el('a', null, 'Política de Privacidade'); link.href = '/privacidade'; link.target = '_blank'; link.rel = 'noopener';
      txt.appendChild(link);
      txt.appendChild(document.createTextNode('.'));
      ok.appendChild(txt);
      f.appendChild(ok);
    }

    var erro = el('p', 'feito__erro');
    erro.setAttribute('role', 'alert');
    f.appendChild(erro);

    var acoes = el('div', 'feito__acoes');
    if (t.registro) {
      var desfazer = el('button', 'link mono', 'Desmarcar');
      desfazer.type = 'button';
      desfazer.addEventListener('click', function () {
        if (!desfazer.dataset.confirma) {
          desfazer.dataset.confirma = '1'; desfazer.textContent = 'Desmarcar mesmo?';
          setTimeout(function () { delete desfazer.dataset.confirma; desfazer.textContent = 'Desmarcar'; }, 3000);
          return;
        }
        enviar({ acao: 'desfazer', treino_id: t.id }, desfazer, erro);
      });
      acoes.appendChild(desfazer);
    }
    var cancelar = el('button', 'btn btn--ghost', 'Cancelar');
    cancelar.type = 'button';
    cancelar.addEventListener('click', function () { f.replaceWith(areaFeito(t)); });
    var salvar = el('button', 'btn btn--yellow', t.registro ? 'Salvar' : 'Feito ✓');
    salvar.type = 'submit';
    acoes.appendChild(cancelar);
    acoes.appendChild(salvar);
    f.appendChild(acoes);

    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var marcado = f.querySelector('input[name=esforco]:checked');
      var dados = {
        acao: 'registrar', treino_id: t.id,
        esforco: marcado ? +marcado.value : null,
        duracao_min: tempo.value,
        distancia_km: f.distancia_km ? f.distancia_km.value : null,
        comentario: coment.value
      };
      if (!consentido) {
        if (!f.consentimento.checked) { erro.textContent = 'Marque a caixa de concordância para salvar.'; return; }
        dados.consentimento = true;
      }
      enviar(dados, salvar, erro);
    });
    return f;
  }

  function enviar(dados, botao, erro) {
    botao.disabled = true;
    erro.textContent = '';
    fetch('/api/aluno', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401) { location.replace('/entrar?volta=/aluno'); return; }
        if (!r.ok) throw new Error(j.erro || 'Não consegui salvar. Tente de novo.');
        if (dados.consentimento) consentido = true;
        carregar();
      });
    }).catch(function (e) {
      erro.textContent = e.message || 'Sem conexão. Tente de novo.';
      botao.disabled = false;
    });
  }

  function mostrar(j) {
    hoje = j.hoje;
    consentido = !!j.perfil.consentimento;
    var nome = (j.perfil.nome || '').split(' ')[0];
    $('#ola').textContent = nome ? 'Olá, ' + nome : 'Olá!';
    $('#periodo').textContent = curta(j.semana.de) + ' – ' + curta(j.semana.ate);
    var atual = j.semana.de <= hoje && hoje <= j.semana.ate;
    $('#semana-rotulo').textContent = atual ? 'Esta semana' : (j.semana.de > hoje ? 'Próxima' : 'Anterior');

    var porDia = {};
    j.treinos.forEach(function (t) { (porDia[t.data] = porDia[t.data] || []).push(t); });

    var dias = $('#dias');
    dias.textContent = '';
    for (var i = 0; i < 7; i++) {
      var iso = somaDias(j.semana.de, i);
      var sec = el('section', 'dia' + (iso === hoje ? ' dia--hoje' : '') + (iso < hoje ? ' dia--passado' : ''));
      var cab = el('header', 'dia__cab');
      cab.appendChild(el('h2', null, DIAS[data(iso).getUTCDay()]));
      cab.appendChild(el('span', 'mono', iso === hoje ? 'Hoje · ' + curta(iso) : curta(iso)));
      sec.appendChild(cab);
      var lista = porDia[iso] || [];
      if (!lista.length) sec.appendChild(el('p', 'dia__vazio', 'Sem treino marcado'));
      lista.forEach(function (t) { sec.appendChild(cartaoTreino(t)); });
      dias.appendChild(sec);
    }
    var h = dias.querySelector('.dia--hoje');
    if (h && atual && !mostrar.rolou) { mostrar.rolou = true; h.scrollIntoView({ block: 'start' }); }
  }

  function aviso(msg, comBotao) {
    var dias = $('#dias');
    dias.textContent = '';
    var p = el('p', 'aluno__aviso', msg);
    dias.appendChild(p);
    if (comBotao) {
      var a = el('a', 'btn btn--yellow', 'Entrar');
      a.href = '/entrar?volta=/aluno';
      dias.appendChild(a);
    }
  }

  function carregar() {
    var url = '/api/aluno' + (semana ? '?semana=' + semana : '');
    fetch(url, { credentials: 'same-origin', cache: 'no-store' }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401) { location.replace('/entrar?volta=/aluno'); return; }
        if (!r.ok) { aviso(j.erro || 'Não consegui carregar os treinos agora.', r.status === 403); return; }
        semana = j.semana.de;
        mostrar(j);
      });
    }).catch(function () { aviso('Sem conexão. Confira a internet e tente de novo.'); });
  }

  $('#anterior').addEventListener('click', function () { if (semana) { semana = somaDias(semana, -7); carregar(); } });
  $('#proxima').addEventListener('click', function () { if (semana) { semana = somaDias(semana, 7); carregar(); } });
  $('#sair').addEventListener('click', function () {
    fetch('/api/auth/sair', { method: 'POST', credentials: 'same-origin' }).then(function () { location.replace('/'); });
  });

  carregar();
})();

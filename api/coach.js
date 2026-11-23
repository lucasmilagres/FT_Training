// /api/coach — painel do coach. Só para a equipe: perfil ativo com papel admin ou coach.
//   admin: vê e gerencia todos os alunos, libera pedidos de acesso, convida coach/admin.
//   coach: só os alunos ligados a ele; convida alunos para si mesmo.
// Uma função só (o plano Hobby da Vercel tem limite de funções):
//   GET  ?acao=resumo
//   GET  ?acao=semana&aluno=ID&semana=AAAA-MM-DD
//   GET  ?acao=template&id=ID
//   GET  ?acao=tv&semana=AAAA-MM-DD   (treinos da TV: planilha × versão da IA)
//   POST { acao: convidar | cancelar_convite | liberar | desativar | salvar_template |
//          arquivar_template | agendar | remover_treino | copiar_semana |
//          tv_ler | tv_aprovar | tv_descartar, ... }
const { sessaoEmail, emailsLiberados, json } = require('./_lib/sessao');
const { hojeISO } = require('./_lib/planilha');
const { dataOk, somaDias, segunda, diasEntre } = require('./_lib/datas');
const banco = require('./_lib/banco');
const tvia = require('./_lib/tvia');
const gemini = require('./_lib/gemini');
const { treinosDaData } = require('./_lib/fonte');

const MODALIDADES = ['musculacao', 'corrida', 'hyrox', 'outro'];
const PAPEIS = ['admin', 'coach', 'aluno'];
const uuidOk = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ''));
const emailOk = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const q = encodeURIComponent;

function falha(status, msg) { const e = new Error(msg); e.status = status; return e; }
const texto = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
function inteiro(v, min, max) {
  if (v === '' || v == null) return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

// ---------- quem está logado ----------
async function equipeLogada(req, res) {
  const email = sessaoEmail(req, res);
  if (!email) throw falha(401, 'Faça login para abrir o painel.');
  let eu = await banco.perfilPorEmail(email);
  // quem entrou pelo código do e-mail ainda pode não ter perfil: cria (usa o convite, se houver)
  if (!eu && emailsLiberados().includes(email)) eu = await banco.entrarComGoogle(email, '');
  if (!eu || !eu.ativo || !['admin', 'coach'].includes(eu.papel)) throw falha(403, 'O painel é só para a equipe da FT.');
  return eu;
}

const ehAdmin = (eu) => eu.papel === 'admin';

async function alunoGerido(eu, id) {
  if (!uuidOk(id)) throw falha(400, 'Aluno inválido.');
  const a = await banco.um('perfis', 'select=id,email,nome,papel,coach_id,ativo&id=eq.' + id);
  if (!a) throw falha(404, 'Aluno não encontrado.');
  if (!ehAdmin(eu) && a.coach_id !== eu.id) throw falha(403, 'Esse aluno é de outro coach.');
  return a;
}

async function membroDaEquipe(id) {
  if (!uuidOk(id)) return null;
  return banco.um('perfis', 'select=id&ativo=eq.true&papel=in.(admin,coach)&id=eq.' + id);
}

// ---------- estrutura do treino (vem do editor; nada passa sem limpar) ----------
function limparEstrutura(e) {
  e = e && typeof e === 'object' ? e : {};
  const s = { blocos: [] };
  const aq = inteiro(e.aquecimento_min, 1, 180), dq = inteiro(e.desaquecimento_min, 1, 180);
  if (aq) s.aquecimento_min = aq;
  if (dq) s.desaquecimento_min = dq;
  (Array.isArray(e.blocos) ? e.blocos : []).slice(0, 30).forEach((b) => {
    const atividades = (Array.isArray(b && b.atividades) ? b.atividades : []).slice(0, 40).map((a) => {
      a = a || {};
      const x = { nome: texto(a.nome, 120) };
      [['equipamento', 60], ['carga', 60], ['obs', 300]].forEach(([k, max]) => { const v = texto(a[k], max); if (v) x[k] = v; });
      [['series', 100], ['reps', 1000], ['tempo_s', 86400], ['distancia_m', 100000], ['descanso_s', 3600]].forEach(([k, max]) => {
        const v = inteiro(a[k], 1, max); if (v) x[k] = v;
      });
      return x;
    }).filter((a) => a.nome || a.descanso_s);
    if (atividades.length) s.blocos.push({ repetir: inteiro(b.repetir, 1, 50) || 1, atividades });
  });
  return s;
}

function limparTemplate(t) {
  const nome = texto(t.nome, 120);
  if (!nome) throw falha(400, 'Dê um nome ao treino.');
  const modalidade = MODALIDADES.includes(t.modalidade) ? t.modalidade : null;
  if (!modalidade) throw falha(400, 'Escolha a modalidade.');
  return {
    nome, modalidade,
    nome_tecnico: texto(t.nome_tecnico, 120) || null,
    tipo: texto(t.tipo, 60) || null,
    observacoes: texto(t.observacoes, 2000) || null,
    estrutura: limparEstrutura(t.estrutura)
  };
}

// ---------- leituras ----------
async function resumo(eu) {
  const admin = ehAdmin(eu);
  const de = segunda(hojeISO()), ate = somaDias(de, 6);
  const meus = admin ? '' : '&coach_id=eq.' + eu.id;

  const [alunos, equipe, convites, templates, exercicios, pedidos] = await Promise.all([
    banco.ler('perfis', 'select=id,email,nome,coach_id,ultimo_acesso_em,criado_em&papel=eq.aluno&ativo=eq.true' + meus + '&order=nome.asc'),
    banco.ler('perfis', 'select=id,nome,email,papel&ativo=eq.true&papel=in.(admin,coach)&order=nome.asc'),
    banco.ler('convites', 'select=email,nome,papel,coach_id,criado_em' + meus + '&order=criado_em.desc'),
    banco.ler('templates', 'select=id,nome,nome_tecnico,modalidade,tipo,atualizado_em&ativo=eq.true&order=nome.asc'),
    banco.ler('exercicios', 'select=nome&order=nome.asc'),
    admin ? banco.ler('perfis', 'select=id,email,nome,papel,criado_em,ultimo_acesso_em&ativo=eq.false&order=criado_em.desc') : []
  ]);

  const semana = alunos.length
    ? await banco.ler('treinos', 'select=aluno_id,registros(treino_id)&data=gte.' + de + '&data=lte.' + ate + '&aluno_id=in.(' + alunos.map((a) => a.id).join(',') + ')')
    : [];
  const conta = {};
  banco.comRegistro(semana).forEach((t) => {
    const c = conta[t.aluno_id] = conta[t.aluno_id] || { treinos: 0, feitos: 0 };
    c.treinos++; if (t.registro) c.feitos++;
  });

  return {
    eu: { id: eu.id, nome: eu.nome, email: eu.email, papel: eu.papel },
    hoje: hojeISO(), semana: { de, ate },
    alunos: alunos.map((a) => ({ ...a, semana: conta[a.id] || { treinos: 0, feitos: 0 } })),
    equipe, convites, templates, pedidos,
    exercicios: exercicios.map((x) => x.nome)
  };
}

async function semanaDoAluno(eu, alunoId, pedida) {
  const aluno = await alunoGerido(eu, alunoId);
  const de = segunda(dataOk(pedida) ? pedida : hojeISO()), ate = somaDias(de, 6);
  const treinos = await banco.treinosDoAluno(aluno.id, de, ate);
  return { aluno, hoje: hojeISO(), semana: { de, ate }, treinos: banco.comRegistro(treinos) };
}

async function template(id) {
  if (!uuidOk(id)) throw falha(400, 'Template inválido.');
  const t = await banco.um('templates', 'select=*&id=eq.' + id);
  if (!t) throw falha(404, 'Template não encontrado.');
  return { template: t };
}

// ---------- TV: semana da planilha + versão organizada pela IA ----------
async function tvSemana(pedida) {
  const de = segunda(dataOk(pedida) ? pedida : hojeISO());
  const dias = await tvia.semanaDaPlanilha(de);
  const salvos = await tvia.salvos(dias.map((d) => d.data));
  return {
    hoje: hojeISO(), semana: { de, ate: somaDias(de, 4) }, iaConfigurada: gemini.configurado(),
    dias: dias.map((d) => {
      const s = salvos[d.data];
      return {
        data: d.data, erro: d.erro || null, fonte: d.fonte || null, temTreino: !!(d.fonte && tvia.temTreino(d.fonte)),
        salvo: s ? {
          status: s.status, ia: s.ia, alertas: s.alertas || [], modelo: s.modelo,
          gerado_em: s.gerado_em, aprovado_em: s.aprovado_em, valido: s.hash === d.hash
        } : null
      };
    })
  };
}

// ---------- ações ----------
const acoes = {
  async tv_ler(eu, b) {
    const de = segunda(dataOk(b.semana) ? b.semana : hojeISO());
    const dias = await tvia.semanaDaPlanilha(de);
    const resultado = await tvia.organizar(dias);
    const lidos = await tvia.salvarRascunhos(dias, resultado);
    return { ...(await tvSemana(de)), lidos };
  },

  async tv_aprovar(eu, b) {
    const datas = (Array.isArray(b.datas) ? b.datas : [b.data]).filter(dataOk).slice(0, 7);
    if (!datas.length) throw falha(400, 'Escolha o dia.');
    const salvos = await tvia.salvos(datas);
    for (const data of datas) {
      const s = salvos[data];
      if (!s || !s.ia) throw falha(404, 'Esse dia ainda não foi lido pela IA.');
      // a planilha pode ter mudado depois da leitura: aí precisa ler de novo
      const atual = tvia.hashDe(tvia.fonteDe(await treinosDaData(data)));
      if (atual !== s.hash) throw falha(409, 'A planilha mudou depois da leitura. Leia a semana de novo.');
    }
    await banco.atualizar('tv_dias', 'data=in.(' + datas.join(',') + ')',
      { status: 'aprovado', aprovado_em: new Date().toISOString(), aprovado_por: eu.id });
    return { ok: true, aprovados: datas.length };
  },

  async tv_descartar(eu, b) {
    if (!dataOk(b.data)) throw falha(400, 'Data inválida.');
    await banco.apagar('tv_dias', 'data=eq.' + b.data);
    return { ok: true };
  },

  async convidar(eu, b) {
    const email = texto(b.email, 200).toLowerCase();
    if (!emailOk(email)) throw falha(400, 'Digite um e-mail válido (o da conta Google do aluno).');
    const nome = texto(b.nome, 120);
    let papel = 'aluno', coachId = eu.id;
    if (ehAdmin(eu)) {
      papel = PAPEIS.includes(b.papel) ? b.papel : 'aluno';
      coachId = papel === 'aluno' ? (b.coach_id || eu.id) : null;
      if (coachId && !(await membroDaEquipe(coachId))) throw falha(400, 'Coach inválido.');
    }
    const ja = await banco.perfilPorEmail(email);
    if (ja && ja.ativo) {
      throw falha(409, ehAdmin(eu) ? 'Essa pessoa já tem acesso.' : 'Essa pessoa já tem acesso. Peça a um admin para mudar o coach dela.');
    }
    await banco.apagar('convites', 'email=eq.' + q(email));
    const criado = await banco.inserir('convites', { email, nome, papel, coach_id: coachId, criado_por: eu.id });
    // sem linha de volta = a pessoa já tinha entrado antes e o convite liberou o acesso na hora
    return { ok: true, liberado: criado.length === 0 };
  },

  async cancelar_convite(eu, b) {
    const email = texto(b.email, 200).toLowerCase();
    const filtro = 'email=eq.' + q(email) + (ehAdmin(eu) ? '' : '&coach_id=eq.' + eu.id);
    const apagados = await banco.apagar('convites', filtro);
    if (!apagados.length) throw falha(404, 'Convite não encontrado.');
    return { ok: true };
  },

  async liberar(eu, b) {
    if (!ehAdmin(eu)) throw falha(403, 'Só um admin libera pedidos de acesso.');
    if (!uuidOk(b.id)) throw falha(400, 'Pedido inválido.');
    const papel = PAPEIS.includes(b.papel) ? b.papel : 'aluno';
    const coachId = papel === 'aluno' ? (b.coach_id || eu.id) : null;
    if (coachId && !(await membroDaEquipe(coachId))) throw falha(400, 'Coach inválido.');
    const r = await banco.atualizar('perfis', 'id=eq.' + b.id, { ativo: true, papel, coach_id: coachId });
    if (!r.length) throw falha(404, 'Pedido não encontrado.');
    return { ok: true };
  },

  async desativar(eu, b) {
    if (b.id === eu.id) throw falha(400, 'Você não pode tirar o próprio acesso.');
    const a = await alunoGerido(eu, b.id);
    if (a.papel !== 'aluno' && !ehAdmin(eu)) throw falha(403, 'Só um admin mexe no acesso da equipe.');
    await banco.atualizar('perfis', 'id=eq.' + a.id, { ativo: false });
    return { ok: true };
  },

  async salvar_template(eu, b) {
    const campos = limparTemplate(b);
    if (b.id) {
      if (!uuidOk(b.id)) throw falha(400, 'Template inválido.');
      const r = await banco.atualizar('templates', 'id=eq.' + b.id, campos);
      if (!r.length) throw falha(404, 'Template não encontrado.');
      return { template: r[0] };
    }
    const r = await banco.inserir('templates', { ...campos, criado_por: eu.id });
    return { template: r[0] };
  },

  async arquivar_template(eu, b) {
    if (!uuidOk(b.id)) throw falha(400, 'Template inválido.');
    await banco.atualizar('templates', 'id=eq.' + b.id, { ativo: false });
    return { ok: true };
  },

  async agendar(eu, b) {
    const aluno = await alunoGerido(eu, b.aluno_id);
    if (!dataOk(b.data)) throw falha(400, 'Data inválida.');
    const { template: t } = await template(b.template_id);
    const doDia = await banco.ler('treinos', 'select=id&aluno_id=eq.' + aluno.id + '&data=eq.' + b.data);
    const r = await banco.inserir('treinos', {
      aluno_id: aluno.id, data: b.data, ordem: doDia.length, template_id: t.id,
      nome: t.nome, modalidade: t.modalidade, tipo: t.tipo, estrutura: t.estrutura,
      observacoes: t.observacoes, criado_por: eu.id
    });
    return { treino: r[0] };
  },

  async remover_treino(eu, b) {
    if (!uuidOk(b.id)) throw falha(400, 'Treino inválido.');
    const t = await banco.um('treinos', 'select=id,aluno_id&id=eq.' + b.id);
    if (!t) throw falha(404, 'Treino não encontrado.');
    await alunoGerido(eu, t.aluno_id);
    await banco.apagar('treinos', 'id=eq.' + t.id);
    return { ok: true };
  },

  async copiar_semana(eu, b) {
    const aluno = await alunoGerido(eu, b.aluno_id);
    if (!dataOk(b.de) || !dataOk(b.para)) throw falha(400, 'Semana inválida.');
    const de = segunda(b.de), para = segunda(b.para);
    if (de === para) throw falha(400, 'Escolha outra semana para copiar.');
    const origem = await banco.ler('treinos',
      'select=data,ordem,template_id,nome,modalidade,tipo,estrutura,observacoes&aluno_id=eq.' + aluno.id +
      '&data=gte.' + de + '&data=lte.' + somaDias(de, 6) + '&order=data.asc,ordem.asc');
    if (!origem.length) throw falha(400, 'Essa semana não tem treinos para copiar.');
    const desloca = diasEntre(de, para);
    const destino = await banco.ler('treinos', 'select=data&aluno_id=eq.' + aluno.id + '&data=gte.' + para + '&data=lte.' + somaDias(para, 6));
    const jaTem = {};
    destino.forEach((t) => { jaTem[t.data] = (jaTem[t.data] || 0) + 1; });
    await banco.inserir('treinos', origem.map((t) => {
      const data = somaDias(t.data, desloca);
      return {
        aluno_id: aluno.id, data, ordem: (jaTem[data] || 0) + t.ordem, template_id: t.template_id,
        nome: t.nome, modalidade: t.modalidade, tipo: t.tipo, estrutura: t.estrutura,
        observacoes: t.observacoes, criado_por: eu.id
      };
    }));
    return { ok: true, copiados: origem.length };
  }
};

module.exports = async function (req, res) {
  try {
    const eu = await equipeLogada(req, res);
    if (req.method === 'GET') {
      const p = new URL(req.url, 'http://x').searchParams;
      const acao = p.get('acao') || 'resumo';
      if (acao === 'resumo') return json(res, 200, await resumo(eu));
      if (acao === 'semana') return json(res, 200, await semanaDoAluno(eu, p.get('aluno'), p.get('semana')));
      if (acao === 'template') return json(res, 200, await template(p.get('id')));
      if (acao === 'tv') return json(res, 200, await tvSemana(p.get('semana')));
      return json(res, 400, { erro: 'Ação desconhecida.' });
    }
    if (req.method === 'POST') {
      const b = req.body && typeof req.body === 'object' ? req.body : {};
      const fn = Object.prototype.hasOwnProperty.call(acoes, b.acao) ? acoes[b.acao] : null;
      if (!fn) return json(res, 400, { erro: 'Ação desconhecida.' });
      return json(res, 200, await fn(eu, b));
    }
    return json(res, 405, { erro: 'Método não permitido' });
  } catch (e) {
    if (!e.status) console.error('coach:', e);
    return json(res, e.status || 500, { erro: e.status ? e.message : 'Algo deu errado no servidor.' });
  }
};

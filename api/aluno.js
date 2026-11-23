// /api/aluno — área do aluno. Só o próprio perfil, e só se estiver ativo (liberado pelo coach).
//   GET  [?semana=AAAA-MM-DD] → quem está logado + os treinos da semana dele (seg → dom)
//   POST { acao: 'registrar', treino_id, esforco, duracao_min, distancia_km, comentario, consentimento }
//        → marca o treino como feito (ou corrige o que já foi marcado)
//   POST { acao: 'desfazer', treino_id } → desmarca
// Esforço, tempo e comentário são dados de saúde (LGPD): no 1º registro o aluno precisa
// concordar; a data do aceite fica em perfis.consentimento_saude_em.
const { sessaoEmail, json } = require('./_lib/sessao');
const { hojeISO } = require('./_lib/planilha');
const banco = require('./_lib/banco');
const { dataOk, segunda, somaDias } = require('./_lib/datas');
const push = require('./_lib/push');

function falha(status, msg) { const e = new Error(msg); e.status = status; return e; }
const uuidOk = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ''));

// número opcional dentro de um intervalo; aceita vírgula ("5,2"). Vazio = null; fora do intervalo = erro.
function numero(v, min, max, casas, nome) {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < min || n > max) throw falha(400, `${nome} deve ficar entre ${min} e ${max}.`);
  const f = Math.pow(10, casas);
  return Math.round(n * f) / f;
}

async function alunoLogado(req, res) {
  const email = sessaoEmail(req, res);
  if (!email) throw falha(401, 'Faça login para ver os seus treinos.');
  const perfil = await banco.perfilPorEmail(email);
  if (!perfil || !perfil.ativo) throw falha(403, 'O seu acesso ainda não foi liberado. Fale com o seu coach.');
  return perfil;
}

async function treinoDoAluno(perfil, id) {
  if (!uuidOk(id)) throw falha(400, 'Treino inválido.');
  const t = await banco.um('treinos', 'select=id,data,nome&aluno_id=eq.' + perfil.id + '&id=eq.' + id);
  if (!t) throw falha(404, 'Treino não encontrado.');
  return t;
}

async function semana(perfil, pedida) {
  const hoje = hojeISO();
  const de = segunda(dataOk(pedida) ? pedida : hoje), ate = somaDias(de, 6);
  const treinos = await banco.treinosDoAluno(perfil.id, de, ate);
  return {
    perfil: { nome: perfil.nome, papel: perfil.papel, consentimento: !!perfil.consentimento_saude_em },
    hoje, semana: { de, ate },
    treinos: banco.comRegistro(treinos)
  };
}

const acoes = {
  async registrar(perfil, b) {
    const t = await treinoDoAluno(perfil, b.treino_id);
    if (t.data > hojeISO()) throw falha(400, 'Esse treino ainda não chegou. Marque no dia.');

    // valida tudo antes de gravar qualquer coisa (inclusive o aceite)
    const linha = {
      treino_id: t.id, aluno_id: perfil.id,
      esforco: numero(b.esforco, 1, 10, 0, 'O esforço'),
      duracao_min: numero(b.duracao_min, 1, 1440, 0, 'O tempo'),
      distancia_km: numero(b.distancia_km, 0.01, 1000, 2, 'A distância'),
      comentario: String(b.comentario == null ? '' : b.comentario).trim().slice(0, 2000) || null
    };
    if (!perfil.consentimento_saude_em) {
      if (b.consentimento !== true) throw falha(400, 'Para registrar, confirme que concorda com o uso dos seus dados de treino.');
      await banco.atualizar('perfis', 'id=eq.' + perfil.id, { consentimento_saude_em: new Date().toISOString() });
    }
    const jaTinha = await banco.um('registros', 'select=treino_id&treino_id=eq.' + t.id);
    const r = await banco.upsert('registros', linha, 'treino_id');
    // avisa o coach só na 1ª vez (editar não repete). Sem o comentário: fica só no painel.
    if (!jaTinha && perfil.coach_id) {
      await push.avisar([perfil.coach_id], {
        titulo: (perfil.nome || 'Aluno').split(' ')[0] + ' treinou ✓',
        texto: t.nome + (linha.esforco ? ' · esforço ' + linha.esforco + '/10' : '') + (linha.comentario ? ' · deixou um comentário' : ''),
        url: '/coach#aluno/' + perfil.id, tag: 'feito-' + t.id
      });
    }
    return { registro: r[0] || linha };
  },

  async desfazer(perfil, b) {
    const t = await treinoDoAluno(perfil, b.treino_id);
    await banco.apagar('registros', 'treino_id=eq.' + t.id + '&aluno_id=eq.' + perfil.id);
    return { ok: true };
  }
};

module.exports = async function (req, res) {
  try {
    const perfil = await alunoLogado(req, res);
    if (req.method === 'GET') {
      return json(res, 200, await semana(perfil, new URL(req.url, 'http://x').searchParams.get('semana')));
    }
    if (req.method === 'POST') {
      const b = req.body && typeof req.body === 'object' ? req.body : {};
      const fn = Object.prototype.hasOwnProperty.call(acoes, b.acao) ? acoes[b.acao] : null;
      if (!fn) return json(res, 400, { erro: 'Ação desconhecida.' });
      return json(res, 200, await fn(perfil, b));
    }
    return json(res, 405, { erro: 'Método não permitido' });
  } catch (e) {
    if (!e.status) console.error('aluno:', e);
    return json(res, e.status || 500, { erro: e.status ? e.message : 'Algo deu errado no servidor.' });
  }
};

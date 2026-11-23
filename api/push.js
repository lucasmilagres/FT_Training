// /api/push — notificações do app
//   GET                       → { configurado, chave } (chave pública VAPID para o navegador)
//   POST { acao: 'inscrever', inscricao, aparelho }  (logado, perfil ativo)
//   POST { acao: 'cancelar', endpoint }               (logado)
//   GET  ?acao=lembrete        → lembrete da manhã para quem tem treino hoje e ainda não marcou.
//        Chamado pelo cron da Vercel (vercel.json), que manda "Authorization: Bearer CRON_SECRET".
const { sessaoEmail, json, iguais } = require('./_lib/sessao');
const { hojeISO } = require('./_lib/planilha');
const banco = require('./_lib/banco');
const push = require('./_lib/push');

function falha(status, msg) { const e = new Error(msg); e.status = status; return e; }

async function perfilLogado(req, res) {
  const email = sessaoEmail(req, res);
  if (!email) throw falha(401, 'Faça login para ativar as notificações.');
  const p = await banco.perfilPorEmail(email);
  if (!p || !p.ativo) throw falha(403, 'O seu acesso ainda não foi liberado.');
  return p;
}

async function lembrete(req) {
  const segredo = (process.env.CRON_SECRET || '').trim();
  const veio = String(req.headers.authorization || '');
  if (!segredo || !iguais(veio, 'Bearer ' + segredo)) throw falha(401, 'Não autorizado.');
  const hoje = hojeISO();
  const treinos = banco.comRegistro(await banco.ler('treinos',
    'select=aluno_id,nome,ordem,registros(treino_id)&data=eq.' + hoje + '&order=ordem.asc'));
  const pendentes = {};
  treinos.filter((t) => !t.registro).forEach((t) => { (pendentes[t.aluno_id] = pendentes[t.aluno_id] || []).push(t.nome); });
  const ids = Object.keys(pendentes);
  if (!ids.length) return { hoje, alunos: 0, enviados: 0 };
  const ativos = await banco.ler('perfis', 'select=id&ativo=eq.true&id=in.(' + ids.join(',') + ')');
  let enviados = 0;
  for (const { id } of ativos) {
    const nomes = pendentes[id];
    enviados += await push.avisar([id], {
      titulo: 'Treino de hoje',
      texto: nomes.length > 1 ? nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1] : nomes[0],
      url: '/aluno', tag: 'hoje-' + hoje
    });
  }
  return { hoje, alunos: ativos.length, enviados };
}

module.exports = async function (req, res) {
  try {
    const q = new URL(req.url, 'http://x').searchParams;
    if (req.method === 'GET' && q.get('acao') === 'lembrete') return json(res, 200, await lembrete(req));
    if (req.method === 'GET') return json(res, 200, { configurado: push.configurado(), chave: push.chavePublica() });
    if (req.method !== 'POST') return json(res, 405, { erro: 'Método não permitido' });

    const b = req.body && typeof req.body === 'object' ? req.body : {};
    const eu = await perfilLogado(req, res);
    if (b.acao === 'inscrever') {
      if (!push.configurado()) throw falha(503, 'As notificações ainda não foram configuradas no servidor.');
      await push.inscrever(eu.id, b.inscricao, b.aparelho);
      // ao tocar em "Ativar avisos": confirma na hora (e prova que o caminho até o aparelho funciona)
      let enviados = null;
      if (b.boasVindas === true) {
        enviados = await push.avisar([eu.id], {
          titulo: 'Avisos ligados ✓', texto: 'Você vai receber os avisos da FT Training neste aparelho.',
          url: eu.papel === 'aluno' ? '/aluno' : '/coach', tag: 'boas-vindas'
        });
      }
      return json(res, 200, { ok: true, enviados });
    }
    if (b.acao === 'cancelar') {
      await push.cancelar(eu.id, b.endpoint);
      return json(res, 200, { ok: true });
    }
    return json(res, 400, { erro: 'Ação desconhecida.' });
  } catch (e) {
    if (!e.status) console.error('push:', e);
    return json(res, e.status || 500, { erro: e.status ? e.message : 'Algo deu errado no servidor.' });
  }
};

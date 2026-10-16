// /api/planilha — ligar a planilha de treinos (só logado)
// GET  → planilha ligada hoje + e-mail do robô com quem o coach precisa compartilhar
// POST { url, aba? } → confere o acesso, salva e devolve uma prévia do que o site entendeu
const { usuario, json } = require('./_lib/sessao');
const google = require('./_lib/google');
const { lerConfig, salvarConfig } = require('./_lib/config');
const { hojeISO, treinosDoDia, resumo } = require('./_lib/planilha');
const { limparCache } = require('./_lib/fonte');

module.exports = async function (req, res) {
  let email;
  try { email = usuario(req, res); } catch (e) {
    return json(res, 500, { erro: 'Login ainda não configurado no servidor (SESSION_SECRET).' });
  }
  if (!email) return json(res, 401, { erro: 'Faça login para configurar a planilha.' });

  let robo;
  try { robo = google.emailRobo(); } catch (e) { return json(res, 500, { erro: e.message }); }

  if (req.method === 'GET') {
    let config = null;
    try { config = await lerConfig(); } catch (e) { console.error('config:', e.message); }
    return json(res, 200, { robo, config: config && { url: config.url, nome: config.nome, aba: config.aba, salvoEm: config.salvoEm } });
  }

  if (req.method !== 'POST') return json(res, 405, { erro: 'Método não permitido' });
  if (!robo) return json(res, 503, { erro: 'O robô do Google ainda não foi configurado no servidor.' });

  const url = String((req.body && req.body.url) || '').trim();
  const link = google.lerLink(url);
  if (!link) return json(res, 400, { erro: 'Cole o link da planilha (começa com https://docs.google.com/spreadsheets/d/...).' });

  try {
    const dados = await google.info(link.id);
    const pedida = req.body && req.body.aba;
    const aba = dados.abas.find((a) => a.nome === pedida) || dados.abas.find((a) => a.id === link.gid) || dados.abas[0];
    const linhas = await google.linhas(link.id, aba.nome);
    const hoje = hojeISO();

    const config = { id: link.id, url, nome: dados.nome, aba: aba.nome, salvoEm: new Date().toISOString() };
    await salvarConfig(config);
    limparCache();

    return json(res, 200, {
      ok: true,
      robo,
      config: { url, nome: config.nome, aba: config.aba, salvoEm: config.salvoEm },
      abas: dados.abas.map((a) => a.nome),
      previa: { hoje, treinos: treinosDoDia(linhas, hoje), ...resumo(linhas, hoje) }
    });
  } catch (e) {
    console.error('planilha:', e.message);
    return json(res, e.status || 502, { erro: e.message, robo });
  }
};

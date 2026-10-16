// GET /api/treinos[?data=AAAA-MM-DD] → treinos do dia, lidos da planilha do coach.
// Só para quem está logado. A planilha é ligada em /planilha (veja api/_lib/fonte.js).
const { usuario, json } = require('./_lib/sessao');
const { hojeISO, treinosDoDia } = require('./_lib/planilha');
const { linhasDosTreinos } = require('./_lib/fonte');

module.exports = async function (req, res) {
  let email;
  try { email = usuario(req, res); } catch (e) {
    return json(res, 500, { erro: 'Login ainda não configurado no servidor (SESSION_SECRET).' });
  }
  if (!email) return json(res, 401, { erro: 'Faça login para ver os treinos.' });

  const pedida = new URL(req.url, 'http://x').searchParams.get('data');
  const data = /^\d{4}-\d{2}-\d{2}$/.test(pedida || '') ? pedida : hojeISO();

  let lidas;
  try { lidas = await linhasDosTreinos(); } catch (e) {
    return json(res, e.status || 502, { erro: e.status === 503 ? e.message : 'Não consegui ler a planilha agora: ' + e.message, semPlanilha: e.status === 503 });
  }

  return json(res, 200, {
    data,
    hoje: hojeISO(),
    treinos: treinosDoDia(lidas.linhas, data),
    lidoEm: new Date(lidas.em).toISOString()
  });
};

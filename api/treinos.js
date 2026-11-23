// GET /api/treinos[?data=AAAA-MM-DD] → treinos do dia, lidos da planilha do coach.
// Só para quem está logado. A planilha é ligada em /planilha (veja api/_lib/fonte.js).
const { usuario, json } = require('./_lib/sessao');
const { hojeISO } = require('./_lib/planilha');
const { treinosDaData } = require('./_lib/fonte');
const { aplicarNaTV } = require('./_lib/tvia');

module.exports = async function (req, res) {
  let email;
  try { email = usuario(req, res); } catch (e) {
    return json(res, 500, { erro: 'Login ainda não configurado no servidor (SESSION_SECRET).' });
  }
  if (!email) return json(res, 401, { erro: 'Faça login para ver os treinos.' });

  const pedida = new URL(req.url, 'http://x').searchParams.get('data');
  const data = /^\d{4}-\d{2}-\d{2}$/.test(pedida || '') ? pedida : hojeISO();

  let r;
  try { r = await treinosDaData(data); } catch (e) {
    return json(res, e.status || 502, { erro: e.status === 503 ? e.message : 'Não consegui ler a planilha agora: ' + e.message, semPlanilha: e.status === 503 });
  }
  // versão organizada pela IA e aprovada pelo coach, se a planilha do dia não mudou depois
  r = await aplicarNaTV(data, r);

  return json(res, 200, { data, hoje: hojeISO(), treinos: r.treinos, aviso: r.aviso, onde: r.onde, ia: !!r.ia });
};

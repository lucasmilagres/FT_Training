// GET /api/treinos[?data=AAAA-MM-DD] → treinos do dia, lidos da planilha do coach.
// Só para quem está logado. TREINOS_PLANILHA = link "Publicar na Web" da planilha em formato CSV.
const { usuario, json } = require('./_lib/sessao');
const { hojeISO, treinosDoDia } = require('./_lib/planilha');

let cache = { em: 0, csv: '' }; // evita baixar a planilha a cada TV/aba aberta ao mesmo tempo
const CACHE_MS = 60 * 1000;

module.exports = async function (req, res) {
  let email;
  try { email = usuario(req, res); } catch (e) {
    return json(res, 500, { erro: 'Login ainda não configurado no servidor (SESSION_SECRET).' });
  }
  if (!email) return json(res, 401, { erro: 'Faça login para ver os treinos.' });

  const url = process.env.TREINOS_PLANILHA;
  if (!url) return json(res, 503, { erro: 'A planilha de treinos ainda não foi ligada ao site (TREINOS_PLANILHA).' });

  const pedida = new URL(req.url, 'http://x').searchParams.get('data');
  const data = /^\d{4}-\d{2}-\d{2}$/.test(pedida || '') ? pedida : hojeISO();

  if (Date.now() - cache.em > CACHE_MS) {
    try {
      const r = await fetch(url, { redirect: 'follow', headers: { 'Cache-Control': 'no-cache' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const csv = await r.text();
      if (/^\s*<(!doctype|html)/i.test(csv)) throw new Error('o link não é CSV (veio uma página HTML)');
      cache = { em: Date.now(), csv };
    } catch (e) {
      console.error('Planilha falhou:', e.message);
      if (!cache.csv) return json(res, 502, { erro: 'Não consegui ler a planilha agora: ' + e.message });
    }
  }

  return json(res, 200, {
    data,
    hoje: hojeISO(),
    treinos: treinosDoDia(cache.csv, data),
    lidoEm: new Date(cache.em).toISOString()
  });
};

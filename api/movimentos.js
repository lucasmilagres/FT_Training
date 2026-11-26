// GET /api/movimentos → lista pública de movimentos com vídeo (ordem alfabética), para /movimentos.
// Aberta, sem login. O cadastro fica no painel do coach (api/coach.js, ações *_movimento).
const { json } = require('./_lib/sessao');
const { listaPublica } = require('./_lib/movimentos');

module.exports = async function (req, res) {
  if (req.method !== 'GET') return json(res, 405, { erro: 'Método não permitido' });
  try {
    const movimentos = await listaPublica();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    // a Vercel guarda por 1 minuto: muita gente abrindo não pesa no banco
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
    res.end(JSON.stringify({ movimentos }));
  } catch (e) {
    console.error('movimentos:', e);
    return json(res, 500, { erro: 'Não consegui carregar os movimentos agora.' });
  }
};

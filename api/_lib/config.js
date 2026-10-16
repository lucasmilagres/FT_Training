// Planilha ligada pelo coach na página /planilha, guardada no Vercel Blob (store privado "ft-config").
// Variável de ambiente: BLOB_READ_WRITE_TOKEN (criada pela Vercel ao ligar o store ao projeto).
const { put, get } = require('@vercel/blob');

const CAMINHO = 'config/planilha.json';
let cache = { em: 0, valor: null };

async function lerConfig() {
  if (Date.now() - cache.em < 30 * 1000) return cache.valor;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  const r = await get(CAMINHO, { access: 'private', useCache: false });
  const valor = r && r.statusCode === 200 ? JSON.parse(await new Response(r.stream).text()) : null;
  cache = { em: Date.now(), valor };
  return valor;
}

async function salvarConfig(valor) {
  await put(CAMINHO, JSON.stringify(valor), {
    access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json'
  });
  cache = { em: Date.now(), valor };
}

module.exports = { lerConfig, salvarConfig };

// Configuração da área do coach, guardada no Vercel Blob (store privado "ft-config"):
//  - config/planilha.json: planilha ligada em /planilha (id, link, aba, modo "robo" ou "google")
//  - config/google.json:   conta Google conectada (e-mail + refresh token criptografado)
// Variável de ambiente: BLOB_READ_WRITE_TOKEN (criada pela Vercel ao ligar o store ao projeto).
const { put, get, del } = require('@vercel/blob');
const cofre = require('./cofre');

const PLANILHA = 'config/planilha.json';
const GOOGLE = 'config/google.json';
const cache = new Map();

async function ler(caminho) {
  const c = cache.get(caminho);
  if (c && Date.now() - c.em < 30 * 1000) return c.valor;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  const r = await get(caminho, { access: 'private', useCache: false });
  const valor = r && r.statusCode === 200 ? JSON.parse(await new Response(r.stream).text()) : null;
  cache.set(caminho, { em: Date.now(), valor });
  return valor;
}

async function salvar(caminho, valor) {
  await put(caminho, JSON.stringify(valor), {
    access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json'
  });
  cache.set(caminho, { em: Date.now(), valor });
}

async function apagar(caminho) {
  await del(caminho);
  cache.set(caminho, { em: Date.now(), valor: null });
}

// Conta Google: o refresh token só sai daqui descriptografado
async function lerConta() {
  const c = await ler(GOOGLE);
  return c ? { email: c.email, conectadoEm: c.conectadoEm, refresh: cofre.abrir(c.refresh) } : null;
}
const salvarConta = (email, refresh) => salvar(GOOGLE, { email, refresh: cofre.trancar(refresh), conectadoEm: new Date().toISOString() });

module.exports = {
  lerConfig: () => ler(PLANILHA),
  salvarConfig: (v) => salvar(PLANILHA, v),
  apagarConfig: () => apagar(PLANILHA),
  lerConta,
  salvarConta,
  apagarConta: () => apagar(GOOGLE)
};

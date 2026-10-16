// De onde vêm os treinos: a planilha ligada em /planilha (privada, lida pelo robô do Google
// ou pela conta Google do coach) ou, como reserva, um link CSV "Publicar na Web" em TREINOS_PLANILHA.
const { lerConfig, lerConta } = require('./config');
const google = require('./google');
const { lerCSV } = require('./planilha');

let cache = { em: 0, chave: '', linhas: null };
const CACHE_MS = 60 * 1000; // evita ler a planilha a cada TV/aba aberta ao mesmo tempo

function erro(status, msg) { const e = new Error(msg); e.status = status; return e; }

async function buscar() {
  const cfg = await lerConfig();
  if (cfg && cfg.id && cfg.modo === 'google') {
    const conta = await lerConta();
    if (!conta) throw erro(503, 'A conta Google que ligava a planilha foi desconectada.');
    return { chave: `google:${cfg.id}:${cfg.aba}`, ler: () => google.linhas(cfg.id, cfg.aba, conta) };
  }
  if (cfg && cfg.id) return { chave: `robo:${cfg.id}:${cfg.aba}`, ler: () => google.linhas(cfg.id, cfg.aba) };

  const url = process.env.TREINOS_PLANILHA;
  if (url) {
    return {
      chave: 'csv:' + url,
      ler: async () => {
        const r = await fetch(url, { redirect: 'follow', headers: { 'Cache-Control': 'no-cache' } });
        if (!r.ok) throw erro(502, 'HTTP ' + r.status);
        const csv = await r.text();
        if (/^\s*<(!doctype|html)/i.test(csv)) throw erro(502, 'o link não é CSV (veio uma página HTML)');
        return lerCSV(csv);
      }
    };
  }
  throw erro(503, 'Nenhuma planilha ligada ao site ainda.');
}

// Devolve as linhas da planilha; se a leitura falhar, usa a última que deu certo
async function linhasDosTreinos() {
  const fonte = await buscar();
  if (cache.chave === fonte.chave && Date.now() - cache.em < CACHE_MS) return cache;
  try {
    cache = { em: Date.now(), chave: fonte.chave, linhas: await fonte.ler() };
  } catch (e) {
    console.error('Planilha falhou:', e.message);
    if (cache.chave !== fonte.chave || !cache.linhas) throw e;
  }
  return cache;
}

function limparCache() { cache = { em: 0, chave: '', linhas: null }; }

module.exports = { linhasDosTreinos, limparCache };

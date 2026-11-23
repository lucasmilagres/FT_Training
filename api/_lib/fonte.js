// De onde vêm os treinos: a planilha ligada em /planilha (privada, lida pelo robô do Google
// ou pela conta Google do coach) ou, como reserva, um link CSV "Publicar na Web" em TREINOS_PLANILHA.
// Dois formatos de planilha:
//  - semanal (o do coach): abas por mês, blocos por semana, colunas seg→sex (ver semana.js)
//  - por data: uma linha por treino com coluna "Data" (ver planilha.js)
const { lerConfig, lerConta } = require('./config');
const google = require('./google');
const { lerCSV, treinosDoDia } = require('./planilha');
const semana = require('./semana');

const CACHE_MS = 60 * 1000; // evita ler a planilha a cada TV/aba aberta ao mesmo tempo
const cache = new Map();    // chave → { em, valor }

function erro(status, msg) { const e = new Error(msg); e.status = status; return e; }

// Lê com cache; se o Google falhar, usa a última leitura que deu certo
async function comCache(chave, ler) {
  const c = cache.get(chave);
  if (c && Date.now() - c.em < CACHE_MS) return c.valor;
  try {
    const valor = await ler();
    cache.set(chave, { em: Date.now(), valor });
    return valor;
  } catch (e) {
    console.error('Planilha falhou:', chave, e.message);
    if (c) return c.valor;
    throw e;
  }
}

// Treinos de uma data (AAAA-MM-DD) → { treinos, aviso, onde, formato }
async function treinosDaData(data) {
  // TREINOS_PLANILHA_ID (opcional): id da planilha lida pelo robô quando nenhuma foi ligada em /planilha (útil para testar local)
  const cfg = (await lerConfig()) || (process.env.TREINOS_PLANILHA_ID ? { id: process.env.TREINOS_PLANILHA_ID, modo: 'robo' } : null);

  if (cfg && cfg.id) {
    let conta;
    if (cfg.modo === 'google') {
      conta = await lerConta();
      if (!conta) throw erro(503, 'A conta Google que ligava a planilha foi desconectada.');
    }
    const base = `${cfg.modo || 'robo'}:${cfg.id}`;
    const dados = await comCache(base + ':info', () => google.info(cfg.id, conta));
    const abas = dados.abas.map((a) => a.nome);

    const r = await semana.treinosDaData(data, abas, (aba) => comCache(`${base}:grade:${aba}`, () => google.grade(cfg.id, aba, conta)));
    if (r) return { ...r, formato: 'semanal' };

    const linhas = await comCache(`${base}:linhas:${cfg.aba}`, () => google.linhas(cfg.id, cfg.aba, conta));
    return { treinos: treinosDoDia(linhas, data), aviso: null, onde: { aba: cfg.aba }, formato: 'datas', linhas };
  }

  const url = process.env.TREINOS_PLANILHA;
  if (url) {
    const linhas = await comCache('csv:' + url, async () => {
      const r = await fetch(url, { redirect: 'follow', headers: { 'Cache-Control': 'no-cache' } });
      if (!r.ok) throw erro(502, 'HTTP ' + r.status);
      const csv = await r.text();
      if (/^\s*<(!doctype|html)/i.test(csv)) throw erro(502, 'o link não é CSV (veio uma página HTML)');
      return lerCSV(csv);
    });
    return { treinos: treinosDoDia(linhas, data), aviso: null, onde: null, formato: 'datas', linhas };
  }

  throw erro(503, 'Nenhuma planilha ligada ao site ainda.');
}

function limparCache() { cache.clear(); }

module.exports = { treinosDaData, limparCache };

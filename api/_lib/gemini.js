// Gemini (Google AI Studio) pela API REST, sem dependências.
// Variáveis: GEMINI_API_KEY (obrigatória) e GEMINI_MODELO (opcional; sem ela o servidor
// pergunta ao Google quais modelos existem e usa o "gemini-X-flash" mais novo).
// Na faixa gratuita o Google pode usar o que é enviado para melhorar os produtos dele:
// mande só o texto dos treinos da planilha, nunca dados de alunos.
const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const UM_DIA = 24 * 3600 * 1000;
let lista = null;      // { nomes, em } modelos Flash disponíveis, do mais novo ao mais velho
let ultimoBom = null;  // modelo que respondeu por último: é tentado primeiro

function erro(status, msg) { const e = new Error(msg); e.status = status; return e; }
const configurado = () => !!(process.env.GEMINI_API_KEY || '').trim();

function chave() {
  const k = (process.env.GEMINI_API_KEY || '').trim();
  if (!k) throw erro(503, 'A IA ainda não foi configurada no servidor (GEMINI_API_KEY).');
  return k;
}

async function chamar(caminho, corpo, limiteMs = 20000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), limiteMs);
  let r;
  try {
    r = await fetch(BASE + caminho, {
      method: corpo ? 'POST' : 'GET',
      headers: { 'x-goog-api-key': chave(), ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: ctrl.signal
    });
  } catch (e) {
    const x = erro(504, ctrl.signal.aborted ? 'A IA demorou demais para responder.' : 'Não consegui falar com a IA: ' + e.message);
    x.outroModelo = true;
    throw x;
  } finally {
    clearTimeout(timer);
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (j.error && j.error.message) || 'HTTP ' + r.status;
    let e;
    if (r.status === 429) e = erro(429, 'A IA atingiu o limite gratuito por agora. Tente de novo em alguns minutos.');
    else if (r.status === 400 && /api key/i.test(msg)) e = erro(503, 'A chave do Gemini (GEMINI_API_KEY) é inválida.');
    else e = erro(502, 'A IA respondeu com erro: ' + msg);
    e.semThinking = r.status === 400 && /thinking/i.test(msg); // modelo não aceita desligar o raciocínio
    // sobrecarga ou limite do modelo: vale tentar outro modelo
    e.outroModelo = [429, 500, 503, 504].includes(r.status) || /high demand|overloaded|unavailable/i.test(msg);
    throw e;
  }
  return j;
}

// "gemini-3.5-flash" → [3, 5, 0]   "gemini-3.5-flash-lite" → [3, 5, 1] (lite vem depois)
const versao = (nome) => {
  const m = nome.match(/^gemini-(\d+)(?:\.(\d+))?-flash(-lite)?$/);
  return m ? [+m[1], +(m[2] || 0), m[3] ? 1 : 0] : null;
};

// Modelos a tentar, em ordem: o que funcionou por último, depois Flash do mais novo ao mais velho, depois os "lite"
async function modelos() {
  const fixo = (process.env.GEMINI_MODELO || '').trim().replace(/^models\//, '');
  if (!lista || Date.now() - lista.em > UM_DIA) {
    const j = await chamar('/models?pageSize=1000');
    const nomes = (j.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => String(m.name || '').replace(/^models\//, ''));
    // mais novo primeiro; em cada versão, o Flash e logo depois o lite (mais rápido e menos disputado)
    const flash = nomes.filter((n) => versao(n)).sort((a, b) => {
      const x = versao(a), y = versao(b);
      return y[0] - x[0] || y[1] - x[1] || x[2] - y[2];
    });
    if (nomes.includes('gemini-flash-latest')) flash.push('gemini-flash-latest');
    lista = { nomes: flash, em: Date.now() };
  }
  const ordem = [fixo, ultimoBom].concat(lista.nomes).filter(Boolean);
  const unicos = ordem.filter((n, i) => ordem.indexOf(n) === i);
  if (!unicos.length) throw erro(502, 'Não achei um modelo Gemini Flash disponível para esta chave.');
  return unicos;
}

async function modelo() { return (await modelos())[0]; }

// Pede uma resposta em JSON seguindo "schema" (formato OpenAPI do Gemini).
// Se um modelo estiver sobrecarregado ou lento, tenta o próximo, sem passar de ~50 s no total
// (a função da Vercel tem 60 s).
async function gerarJSON({ instrucoes, texto, schema, prazoMs = 50000 }) {
  const corpo = (thinking) => ({
    systemInstruction: { parts: [{ text: instrucoes }] },
    contents: [{ role: 'user', parts: [{ text: texto }] }],
    generationConfig: {
      responseMimeType: 'application/json', responseSchema: schema, temperature: 0.1,
      // organizar texto não precisa de "raciocínio": desligado, a resposta vem bem mais rápido
      ...(thinking ? {} : { thinkingConfig: { thinkingBudget: 0 } })
    }
  });
  const fim = Date.now() + prazoMs;
  let ultimoErro = null;
  for (const nome of (await modelos()).slice(0, 5)) {
    const resta = fim - Date.now();
    if (resta < 6000) break;
    const inicio = Date.now();
    const caminho = `/models/${encodeURIComponent(nome)}:generateContent`;
    let j;
    try {
      try { j = await chamar(caminho, corpo(false), Math.min(25000, resta)); } catch (e) {
        if (!e.semThinking) throw e;
        j = await chamar(caminho, corpo(true), Math.min(25000, fim - Date.now()));
      }
    } catch (e) {
      if (!e.outroModelo) throw e;
      console.error('gemini', nome, Date.now() - inicio + 'ms', e.message);
      ultimoErro = e;
      continue;
    }
    console.log('gemini ok', nome, Date.now() - inicio + 'ms');
    const cand = (j.candidates || [])[0];
    const saida = cand && cand.content && (cand.content.parts || []).map((p) => p.text || '').join('');
    if (!saida) throw erro(502, 'A IA não devolveu resposta' + (cand && cand.finishReason ? ' (' + cand.finishReason + ').' : '.'));
    let dados;
    try { dados = JSON.parse(saida); } catch (e) { throw erro(502, 'A IA devolveu um formato inválido. Tente de novo.'); }
    ultimoBom = nome;
    return { modelo: nome, dados };
  }
  throw erro(ultimoErro && ultimoErro.status === 429 ? 429 : 503,
    'Os modelos do Gemini estão sobrecarregados agora. Tente de novo em alguns minutos.');
}

module.exports = { configurado, modelo, modelos, gerarJSON };

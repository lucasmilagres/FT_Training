// Gemini (Google AI Studio) pela API REST, sem dependências.
// Variáveis: GEMINI_API_KEY (obrigatória) e GEMINI_MODELO (opcional; sem ela o servidor
// pergunta ao Google quais modelos existem e usa o "gemini-X-flash" mais novo).
// Na faixa gratuita o Google pode usar o que é enviado para melhorar os produtos dele:
// mande só o texto dos treinos da planilha, nunca dados de alunos.
const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const UM_DIA = 24 * 3600 * 1000;
let escolhido = null; // { nome, em }

function erro(status, msg) { const e = new Error(msg); e.status = status; return e; }
const configurado = () => !!(process.env.GEMINI_API_KEY || '').trim();

function chave() {
  const k = (process.env.GEMINI_API_KEY || '').trim();
  if (!k) throw erro(503, 'A IA ainda não foi configurada no servidor (GEMINI_API_KEY).');
  return k;
}

async function chamar(caminho, corpo) {
  const r = await fetch(BASE + caminho, {
    method: corpo ? 'POST' : 'GET',
    headers: { 'x-goog-api-key': chave(), ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (j.error && j.error.message) || 'HTTP ' + r.status;
    if (r.status === 429) throw erro(429, 'A IA atingiu o limite gratuito por agora. Tente de novo em alguns minutos.');
    if (r.status === 400 && /api key/i.test(msg)) throw erro(503, 'A chave do Gemini (GEMINI_API_KEY) é inválida.');
    throw erro(502, 'A IA respondeu com erro: ' + msg);
  }
  return j;
}

// "gemini-3.5-flash" → [3, 5]
const versao = (nome) => (nome.match(/^gemini-(\d+)(?:\.(\d+))?-flash$/) || []).slice(1).map((n) => +(n || 0));

async function modelo() {
  const fixo = (process.env.GEMINI_MODELO || '').trim().replace(/^models\//, '');
  if (fixo) return fixo;
  if (escolhido && Date.now() - escolhido.em < UM_DIA) return escolhido.nome;
  const j = await chamar('/models?pageSize=1000');
  const nomes = (j.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => String(m.name || '').replace(/^models\//, ''));
  const flash = nomes.filter((n) => versao(n).length)
    .sort((a, b) => { const x = versao(a), y = versao(b); return y[0] - x[0] || y[1] - x[1]; });
  const nome = flash[0] || nomes.find((n) => n === 'gemini-flash-latest');
  if (!nome) throw erro(502, 'Não achei um modelo Gemini Flash disponível para esta chave.');
  escolhido = { nome, em: Date.now() };
  return nome;
}

// Pede uma resposta em JSON seguindo "schema" (formato OpenAPI do Gemini)
async function gerarJSON({ instrucoes, texto, schema }) {
  const nome = await modelo();
  const j = await chamar(`/models/${encodeURIComponent(nome)}:generateContent`, {
    systemInstruction: { parts: [{ text: instrucoes }] },
    contents: [{ role: 'user', parts: [{ text: texto }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.1 }
  });
  const cand = (j.candidates || [])[0];
  const saida = cand && cand.content && (cand.content.parts || []).map((p) => p.text || '').join('');
  if (!saida) throw erro(502, 'A IA não devolveu resposta' + (cand && cand.finishReason ? ' (' + cand.finishReason + ').' : '.'));
  try { return { modelo: nome, dados: JSON.parse(saida) }; } catch (e) {
    throw erro(502, 'A IA devolveu um formato inválido. Tente de novo.');
  }
}

module.exports = { configurado, modelo, gerarJSON };

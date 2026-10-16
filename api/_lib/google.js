// Lê planilhas privadas do Google Sheets com uma conta de serviço (o "robô" do site).
// O coach compartilha a planilha com o e-mail do robô como Leitor e pronto.
// Variável de ambiente: GOOGLE_SERVICE_ACCOUNT = conteúdo do arquivo .json da chave.
const crypto = require('crypto');

const ESCOPO = 'https://www.googleapis.com/auth/spreadsheets.readonly';
let token = { valor: '', expira: 0 };

function credencial() {
  const bruto = process.env.GOOGLE_SERVICE_ACCOUNT;
  if (!bruto) return null;
  let j;
  try { j = JSON.parse(bruto); } catch (e) { throw new Error('GOOGLE_SERVICE_ACCOUNT não é um JSON válido'); }
  if (!j.client_email || !j.private_key) throw new Error('GOOGLE_SERVICE_ACCOUNT sem client_email/private_key');
  return { email: j.client_email, chave: j.private_key };
}

const emailRobo = () => { const c = credencial(); return c ? c.email : null; };

async function acesso() {
  if (token.valor && Date.now() < token.expira - 60 * 1000) return token.valor;
  const c = credencial();
  if (!c) throw erro(503, 'O robô do Google ainda não foi configurado no servidor (GOOGLE_SERVICE_ACCOUNT).');
  const t = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const corpo = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: c.email, scope: ESCOPO, aud: 'https://oauth2.googleapis.com/token', iat: t, exp: t + 3600 });
  const assinatura = crypto.sign('RSA-SHA256', Buffer.from(corpo), c.chave).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: corpo + '.' + assinatura })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw erro(502, 'O Google recusou a chave do robô: ' + (j.error_description || j.error || r.status));
  token = { valor: j.access_token, expira: Date.now() + j.expires_in * 1000 };
  return token.valor;
}

function erro(status, msg) { const e = new Error(msg); e.status = status; return e; }

async function sheets(caminho) {
  const r = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + caminho, { headers: { Authorization: 'Bearer ' + await acesso() } });
  if (r.ok) return r.json();
  const j = await r.json().catch(() => ({}));
  const msg = (j.error && j.error.message) || '';
  if (r.status === 403) throw erro(403, `O robô ainda não tem acesso a essa planilha. Compartilhe com ${emailRobo()} como Leitor.`);
  if (r.status === 404) throw erro(404, 'Planilha não encontrada. Confira se o link está completo.');
  if (/not supported for this document/i.test(msg)) throw erro(400, 'Esse arquivo é um Excel (.xlsx). Abra no Google Sheets e use Arquivo → Salvar como Planilhas Google, depois cole o link novo.');
  throw erro(502, 'O Google respondeu com erro: ' + (msg || r.status));
}

// Link da planilha → id (e a aba, se o link tiver #gid=)
function lerLink(url) {
  const id = (String(url).match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/) || [])[1];
  const gid = (String(url).match(/[#?&]gid=(\d+)/) || [])[1];
  return id ? { id, gid: gid != null ? Number(gid) : null } : null;
}

async function info(id) {
  const j = await sheets(encodeURIComponent(id) + '?fields=properties.title,sheets.properties(sheetId,title,index)');
  return {
    nome: j.properties.title,
    abas: j.sheets.map((s) => s.properties).sort((a, b) => a.index - b.index).map((p) => ({ id: p.sheetId, nome: p.title }))
  };
}

// Valores como aparecem na tela (datas já formatadas, ex.: 15/10/2026)
async function linhas(id, aba) {
  const faixa = encodeURIComponent(`'${String(aba).replace(/'/g, "''")}'!A1:Z1000`);
  const j = await sheets(`${encodeURIComponent(id)}/values/${faixa}?valueRenderOption=FORMATTED_VALUE`);
  return j.values || [];
}

module.exports = { emailRobo, lerLink, info, linhas };

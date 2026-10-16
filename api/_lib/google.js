// Lê planilhas privadas do Google Sheets de dois jeitos:
//  1. Robô (conta de serviço): o coach compartilha a planilha com o e-mail do robô como Leitor.
//     Variável: GOOGLE_SERVICE_ACCOUNT = conteúdo do arquivo .json da chave.
//  2. Conta Google do coach ("Conectar com Google" + escolher a planilha no Google Picker).
//     Escopo drive.file: o site só enxerga os arquivos que o coach escolher.
//     Variáveis: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (e GOOGLE_API_KEY para o Picker no navegador).
const crypto = require('crypto');

const ESCOPO_ROBO = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const ESCOPOS_CONTA = 'openid email https://www.googleapis.com/auth/drive.file';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

function erro(status, msg) { const e = new Error(msg); e.status = status; return e; }

// ---------- robô ----------
let tokenRobo = { valor: '', expira: 0 };

function credencial() {
  const bruto = process.env.GOOGLE_SERVICE_ACCOUNT;
  if (!bruto) return null;
  let j;
  try { j = JSON.parse(bruto); } catch (e) { throw new Error('GOOGLE_SERVICE_ACCOUNT não é um JSON válido'); }
  if (!j.client_email || !j.private_key) throw new Error('GOOGLE_SERVICE_ACCOUNT sem client_email/private_key');
  return { email: j.client_email, chave: j.private_key };
}

const emailRobo = () => { const c = credencial(); return c ? c.email : null; };

async function acessoRobo() {
  if (tokenRobo.valor && Date.now() < tokenRobo.expira - 60 * 1000) return tokenRobo.valor;
  const c = credencial();
  if (!c) throw erro(503, 'O robô do Google ainda não foi configurado no servidor (GOOGLE_SERVICE_ACCOUNT).');
  const t = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const corpo = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: c.email, scope: ESCOPO_ROBO, aud: TOKEN_URL, iat: t, exp: t + 3600 });
  const assinatura = crypto.sign('RSA-SHA256', Buffer.from(corpo), c.chave).toString('base64url');
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: corpo + '.' + assinatura })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw erro(502, 'O Google recusou a chave do robô: ' + (j.error_description || j.error || r.status));
  tokenRobo = { valor: j.access_token, expira: Date.now() + j.expires_in * 1000 };
  return tokenRobo.valor;
}

// ---------- conta Google do coach (OAuth) ----------
const tokensConta = new Map();

function clienteOAuth() {
  const id = process.env.GOOGLE_CLIENT_ID, segredo = process.env.GOOGLE_CLIENT_SECRET;
  return id && segredo ? { id, segredo } : null;
}

// Para o Google Picker: o "app id" é o número do projeto, que é o começo do client id
const appId = () => (process.env.GOOGLE_CLIENT_ID || '').split('-')[0];

function urlLogin(redirect, state) {
  const c = clienteOAuth();
  if (!c) throw erro(503, 'O login com Google ainda não foi configurado no servidor.');
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: c.id,
    redirect_uri: redirect,
    response_type: 'code',
    scope: ESCOPOS_CONTA,
    access_type: 'offline',      // devolve refresh token: a TV continua lendo sem novo login
    prompt: 'consent',
    include_granted_scopes: 'true',
    state
  });
}

async function postToken(params) {
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params)
  });
  return { r, j: await r.json().catch(() => ({})) };
}

// Código do retorno do Google → refresh token + e-mail da conta
async function trocarCodigo(codigo, redirect) {
  const c = clienteOAuth();
  const { r, j } = await postToken({ code: codigo, client_id: c.id, client_secret: c.segredo, redirect_uri: redirect, grant_type: 'authorization_code' });
  if (!r.ok) throw erro(502, 'O Google não confirmou o login: ' + (j.error_description || j.error || r.status));
  if (!j.refresh_token) throw erro(502, 'O Google não liberou acesso contínuo. Tente conectar de novo.');
  let email = '';
  try { email = JSON.parse(Buffer.from(j.id_token.split('.')[1], 'base64url').toString()).email || ''; } catch (e) {}
  tokensConta.set(j.refresh_token, { valor: j.access_token, expira: Date.now() + j.expires_in * 1000 });
  return { refresh: j.refresh_token, email };
}

async function acessoConta(refresh) {
  const t = tokensConta.get(refresh);
  if (t && Date.now() < t.expira - 60 * 1000) return t.valor;
  const c = clienteOAuth();
  if (!c) throw erro(503, 'O login com Google ainda não foi configurado no servidor.');
  const { r, j } = await postToken({ refresh_token: refresh, client_id: c.id, client_secret: c.segredo, grant_type: 'refresh_token' });
  if (j.error === 'invalid_grant') throw erro(401, 'A conexão com o Google foi removida ou expirou. Clique em "Conectar com Google" de novo.');
  if (!r.ok) throw erro(502, 'O Google recusou o acesso: ' + (j.error_description || j.error || r.status));
  tokensConta.set(refresh, { valor: j.access_token, expira: Date.now() + j.expires_in * 1000 });
  return j.access_token;
}

async function revogar(refresh) {
  tokensConta.delete(refresh);
  await fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(refresh), { method: 'POST' }).catch(() => {});
}

// ---------- Sheets ----------
// conta = { refresh } para ler com a conta do coach; vazio = robô
async function sheets(caminho, conta) {
  const token = conta && conta.refresh ? await acessoConta(conta.refresh) : await acessoRobo();
  const r = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + caminho, { headers: { Authorization: 'Bearer ' + token } });
  if (r.ok) return r.json();
  const j = await r.json().catch(() => ({}));
  const msg = (j.error && j.error.message) || '';
  if (r.status === 403) {
    throw erro(403, conta && conta.refresh
      ? 'Sua conta Google ainda não liberou essa planilha para o site. Use o botão "Escolher planilha" e selecione ela.'
      : `O robô ainda não tem acesso a essa planilha. Compartilhe com ${emailRobo()} como Leitor.`);
  }
  if (r.status === 404) throw erro(404, 'Planilha não encontrada. Confira se o link está completo.');
  if (/not supported for this document/i.test(msg)) throw erro(400, 'Esse arquivo é um Excel (.xlsx). Abra no Google Sheets e use Arquivo → Salvar como Planilhas Google, depois escolha o arquivo novo.');
  throw erro(502, 'O Google respondeu com erro: ' + (msg || r.status));
}

// Link da planilha → id (e a aba, se o link tiver #gid=)
function lerLink(url) {
  const id = (String(url).match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/) || [])[1];
  const gid = (String(url).match(/[#?&]gid=(\d+)/) || [])[1];
  return id ? { id, gid: gid != null ? Number(gid) : null } : null;
}

async function info(id, conta) {
  const j = await sheets(encodeURIComponent(id) + '?fields=properties.title,sheets.properties(sheetId,title,index)', conta);
  return {
    nome: j.properties.title,
    abas: j.sheets.map((s) => s.properties).sort((a, b) => a.index - b.index).map((p) => ({ id: p.sheetId, nome: p.title }))
  };
}

// Valores como aparecem na tela (datas já formatadas, ex.: 15/10/2026)
async function linhas(id, aba, conta) {
  const faixa = encodeURIComponent(`'${String(aba).replace(/'/g, "''")}'!A1:Z1000`);
  const j = await sheets(`${encodeURIComponent(id)}/values/${faixa}?valueRenderOption=FORMATTED_VALUE`, conta);
  return j.values || [];
}

module.exports = {
  emailRobo, lerLink, info, linhas,
  clienteOAuth, appId, urlLogin, trocarCodigo, acessoConta, revogar
};

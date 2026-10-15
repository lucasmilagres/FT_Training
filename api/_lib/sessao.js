// Login da área do coach: sessão assinada em cookie (sem banco de dados).
// Variáveis de ambiente: SESSION_SECRET, TREINOS_EMAILS.
const crypto = require('crypto');

const SESSAO = 'ft_sessao';      // httpOnly, prova que está logado
const AVISO = 'ft_coach';        // legível pelo JS do site, só para mostrar a aba "Treinos"
const UM_ANO = 365 * 24 * 3600;
const RENOVAR_APOS = 30 * 24 * 3600; // TV que fica ligada nunca expira: a sessão é renovada a cada 30 dias de uso

function segredo() {
  const s = process.env.SESSION_SECRET || '';
  if (s.length < 32) throw new Error('SESSION_SECRET ausente ou curto (mínimo 32 caracteres)');
  return s;
}

const b64 = (s) => Buffer.from(s).toString('base64url');
const assina = (txt) => crypto.createHmac('sha256', segredo()).update(txt).digest('base64url');

function iguais(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function selar(dados) {
  const corpo = b64(JSON.stringify(dados));
  return corpo + '.' + assina(corpo);
}

function abrir(token) {
  if (!token || token.indexOf('.') < 0) return null;
  const [corpo, sig] = token.split('.');
  if (!iguais(sig, assina(corpo))) return null;
  try { return JSON.parse(Buffer.from(corpo, 'base64url').toString()); } catch (e) { return null; }
}

const agora = () => Math.floor(Date.now() / 1000);

function lerCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function cookie(nome, valor, maxAge, { httpOnly = true, path = '/' } = {}) {
  return [
    `${nome}=${encodeURIComponent(valor)}`,
    `Path=${path}`,
    `Max-Age=${maxAge}`,
    'SameSite=Lax',
    'Secure',
    httpOnly ? 'HttpOnly' : ''
  ].filter(Boolean).join('; ');
}

function addCookie(res, valor) {
  const atual = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', [].concat(atual || [], valor));
}

function emailsLiberados() {
  return (process.env.TREINOS_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}

function iniciarSessao(res, email) {
  const t = agora();
  addCookie(res, cookie(SESSAO, selar({ e: email, t, x: t + UM_ANO }), UM_ANO));
  addCookie(res, cookie(AVISO, '1', UM_ANO, { httpOnly: false }));
}

function encerrarSessao(res) {
  addCookie(res, cookie(SESSAO, '', 0));
  addCookie(res, cookie(AVISO, '', 0, { httpOnly: false }));
}

// Devolve o e-mail logado ou null. Renova a sessão quando ela já tem mais de 30 dias.
function usuario(req, res) {
  const s = abrir(lerCookies(req)[SESSAO]);
  if (!s || s.x < agora()) return null;
  // e-mail removido de TREINOS_EMAILS perde o acesso na hora
  if (!emailsLiberados().includes(s.e)) return null;
  if (res && agora() - s.t > RENOVAR_APOS) iniciarSessao(res, s.e);
  return s.e;
}

function json(res, status, dados) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(dados));
}

module.exports = {
  crypto, assina, selar, abrir, iguais, agora, lerCookies, cookie, addCookie,
  emailsLiberados, iniciarSessao, encerrarSessao, usuario, json
};

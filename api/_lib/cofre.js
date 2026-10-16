// Criptografa segredos guardados no Blob (ex.: refresh token do Google) com AES-256-GCM.
// A chave sai do SESSION_SECRET: quem lê o Blob sem a variável de ambiente não consegue usar o token.
const crypto = require('crypto');

function chave() {
  const s = process.env.SESSION_SECRET || '';
  if (s.length < 32) throw new Error('SESSION_SECRET ausente ou curto (mínimo 32 caracteres)');
  return crypto.createHash('sha256').update('ft-cofre|' + s).digest();
}

function trancar(texto) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', chave(), iv);
  const corpo = Buffer.concat([c.update(String(texto), 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), corpo].map((b) => b.toString('base64url')).join('.');
}

function abrir(selado) {
  const [iv, tag, corpo] = String(selado).split('.').map((p) => Buffer.from(p, 'base64url'));
  const d = crypto.createDecipheriv('aes-256-gcm', chave(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(corpo), d.final()]).toString('utf8');
}

module.exports = { trancar, abrir };

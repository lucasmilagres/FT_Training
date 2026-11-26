// POST /api/auth/codigo  { email }  → envia um código de 8 dígitos pelo Resend.
// Vale para a equipe (TREINOS_EMAILS) e para quem o coach cadastrou (perfil ativo ou convite).
// O código não fica salvo em lugar nenhum: o navegador recebe um cookie com o hash dele.
const { crypto, assina, agora, cookie, addCookie, emailsLiberados, json } = require('../_lib/sessao');
const { emailCodigo, enviarEmail } = require('../_lib/email-codigo');
const banco = require('../_lib/banco');

const VALIDADE = 10 * 60;

module.exports = async function (req, res) {
  if (req.method !== 'POST') return json(res, 405, { erro: 'Método não permitido' });

  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res, 400, { erro: 'Digite um e-mail válido.' });

  let pode = emailsLiberados().includes(email);
  if (!pode) {
    try { pode = await banco.temAcesso(email); } catch (e) {
      console.error('codigo temAcesso:', e.message);
      return json(res, 502, { erro: 'Não consegui conferir o seu cadastro agora. Tente de novo em instantes.' });
    }
  }
  if (!pode) return json(res, 403, { erro: 'Esse e-mail não está cadastrado. Peça para o seu coach cadastrar você.' });

  // 8 dígitos: 100 milhões de combinações, inviável de chutar em 10 minutos
  const codigo = String(crypto.randomInt(0, 1e8)).padStart(8, '0');
  const x = agora() + VALIDADE;
  let hash;
  try {
    hash = assina(`otp|${email}|${x}|${codigo}`);
  } catch (e) {
    return json(res, 500, { erro: 'Login ainda não configurado no servidor (SESSION_SECRET).' });
  }

  try {
    // Sem chave só é aceito rodando local: o código aparece no terminal
    await enviarEmail(email, emailCodigo(codigo));
  } catch (e) {
    return json(res, process.env.RESEND_API_KEY ? 502 : 500, { erro: process.env.RESEND_API_KEY ? 'Não consegui enviar o e-mail agora. Tente de novo em instantes.' : e.message });
  }

  addCookie(res, cookie('ft_otp', `${Buffer.from(email).toString('base64url')}.${x}.${hash}`, VALIDADE, { path: '/api/auth' }));
  return json(res, 200, { ok: true });
};

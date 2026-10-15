// POST /api/auth/codigo  { email }  → envia um código de 8 dígitos pelo Resend.
// O código não fica salvo em lugar nenhum: o navegador recebe um cookie com o hash dele.
const { crypto, assina, agora, cookie, addCookie, emailsLiberados, json } = require('../_lib/sessao');
const { emailCodigo } = require('../_lib/email-codigo');

const VALIDADE = 10 * 60;

module.exports = async function (req, res) {
  if (req.method !== 'POST') return json(res, 405, { erro: 'Método não permitido' });

  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res, 400, { erro: 'Digite um e-mail válido.' });
  if (!emailsLiberados().includes(email)) return json(res, 403, { erro: 'Esse e-mail não tem acesso à área de treinos.' });

  // 8 dígitos: 100 milhões de combinações, inviável de chutar em 10 minutos
  const codigo = String(crypto.randomInt(0, 1e8)).padStart(8, '0');
  const x = agora() + VALIDADE;
  let hash;
  try {
    hash = assina(`otp|${email}|${x}|${codigo}`);
  } catch (e) {
    return json(res, 500, { erro: 'Login ainda não configurado no servidor (SESSION_SECRET).' });
  }

  const chave = process.env.RESEND_API_KEY;
  if (!chave) {
    // Sem chave só é aceito rodando local: o código aparece no terminal
    if (process.env.VERCEL) return json(res, 500, { erro: 'Envio de e-mail não configurado (RESEND_API_KEY).' });
    console.log(`\n[dev] código para ${email}: ${codigo}\n`);
  } else {
    const msg = emailCodigo(codigo);
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_REMETENTE || 'FT Training <acesso@fttraining.com.br>',
        to: [email],
        subject: msg.assunto,
        html: msg.html,
        text: msg.texto
      })
    });
    if (!r.ok) {
      console.error('Resend falhou', r.status, await r.text());
      return json(res, 502, { erro: 'Não consegui enviar o e-mail agora. Tente de novo em instantes.' });
    }
  }

  addCookie(res, cookie('ft_otp', `${Buffer.from(email).toString('base64url')}.${x}.${hash}`, VALIDADE, { path: '/api/auth' }));
  return json(res, 200, { ok: true });
};

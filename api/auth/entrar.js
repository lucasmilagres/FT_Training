// POST /api/auth/entrar  { codigo }  → confere o código do e-mail e abre a sessão (1 ano).
const { assina, iguais, agora, lerCookies, cookie, addCookie, emailsLiberados, iniciarSessao, json } = require('../_lib/sessao');

module.exports = function (req, res) {
  if (req.method !== 'POST') return json(res, 405, { erro: 'Método não permitido' });

  const codigo = String((req.body && req.body.codigo) || '').replace(/\D/g, '');
  const [emailB64, x, hash] = String(lerCookies(req).ft_otp || '').split('.');
  if (!emailB64 || !hash) return json(res, 400, { erro: 'Peça um novo código.' });
  if (Number(x) < agora()) return json(res, 400, { erro: 'Código expirado. Peça um novo.' });

  const email = Buffer.from(emailB64, 'base64url').toString();
  let certo = false;
  try { certo = codigo.length === 8 && iguais(hash, assina(`otp|${email}|${x}|${codigo}`)); } catch (e) {
    return json(res, 500, { erro: 'Login ainda não configurado no servidor (SESSION_SECRET).' });
  }
  if (!certo) return json(res, 401, { erro: 'Código incorreto. Confira o e-mail e tente de novo.' });
  if (!emailsLiberados().includes(email)) return json(res, 403, { erro: 'Esse e-mail não tem acesso à área de treinos.' });

  addCookie(res, cookie('ft_otp', '', 0, { path: '/api/auth' }));
  iniciarSessao(res, email);
  return json(res, 200, { ok: true });
};

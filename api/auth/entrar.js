// POST /api/auth/entrar  { codigo }  → confere o código do e-mail e abre a sessão (1 ano).
// Equipe da TV (TREINOS_EMAILS) vai para /treinos; aluno cadastrado pelo coach vai para /aluno.
const { assina, iguais, agora, lerCookies, cookie, addCookie, emailsLiberados, iniciarSessao, json } = require('../_lib/sessao');
const banco = require('../_lib/banco');

module.exports = async function (req, res) {
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

  if (emailsLiberados().includes(email)) {
    addCookie(res, cookie('ft_otp', '', 0, { path: '/api/auth' }));
    iniciarSessao(res, email);
    return json(res, 200, { ok: true, destino: '/treinos' });
  }

  // Aluno (ou coach cadastrado só no banco): abre o perfil, usando o convite no 1º acesso
  let perfil = null;
  try { perfil = await banco.entrarComGoogle(email, ''); } catch (e) {
    console.error('entrar código:', e.message);
    return json(res, 502, { erro: 'Não consegui abrir o seu cadastro agora. Tente de novo em instantes.' });
  }
  if (!perfil || !perfil.ativo) return json(res, 403, { erro: 'O seu acesso ainda não foi liberado. Fale com o seu coach.' });

  addCookie(res, cookie('ft_otp', '', 0, { path: '/api/auth' }));
  iniciarSessao(res, email, { coach: false });
  return json(res, 200, { ok: true, destino: perfil.papel === 'aluno' ? '/aluno' : '/coach' });
};

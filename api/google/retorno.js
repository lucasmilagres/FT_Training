// GET /api/google/retorno → o Google volta para cá depois que o coach autoriza.
// Troca o código por um refresh token e guarda (criptografado) no Blob.
const { iguais, usuario, lerCookies, cookie, addCookie } = require('../_lib/sessao');
const google = require('../_lib/google');
const { salvarConta } = require('../_lib/config');

const ir = (res, url) => { res.statusCode = 302; res.setHeader('Location', url); res.setHeader('Cache-Control', 'no-store'); res.end(); };
const base = (req) => `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
const falha = (res, msg) => ir(res, '/planilha?google=erro&msg=' + encodeURIComponent(msg));

module.exports = async function (req, res) {
  let email;
  try { email = usuario(req, res); } catch (e) { email = null; }
  if (!email) return ir(res, '/entrar?volta=/planilha');

  const q = new URL(req.url, 'http://x').searchParams;
  const state = lerCookies(req).ft_gstate;
  addCookie(res, cookie('ft_gstate', '', 0, { path: '/api/google' }));

  if (q.get('error')) return falha(res, q.get('error') === 'access_denied' ? 'Você cancelou a conexão com o Google.' : 'O Google não autorizou: ' + q.get('error'));
  if (!state || !q.get('state') || !iguais(state, q.get('state'))) return falha(res, 'A conexão expirou. Clique em "Conectar com Google" de novo.');
  if (!q.get('code')) return falha(res, 'O Google não devolveu a autorização.');

  try {
    const conta = await google.trocarCodigo(q.get('code'), base(req) + '/api/google/retorno');
    await salvarConta(conta.email, conta.refresh);
    return ir(res, '/planilha?google=conectado');
  } catch (e) {
    console.error('google retorno:', e.message);
    return falha(res, e.message);
  }
};

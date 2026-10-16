// GET /api/google/conectar → manda o coach (logado) para a tela de permissão do Google.
const { crypto, usuario, cookie, addCookie } = require('../_lib/sessao');
const google = require('../_lib/google');

const ir = (res, url) => { res.statusCode = 302; res.setHeader('Location', url); res.setHeader('Cache-Control', 'no-store'); res.end(); };
const base = (req) => `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;

module.exports = function (req, res) {
  let email;
  try { email = usuario(req, res); } catch (e) { email = null; }
  if (!email) return ir(res, '/entrar?volta=/planilha');

  // "state" contra login forjado: o retorno só é aceito no navegador que começou o login
  const state = crypto.randomBytes(24).toString('base64url');
  addCookie(res, cookie('ft_gstate', state, 10 * 60, { path: '/api/google' }));

  try {
    return ir(res, google.urlLogin(base(req) + '/api/google/retorno', state));
  } catch (e) {
    return ir(res, '/planilha?google=erro&msg=' + encodeURIComponent(e.message));
  }
};

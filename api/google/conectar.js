// GET /api/google/conectar → manda para a tela de permissão do Google.
//   ?login=1&volta=/treinos → "Entrar com Google" na tela /entrar (alunos e equipe; só nome e e-mail)
//   sem login=1             → coach já logado conectando o Drive em /planilha (drive.file)
const { crypto, selar, usuario, cookie, addCookie } = require('../_lib/sessao');
const google = require('../_lib/google');

const ir = (res, url) => { res.statusCode = 302; res.setHeader('Location', url); res.setHeader('Cache-Control', 'no-store'); res.end(); };
const base = (req) => `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;

module.exports = function (req, res) {
  const q = new URL(req.url, 'http://x').searchParams;
  const login = q.get('login') === '1';
  let volta = q.get('volta') || '';
  if (!/^\/(?!\/)/.test(volta)) volta = '';

  if (!login) {
    let email;
    try { email = usuario(req, res); } catch (e) { email = null; }
    if (!email) return ir(res, '/entrar?volta=/planilha');
  }

  // "state" contra login forjado: o retorno só é aceito no navegador que começou o login.
  // O cookie guarda também se é login ou conexão e para onde voltar (assinado, não dá para alterar).
  const state = crypto.randomBytes(24).toString('base64url');
  try {
    addCookie(res, cookie('ft_gstate', selar({ s: state, login, volta }), 10 * 60, { path: '/api/google' }));
    return ir(res, google.urlLogin(base(req) + '/api/google/retorno', state, { login }));
  } catch (e) {
    return ir(res, (login ? '/entrar?erro=' : '/planilha?google=erro&msg=') + encodeURIComponent(e.message));
  }
};

// GET /api/google/retorno → o Google volta para cá depois da permissão.
// - Conexão (coach já logado, em /planilha): guarda a conta Google (refresh token criptografado).
// - Login (botão "Entrar com Google" em /entrar): abre a sessão do site se o e-mail for autorizado
//   e, se for o coach principal (1º e-mail de TREINOS_EMAILS), já conecta a conta Google também:
//   um login só para entrar e ligar a planilha. Outros e-mails autorizados só entram no site.
const { abrir, iguais, usuario, lerCookies, cookie, addCookie, emailsLiberados, iniciarSessao } = require('../_lib/sessao');
const google = require('../_lib/google');
const { salvarConta, lerConfig } = require('../_lib/config');

const ir = (res, url) => { res.statusCode = 302; res.setHeader('Location', url); res.setHeader('Cache-Control', 'no-store'); res.end(); };
const base = (req) => `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;

module.exports = async function (req, res) {
  const q = new URL(req.url, 'http://x').searchParams;
  let st = null;
  try { st = abrir(lerCookies(req).ft_gstate); } catch (e) { st = null; }
  addCookie(res, cookie('ft_gstate', '', 0, { path: '/api/google' }));

  const login = !!(st && st.login);
  const falha = (msg) => ir(res, (login ? '/entrar?erro=' : '/planilha?google=erro&msg=') + encodeURIComponent(msg));

  if (q.get('error')) return falha(q.get('error') === 'access_denied' ? 'Você cancelou o login com o Google.' : 'O Google não autorizou: ' + q.get('error'));
  if (!st || !q.get('state') || !iguais(st.s, q.get('state'))) return falha('O login expirou. Tente de novo.');
  if (!q.get('code')) return falha('O Google não devolveu a autorização.');

  // Conexão a partir de /planilha exige estar logado no site
  let logado = null;
  try { logado = usuario(req, res); } catch (e) { logado = null; }
  if (!login && !logado) return ir(res, '/entrar?volta=/planilha');

  try {
    const conta = await google.trocarCodigo(q.get('code'), base(req) + '/api/google/retorno');

    if (!login) {
      await salvarConta(conta.email, conta.refresh);
      return ir(res, '/planilha?google=conectado');
    }

    const liberados = emailsLiberados();
    if (!conta.verificado || !liberados.includes(conta.email)) {
      await google.revogar(conta.refresh);
      return falha(`A conta ${conta.email || 'do Google'} não tem acesso à área de treinos.`);
    }

    iniciarSessao(res, conta.email);

    if (conta.email !== liberados[0]) {
      await google.revogar(conta.refresh);   // só entra no site; não mexe na planilha ligada
      return ir(res, st.volta || '/treinos');
    }

    await salvarConta(conta.email, conta.refresh);
    const cfg = await lerConfig().catch(() => null);
    return ir(res, cfg && cfg.id ? (st.volta || '/treinos') : '/planilha?google=conectado');
  } catch (e) {
    console.error('google retorno:', e.message);
    return falha(e.message);
  }
};

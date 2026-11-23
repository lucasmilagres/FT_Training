// GET /api/google/retorno → o Google volta para cá depois da permissão.
// - Conexão (coach já logado, em /planilha): guarda a conta Google (refresh token criptografado).
// - Login (botão "Entrar com Google" em /entrar): o Google só confirma nome e e-mail.
//     · Equipe (TREINOS_EMAILS): abre a sessão de coach. O coach principal (1º e-mail) que ainda
//       não ligou o Drive segue direto para a permissão do Drive: um login só para entrar e ligar a planilha.
//     · Aluno: precisa de perfil ativo no banco (convite do coach). Sem convite, o perfil fica
//       como pedido de acesso e a pessoa vê o aviso para falar com o coach.
//     · Coach/admin cadastrado só no banco (fora de TREINOS_EMAILS): vai para o painel /coach.
const { abrir, iguais, usuario, lerCookies, cookie, addCookie, emailsLiberados, iniciarSessao } = require('../_lib/sessao');
const google = require('../_lib/google');
const banco = require('../_lib/banco');
const { salvarConta, lerConfig, lerConta } = require('../_lib/config');

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

  // Conexão a partir de /planilha exige estar logado como coach
  let logado = null;
  try { logado = usuario(req, res); } catch (e) { logado = null; }
  if (!login && !logado) return ir(res, '/entrar?volta=/planilha');

  try {
    const conta = await google.trocarCodigo(q.get('code'), base(req) + '/api/google/retorno', { login });

    if (!login) {
      await salvarConta(conta.email, conta.refresh);
      return ir(res, '/planilha?google=conectado');
    }

    if (!conta.verificado || !conta.email) return falha('O Google não confirmou o e-mail dessa conta.');

    const liberados = emailsLiberados();
    const coach = liberados.includes(conta.email);

    // Perfil no banco (cria no 1º acesso). Se o banco cair, a equipe ainda entra na TV.
    let perfil = null;
    if (banco.configurado()) {
      try { perfil = await banco.entrarComGoogle(conta.email, conta.nome); } catch (e) {
        console.error('entrar_com_google:', e.message);
        if (!coach) return falha('Não consegui abrir o seu cadastro agora. Tente de novo em instantes.');
      }
    }

    if (!coach) {
      if (!perfil) return falha(`A conta ${conta.email} não tem acesso.`);
      if (!perfil.ativo) return falha(`Recebemos o seu pedido de acesso com ${conta.email}. Fale com o seu coach para liberar.`);
      iniciarSessao(res, conta.email, { coach: false });
      // coach cadastrado só no banco: painel (a TV e a planilha continuam só para TREINOS_EMAILS)
      return ir(res, perfil.papel === 'aluno' ? '/aluno' : '/coach');
    }

    iniciarSessao(res, conta.email);
    const destino = st.volta || '/treinos';
    if (conta.email !== liberados[0]) return ir(res, destino);

    // Coach principal: liga o Drive na primeira vez (a planilha da TV é lida com essa conta)
    const ligada = await lerConta().catch(() => null);
    if (!ligada) return ir(res, '/api/google/conectar');
    const cfg = await lerConfig().catch(() => null);
    return ir(res, cfg && cfg.id ? destino : '/planilha');
  } catch (e) {
    console.error('google retorno:', e.message);
    return falha(e.message);
  }
};

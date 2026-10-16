// /api/google/conta (só logado)
// GET    → login com Google está configurado? qual conta está conectada?
// POST   → token curto + chave de API para abrir o Google Picker ("Escolher planilha")
// DELETE → desconecta a conta (revoga no Google e apaga o token)
const { usuario, json } = require('../_lib/sessao');
const google = require('../_lib/google');
const { lerConta, apagarConta, lerConfig, apagarConfig } = require('../_lib/config');
const { limparCache } = require('../_lib/fonte');

module.exports = async function (req, res) {
  let email;
  try { email = usuario(req, res); } catch (e) {
    return json(res, 500, { erro: 'Login ainda não configurado no servidor (SESSION_SECRET).' });
  }
  if (!email) return json(res, 401, { erro: 'Faça login de novo.' });

  const configurado = !!(google.clienteOAuth() && process.env.GOOGLE_API_KEY);
  let conta = null;
  try { conta = await lerConta(); } catch (e) { console.error('conta google:', e.message); }

  if (req.method === 'GET') {
    return json(res, 200, { configurado, conectado: !!conta, email: conta ? conta.email : null });
  }

  if (req.method === 'POST') {
    if (!configurado) return json(res, 503, { erro: 'O login com Google ainda não foi configurado no servidor.' });
    if (!conta) return json(res, 400, { erro: 'Conecte sua conta Google primeiro.' });
    try {
      return json(res, 200, { token: await google.acessoConta(conta.refresh), apiKey: process.env.GOOGLE_API_KEY, appId: google.appId() });
    } catch (e) {
      return json(res, e.status || 502, { erro: e.message });
    }
  }

  if (req.method === 'DELETE') {
    if (conta) await google.revogar(conta.refresh);
    await apagarConta();
    // a planilha ligada por essa conta para de funcionar junto
    const cfg = await lerConfig().catch(() => null);
    if (cfg && cfg.modo === 'google') await apagarConfig();
    limparCache();
    return json(res, 200, { ok: true });
  }

  return json(res, 405, { erro: 'Método não permitido' });
};

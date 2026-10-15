// POST /api/auth/sair → encerra a sessão neste aparelho.
const { encerrarSessao, json } = require('../_lib/sessao');

module.exports = function (req, res) {
  if (req.method !== 'POST') return json(res, 405, { erro: 'Método não permitido' });
  encerrarSessao(res);
  return json(res, 200, { ok: true });
};

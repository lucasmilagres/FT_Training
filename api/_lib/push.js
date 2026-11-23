// Notificações (Web Push) para o app instalado.
// Variável: VAPID_PRIVATE_KEY (a chave pública é calculada a partir dela).
// O conteúdo vai criptografado até o aparelho: os serviços de push (Apple, Google, Mozilla)
// só entregam, não leem. Mesmo assim, as mensagens não levam comentários dos alunos.
const crypto = require('crypto');
const webpush = require('web-push');
const banco = require('./banco');

const ASSUNTO = 'https://www.fttraining.com.br';
const uuidOk = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ''));
function erro(status, msg) { const e = new Error(msg); e.status = status; return e; }

let pronto = null;
function chaves() {
  const priv = (process.env.VAPID_PRIVATE_KEY || '').trim();
  if (!priv) return null;
  if (pronto && pronto.priv === priv) return pronto;
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.setPrivateKey(Buffer.from(priv, 'base64url'));
  const pub = ecdh.getPublicKey(null, 'uncompressed').toString('base64url');
  webpush.setVapidDetails(ASSUNTO, pub, priv);
  pronto = { priv, pub };
  return pronto;
}

const configurado = () => { try { return !!chaves(); } catch (e) { return false; } };
const chavePublica = () => { const c = chaves(); return c ? c.pub : null; };

// inscricao = PushSubscription.toJSON() do navegador
async function inscrever(perfilId, inscricao, aparelho) {
  const s = inscricao && typeof inscricao === 'object' ? inscricao : {};
  const endpoint = String(s.endpoint || '');
  const p256dh = String((s.keys && s.keys.p256dh) || '');
  const auth = String((s.keys && s.keys.auth) || '');
  if (!/^https:\/\/[^\s]{10,2000}$/.test(endpoint) || !/^[A-Za-z0-9_-]{60,120}$/.test(p256dh) || !/^[A-Za-z0-9_-]{10,40}$/.test(auth)) {
    throw erro(400, 'Inscrição de notificação inválida.');
  }
  await banco.upsert('push_inscricoes', {
    perfil_id: perfilId, endpoint, p256dh, auth, aparelho: String(aparelho || '').slice(0, 120) || null
  }, 'endpoint');
}

async function cancelar(perfilId, endpoint) {
  await banco.apagar('push_inscricoes', 'endpoint=eq.' + encodeURIComponent(String(endpoint || '')) + '&perfil_id=eq.' + perfilId);
}

// Envia para todos os aparelhos das pessoas. aviso = { titulo, texto, url, tag }. Devolve quantos chegaram.
async function enviar(perfilIds, aviso) {
  const ids = [...new Set((perfilIds || []).filter(uuidOk))];
  if (!ids.length || !configurado() || !banco.configurado()) return 0;
  const inscs = await banco.ler('push_inscricoes', 'select=id,endpoint,p256dh,auth&perfil_id=in.(' + ids.join(',') + ')');
  const corpo = JSON.stringify({
    titulo: String(aviso.titulo || 'FT Training').slice(0, 80),
    texto: String(aviso.texto || '').slice(0, 200),
    url: /^\/(?!\/)/.test(aviso.url || '') ? aviso.url : '/app',
    tag: String(aviso.tag || '').slice(0, 60)
  });
  const res = await Promise.allSettled(inscs.map((i) => webpush.sendNotification(
    { endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } }, corpo, { TTL: 12 * 3600, urgency: 'normal', timeout: 8000 }
  )));
  // aparelho que desinstalou o app ou tirou a permissão: apaga a inscrição
  const vencidas = inscs.filter((i, k) => res[k].status === 'rejected' && [404, 410].includes(res[k].reason && res[k].reason.statusCode));
  if (vencidas.length) await banco.apagar('push_inscricoes', 'id=in.(' + vencidas.map((i) => i.id).join(',') + ')').catch(() => {});
  res.forEach((r, k) => {
    if (r.status === 'rejected' && !vencidas.includes(inscs[k])) console.error('push falhou:', r.reason && (r.reason.statusCode || r.reason.message));
  });
  return res.filter((r) => r.status === 'fulfilled').length;
}

// Para usar dentro de outras ações: nunca quebra a ação principal se o aviso falhar
async function avisar(perfilIds, aviso) {
  try { return await enviar(perfilIds, aviso); } catch (e) { console.error('push:', e.message); return 0; }
}

module.exports = { configurado, chavePublica, inscrever, cancelar, enviar, avisar };

/* Service worker do app FT Training (área do aluno e painel do coach).
   Rede primeiro: com internet, sempre a versão mais nova; sem internet, a última que abriu.
   Só cuida das páginas do app e de GET /api/aluno e /api/coach; o resto do site passa direto.
   Ao sair da conta, a página pede para apagar os dados salvos (mensagem "limpar"). */
const VERSAO = 'ft-app-v1';
const API = 'ft-app-api';

const SHELL = [
  '/app', '/aluno', '/coach', '/entrar',
  '/css/painel.css', '/js/app.js', '/js/aluno.js', '/js/coach.js', '/js/entrar.js', '/js/pwa.js',
  '/assets/brand/ft-logo-sm.webp', '/assets/brand/icon-192.png', '/app.webmanifest'
];
const PAGINAS = /^\/(app|aluno|coach|entrar)(\.html)?\/?$/;
const ESTATICOS = /^\/(css\/painel\.css|js\/(app|aluno|coach|entrar|pwa)\.js|assets\/brand\/|app\.webmanifest)/;
const DADOS = /^\/api\/(aluno|coach)$/;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO && n !== API).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.tipo === 'limpar') e.waitUntil(caches.delete(API));
});

// tenta a rede; se der certo guarda uma cópia, se falhar devolve a cópia guardada
async function redePrimeiro(req, cache, chave) {
  try {
    const r = await fetch(req);
    if (r.ok && r.type === 'basic') (await caches.open(cache)).put(chave || req, r.clone());
    return r;
  } catch (erro) {
    const guardada = await caches.match(chave || req, { cacheName: cache, ignoreVary: true });
    if (guardada) return guardada;
    throw erro;
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (PAGINAS.test(url.pathname)) {
    // uma cópia por página, sem a query (?volta=, ?erro=)
    e.respondWith(redePrimeiro(req, VERSAO, url.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/'));
  } else if (ESTATICOS.test(url.pathname)) {
    e.respondWith(redePrimeiro(req, VERSAO, url.pathname));
  } else if (DADOS.test(url.pathname)) {
    e.respondWith(redePrimeiro(req, API));
  }
});

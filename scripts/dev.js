// Servidor local que imita a Vercel: arquivos estáticos, URLs sem .html e funções em /api.
// Rodar na raiz do projeto: node scripts/dev.js   →   http://localhost:5173
// Variáveis de ambiente: crie .env.local (veja .env.example). Sem RESEND_API_KEY o código
// de login aparece aqui no terminal em vez de ir por e-mail.
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const PORTA = +process.env.PORT || 5173;

const envLocal = path.join(root, '.env.local');
if (fs.existsSync(envLocal)) {
  fs.readFileSync(envLocal, 'utf8').split(/\r?\n/).forEach((l) => {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  });
}

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json'
};

async function api(req, res, rota) {
  const arquivo = path.join(root, rota + '.js');
  if (!arquivo.startsWith(path.join(root, 'api')) || /[\\/]_/.test(rota) || !fs.existsSync(arquivo)) {
    res.statusCode = 404; return res.end('{"erro":"não encontrado"}');
  }
  let corpo = '';
  for await (const parte of req) corpo += parte;
  try { req.body = corpo ? JSON.parse(corpo) : {}; } catch (e) { req.body = {}; }
  delete require.cache[arquivo]; // edita e testa sem reiniciar
  Object.keys(require.cache).filter((k) => k.includes(path.join('api', '_lib'))).forEach((k) => delete require.cache[k]);
  try { await require(arquivo)(req, res); } catch (e) {
    console.error(e); res.statusCode = 500; res.end('{"erro":"falha no servidor local"}');
  }
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = decodeURIComponent(url.pathname);
  if (p.startsWith('/api/')) return api(req, res, p.replace(/\/$/, ''));

  let arquivo = path.join(root, p);
  if (!arquivo.startsWith(root)) { res.statusCode = 403; return res.end(); }
  if (p.endsWith('/')) arquivo = path.join(arquivo, 'index.html');
  else if (!path.extname(arquivo) && fs.existsSync(arquivo + '.html')) arquivo += '.html';

  fs.readFile(arquivo, (err, dados) => {
    if (err) { res.statusCode = 404; return res.end('404'); }
    res.setHeader('Content-Type', TIPOS[path.extname(arquivo)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.end(dados);
  });
}).listen(PORTA, () => console.log(`FT Training local: http://localhost:${PORTA}`));

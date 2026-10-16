# Site FT Training

Site institucional estático (HTML + CSS + JS). Não precisa de build.

## Rodar localmente
```
node scripts/dev.js
```
Abra http://localhost:5173

## Estrutura
- `index.html` — conteúdo das seções
- `css/style.css` — visual (cores em `:root`)
- `js/data.js` — **conteúdo editável**: WhatsApp, reels do baralho, feed do Instagram
- `js/main.js` — animações (GSAP + ScrollTrigger + Lenis), baralho, horários ao vivo
- `js/hero3d.js` — piso 3D de cruzes do hero (Three.js)
- `assets/reels` — vídeos e capas do baralho (`reel-01.mp4` ... `reel-06.mp4`)
- `assets/feed` — retrato do feed do Instagram
- `assets/partners` — logos dos parceiros
- `assets/brand` — logo grafite FT (`ft-logo.png` em alta, `ft-logo-640.png` para uso geral), favicons e `ft-profile.jpg` (foto de perfil do Instagram, usada só onde o site imita o Instagram)

## Tarefas comuns
- **Trocar um reel:** salve o novo `.mp4` e a capa `.webp` (540x960) em `assets/reels` e ajuste `code`/`tag` em `js/data.js`.
- **Feed do Instagram ao vivo:** crie um feed gratuito em https://behold.so (conectar o Instagram da FT, formato JSON) e cole a URL em `beholdFeedUrl` no `js/data.js`. Sem isso, o site mostra o retrato salvo em `assets/feed`.
- **Horários:** HTML da seção `#horarios` + array `SLOTS` no topo de `js/main.js`.
- **WhatsApp:** campo `whatsapp` em `js/data.js`.
- **Google Analytics 4:** ID em `GA_ID` no topo de `js/analytics.js`. Só envia dados em www.fttraining.com.br e só grava cookies depois que a pessoa aceita o aviso (Consent Mode v2). Eventos próprios: `clique_whatsapp` e `clique_instagram`, com o parâmetro `origem` (de onde veio o clique).

## Área do coach (login + treinos na TV)
- `/entrar` — login sem senha: e-mail → código de 8 dígitos enviado pelo Resend (de `acesso@fttraining.com.br`). A sessão dura 1 ano e se renova sozinha com o uso (a TV não desloga).
- `/treinos` — treino do dia em tela cheia para a TV do box. Só abre logado. A aba **Treinos** aparece no menu do site para quem está logado; o link "Área do coach" fica no rodapé.
- **Ligar a planilha:** o coach entra em `/planilha` (botão "Planilha" na tela da TV), cola o link da planilha do Google Sheets e compartilha a planilha com o e-mail do robô (mostrado na página) como **Leitor**. A planilha continua privada. O site lê pela API do Google com uma conta de serviço (`GOOGLE_SERVICE_ACCOUNT`) e guarda o link no Vercel Blob privado `ft-config`.
- Os treinos vêm da planilha do Google Sheets: uma linha por treino, com uma coluna **Data** (`15/10/2026`, `15/10` ou `qui 15/10`) e uma coluna para cada parte (ex.: `Modalidade | Aquecimento | Força | WOD`). Coluna "Modalidade" vira o título do quadro; colunas com título começando em `_` não aparecem (anotações). Duas linhas na mesma data = dois treinos lado a lado.
- A TV relê a planilha a cada 5 min e troca de dia sozinha (às 05h a página recarrega inteira). Não precisa de cron nem banco de dados: o dia certo sai da coluna Data. Setas ← → no teclado/controle mostram outros dias (volta para hoje sozinha em 3 min).
- Código: `api/` (funções da Vercel), `entrar.html` + `js/entrar.js`, `treinos.html` + `js/treinos.js`, `planilha.html` + `js/planilha.js`, `css/painel.css`. Dependência: `@vercel/blob` (rode `npm install` para testar local).
- **Variáveis de ambiente na Vercel** (Settings → Environment Variables), explicadas em `.env.example`: `RESEND_API_KEY`, `SESSION_SECRET`, `TREINOS_EMAILS`, `GOOGLE_SERVICE_ACCOUNT`, `BLOB_READ_WRITE_TOKEN`. Depois de mudar, faça um novo deploy.
- **Testar local:** copie `.env.example` para `.env.local`, preencha e rode `node scripts/dev.js` (substitui o http-server: serve o site e as funções de `/api`). Sem `RESEND_API_KEY` o código de login aparece no terminal.

## Publicar
Hospedado na Vercel (as funções de `/api` exigem Vercel). Push na branch `main` publica sozinho.

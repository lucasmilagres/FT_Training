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
- **Ligar a planilha:** o coach entra em `/planilha` (botão "Planilha" na tela da TV), cola o link da planilha do Google Sheets e compartilha a planilha com o e-mail do robô (mostrado na página) como **Leitor**, ou usa **Entrar com Google** e escolhe a planilha numa janela do Google (escopo `drive.file`: o site só vê a planilha escolhida). A planilha continua privada. O link e a conexão Google (refresh token criptografado com o `SESSION_SECRET`) ficam no Vercel Blob privado `ft-config`.
- **Formato da planilha do coach (semanal):** uma aba por mês ("OUTUBRO HYROX 2026", "NOVEMBRO HYROX 2026"…), um bloco por semana com a linha de títulos colorida (nome do treino de cada dia) e uma coluna por dia, segunda a sexta. Não há datas: o 1º bloco é a semana do 1º dia útil do mês, o 2º a seguinte etc. Título sem treino embaixo (ex.: "FERIADO NOSSA SENHORA") aparece como aviso na TV. "ESTAÇÃO 1", "ESTAÇÃO 2"… e linhas em branco dividem o treino em quadros. Código em `api/_lib/semana.js`.
- Formato alternativo (por data), usado se a planilha não tiver abas de mês: uma linha por treino, com uma coluna **Data** (`15/10/2026`, `15/10` ou `qui 15/10`) e uma coluna para cada parte (ex.: `Modalidade | Aquecimento | Força | WOD`). Coluna "Modalidade" vira o título do quadro; colunas com título começando em `_` não aparecem (anotações). Duas linhas na mesma data = dois treinos lado a lado.
- A TV relê a planilha a cada 5 min e troca de dia sozinha (às 05h a página recarrega inteira). Não precisa de cron nem banco de dados: o dia certo sai da coluna Data. Setas ← → no teclado/controle mostram outros dias (volta para hoje sozinha em 3 min).
- Código: `api/` (funções da Vercel), `entrar.html` + `js/entrar.js`, `treinos.html` + `js/treinos.js`, `planilha.html` + `js/planilha.js`, `css/painel.css`. Dependência: `@vercel/blob` (rode `npm install` para testar local).
- **Variáveis de ambiente na Vercel** (Settings → Environment Variables), explicadas em `.env.example`: `RESEND_API_KEY`, `SESSION_SECRET`, `TREINOS_EMAILS`, `GOOGLE_SERVICE_ACCOUNT`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`. Depois de mudar, faça um novo deploy.
- **Testar local:** copie `.env.example` para `.env.local`, preencha e rode `node scripts/dev.js` (substitui o http-server: serve o site e as funções de `/api`). Sem `RESEND_API_KEY` o código de login aparece no terminal.

## Área do aluno (em construção)
- **Login:** o mesmo "Entrar com Google" de `/entrar`, pedindo só nome e e-mail (o Drive só é pedido quando o coach liga a planilha). Quem está em `TREINOS_EMAILS` continua sendo da equipe (TV e planilha). Os demais precisam de perfil **ativo** no banco: o coach cadastra o e-mail Google do aluno em `convites` e, no 1º login, o perfil já nasce liberado. Sem convite, o login cria um pedido de acesso (`ativo = false`) e a pessoa vê um aviso para falar com o coach.
- `/aluno` — treinos da semana do aluno (seg → dom), pensado para o celular. **Marcar como feito** (no dia ou depois, nunca antes): esforço de 1 a 10, tempo, distância (corrida/Hyrox) e comentário para o coach; dá para editar e desmarcar. No 1º registro o aluno concorda com o uso desses dados (LGPD; data em `perfis.consentimento_saude_em`). O coach vê tudo no calendário do painel. Código: `aluno.html`, `js/aluno.js`, `api/aluno.js`.
- `/coach` — painel da equipe (perfil ativo admin ou coach; botão "Painel" na tela da TV). **Alunos:** convidar pelo e-mail Google, pedidos de acesso (admin libera e escolhe o coach), convites pendentes, lista com treinos feitos/marcados na semana. **Semana do aluno:** calendário seg → dom, "+ Treino" em cada dia aplica um modelo (o treino guarda uma cópia: mudar o modelo depois não altera o que já foi marcado), × tira do dia, "Copiar esta semana para a próxima". **Treinos:** modelos com blocos "Repetir N x" e atividades (equipamento, séries, reps, carga, distância, descanso, observação). Coach só vê e mexe nos alunos dele; admin vê todos. Código: `coach.html`, `js/coach.js`, `api/coach.js` (uma função só, com `acao`, por causa do limite de 12 funções do plano Hobby da Vercel).
- **TV com IA (aba "TV" do painel):** "Ler a semana com IA" manda o texto da semana da planilha (seg → sex, uma chamada só) para o Gemini (`api/_lib/gemini.js`, chave `GEMINI_API_KEY`), que devolve cada dia em partes e itens (quantidade + exercício, formato como "3 rounds · cap 25 min"). `api/_lib/tvia.js` confere a resposta: número que não está na planilha ou palavra da planilha que sumiu vira alerta. Cada dia fica em `tv_dias` como rascunho; só depois de **aprovado** a TV usa o layout novo, e só enquanto a planilha daquele dia não mudar (hash). Se mudar, se a IA cair ou se o banco falhar, a TV volta para a leitura direta da planilha. O modelo é escolhido sozinho (o `gemini-X-flash` mais novo) ou fixado em `GEMINI_MODELO`.
- **App instalável (PWA):** `app.webmanifest` (abre em `/app`, que leva o aluno para `/aluno` e a equipe para `/coach`) + `sw.js` (rede primeiro: sem internet abre a última versão das telas e da semana carregada) + `js/pwa.js` (registra o service worker, botão "Instalar app" no Android/Chrome, dica de "Adicionar à Tela de Início" no iPhone, aviso de sem internet). "Sair" e a tela `/entrar` apagam os dados guardados no aparelho. Ao mudar arquivos do app, troque `VERSAO` no `sw.js` para os aparelhos baixarem a nova lista.
- **Notificações (Web Push):** botão "🔔 Ativar avisos" em `/aluno` e `/coach` (`js/pwa.js`); o aparelho recebe na hora "Avisos ligados ✓". Avisos: aluno recebe "Novo treino" quando o coach marca treino (hoje em diante) ou copia a semana; o coach recebe "Fulano treinou ✓" quando um aluno dele marca feito pela 1ª vez (sem o texto do comentário); lembrete da manhã ("Treino de hoje") pelo cron da Vercel, `0 8 * * *` UTC = entre 05h e 06h em Brasília. Código: `api/_lib/push.js`, `api/push.js`, `sw.js` (eventos push/notificationclick), tabela `push_inscricoes`. Variáveis: `VAPID_PRIVATE_KEY`, `CRON_SECRET`. iPhone só recebe com o app instalado na Tela de Início (iOS 16.4+). "Sair" desliga os avisos daquele aparelho.
- **Banco:** Supabase (projeto "FT-Training", região São Paulo) usado **só como banco**, sem o login do Supabase. Só as funções de `api/` acessam, com a chave secreta (`api/_lib/banco.js`); as chaves públicas não enxergam nada. As permissões (aluno só vê o que é dele) ficam no código de `api/`. Estrutura em `supabase/migrations/` (rodar no SQL Editor do Supabase).

## Publicar
Hospedado na Vercel (as funções de `/api` exigem Vercel). Push na branch `main` publica sozinho.

# Site FT Training

Site institucional estático (HTML + CSS + JS). Não precisa de build.

## Rodar localmente
```
npx http-server . -p 5173 -c-1
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
- `assets/brand` — logo FT (foto de perfil, 150px — trocar por arquivo em alta)

## Tarefas comuns
- **Trocar um reel:** salve o novo `.mp4` e a capa `.jpg` em `assets/reels` e ajuste `code`/`tag` em `js/data.js`.
- **Feed do Instagram ao vivo:** crie um feed gratuito em https://behold.so (conectar o Instagram da FT, formato JSON) e cole a URL em `beholdFeedUrl` no `js/data.js`. Sem isso, o site mostra o retrato salvo em `assets/feed`.
- **Horários:** HTML da seção `#horarios` + array `SLOTS` no topo de `js/main.js`.
- **WhatsApp:** campo `whatsapp` em `js/data.js`.

## Publicar
Qualquer hospedagem estática serve (Netlify, Vercel, GitHub Pages, Hostinger). Envie a pasta inteira, exceto `.claude/`.

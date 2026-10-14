/* =========================================================
   FT TRAINING — Google Analytics 4 + aviso de cookies (LGPD)
   Troque GA_ID pelo ID da propriedade (Admin → Fluxos de dados → G-...).
   ========================================================= */
(function () {
  const GA_ID = 'G-LM4H62YD9Z';
  const KEY = 'ft-consent';
  const live = /^G-[A-Z0-9]+$/.test(GA_ID) && GA_ID !== 'G-XXXXXXXXXX';
  // Só envia dados no domínio de produção (testes locais não sujam o relatório)
  const prod = /(^|\.)fttraining\.com\.br$/.test(location.hostname);

  const read = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const save = (v) => { try { localStorage.setItem(KEY, v); } catch (e) {} };

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;

  // Consent Mode v2: tudo negado até a pessoa aceitar
  const choice = read();
  gtag('consent', 'default', {
    analytics_storage: choice === 'granted' ? 'granted' : 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500
  });

  if (live && prod) {
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', GA_ID);
  }

  /* ---------- Cliques que importam ---------- */
  function where(el) {
    if (el.closest('.wpp-float')) return 'botao_flutuante';
    if (el.closest('.js-slot')) return 'horario_' + el.closest('.js-slot').dataset.h + 'h';
    if (el.closest('.footer')) return 'rodape';
    const sec = el.closest('section[id], header');
    return sec ? (sec.id || 'topo') : 'outro';
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    if (/wa\.me|whatsapp/.test(a.href)) gtag('event', 'clique_whatsapp', { origem: where(a) });
    else if (/instagram\.com/.test(a.href)) gtag('event', 'clique_instagram', { origem: where(a), destino: a.href });
  }, true);

  /* ---------- Aviso de cookies ---------- */
  function decide(v) {
    save(v);
    gtag('consent', 'update', { analytics_storage: v });
    const bar = document.querySelector('.consent');
    if (bar) bar.classList.remove('is-open');
  }
  function open() {
    let bar = document.querySelector('.consent');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'consent';
      bar.setAttribute('role', 'dialog');
      bar.setAttribute('aria-label', 'Aviso de cookies');
      bar.innerHTML =
        '<p>Usamos cookies do Google Analytics só para saber quantas pessoas visitam o site e o que elas acessam. Nada é vendido nem usado em anúncios.</p>' +
        '<div class="consent__btns">' +
        '<button type="button" class="consent__no">Recusar</button>' +
        '<button type="button" class="consent__ok">Aceitar</button>' +
        '</div>';
      bar.querySelector('.consent__ok').addEventListener('click', () => decide('granted'));
      bar.querySelector('.consent__no').addEventListener('click', () => decide('denied'));
      document.body.appendChild(bar);
    }
    void bar.offsetWidth; // força o layout para a transição de entrada rodar
    bar.classList.add('is-open');
  }
  window.ftCookies = open;

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.js-cookies').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); open(); }));
    if (!choice) setTimeout(open, 1800);
  });
})();

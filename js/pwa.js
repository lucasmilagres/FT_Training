/* App instalável (PWA) da área do aluno e do painel do coach.
   - registra o service worker (/sw.js): o app abre sem internet com a última semana carregada
   - botão "Instalar app" (Android/Chrome) ou dica de "Adicionar à Tela de Início" (iPhone)
   - aviso quando está sem internet
   - window.ftPwa.limpar(): apaga os dados salvos no aparelho (usado no "Sair") */
(function () {
  var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  var CHAVE_DICA = 'ft-pwa-dica-fechada';

  // última tela usada: o app abre nela quando está sem internet (veja js/app.js)
  if (/^\/(aluno|coach)/.test(location.pathname)) {
    try { localStorage.setItem('ft-app-destino', location.pathname.replace(/\.html$/, '')); } catch (e) {}
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }

  window.ftPwa = {
    limpar: function () {
      var feito = [];
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ tipo: 'limpar' });
      }
      if (window.caches) feito.push(caches.delete('ft-app-api').catch(function () {}));
      try { localStorage.removeItem('ft-app-destino'); } catch (e) {}
      return Promise.all(feito);
    }
  };

  // na tela de login, apaga o que outra conta possa ter deixado salvo neste aparelho
  if (/^\/entrar/.test(location.pathname)) window.ftPwa.limpar();

  // ---------- aviso de sem internet ----------
  var barra = document.createElement('div');
  barra.className = 'pwa-offline mono';
  barra.setAttribute('role', 'status');
  barra.textContent = 'Sem internet · mostrando a última versão salva';
  barra.hidden = navigator.onLine;
  function montarBarra() { document.body.appendChild(barra); }
  if (document.body) montarBarra(); else document.addEventListener('DOMContentLoaded', montarBarra);
  window.addEventListener('online', function () { barra.hidden = true; });
  window.addEventListener('offline', function () { barra.hidden = false; });

  // ---------- instalar ----------
  if (standalone) return;
  var dicaFechada = false;
  try { dicaFechada = localStorage.getItem(CHAVE_DICA) === '1'; } catch (e) {}

  function lugarDoBotao() { return document.querySelector('[data-pwa-instalar]'); }

  function botao(texto, aoClicar) {
    var alvo = lugarDoBotao();
    if (!alvo || alvo.querySelector('.pwa-instalar')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'pwa-instalar mono';
    b.textContent = texto;
    b.addEventListener('click', aoClicar);
    alvo.appendChild(b);
    return b;
  }

  // Android / Chrome / Edge: o navegador avisa que dá para instalar
  var pedido = null;
  window.addEventListener('beforeinstallprompt', function (ev) {
    ev.preventDefault();
    pedido = ev;
    var b = botao('Instalar app', function () {
      pedido.prompt();
      pedido.userChoice.then(function () { pedido = null; b.remove(); });
    });
  });
  window.addEventListener('appinstalled', function () {
    var b = document.querySelector('.pwa-instalar');
    if (b) b.remove();
  });

  // iPhone/iPad no Safari: não existe o aviso automático, então mostramos como fazer
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios && !dicaFechada) {
    document.addEventListener('DOMContentLoaded', function () {
      var dica = document.createElement('div');
      dica.className = 'pwa-dica';
      dica.innerHTML = '<p><b>Instale o app:</b> toque em <span class="pwa-dica__ico" aria-label="Compartilhar">⬆</span> Compartilhar e depois em <b>Adicionar à Tela de Início</b>.</p>';
      var x = document.createElement('button');
      x.type = 'button';
      x.className = 'pwa-dica__fechar';
      x.setAttribute('aria-label', 'Fechar dica');
      x.textContent = '×';
      x.addEventListener('click', function () {
        dica.remove();
        try { localStorage.setItem(CHAVE_DICA, '1'); } catch (e) {}
      });
      dica.appendChild(x);
      document.body.appendChild(dica);
    });
  }
})();

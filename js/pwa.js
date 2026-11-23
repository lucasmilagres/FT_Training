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
      feito.push(desligarAvisos().catch(function () {})); // aparelho compartilhado: o próximo não recebe avisos de outra pessoa
      try { localStorage.removeItem('ft-app-destino'); } catch (e) {}
      return Promise.all(feito);
    }
  };

  // ---------- notificações (Web Push) ----------
  var suportaPush = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  var iosNavegador = (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) && !standalone;

  function postPush(dados) {
    return fetch('/api/push', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados)
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.erro || 'Erro ' + r.status); return j; }); });
  }
  function bytesDaChave(b64) {
    var s = (b64 + '===='.slice((b64.length + 3) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function inscricaoAtual() {
    if (!suportaPush) return Promise.resolve(null);
    return navigator.serviceWorker.getRegistration().then(function (reg) { return reg ? reg.pushManager.getSubscription() : null; });
  }
  function ligarAvisos(chave) {
    return Notification.requestPermission().then(function (p) {
      if (p !== 'granted') throw new Error('permissao');
      return navigator.serviceWorker.register('/sw.js').then(function () { return navigator.serviceWorker.ready; });
    }).then(function (reg) {
      return reg.pushManager.getSubscription().then(function (s) {
        return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytesDaChave(chave) });
      });
    }).then(function (s) {
      var ua = navigator.userAgent;
      var aparelho = /iphone/i.test(ua) ? 'iPhone' : /ipad/i.test(ua) ? 'iPad' : /android/i.test(ua) ? 'Android' : /mac/i.test(ua) ? 'Mac' : /windows/i.test(ua) ? 'Windows' : 'Outro';
      return postPush({ acao: 'inscrever', inscricao: s.toJSON(), aparelho: aparelho, boasVindas: true });
    });
  }
  function desligarAvisos() {
    return inscricaoAtual().then(function (s) {
      if (!s) return;
      var endpoint = s.endpoint;
      return s.unsubscribe().then(function () { return postPush({ acao: 'cancelar', endpoint: endpoint }).catch(function () {}); });
    });
  }

  function botaoAvisos() {
    var alvo = document.querySelector('[data-pwa-instalar]');
    if (!alvo || (!suportaPush && !iosNavegador)) return;
    if (suportaPush && Notification.permission === 'denied') return;
    fetch('/api/push', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (cfg) {
      if (!cfg.configurado || !cfg.chave) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pwa-avisos mono';
      alvo.insertBefore(b, alvo.firstChild);
      var texto = function (t, ligado) { b.textContent = t; b.classList.toggle('pwa-avisos--ligado', !!ligado); };

      if (!suportaPush) { // iPhone no Safari: só recebe avisos com o app instalado
        texto('🔔 Avisos');
        b.addEventListener('click', function () {
          var dica = document.createElement('div');
          dica.className = 'pwa-dica';
          dica.innerHTML = '<p><b>Para receber avisos no iPhone:</b> toque em <span class="pwa-dica__ico">⬆</span> Compartilhar → <b>Adicionar à Tela de Início</b> e abra o app pelo ícone.</p>';
          var x = document.createElement('button');
          x.type = 'button'; x.className = 'pwa-dica__fechar'; x.setAttribute('aria-label', 'Fechar'); x.textContent = '×';
          x.addEventListener('click', function () { dica.remove(); });
          dica.appendChild(x);
          document.body.appendChild(dica);
        });
        return;
      }

      inscricaoAtual().then(function (s) {
        var ligado = !!s && Notification.permission === 'granted';
        // aparelho já inscrito: garante que o servidor tem a inscrição (ex.: depois de entrar de novo)
        if (ligado) postPush({ acao: 'inscrever', inscricao: s.toJSON() }).catch(function () {});
        texto(ligado ? '🔔 Avisos ligados' : '🔔 Ativar avisos', ligado);
        b.addEventListener('click', function () {
          b.disabled = true;
          if (ligado) {
            if (!b.dataset.confirma) {
              b.dataset.confirma = '1'; texto('Desligar avisos?', true); b.disabled = false;
              setTimeout(function () { if (b.dataset.confirma) { delete b.dataset.confirma; texto('🔔 Avisos ligados', true); } }, 3000);
              return;
            }
            delete b.dataset.confirma;
            desligarAvisos().then(function () { ligado = false; texto('🔔 Ativar avisos'); })
              .catch(function () { texto('Não deu certo', true); }).then(function () { b.disabled = false; });
            return;
          }
          texto('Ativando…');
          ligarAvisos(cfg.chave).then(function () { ligado = true; texto('🔔 Avisos ligados', true); })
            .catch(function (e) {
              if (e && e.message === 'permissao') { b.remove(); return; } // recusou no navegador
              texto('Não deu certo');
              setTimeout(function () { texto('🔔 Ativar avisos'); }, 3000);
            }).then(function () { b.disabled = false; });
        });
      });
    }).catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', botaoAvisos); else botaoAvisos();

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

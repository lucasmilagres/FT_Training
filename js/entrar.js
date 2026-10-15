/* Login da área do coach: e-mail → código de 8 dígitos → sessão de 1 ano. */
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var passoEmail = $('#passo-email');
  var passoCodigo = $('#passo-codigo');
  var campoEmail = $('#email');
  var campoCodigo = $('#codigo');

  // só volta para páginas do próprio site
  var volta = new URLSearchParams(location.search).get('volta') || '/treinos';
  if (!/^\/(?!\/)/.test(volta)) volta = '/treinos';

  try { campoEmail.value = localStorage.getItem('ft-coach-email') || ''; } catch (e) {}

  function post(url, dados) {
    return fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.erro || 'Algo deu errado. Tente de novo.');
        return j;
      });
    });
  }

  function enviando(form, sim) {
    var b = form.querySelector('button[type=submit]');
    b.disabled = sim;
    if (!b.dataset.txt) b.dataset.txt = b.textContent;
    b.textContent = sim ? 'Aguarde…' : b.dataset.txt;
  }

  function erro(form, msg) { form.querySelector('.login__erro').textContent = msg || ''; }

  function pedirCodigo(form) {
    var email = campoEmail.value.trim().toLowerCase();
    erro(form, '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { erro(form, 'Digite um e-mail válido.'); campoEmail.focus(); return; }
    enviando(form, true);
    post('/api/auth/codigo', { email: email }).then(function () {
      try { localStorage.setItem('ft-coach-email', email); } catch (e) {}
      $('#email-enviado').textContent = email;
      passoEmail.hidden = true;
      passoCodigo.hidden = false;
      campoCodigo.value = '';
      campoCodigo.focus();
    }).catch(function (e) { erro(form, e.message); })
      .then(function () { enviando(form, false); });
  }

  $('#form-email').addEventListener('submit', function (ev) { ev.preventDefault(); pedirCodigo(this); });

  // mostra "1234 5678" enquanto digita
  campoCodigo.addEventListener('input', function () {
    var d = campoCodigo.value.replace(/\D/g, '').slice(0, 8);
    campoCodigo.value = d.length > 4 ? d.slice(0, 4) + ' ' + d.slice(4) : d;
    var form = $('#form-codigo');
    if (d.length === 8 && form.requestSubmit) form.requestSubmit();
  });

  $('#form-codigo').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var form = this;
    var codigo = campoCodigo.value.replace(/\D/g, '');
    erro(form, '');
    if (codigo.length !== 8) { erro(form, 'O código tem 8 dígitos.'); return; }
    enviando(form, true);
    post('/api/auth/entrar', { codigo: codigo }).then(function () {
      location.replace(volta);
    }).catch(function (e) {
      erro(form, e.message);
      enviando(form, false);
      campoCodigo.select();
    });
  });

  $('#trocar').addEventListener('click', function () {
    passoCodigo.hidden = true;
    passoEmail.hidden = false;
    campoEmail.focus();
  });

  $('#reenviar').addEventListener('click', function () {
    var form = $('#form-codigo');
    erro(form, '');
    post('/api/auth/codigo', { email: campoEmail.value.trim().toLowerCase() })
      .then(function () { erro(form, ''); form.querySelector('.login__erro').textContent = 'Novo código enviado.'; })
      .catch(function (e) { erro(form, e.message); });
  });
})();

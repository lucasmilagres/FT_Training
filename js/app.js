/* Porta de entrada do app instalado (/app): leva cada pessoa para o lugar certo.
   Aluno → /aluno · equipe → /coach · sem login → /entrar. Sem internet, volta para a última tela usada. */
(function () {
  var CHAVE = 'ft-app-destino';
  function ir(destino, lembrar) {
    if (lembrar) { try { localStorage.setItem(CHAVE, destino); } catch (e) {} }
    location.replace(destino);
  }
  function ultimo() { try { return localStorage.getItem(CHAVE) || '/aluno'; } catch (e) { return '/aluno'; } }

  if (!navigator.onLine) return ir(ultimo());

  fetch('/api/aluno', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) {
    if (r.status === 401) return ir('/entrar?volta=/app');
    if (r.status === 403) return ir('/coach', true); // equipe ainda sem perfil de aluno: o painel resolve
    if (!r.ok) return ir(ultimo());
    return r.json().then(function (j) {
      ir(j.perfil && j.perfil.papel !== 'aluno' ? '/coach' : '/aluno', true);
    });
  }).catch(function () { ir(ultimo()); });
})();

// Datas no formato AAAA-MM-DD (sem fuso: meio-dia UTC evita virar o dia).
const dataOk = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(new Date(s + 'T12:00:00Z'));

function somaDias(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// segunda-feira da semana de uma data
function segunda(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  return somaDias(iso, -((d.getUTCDay() + 6) % 7));
}

const diasEntre = (de, ate) => Math.round((new Date(ate + 'T12:00:00Z') - new Date(de + 'T12:00:00Z')) / 864e5);

module.exports = { dataOk, somaDias, segunda, diasEntre };

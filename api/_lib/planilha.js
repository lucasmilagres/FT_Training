// Lê a planilha de treinos (Google Sheets publicada como CSV) e separa os treinos de uma data.
// Formato esperado: 1ª linha com títulos, uma coluna "Data" e as outras colunas com o treino
// (ex.: Data | Modalidade | Aquecimento | Força | WOD). Várias linhas na mesma data viram
// vários quadros na TV. Colunas com título começando em "_" são ignoradas (anotações do coach).

const FUSO = 'America/Sao_Paulo';

// Data de hoje (ou de um instante qualquer) no horário de Brasília, como AAAA-MM-DD
function hojeISO(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

// CSV com aspas, vírgulas e quebras de linha dentro das células (RFC 4180)
function lerCSV(txt) {
  const linhas = [];
  let linha = [], cel = '', aspas = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (aspas) {
      if (c === '"' && txt[i + 1] === '"') { cel += '"'; i++; }
      else if (c === '"') aspas = false;
      else cel += c;
    } else if (c === '"') aspas = true;
    else if (c === ',') { linha.push(cel); cel = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && txt[i + 1] === '\n') i++;
      linha.push(cel); linhas.push(linha); linha = []; cel = '';
    } else cel += c;
  }
  if (cel !== '' || linha.length) { linha.push(cel); linhas.push(linha); }
  return linhas;
}

// "15/10/2026", "15/10/26", "15/10", "qua 15/10", "2026-10-15" → "2026-10-15"
function paraISO(valor, anoPadrao) {
  const v = String(valor || '').trim();
  let m = v.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = v.match(/(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?/);
  if (!m) return null;
  const dia = +m[1], mes = +m[2];
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;
  let ano = m[3] ? +m[3] : anoPadrao;
  if (ano < 100) ano += 2000;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

const limpa = (s) => String(s || '').replace(/ /g, ' ').trim();

function treinosDoDia(csv, dataISO) {
  const linhas = lerCSV(csv).map((l) => l.map(limpa)).filter((l) => l.some(Boolean));
  if (!linhas.length) return [];
  const ano = +dataISO.slice(0, 4);

  // Cabeçalho: 1ª linha, se ela não for uma linha de treino
  let cab = linhas[0];
  let colData = cab.findIndex((t) => /\b(data|dia|date)\b/i.test(t));
  const temCab = colData >= 0 || !cab.some((t) => paraISO(t, ano));
  const corpo = temCab ? linhas.slice(1) : linhas;
  if (!temCab) cab = [];

  // Sem coluna "Data": usa a primeira coluna onde a maioria das linhas tem uma data
  if (colData < 0) {
    const largura = Math.max(...corpo.map((l) => l.length));
    for (let c = 0; c < largura && colData < 0; c++) {
      const comData = corpo.filter((l) => paraISO(l[c], ano)).length;
      if (comData >= corpo.length / 2) colData = c;
    }
  }
  if (colData < 0) return [];

  const colTitulo = cab.findIndex((t) => /^(modalidade|aula|turma|tipo|hor[aá]rio|treino)$/i.test(t));

  return corpo
    .filter((l) => paraISO(l[colData], ano) === dataISO)
    .map((l) => ({
      titulo: colTitulo >= 0 && colTitulo !== colData ? l[colTitulo] : '',
      blocos: l
        .map((texto, i) => ({ titulo: cab[i] || '', texto, i }))
        .filter((b) => b.i !== colData && b.i !== colTitulo && b.texto && !/^_/.test(b.titulo))
        .map(({ titulo, texto }) => ({ titulo, texto }))
    }))
    .filter((t) => t.blocos.length);
}

module.exports = { FUSO, hojeISO, lerCSV, paraISO, treinosDoDia };

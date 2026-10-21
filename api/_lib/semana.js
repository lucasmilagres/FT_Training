// Leitor do formato da planilha do coach ("Treinos FT 2026"):
//  - uma aba por mês: "OUTUBRO HYROX 2026", "NOVEMBRO HYROX 2026", "JAN 2026"...
//  - dentro da aba, um bloco por semana, empilhados; cada bloco começa numa linha de títulos
//    colorida (amarela) com o nome do treino de cada dia: "FT HYROX ENGIME", "FT HYROX COMPLETE"...
//  - colunas = dias da semana (A = segunda ... E = sexta); abaixo do título, o treino linha a linha
//  - não há datas: o 1º bloco é a semana do 1º dia útil do mês, o 2º a semana seguinte, e assim por diante
//    (conferido em out/2026: o 3º bloco começa com "FERIADO NOSSA SENHORA" na segunda, 12/10)

const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

// "OUTUBRO HYROX 2026" → { mes: 10, ano: 2026 }
function mesDaAba(nome) {
  const n = norm(nome);
  const ano = (n.match(/\b(20\d\d)\b/) || [])[1];
  const palavras = n.split(/[^A-Z]+/).filter((p) => p.length >= 3);
  const i = MESES.findIndex((m) => palavras.some((p) => p.startsWith(m)));
  return i >= 0 && ano ? { mes: i + 1, ano: +ano } : null;
}

// ---------- datas (sempre em UTC, só dia/mês/ano) ----------
const d = (iso) => new Date(iso + 'T12:00:00Z');
const iso = (dt) => dt.toISOString().slice(0, 10);
const diaSemana = (s) => (d(s).getUTCDay() + 6) % 7; // 0 = segunda ... 6 = domingo
function somaDias(s, n) { const dt = d(s); dt.setUTCDate(dt.getUTCDate() + n); return iso(dt); }
const segundaDe = (s) => somaDias(s, -diaSemana(s));

function primeiroDiaUtil(ano, mes) {
  let s = `${ano}-${String(mes).padStart(2, '0')}-01`;
  while (diaSemana(s) > 4) s = somaDias(s, 1);
  return s;
}

// Qual bloco (semana) da aba do mês corresponde à data
function indiceSemana(data, ano, mes) {
  const inicio = segundaDe(primeiroDiaUtil(ano, mes));
  return Math.round((d(segundaDe(data)) - d(inicio)) / (7 * 864e5));
}

// ---------- blocos ----------
const temCor = (c) => c && c.cor && c.cor !== '#ffffff';
const txt = (c) => String((c && c.v) || '').trim();

// Linha de títulos: 2+ células preenchidas e coloridas; sem cores (CSV), 3+ células começando com "FT"/"FERIADO"
function ehTitulo(linha) {
  if (linha.filter((c) => txt(c) && temCor(c)).length >= 2) return true;
  return linha.filter((c) => /^(FT\b|FERIADO)/i.test(txt(c))).length >= 3;
}

function blocosDaGrade(grade) {
  const inicios = grade.map((l, i) => (ehTitulo(l) ? i : -1)).filter((i) => i >= 0);
  return inicios.map((ini, k) => ({
    titulos: grade[ini].map(txt),
    linhas: grade.slice(ini + 1, k + 1 < inicios.length ? inicios[k + 1] : grade.length)
  }));
}

// Treino de um dia (uma coluna do bloco) em quadros para a TV:
// partes separadas por linha em branco viram quadros; "ESTAÇÃO 1", "ESTAÇÃO 2"... viram quadros com título
function treinoDaColuna(bloco, col) {
  const titulo = bloco.titulos[col] || '';
  const linhas = bloco.linhas.map((l) => txt(l[col]));
  const quadros = [];
  let atual = null;
  linhas.forEach((linha) => {
    if (!linha) { atual = null; return; }
    if (/^ESTA[CÇ][AÃ]O\s*\d+\s*$/i.test(linha)) {
      atual = { titulo: linha, linhas: [] };
      quadros.push(atual);
      return;
    }
    if (!atual) { atual = { titulo: '', linhas: [] }; quadros.push(atual); }
    atual.linhas.push(linha);
  });
  const blocos = quadros.filter((q) => q.linhas.length).map((q) => ({ titulo: q.titulo, texto: q.linhas.join('\n') }));
  if (!titulo && !blocos.length) return null;
  return { titulo, blocos };
}

// Abas de mês da planilha (nomes) que podem ter a semana da data: a do mês e a do mês seguinte
// (a última semana de um mês às vezes fica no começo da aba do mês seguinte)
function abasCandidatas(abas, data) {
  const ano = +data.slice(0, 4), mes = +data.slice(5, 7);
  const prox = mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
  return [{ ano, mes }, prox].flatMap((alvo) =>
    abas.filter((a) => { const m = mesDaAba(a); return m && m.ano === alvo.ano && m.mes === alvo.mes; }).map((nome) => ({ nome, ...alvo })));
}

// abas: nomes de todas as abas; lerGrade(nome) → grade [[{v, cor}]]
// Devolve { treinos, aviso, onde } ou null se a planilha não tem abas de mês
async function treinosDaData(data, abas, lerGrade) {
  if (!abas.some(mesDaAba)) return null;
  const col = diaSemana(data);
  if (col > 5) return { treinos: [], aviso: 'Fim de semana: sem aula', onde: null };

  for (const aba of abasCandidatas(abas, data)) {
    const k = indiceSemana(data, aba.ano, aba.mes);
    if (k < 0) continue;
    const bloco = blocosDaGrade(await lerGrade(aba.nome))[k];
    if (!bloco) continue;
    const treino = treinoDaColuna(bloco, col);
    if (!treino) continue;
    const onde = { aba: aba.nome, semana: k + 1, dia: ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][col] };
    if (!treino.blocos.length) return { treinos: [], aviso: treino.titulo, onde }; // ex.: "FERIADO NOSSA SENHORA"
    return { treinos: [treino], aviso: null, onde };
  }
  return { treinos: [], aviso: col >= 5 ? 'Fim de semana: sem aula' : null, onde: null };
}

module.exports = { mesDaAba, primeiroDiaUtil, indiceSemana, blocosDaGrade, treinoDaColuna, treinosDaData };

// Leitor do formato da planilha do coach ("Treinos FT 2026"):
//  - uma aba por mês: "OUTUBRO HYROX 2026", "NOVEMBRO HYROX 2026", "JAN 2026"...
//  - dentro da aba, um bloco por semana, empilhados; cada bloco começa numa linha de títulos
//    colorida (amarela) com o nome do treino de cada dia: "FT HYROX ENGIME", "FT HYROX COMPLETE"...
//  - colunas = dias da semana (A = segunda ... E = sexta); abaixo do título, o treino linha a linha
//  - as abas NÃO seguem o mês certinho: cada aba continua de onde a anterior parou
//    (out/2026 = semanas de 28/09 a 19/10; nov/2026 = 26/10 a 16/11, com "FERIADO FECHADO" na segunda 02/11
//    e "FERIADO" na sexta 20/11; dez/2026 começa em 23/11)
//  - desde a semana de 23/11/2026 o coach põe a data no título: "FT HYROX ENGIME 23\11", "... 24/11"
// Como cada bloco ganha a sua semana:
//  1. bloco com data no título → semana dessa data
//  2. bloco sem data, com algum bloco datado nas abas lidas → conta semanas a partir do bloco datado mais perto
//     (as abas lidas — mês anterior, do mês e seguinte — são tratadas como uma sequência contínua de semanas)
//  3. nenhum bloco datado → regra antiga: 1º bloco = semana do 1º dia útil do mês da aba

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

// Qual bloco (semana) da aba do mês corresponde à data, pela regra antiga (sem datas)
function indiceSemana(data, ano, mes) {
  const inicio = segundaDe(primeiroDiaUtil(ano, mes));
  return Math.round((d(segundaDe(data)) - d(inicio)) / (7 * 864e5));
}

// Data no fim do título: "FT HYROX ENGIME 23\11", "24/11", "24-11", "24.11", "24/11/26", "(24/11)"
const RE_DATA = /\s*[-–(]?\s*\b(\d{1,2})\s*[/\\.-]\s*(\d{1,2})(?:\s*[/\\.-]\s*(\d{4}|\d{2}))?\b\s*\)?\s*$/;
const semData = (titulo) => String(titulo || '').replace(RE_DATA, '').trim();

// Ano vem da aba; "29/12" numa aba de JAN 2027 é 2026, "02/01" numa aba de DEZ 2026 é 2027
function dataDoTitulo(titulo, ano, mes) {
  const m = String(titulo || '').match(RE_DATA);
  if (!m) return null;
  const dia = +m[1], mm = +m[2];
  let a = ano;
  if (m[3]) a = m[3].length === 2 ? 2000 + +m[3] : +m[3];
  else if (mm - mes > 6) a--;
  else if (mes - mm > 6) a++;
  const dt = new Date(Date.UTC(a, mm - 1, dia, 12));
  if (mm < 1 || mm > 12 || dt.getUTCMonth() !== mm - 1 || dt.getUTCDate() !== dia) return null;
  return iso(dt);
}

// abas: [{ nome, ano, mes, blocos }] em ordem cronológica → lista de { aba, k, bloco, segunda, pela }
function semanasDosBlocos(abas) {
  const todos = abas.flatMap((aba) => aba.blocos.map((bloco, k) => {
    const datas = bloco.titulos.map((t) => dataDoTitulo(t, aba.ano, aba.mes)).filter(Boolean);
    return { aba, k, bloco, datada: datas.length ? segundaDe(datas[0]) : null };
  }));
  const ancoras = todos.map((x, i) => (x.datada ? i : -1)).filter((i) => i >= 0);
  todos.forEach((x, i) => {
    if (x.datada) { x.segunda = x.datada; x.pela = 'data'; return; }
    if (ancoras.length) {
      const j = ancoras.reduce((a, b) => (Math.abs(b - i) < Math.abs(a - i) ? b : a));
      x.segunda = somaDias(todos[j].datada, 7 * (i - j));
      x.pela = 'contagem';
      return;
    }
    x.segunda = somaDias(segundaDe(primeiroDiaUtil(x.aba.ano, x.aba.mes)), 7 * x.k);
    x.pela = 'posicao';
  });
  return todos;
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
  const titulo = semData(bloco.titulos[col]); // a data do título não aparece na TV
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

// Abas de mês que podem ter a semana da data: a do mês anterior, a do mês e a do seguinte, em ordem
function abasVizinhas(abas, data) {
  const ano = +data.slice(0, 4), mes = +data.slice(5, 7);
  const mais = (n) => { const t = ano * 12 + (mes - 1) + n; return { ano: Math.floor(t / 12), mes: (t % 12) + 1 }; };
  return [mais(-1), mais(0), mais(1)].flatMap((alvo, ordem) =>
    abas.filter((a) => { const m = mesDaAba(a); return m && m.ano === alvo.ano && m.mes === alvo.mes; })
      .map((nome) => ({ nome, ...alvo, ordem })));
}

const CERTEZA = { data: 0, contagem: 1, posicao: 2 };
const PREFERENCIA = [1, 2, 0]; // empate: aba do próprio mês, depois a seguinte, depois a anterior

// abas: nomes de todas as abas; lerGrade(nome) → grade [[{v, cor}]]
// Devolve { treinos, aviso, onde } ou null se a planilha não tem abas de mês
async function treinosDaData(data, abas, lerGrade) {
  if (!abas.some(mesDaAba)) return null;
  const col = diaSemana(data);
  if (col > 5) return { treinos: [], aviso: 'Fim de semana: sem aula', onde: null };

  const vizinhas = abasVizinhas(abas, data);
  const grades = await Promise.all(vizinhas.map((a) => lerGrade(a.nome)));
  const semanas = semanasDosBlocos(vizinhas.map((a, i) => ({ ...a, blocos: blocosDaGrade(grades[i]) })));
  const segunda = segundaDe(data);
  const candidatos = semanas.filter((x) => x.segunda === segunda).sort((a, b) =>
    CERTEZA[a.pela] - CERTEZA[b.pela] || PREFERENCIA.indexOf(a.aba.ordem) - PREFERENCIA.indexOf(b.aba.ordem));

  for (const x of candidatos) {
    const treino = treinoDaColuna(x.bloco, col);
    if (!treino) continue;
    const onde = { aba: x.aba.nome, semana: x.k + 1, dia: ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][col], segunda, pela: x.pela };
    if (!treino.blocos.length) return { treinos: [], aviso: treino.titulo, onde }; // ex.: "FERIADO NOSSA SENHORA"
    return { treinos: [treino], aviso: null, onde };
  }
  return { treinos: [], aviso: col >= 5 ? 'Fim de semana: sem aula' : null, onde: null };
}

module.exports = { mesDaAba, primeiroDiaUtil, indiceSemana, dataDoTitulo, semData, semanasDosBlocos, blocosDaGrade, treinoDaColuna, treinosDaData };

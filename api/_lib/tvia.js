// Treinos da TV organizados pela IA.
// 1. "fonte" de cada dia = o que o leitor atual tira da planilha (título + quadros de texto).
// 2. A IA (Gemini) reorganiza o dia em partes e itens legíveis, sem inventar nem tirar nada.
// 3. O servidor confere: todo número da IA precisa existir na planilha e as palavras da
//    planilha precisam aparecer na versão da IA. O que não bater vira alerta para o coach revisar.
// 4. Só depois que o coach aprova a TV usa a versão da IA, e só enquanto a planilha daquele
//    dia não mudar (hash). Qualquer problema: a TV volta para a leitura direta da planilha.
const crypto = require('crypto');
const banco = require('./banco');
const gemini = require('./gemini');
const { treinosDaData } = require('./fonte');
const { somaDias } = require('./datas');

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const diaDaSemana = (iso) => DIAS[new Date(iso + 'T12:00:00Z').getUTCDay()];

// ---------- fonte (planilha) ----------
function fonteDe(r) {
  return {
    aviso: String((r && r.aviso) || ''),
    treinos: ((r && r.treinos) || []).map((t) => ({
      titulo: String(t.titulo || ''),
      blocos: (t.blocos || []).map((b) => ({ titulo: String(b.titulo || ''), texto: String(b.texto || '') }))
    }))
  };
}
const hashDe = (fonte) => crypto.createHash('sha256').update(JSON.stringify(fonte)).digest('hex').slice(0, 32);
const temTreino = (fonte) => fonte.treinos.some((t) => t.blocos.some((b) => b.texto.trim()));

function textoDaFonte(fonte) {
  const partes = [];
  if (fonte.aviso) partes.push('AVISO: ' + fonte.aviso);
  fonte.treinos.forEach((t) => {
    if (t.titulo) partes.push('TÍTULO: ' + t.titulo);
    t.blocos.forEach((b) => partes.push((b.titulo ? '[' + b.titulo + ']\n' : '') + b.texto));
  });
  return partes.join('\n\n');
}

// Segunda a sexta da semana (segunda = AAAA-MM-DD)
async function semanaDaPlanilha(segunda) {
  const dias = [];
  for (let i = 0; i < 5; i++) {
    const data = somaDias(segunda, i);
    try {
      const fonte = fonteDe(await treinosDaData(data));
      dias.push({ data, fonte, hash: hashDe(fonte) });
    } catch (e) {
      dias.push({ data, erro: e.message });
    }
  }
  return dias;
}

// ---------- IA ----------
const INSTRUCOES = `Você organiza os treinos de um box de treinamento híbrido (Hyrox, corrida, cross, musculação) para serem mostrados numa TV.
Para cada dia você recebe o texto exatamente como o treinador escreveu na planilha. Devolva o mesmo treino organizado em partes.

Regras:
1. Não invente nada: nenhum exercício, número, carga, distância, tempo ou parte que não esteja no texto. Não remova nada do que está escrito.
2. Mantenha os nomes dos exercícios e as siglas como o treinador escreveu (KBS, T2B, D.U, S.U, DB, KB, OH, RUN, BOX JUMP...). Só ajuste maiúsculas e minúsculas para ficar fácil de ler (ex.: "DEADLIFT KB" → "Deadlift KB", "MAX PUSH UP" → qtd "Máx." e texto "Push up") e corrija erros de digitação óbvios.
3. Uma linha como "3 ROUNDS", "2 ROUNDS", "ROUNDS", "EMOM", "AMRAP", "FOR TIME", "TABATA" ou "ESTAÇÃO 2" começa uma parte nova, mesmo sem linha em branco antes. Esse cabeçalho vai no campo formato da parte (ex.: "3 rounds"), não como item.
4. "CAP 25'" é o tempo limite da parte em que aparece: junte no formato (ex.: "3 rounds · cap 25 min"). Não vira item.
5. Em cada item, a quantidade (repetições, metros, calorias, "Máx.", sequências como "1-3-5-7-9...") vai em qtd e o exercício em texto. Detalhes como "(DIR+ESQ)" ou "= 30 S.U" vão em nota do item. Linhas que não são exercício (instruções) viram item só com texto.
6. Nome da parte: use o que a planilha indica ("Estação 1") ou um nome curto pelo tipo do bloco ("Rounds", "Força", "Corrida", "Parte 2"). Não invente objetivos.
7. Se o dia não tem exercícios (só título, feriado ou estações sem conteúdo), devolva partes vazia e explique em aviso (ex.: "Feriado", "Treino ainda não preenchido na planilha").
8. titulo: o título do dia como está na planilha, com maiúsculas normais (ex.: "FT Hyrox Power Inferiores").
Responda em português, só no formato pedido, com um item em dias para cada data recebida.`;

const S = (desc) => ({ type: 'STRING', description: desc });
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    dias: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          data: S('Data no formato AAAA-MM-DD, igual à recebida'),
          titulo: S('Título do treino do dia'),
          aviso: S('Só quando não há treino: feriado, treino não preenchido...'),
          partes: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                nome: S('Nome curto da parte'),
                formato: S('Ex.: 3 rounds · cap 25 min'),
                nota: S('Observação geral da parte, se houver'),
                itens: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: { qtd: S('Quantidade'), texto: S('Exercício'), nota: S('Detalhe') },
                    required: ['texto']
                  }
                }
              },
              required: ['nome', 'itens']
            }
          }
        },
        required: ['data', 'titulo', 'partes']
      }
    }
  },
  required: ['dias']
};

const corta = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

function limparDia(d) {
  const partes = (Array.isArray(d && d.partes) ? d.partes : []).slice(0, 12).map((p) => ({
    nome: corta(p && p.nome, 60),
    formato: corta(p && p.formato, 80),
    nota: corta(p && p.nota, 200),
    itens: (Array.isArray(p && p.itens) ? p.itens : []).slice(0, 30)
      .map((i) => ({ qtd: corta(i && i.qtd, 40), texto: corta(i && i.texto, 120), nota: corta(i && i.nota, 160) }))
      .filter((i) => i.texto || i.qtd)
  })).filter((p) => p.itens.length || p.nome);
  return { titulo: corta(d && d.titulo, 120), aviso: corta(d && d.aviso, 200), partes };
}

// ---------- conferência ----------
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const numeros = (s) => new Set(String(s || '').match(/\d+(?:[.,]\d+)?/g) || []);
const palavras = (s) => new Set(semAcento(s).match(/[A-Z]{3,}/g) || []);
// palavras que a IA pode trocar por formato/rótulos sem perder conteúdo
const LIVRES = new Set(['TITULO', 'AVISO', 'ROUNDS', 'ROUND', 'CAP', 'ESTACAO', 'MAX', 'REP', 'REPS']);

// comNomes = false: sem os nomes das partes ("Parte 1", "Estação 2" são só rótulos, não entram na conferência de números)
function textoDaIA(ia, comNomes = true) {
  return [ia.titulo, ia.aviso].concat(...ia.partes.map((p) => [comNomes ? p.nome : '', p.formato, p.nota].concat(...p.itens.map((i) => [i.qtd, i.texto, i.nota])))).join(' ');
}

function conferir(fonte, ia) {
  const alertas = [];
  const original = textoDaFonte(fonte);
  const gerado = textoDaIA(ia);
  const numsFonte = numeros(original);
  const inventados = [...numeros(textoDaIA(ia, false))].filter((n) => !numsFonte.has(n) && !numsFonte.has(n.replace(',', '.')) && !numsFonte.has(n.replace('.', ',')));
  if (inventados.length) alertas.push('Números que não estão na planilha: ' + inventados.join(', '));
  const doGerado = palavras(gerado);
  const faltando = [...palavras(original)].filter((p) => !LIVRES.has(p) && !doGerado.has(p));
  if (faltando.length) alertas.push('Palavras da planilha que não aparecem: ' + faltando.slice(0, 8).join(', ').toLowerCase());
  if (temTreino(fonte) && !ia.partes.some((p) => p.itens.length)) alertas.push('A IA não devolveu exercícios para este dia.');
  return alertas;
}

// Lê os dias com a IA (uma chamada para a semana toda) → { [data]: { ia, alertas, modelo } }
async function organizar(dias) {
  const comTreino = dias.filter((d) => d.fonte && temTreino(d.fonte));
  if (!comTreino.length) return {};
  const texto = comTreino.map((d) => `=== ${d.data} (${diaDaSemana(d.data)}) ===\n${textoDaFonte(d.fonte)}`).join('\n\n');
  // 100 s para a IA: sobra tempo para ler a planilha e salvar dentro dos 120 s da função
  const { modelo, dados } = await gemini.gerarJSON({ instrucoes: INSTRUCOES, texto, schema: SCHEMA, prazoMs: 100000 });
  const porData = {};
  (Array.isArray(dados && dados.dias) ? dados.dias : []).forEach((d) => { if (d && d.data) porData[String(d.data).slice(0, 10)] = d; });
  const saida = {};
  comTreino.forEach((d) => {
    const bruto = porData[d.data];
    const ia = limparDia(bruto || {});
    const alertas = bruto ? conferir(d.fonte, ia) : ['A IA não devolveu este dia.'];
    saida[d.data] = { ia, alertas, modelo };
  });
  return saida;
}

// ---------- banco ----------
async function salvos(datas) {
  if (!datas.length) return {};
  const linhas = await banco.ler('tv_dias', 'select=data,hash,ia,alertas,modelo,status,gerado_em,aprovado_em&data=in.(' + datas.join(',') + ')');
  const m = {};
  linhas.forEach((l) => { m[l.data] = l; });
  return m;
}

async function salvarRascunhos(dias, resultado) {
  const linhas = dias.filter((d) => resultado[d.data]).map((d) => ({
    data: d.data, hash: d.hash, fonte: d.fonte, ia: resultado[d.data].ia, alertas: resultado[d.data].alertas,
    modelo: resultado[d.data].modelo, status: 'rascunho', gerado_em: new Date().toISOString(), aprovado_em: null, aprovado_por: null
  }));
  if (linhas.length) await banco.upsert('tv_dias', linhas, 'data');
  return linhas.length;
}

// Versão para a TV no formato do leitor atual ({ titulo, blocos }), com os campos extras do layout novo
function paraTV(ia) {
  return {
    titulo: ia.titulo,
    ia: true,
    blocos: ia.partes.map((p) => ({
      titulo: p.nome, formato: p.formato, nota: p.nota, itens: p.itens,
      texto: p.itens.map((i) => [i.qtd, i.texto, i.nota && '(' + i.nota + ')'].filter(Boolean).join(' ')).join('\n')
    }))
  };
}

// Para /api/treinos: troca a leitura da planilha pela versão aprovada, se ela ainda vale
async function aplicarNaTV(data, r) {
  if (!banco.configurado() || !r || !r.treinos || !r.treinos.length) return r;
  try {
    const fonte = fonteDe(r);
    const d = await banco.um('tv_dias', 'select=hash,ia&status=eq.aprovado&data=eq.' + data);
    if (!d || d.hash !== hashDe(fonte) || !d.ia || !(d.ia.partes || []).length) return r;
    return { ...r, treinos: [paraTV(d.ia)], ia: true };
  } catch (e) {
    console.error('tv ia:', e.message);
    return r;
  }
}

module.exports = {
  fonteDe, hashDe, temTreino, textoDaFonte, semanaDaPlanilha, organizar, conferir, limparDia,
  salvos, salvarRascunhos, paraTV, aplicarNaTV, INSTRUCOES, SCHEMA
};

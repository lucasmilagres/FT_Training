// Banco da plataforma de alunos: Supabase usado só como Postgres + API REST.
// Só o servidor acessa, com a chave secreta (as chaves públicas não enxergam nada).
// As permissões (aluno só vê o que é dele etc.) ficam nas funções de api/.
// Variáveis de ambiente: SUPABASE_URL, SUPABASE_SECRET_KEY.

function erro(status, msg) { const e = new Error(msg); e.status = status; return e; }

function cfg() {
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const chave = (process.env.SUPABASE_SECRET_KEY || '').trim();
  return url && chave ? { url, chave } : null;
}

// A chave pública (publishable/anon) não enxerga nada no banco, de propósito.
// Se ela for colada no lugar da secreta, avisa em vez de dar "permission denied".
function chavePublica(chave) {
  if (chave.startsWith('sb_publishable_')) return true;
  if (chave.startsWith('eyJ')) {
    try { return JSON.parse(Buffer.from(chave.split('.')[1], 'base64url').toString()).role === 'anon'; } catch (e) { return false; }
  }
  return false;
}

const configurado = () => !!cfg();

async function rest(caminho, { method = 'GET', corpo, prefer } = {}) {
  const c = cfg();
  if (!c) throw erro(503, 'Banco de dados ainda não configurado no servidor (SUPABASE_URL e SUPABASE_SECRET_KEY).');
  if (chavePublica(c.chave)) throw erro(503, 'SUPABASE_SECRET_KEY está com a chave pública do Supabase. Use a Secret key (sb_secret_...).');
  const headers = { apikey: c.chave, Accept: 'application/json' };
  // Chave nova (sb_secret_...) vai só no "apikey"; a antiga (JWT service_role) também no Authorization
  if (!c.chave.startsWith('sb_')) headers.Authorization = 'Bearer ' + c.chave;
  if (corpo !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;

  const r = await fetch(c.url + '/rest/v1/' + caminho, {
    method, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo)
  });
  const texto = await r.text();
  let j = null;
  try { j = texto ? JSON.parse(texto) : null; } catch (e) { j = null; }
  if (!r.ok) {
    console.error('supabase', method, caminho.split('?')[0], r.status, texto.slice(0, 300));
    throw erro(502, 'O banco de dados respondeu com erro: ' + ((j && (j.message || j.hint)) || r.status));
  }
  return j;
}

const rpc = (nome, args) => rest('rpc/' + nome, { method: 'POST', corpo: args });

// Atalhos. "filtro" é a parte da URL do PostgREST, ex.: 'id=eq.' + id
const ler = (tabela, query) => rest(tabela + '?' + query).then((j) => j || []);
const inserir = (tabela, linhas) => rest(tabela, { method: 'POST', corpo: linhas, prefer: 'return=representation' }).then((j) => j || []);
const atualizar = (tabela, filtro, campos) => rest(tabela + '?' + filtro, { method: 'PATCH', corpo: campos, prefer: 'return=representation' }).then((j) => j || []);
const apagar = (tabela, filtro) => rest(tabela + '?' + filtro, { method: 'DELETE', prefer: 'return=representation' }).then((j) => j || []);
// insere ou, se já existir linha com a mesma chave (coluna "conflito"), atualiza
const upsert = (tabela, linhas, conflito) => rest(tabela + '?on_conflict=' + conflito,
  { method: 'POST', corpo: linhas, prefer: 'resolution=merge-duplicates,return=representation' }).then((j) => j || []);
const um = (tabela, query) => ler(tabela, query + '&limit=1').then((j) => j[0] || null);

// "registros" vem embutido no treino (1 por treino): objeto ou lista, conforme a versão do PostgREST
const comRegistro = (treinos) => (treinos || []).map(({ registros, ...t }) => ({
  ...t, registro: (Array.isArray(registros) ? registros[0] : registros) || null
}));

// Depois que o Google confirma o e-mail: devolve o perfil (cria se for o 1º acesso,
// usando o convite se houver; sem convite fica ativo = false, como pedido de acesso).
const entrarComGoogle = (email, nome) => rpc('entrar_com_google', { p_email: email, p_nome: nome || '' });

async function perfilPorEmail(email) {
  const j = await rest('perfis?select=*&email=eq.' + encodeURIComponent(String(email).toLowerCase()) + '&limit=1');
  return (j && j[0]) || null;
}

// Treinos do aluno entre duas datas (AAAA-MM-DD), com o registro de "feito" de cada um
function treinosDoAluno(alunoId, de, ate) {
  return rest('treinos?select=id,data,ordem,nome,modalidade,tipo,estrutura,observacoes,registros(concluido_em,duracao_min,distancia_km,esforco,comentario)'
    + '&aluno_id=eq.' + encodeURIComponent(alunoId)
    + '&data=gte.' + de + '&data=lte.' + ate
    + '&order=data.asc,ordem.asc');
}

module.exports = {
  configurado, rest, rpc, ler, inserir, atualizar, apagar, upsert, um, comRegistro,
  entrarComGoogle, perfilPorEmail, treinosDoAluno
};

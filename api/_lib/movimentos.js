// Movimentos: vídeos explicativos para o aluno (página /movimentos, em ordem alfabética).
// Ficam na tabela "exercicios" (nome, video_url, orientacoes). O coach cadastra no painel,
// colando um link do YouTube ou subindo um vídeo (Supabase Storage, bucket público "movimentos").
// PRONTOS: vídeos públicos do YouTube escolhidos para os movimentos que aparecem na planilha.
// Entram no banco quando o coach abre a aba Movimentos pela primeira vez; enquanto o banco
// não tem nenhum vídeo, a página pública mostra esta lista direto.
const banco = require('./banco');

const yt = (id) => 'https://www.youtube.com/watch?v=' + id;

const PRONTOS = [
  ['Agachamento búlgaro (Bulgarian Split Squat)', 'ZpIMkV6cf7c', 'Pé de trás apoiado no banco ou na caixa. Desça reto, com o joelho da frente alinhado ao pé e o tronco firme.'],
  ['Agachamento com salto (Jump Squat)', '36vnWAkL7ZQ', 'Agache até a coxa ficar paralela ao chão e salte o mais alto que puder. Aterrisse macio, já descendo para o próximo.'],
  ['Agachamento costas (Back Squat)', 'gBJ2Z563XSQ', 'Barra apoiada no trapézio, pés na largura dos ombros. Desça com o peito aberto e os joelhos para fora, abaixo da linha do quadril, e suba empurrando o chão.'],
  ['Agachamento frontal (Front Squat)', 'jxZhLBOoXJg', 'Barra apoiada na frente dos ombros, cotovelos altos. Desça com o tronco bem reto e suba sem deixar os cotovelos caírem.'],
  ['Agachamento na caixa (Box Squat)', '6_xQf5A3WmE', 'Agache levando o quadril para trás até sentar de leve na caixa, sem relaxar o tronco, e suba com força.'],
  ['Air Squat', 'aApXbzRq3jI', 'Agachamento sem peso: quadril abaixo da linha do joelho, calcanhar no chão, braços à frente para equilibrar e quadril totalmente estendido em cima.'],
  ['Avanço (Lunge)', 'WuMsV60mnIQ', 'Dê um passo largo e desça até o joelho de trás quase tocar o chão. Tronco reto e joelho da frente alinhado ao pé.'],
  ['Avanço com peso acima da cabeça (Overhead Lunge)', 'UVvNu2dL-JI', 'Peso travado acima da cabeça, braços estendidos e abdômen firme. Faça o avanço sem deixar o peso ir para a frente.'],
  ['Bear Crawl', 'M1LgdyUDLsc', 'Em quatro apoios, com os joelhos a um palmo do chão. Ande movendo mão e pé opostos, com as costas retas e o quadril baixo.'],
  ['Box Jump', 'z5j5hHsEcqU', 'Salte com os dois pés e aterrisse inteiro em cima da caixa. Estenda o quadril em cima e desça com cuidado.'],
  ['Broad Jump', 'uworPS0l6yk', 'Salto para a frente com os dois pés: use os braços para dar impulso e aterrisse com os joelhos flexionados.'],
  ['Burpee', 'auBLPXO8Fww', 'Peito e coxas no chão, levante e termine com um pequeno salto e palmas acima da cabeça.'],
  ['Burpee Box Jump Over', 'Hgw-qCK_QZc', 'Faça o burpee de frente para a caixa e depois salte para cima ou por cima dela, passando para o outro lado.'],
  ['Burpee Over Bar', 'EhdzecLDyEw', 'Burpee ao lado da barra e salto lateral por cima dela, com os dois pés juntos.'],
  ['Butt Kicks (calcanhar no glúteo)', 'xRjl6d9mtCo', 'Corrida no lugar ou deslocando, levando o calcanhar até o glúteo em ritmo rápido.'],
  ['Clean (Power Clean)', '6Is4Ik4LnB4', 'Tire a barra do chão com as costas retas, estenda o quadril com explosão e receba a barra na frente dos ombros, com os cotovelos altos.'],
  ['Clean and Jerk com halter (DB Clean and Jerk)', 'p-GBOGjTYz8', 'Leve o halter até o ombro num movimento explosivo e depois empurre acima da cabeça com o impulso das pernas, travando o braço.'],
  ['Cluster', 'FuV7tKFiVZw', 'Um squat clean seguido direto de um thruster: recebe a barra agachado e usa a subida para levar a barra acima da cabeça.'],
  ['Deadlift (Levantamento terra)', '1ZXobu7JvvE', 'Barra perto da canela e costas retas. Empurre o chão com as pernas e estenda o quadril, levando a barra colada ao corpo.'],
  ['Devil Press', 'FvQct1ZsFB4', 'Burpee com dois halteres no chão e, em seguida, leve os halteres do chão até acima da cabeça num movimento só.'],
  ['Double Unders (D.U)', '6ackfoHYHeo', 'A corda passa duas vezes por baixo dos pés em cada salto. Punhos girando rápido, braços perto do corpo e salto um pouco mais alto.'],
  ['Elevação frontal', 'F6toacmeUlA', 'Halteres na frente das coxas. Eleve os braços estendidos à frente até a altura dos ombros, sem balançar o tronco.'],
  ['Elevação lateral', 'yURmeIEl1Fg', 'Eleve os halteres pelos lados até a altura dos ombros, com os cotovelos levemente flexionados e sem dar impulso.'],
  ['Farmers Carry', '1uOs1hP3u4A', 'Caminhe segurando um peso em cada mão, braços estendidos, ombros para trás e abdômen firme.'],
  ['Flexão diamante (Diamond Push Up)', 'DfsWjEThmLY', 'Flexão com as mãos juntas formando um losango embaixo do peito. Trabalha mais o tríceps.'],
  ['Flutter Kicks', 'Cz6iXfmgtiw', 'Deitado, com a lombar colada no chão e as pernas estendidas e um pouco elevadas, alterne as pernas para cima e para baixo.'],
  ['Goblet Squat', 'ge1vdJRP0UA', 'Agachamento segurando o kettlebell ou halter junto ao peito, com os cotovelos por dentro dos joelhos na descida.'],
  ['Ground to Overhead', 'H0I_B1njFAY', 'Leve o peso do chão até acima da cabeça, do jeito que preferir (clean and jerk ou snatch). Termina com os braços travados em cima.'],
  ['Hand Release Push Up', 'dFI0VWMqxIk', 'Flexão em que o peito encosta no chão e as mãos saem do chão por um instante antes de subir.'],
  ['Handstand Push Up (HSPU)', 'qbRbM6d5ddM', 'Flexão de cabeça para baixo, com os pés apoiados na parede. Desça até a cabeça tocar o apoio e estenda os braços.'],
  ['Hang Clean', '-BEd8cfYH3Y', 'Clean que começa com a barra na altura das coxas (hang), não no chão.'],
  ['Hang Snatch', '52nylh1CnbQ', 'Snatch que começa com a barra na altura das coxas: num movimento só, a barra vai acima da cabeça.'],
  ['Hang Squat Clean', 'YZUdVyVV3uI', 'Clean que começa nas coxas e recebe a barra já no agachamento completo, subindo em seguida.'],
  ['Hollow Rock e Hollow Hold', '17QYGBGsDvw', 'Deitado em forma de "canoa": lombar colada no chão, braços e pernas estendidos e elevados. No hold você segura parado, no rock balança.'],
  ['Kettlebell Swing (KBS)', 'MB87gQFA_y0', 'O movimento vem do quadril, não dos braços. Leve o kettlebell para trás entre as pernas e projete o quadril para a frente com força.'],
  ['Knees High (skipping alto)', 'gxnEVpAGZqE', 'Corrida no lugar elevando os joelhos até a altura do quadril, em ritmo rápido.'],
  ['Knife (canivete)', 'z8GJDUg9hgQ', 'Deitado, suba tronco e pernas ao mesmo tempo, tentando tocar as mãos nos pés, e desça controlando.'],
  ['Leg Raises (elevação de pernas)', 'NJoFF3O87Rs', 'Deitado, com a lombar no chão, suba as pernas estendidas até a vertical e desça devagar sem encostar no chão.'],
  ['Medball Clean', 'KVGhkHSrDJo', 'Agache, pegue a bola no chão e leve-a ao peito com um movimento explosivo de quadril, recebendo agachado.'],
  ['Mountain Climber', '8wuUiihTbdw', 'Em posição de prancha alta, leve os joelhos em direção ao peito, alternando rápido e sem subir o quadril.'],
  ['Overhead Squat (OHS)', 'sFBi347A118', 'Agachamento com a barra travada acima da cabeça, pegada larga e braços estendidos o tempo todo.'],
  ['Panturrilha (elevação de panturrilha)', 'WGXPXWR3nVQ', 'Em pé, suba na ponta dos pés o mais alto que puder, segure um instante e desça devagar.'],
  ['Plank Touch Hands (prancha tocando o ombro)', 'rkHEQ0L1HnU', 'Em prancha alta, toque o ombro oposto com uma mão de cada vez, sem balançar o quadril.'],
  ['Polichinelo (Jumping Jack)', 'FJDZrSZQLiY', 'Salte abrindo as pernas e levando os braços acima da cabeça, depois volte fechando.'],
  ['Prancha (Plank)', 'Zex85qTPc4s', 'Apoio nos antebraços e na ponta dos pés, corpo reto da cabeça ao calcanhar e abdômen e glúteo contraídos.'],
  ['Prancha lateral (Side Plank)', 'pWGhRO5grqs', 'De lado, apoiado em um antebraço e na lateral do pé, com o quadril alto e o corpo em linha reta.'],
  ['Pull Up (barra fixa)', '0r_jpqpuls8', 'Pendurado na barra, suba até o queixo passar da barra e desça até estender os braços.'],
  ['Push Press', 'vNztNxH3QHo', 'Barra na frente dos ombros: faça uma pequena flexão de joelhos e use o impulso das pernas para levar a barra acima da cabeça.'],
  ['Push Up (flexão)', 'lzfBPaGyXwM', 'Mãos um pouco além da largura dos ombros, corpo reto. Peito até perto do chão e braços estendidos em cima.'],
  ['Remo ergômetro (Remador)', 'yaxveBJGoy8', 'A ordem é pernas, tronco e braços na puxada, e o contrário na volta. A força vem das pernas.'],
  ['Reverse Lunge (avanço para trás)', 'bNmttrq4UZU', 'Avanço dando o passo para trás. Desça até o joelho de trás quase tocar o chão e volte à posição inicial.'],
  ['Russian Twist', 'iFQV6q4xRXM', 'Sentado, tronco inclinado para trás e pés no chão ou elevados. Gire o tronco levando o peso de um lado para o outro.'],
  ['Shuttle Run', 'bqRJQcniysw', 'Corrida de vai e volta entre duas marcas, tocando a linha ou o chão em cada virada.'],
  ['Sit Up (abdominal)', 'XOxgZdZMk5I', 'Deitado, suba o tronco inteiro até sentar, tocando os pés ou passando as mãos da linha dos pés, e desça até as costas tocarem o chão.'],
  ['Ski Erg', 'BU34HYkxSss', 'Puxe as alças de cima para baixo dobrando o quadril e os joelhos, como na remada do esqui. A força vem do tronco e das pernas.'],
  ['Sled Push', 'UoxNMyHk26o', 'Empurre o trenó com o corpo inclinado, braços firmes e passos curtos e fortes.'],
  ['Snatch (barra)', 'EZYd4MMfHjE', 'Arranco: a barra sai do chão e vai acima da cabeça num movimento só, com pegada larga.'],
  ['Snatch com halter (DB Snatch)', 'IYF0a3k_aZw', 'Halter do chão até acima da cabeça num movimento só, com um braço. Use o quadril e trave o braço em cima.'],
  ['Split Squat', 'YuLqw3kHPaw', 'Pernas afastadas, uma à frente e outra atrás. Desça e suba sem mudar os pés de lugar.'],
  ['Sprawl', 'f1OFOJo0l64', 'Como um burpee rápido: jogue as pernas para trás até o quadril tocar o chão e volte em pé.'],
  ['Stiff', 'BU_87JJzNA4', 'Com os joelhos quase estendidos, desça o peso perto das pernas levando o quadril para trás, com as costas retas.'],
  ['Sumo Deadlift High Pull (SDHP)', 'gh55vVlwlQg', 'Pés afastados e pegada fechada. Tire o peso do chão e puxe até a altura do queixo, com os cotovelos altos.'],
  ['Superman', 'vDXe2eBowUg', 'Deitado de barriga para baixo, eleve braços e pernas ao mesmo tempo, contraindo a lombar e o glúteo.'],
  ['Supino com kettlebell no chão (Floor Press)', 'lt7_63lXb1U', 'Deitado no chão, empurre o kettlebell para cima até estender o braço e desça até o cotovelo tocar o chão.'],
  ['Thruster', '1WpcAeuT7PQ', 'Front squat seguido direto de um push press: na subida do agachamento a barra já vai acima da cabeça.'],
  ['Toes to Bar (T2B)', 'O_8T796wv48', 'Pendurado na barra, leve os dois pés juntos até tocar a barra, controlando o balanço.'],
  ['Tríceps no banco (Bench Dip)', 'p_DeBmkbCUc', 'Mãos apoiadas no banco atrás do corpo. Desça dobrando os cotovelos para trás e suba estendendo os braços.'],
  ['Walking Lunge', 'DlhojghkaQ0', 'Avanço andando: a cada passo o joelho de trás quase toca o chão, alternando as pernas.'],
  ['Wall Ball', 'WGM7FjbDJUA', 'Agachamento com a bola no peito e, na subida, arremesso até o alvo na parede. Receba a bola já descendo para o próximo.']
].map(([nome, id, orientacoes]) => ({ nome, video_url: yt(id), orientacoes }));

// ---------- vídeos ----------
// YouTube (watch, youtu.be, shorts, embed) → id do vídeo; null se não for YouTube
function idYouTube(url) {
  const m = String(url || '').match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
// Link aceito: YouTube ou arquivo enviado para o nosso Storage
function videoOk(url) {
  if (!url) return true;
  if (idYouTube(url)) return true;
  const base = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  return !!base && String(url).startsWith(base + '/storage/v1/object/public/' + BUCKET + '/');
}

// ---------- Storage (vídeos enviados) ----------
const BUCKET = 'movimentos';
const LIMITE_MB = 50; // limite por arquivo do plano grátis do Supabase
const TIPOS = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/x-m4v': 'm4v' };

function storage() {
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const chave = (process.env.SUPABASE_SECRET_KEY || '').trim();
  if (!url || !chave) { const e = new Error('Banco de dados não configurado.'); e.status = 503; throw e; }
  return { url, headers: { apikey: chave, Authorization: 'Bearer ' + chave } };
}

let bucketPronto = false;
async function garantirBucket() {
  if (bucketPronto) return;
  const s = storage();
  const r = await fetch(s.url + '/storage/v1/bucket/' + BUCKET, { headers: s.headers });
  if (r.status === 404 || r.status === 400) {
    const c = await fetch(s.url + '/storage/v1/bucket', {
      method: 'POST', headers: { ...s.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true, file_size_limit: LIMITE_MB * 1024 * 1024, allowed_mime_types: Object.keys(TIPOS) })
    });
    if (!c.ok && c.status !== 409) throw new Error('Storage: não consegui criar a pasta de vídeos (' + c.status + ' ' + (await c.text()).slice(0, 200) + ')');
  } else if (!r.ok) {
    throw new Error('Storage respondeu ' + r.status);
  }
  bucketPronto = true;
}

// Link assinado para o navegador do coach enviar o arquivo direto ao Storage (sem passar pela Vercel,
// que só aceita 4,5 MB por pedido). Devolve { envio, publico }.
async function linkDeEnvio(tipo, tamanho) {
  const ext = TIPOS[tipo];
  if (!ext) { const e = new Error('Envie um vídeo MP4, MOV ou WEBM.'); e.status = 400; throw e; }
  if (!(tamanho > 0) || tamanho > LIMITE_MB * 1024 * 1024) { const e = new Error('O vídeo pode ter no máximo ' + LIMITE_MB + ' MB. Para vídeos maiores, use um link do YouTube.'); e.status = 400; throw e; }
  await garantirBucket();
  const s = storage();
  const caminho = Date.now().toString(36) + '-' + require('crypto').randomBytes(6).toString('hex') + '.' + ext;
  const r = await fetch(s.url + '/storage/v1/object/upload/sign/' + BUCKET + '/' + caminho, { method: 'POST', headers: s.headers });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.url) throw new Error('Storage: não consegui preparar o envio (' + r.status + ')');
  return { envio: s.url + '/storage/v1' + j.url, publico: s.url + '/storage/v1/object/public/' + BUCKET + '/' + caminho };
}

// Apaga do Storage um vídeo enviado (links do YouTube são ignorados)
async function apagarArquivo(url) {
  const s = storage();
  const prefixo = s.url + '/storage/v1/object/public/' + BUCKET + '/';
  if (!String(url || '').startsWith(prefixo)) return;
  const caminho = String(url).slice(prefixo.length);
  await fetch(s.url + '/storage/v1/object/' + BUCKET, {
    method: 'DELETE', headers: { ...s.headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [caminho] })
  }).catch(() => {});
}

// ---------- banco ----------
const ordem = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
const publico = (x) => ({ nome: x.nome, video: x.video_url || '', youtube: idYouTube(x.video_url), orientacoes: x.orientacoes || '' });

// Lista da página pública: o que o coach cadastrou; enquanto não houver nenhum vídeo no banco, a lista pronta
async function listaPublica() {
  let linhas = [];
  if (banco.configurado()) {
    try { linhas = await banco.ler('exercicios', 'select=nome,video_url,orientacoes&order=nome.asc'); } catch (e) { console.error('movimentos:', e.message); }
  }
  const base = linhas.some((x) => x.video_url) ? linhas : PRONTOS;
  return base.slice().sort(ordem).map(publico);
}

// Coloca no banco os movimentos prontos que ainda não existem (pelo nome); não mexe nos que já existem
async function importarProntos(criadoPor) {
  const existentes = await banco.ler('exercicios', 'select=nome');
  const tem = new Set(existentes.map((x) => x.nome.trim().toLowerCase()));
  const novos = PRONTOS.filter((p) => !tem.has(p.nome.toLowerCase()))
    .map((p) => ({ ...p, modalidade: 'outro', criado_por: criadoPor || null }));
  if (novos.length) await banco.inserir('exercicios', novos);
  return novos.length;
}

module.exports = { PRONTOS, LIMITE_MB, idYouTube, videoOk, linkDeEnvio, apagarArquivo, listaPublica, importarProntos, ordem };

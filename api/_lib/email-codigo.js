// E-mails do site (código de acesso e cadastro), no visual da FT: fundo escuro, amarelo #FFCB3C, logo.
// Feitos para o Gmail: só tabelas, cores em bgcolor + estilo inline, fonte Arial, sem gradiente,
// sem fonte web e sem imagem de fundo (o Gmail ignora ou desenha errado).
const SITE = 'https://www.fttraining.com.br';
const LOGO = SITE + '/assets/brand/icon-512.png';

const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const FONTE = 'Arial,Helvetica,sans-serif';

// Moldura comum: logo, título, conteúdo e rodapé. "previa" é o texto que aparece ao lado do assunto na caixa de entrada.
function moldura({ assunto, previa, titulo, conteudo, rodape }) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${esc(assunto)}</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#0a0a0a;">${esc(previa)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a0a0a" style="background-color:#0a0a0a;">
  <tr><td align="center" style="padding:32px 16px 40px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
      <tr><td align="center" style="padding-bottom:20px;">
        <a href="${SITE}" style="text-decoration:none;"><img src="${LOGO}" width="88" height="88" alt="FT Training" style="display:block;border:0;width:88px;height:88px;"></a>
      </td></tr>
      <tr><td bgcolor="#151515" style="background-color:#151515;border:1px solid #262626;border-radius:16px;padding:32px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="padding-bottom:6px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#ffcb3c" width="40" height="4" style="background-color:#ffcb3c;width:40px;height:4px;font-size:0;line-height:0;border-radius:2px;">&nbsp;</td></tr></table></td></tr>
          <tr><td style="padding-top:18px;font-family:${FONTE};font-size:24px;line-height:1.25;font-weight:bold;color:#ffffff;">${titulo}</td></tr>
          ${conteudo}
        </table>
      </td></tr>
      <tr><td align="center" style="padding:22px 12px 0;font-family:${FONTE};font-size:12px;line-height:1.6;color:#7a7770;">
        ${rodape}<br>
        <a href="${SITE}" style="color:#7a7770;text-decoration:underline;">fttraining.com.br</a> &middot; Divinópolis-MG
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

const paragrafo = (html, extra = '') =>
  `<tr><td style="padding-top:14px;font-family:${FONTE};font-size:16px;line-height:1.6;color:#c9c5bd;${extra}">${html}</td></tr>`;

// Botão que funciona no Gmail e no Outlook (célula com cor, link dentro)
const botao = (link, texto) => `<tr><td style="padding-top:26px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td bgcolor="#ffcb3c" style="background-color:#ffcb3c;border-radius:10px;">
      <a href="${link}" style="display:inline-block;padding:15px 30px;font-family:${FONTE};font-size:16px;font-weight:bold;color:#0a0a0a;text-decoration:none;border-radius:10px;">${texto}</a>
    </td>
  </tr></table>
</td></tr>`;

// ---------- código de acesso ----------
function emailCodigo(codigo) {
  const legivel = codigo.slice(0, 4) + ' ' + codigo.slice(4);
  const assunto = `${legivel} é o seu código de acesso FT Training`;

  const conteudo = paragrafo('Digite este código na tela de login do site para entrar:') + `
          <tr><td style="padding-top:20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td align="center" bgcolor="#0a0a0a" style="background-color:#0a0a0a;border:1px solid #ffcb3c;border-radius:12px;padding:18px 10px;font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:bold;letter-spacing:6px;color:#ffcb3c;white-space:nowrap;">${legivel}</td>
            </tr></table>
          </td></tr>` +
    paragrafo('Ele vale por <strong style="color:#ffffff;">10 minutos</strong>.', 'font-size:14px;color:#9a968e;');

  const html = moldura({
    assunto, previa: `Use ${legivel} para entrar. Vale por 10 minutos.`,
    titulo: 'Seu código de acesso', conteudo,
    rodape: 'Não pediu este código? Pode ignorar este e-mail: ninguém entra sem ele.'
  });

  const texto = `FT Training

Seu código de acesso: ${legivel}

Digite esse código na tela de login do site. Ele vale por 10 minutos.
Não pediu este código? Pode ignorar este e-mail.

${SITE}`;

  return { assunto, html, texto };
}

// ---------- cadastro: o coach cadastrou a pessoa no painel ----------
function emailConvite({ email, nome, coach, papel }) {
  const primeiro = String(nome || '').trim().split(/\s+/)[0];
  const quem = String(coach || '').trim() || 'O seu coach';
  const aluno = papel !== 'admin' && papel !== 'coach';
  const destino = aluno ? '/aluno' : '/coach';
  const link = `${SITE}/entrar?volta=${encodeURIComponent(destino)}`;
  const oque = aluno ? 'a sua planilha de treinos' : 'o painel da equipe';
  const assunto = aluno ? 'Sua planilha de treinos na FT Training está pronta' : 'Seu acesso à equipe FT Training';
  const titulo = primeiro ? `${esc(primeiro)}, seu acesso está pronto` : 'Seu acesso está pronto';

  const passo = (n, html) => `<tr>
                <td width="28" valign="top" style="padding:6px 0;font-family:${FONTE};font-size:15px;font-weight:bold;color:#ffcb3c;">${n}</td>
                <td valign="top" style="padding:6px 0;font-family:${FONTE};font-size:15px;line-height:1.5;color:#c9c5bd;">${html}</td>
              </tr>`;

  const conteudo =
    paragrafo(`${esc(quem)} liberou ${oque} no site da <strong style="color:#ffffff;">FT Training</strong>.`) +
    botao(link, 'Entrar na FT Training') + `
          <tr><td style="padding-top:28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td bgcolor="#0f0f0f" style="background-color:#0f0f0f;border:1px solid #262626;border-radius:12px;padding:16px 18px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr><td colspan="2" style="padding-bottom:6px;font-family:${FONTE};font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#9a968e;">Como entrar</td></tr>
                  ${passo('1', 'Toque em <strong style="color:#ffffff;">Entrar na FT Training</strong>.')}
                  ${passo('2', `Entre com a conta Google <a href="mailto:${esc(email)}" style="color:#ffffff;font-weight:bold;text-decoration:none;">${esc(email)}</a>, ou peça um código: ele chega neste e-mail. Sem senha.`)}
                  ${aluno ? passo('3', 'Coloque o app na tela do celular:') : ''}
                  ${aluno ? `<tr><td></td><td style="padding:2px 0 6px;font-family:${FONTE};font-size:14px;line-height:1.6;color:#c9c5bd;">
                    <strong style="color:#ffcb3c;">iPhone</strong><br>Compartilhar &rsaquo; <strong style="color:#ffffff;">Adicionar à Tela de Início</strong>
                    <div style="padding-top:10px;"><strong style="color:#ffcb3c;">Android</strong><br>&#8942; &rsaquo; Criar atalho &rsaquo; <strong style="color:#ffffff;">Adicionar à tela inicial</strong></div>
                  </td></tr>` : ''}
                </table>
              </td>
            </tr></table>
          </td></tr>`;

  const html = moldura({
    assunto, previa: `${quem} liberou o seu acesso. Entre com ${email}.`,
    titulo, conteudo,
    rodape: 'Não conhece a FT Training? Pode ignorar este e-mail.'
  });

  const texto = `${primeiro ? primeiro + ', seu' : 'Seu'} acesso está pronto

${quem} liberou ${oque} no site da FT Training.

Entrar: ${link}

Como entrar:
1. Abra o link acima.
2. Entre com a conta Google ${email}, ou peça um código: ele chega neste e-mail. Sem senha.${aluno ? '\n3. Coloque o app na tela do celular:\n   iPhone: Compartilhar > Adicionar à Tela de Início\n   Android: ⋮ > Criar atalho > Adicionar à tela inicial' : ''}

Não conhece a FT Training? Pode ignorar este e-mail.`;

  return { assunto, html, texto };
}

// Envia pelo Resend. Sem RESEND_API_KEY (rodando local) só mostra no terminal e devolve false.
async function enviarEmail(para, msg) {
  const chave = process.env.RESEND_API_KEY;
  if (!chave) {
    if (process.env.VERCEL) throw new Error('Envio de e-mail não configurado (RESEND_API_KEY).');
    console.log(`\n[dev] e-mail para ${para}: ${msg.assunto}\n${msg.texto}\n`);
    return false;
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_REMETENTE || 'FT Training <acesso@fttraining.com.br>',
      to: [para], subject: msg.assunto, html: msg.html, text: msg.texto
    })
  });
  if (!r.ok) {
    console.error('Resend falhou', r.status, await r.text());
    throw new Error('Não consegui enviar o e-mail agora.');
  }
  return true;
}

module.exports = { emailCodigo, emailConvite, enviarEmail };

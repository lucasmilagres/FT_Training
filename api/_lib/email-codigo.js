// E-mail com o código de acesso, no visual do site (preto, amarelo #FFCB3C, logo FT).
// Tabelas + estilos inline porque é o que Gmail/Outlook/Apple Mail entendem.
const SITE = 'https://www.fttraining.com.br';

function emailCodigo(codigo) {
  const legivel = codigo.slice(0, 4) + ' ' + codigo.slice(4);
  const assunto = `${legivel} é o seu código de acesso FT Training`;

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${assunto}</title>
</head>
<body style="margin:0;padding:0;background:#000000;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Use ${legivel} para entrar na área de treinos. Vale por 10 minutos.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#000000;">
  <tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#0a0a0a;border:1px solid #262626;border-radius:18px;">
      <tr><td style="height:8px;border-radius:18px 18px 0 0;background:#ffcb3c;background-image:repeating-linear-gradient(-45deg,#ffcb3c 0 14px,#0a0a0a 14px 28px);font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td align="center" style="padding:36px 32px 8px;">
        <a href="${SITE}" style="text-decoration:none;"><img src="${SITE}/assets/brand/icon-512.png" width="132" height="132" alt="FT Training" style="display:block;border:0;width:132px;height:132px;"></a>
      </td></tr>
      <tr><td align="center" style="padding:0 32px;">
        <p style="margin:0;font-family:'Courier New',monospace;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#ffcb3c;">+ Alunos e equipe</p>
        <h1 style="margin:12px 0 0;font-family:'Arial Narrow',Arial,sans-serif;font-weight:900;font-style:italic;font-size:34px;line-height:1;text-transform:uppercase;color:#f2efe8;">Seu código de acesso</h1>
      </td></tr>
      <tr><td align="center" style="padding:28px 32px;">
        <div style="display:inline-block;padding:18px 28px;border:2px solid #ffcb3c;border-radius:14px;font-family:'Courier New',monospace;font-weight:700;font-size:40px;letter-spacing:8px;color:#ffcb3c;white-space:nowrap;">${legivel}</div>
      </td></tr>
      <tr><td align="center" style="padding:0 40px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#bdb9b0;">
        Digite esse código na tela de login do site para entrar.<br>
        Ele vale por <strong style="color:#f2efe8;">10 minutos</strong>.
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid #262626;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#8a8780;text-align:center;">
        Não pediu este código? Pode ignorar este e-mail: ninguém entra sem ele.<br>
        <a href="${SITE}" style="color:#8a8780;">fttraining.com.br</a> · Divinópolis-MG
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const texto = `FT Training

Seu código de acesso: ${legivel}

Digite esse código na tela de login do site. Ele vale por 10 minutos.
Não pediu este código? Pode ignorar este e-mail.

${SITE}`;

  return { assunto, html, texto };
}

const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Convite: o coach cadastrou a pessoa no painel → ela recebe o link para entrar (Google ou código por e-mail)
function emailConvite({ email, nome, coach, papel }) {
  const primeiro = String(nome || '').trim().split(/\s+/)[0];
  const ola = primeiro ? `Olá, ${esc(primeiro)}!` : 'Olá!';
  const quem = coach ? esc(coach) : 'O seu coach';
  const aluno = papel !== 'admin' && papel !== 'coach';
  const destino = aluno ? '/aluno' : '/coach';
  const link = `${SITE}/entrar?volta=${encodeURIComponent(destino)}`;
  const oque = aluno ? 'a sua planilha de treinos' : 'o painel da equipe';
  const assunto = aluno ? 'Sua planilha de treinos na FT Training está pronta' : 'Seu acesso à equipe FT Training';

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${assunto}</title>
</head>
<body style="margin:0;padding:0;background:#000000;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${quem} liberou o seu acesso. Entre com ${esc(email)}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#000000;">
  <tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#0a0a0a;border:1px solid #262626;border-radius:18px;">
      <tr><td style="height:8px;border-radius:18px 18px 0 0;background:#ffcb3c;background-image:repeating-linear-gradient(-45deg,#ffcb3c 0 14px,#0a0a0a 14px 28px);font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td align="center" style="padding:36px 32px 8px;">
        <a href="${SITE}" style="text-decoration:none;"><img src="${SITE}/assets/brand/icon-512.png" width="132" height="132" alt="FT Training" style="display:block;border:0;width:132px;height:132px;"></a>
      </td></tr>
      <tr><td align="center" style="padding:0 32px;">
        <p style="margin:0;font-family:'Courier New',monospace;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#ffcb3c;">+ ${aluno ? 'Sou aluno' : 'Equipe'}</p>
        <h1 style="margin:12px 0 0;font-family:'Arial Narrow',Arial,sans-serif;font-weight:900;font-style:italic;font-size:34px;line-height:1;text-transform:uppercase;color:#f2efe8;">${ola}</h1>
      </td></tr>
      <tr><td align="center" style="padding:20px 40px 8px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#bdb9b0;">
        ${quem} liberou ${oque} no site da FT Training.<br>
        Para entrar, use o e-mail <strong style="color:#f2efe8;">${esc(email)}</strong>: pela conta Google ou com um código que chega neste e-mail. Sem senha.
      </td></tr>
      <tr><td align="center" style="padding:24px 32px 32px;">
        <a href="${link}" style="display:inline-block;padding:16px 30px;background:#ffcb3c;border-radius:999px;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:15px;letter-spacing:1px;text-transform:uppercase;color:#0a0a0a;text-decoration:none;">Entrar na FT Training</a>
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid #262626;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#8a8780;text-align:center;">
        No celular, depois de entrar, toque em "Adicionar à tela inicial" para abrir como app.<br>
        Não conhece a FT Training? Pode ignorar este e-mail.<br>
        <a href="${SITE}" style="color:#8a8780;">fttraining.com.br</a> · Divinópolis-MG
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const texto = `${ola.replace(/&amp;/g, '&')}

${coach || 'O seu coach'} liberou ${oque} no site da FT Training.
Para entrar, use o e-mail ${email}: pela conta Google ou com um código que chega neste e-mail. Sem senha.

Entrar: ${link}

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

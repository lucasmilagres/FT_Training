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
        <p style="margin:0;font-family:'Courier New',monospace;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#ffcb3c;">+ Área do coach</p>
        <h1 style="margin:12px 0 0;font-family:'Arial Narrow',Arial,sans-serif;font-weight:900;font-style:italic;font-size:34px;line-height:1;text-transform:uppercase;color:#f2efe8;">Seu código de acesso</h1>
      </td></tr>
      <tr><td align="center" style="padding:28px 32px;">
        <div style="display:inline-block;padding:18px 28px;border:2px solid #ffcb3c;border-radius:14px;font-family:'Courier New',monospace;font-weight:700;font-size:40px;letter-spacing:8px;color:#ffcb3c;white-space:nowrap;">${legivel}</div>
      </td></tr>
      <tr><td align="center" style="padding:0 40px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#bdb9b0;">
        Digite esse código na tela de login do site para abrir os <strong style="color:#f2efe8;">Treinos</strong>.<br>
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

  const texto = `FT Training — Área do coach

Seu código de acesso: ${legivel}

Digite esse código na tela de login do site. Ele vale por 10 minutos.
Não pediu este código? Pode ignorar este e-mail.

${SITE}`;

  return { assunto, html, texto };
}

module.exports = { emailCodigo };

// Gera o FAQ visível + JSON-LD (ExerciseGym, WebSite, FAQPage) a partir da mesma lista
// e injeta no index.html entre marcadores. Rodar na raiz do projeto: node scripts/seo.js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const file = path.join(root, 'index.html');
let html = fs.readFileSync(file, 'utf8');

const SITE = 'https://www.fttraining.com.br/';
const WPP = 'https://wa.me/5537999611960';

const faq = [
  {
    q: 'Onde treinar Hyrox em Divinópolis?',
    a: 'Na FT Training. Segunda, quarta e sexta é dia de FT Hyrox: o método completo da prova dividido ao longo da semana, com corrida, as estações (SkiErg, sled push, sled pull, burpee broad jump, remo, farmers carry, lunges e wall balls) e condicionamento. O head coach, Fábio Tanaka, tem certificação de treinador HYROX e compete na modalidade.'
  },
  {
    q: 'Onde fica a FT Training?',
    a: 'Na Rua Pitangui, 175, bairro Bom Pastor, em Divinópolis-MG (CEP 35500-151). O mapa e o botão de rota estão na seção de localização do site.'
  },
  {
    q: 'A FT Training é um box de CrossFit?',
    a: 'A FT Training é um box de treinamento híbrido em Divinópolis. As aulas têm cross training (levantamentos, ginástica e condicionamento de alta intensidade), mas a metodologia vai além e une Hyrox, corrida e hipertrofia. O head coach é certificado CF-L1 e CF-Kids.'
  },
  {
    q: 'O que é treino híbrido?',
    a: 'É o treino que desenvolve força e resistência ao mesmo tempo: corrida, levantamentos, ginástica e condicionamento na mesma rotina. Na FT Training a semana é dividida em FT Hyrox (segunda, quarta e sexta) e FT Power (terça para membros inferiores e quinta para superiores, sempre com workout no final).'
  },
  {
    q: 'Quais são os horários das aulas?',
    a: 'De segunda a sexta, com 8 horários por dia: 6h, 7h, 8h e 9h de manhã e 16h, 17h, 18h e 19h à tarde. Cada aula dura 1 hora.'
  },
  {
    q: 'Tem treino de força e hipertrofia?',
    a: 'Sim. Terça e quinta são dias de FT Power, voltados para força e massa muscular: terça para membros inferiores e quinta para superiores, sempre fechando com um workout de condicionamento.'
  },
  {
    q: 'Tem treino de corrida?',
    a: 'Sim. A corrida faz parte do método FT Hyrox, com base aeróbica, intervalados e técnica de passada. Para quem quer levar a corrida para a rua e para as provas, a FT tem parceria com a BORA Assessoria, de Divinópolis.'
  },
  {
    q: 'Quem são os treinadores da FT Training?',
    a: 'O head coach é Fábio Tanaka, profissional de Educação Física com certificações CF-L1, CF-Kids e de treinador HYROX. Ele também é fundador da UAIROX, corrida híbrida realizada em Minas Gerais.'
  },
  {
    q: 'Como agendar uma aula experimental?',
    a: 'Pelo WhatsApp (37) 99961-1960 ou pelo site www.fttraining.com.br: escolha o horário e envie a mensagem.'
  }
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const faqHtml = `<!-- FAQ:START -->
    <!-- Gerado por scripts/seo.js: edite as perguntas lá e rode node scripts/seo.js -->
    <section class="section faq" id="duvidas" aria-labelledby="faq-title">
      <div class="wrap faq__grid">
        <div class="faq__intro">
          <p class="sec-num reveal"><b>06</b> — Dúvidas</p>
          <h2 class="sec-title reveal" id="faq-title">Perguntas<br><span class="y">frequentes.</span></h2>
          <p class="sec-lead reveal">Treino híbrido, Hyrox, cross training, corrida e hipertrofia em Divinópolis-MG. Se a sua dúvida não estiver aqui, chama a gente no WhatsApp.</p>
        </div>
        <div class="faq__list">
${faq.map((f) => `          <details class="faq__item reveal">
            <summary><h3>${esc(f.q)}</h3><span class="faq__icon" aria-hidden="true"></span></summary>
            <p>${esc(f.a)}</p>
          </details>`).join('\n')}
        </div>
      </div>
    </section>
    <!-- FAQ:END -->`;

const ld = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'ExerciseGym',
      '@id': SITE + '#gym',
      name: 'FT Training',
      alternateName: ['FT Training Divinópolis', 'FT Treinamento Híbrido'],
      description: 'Box de treinamento híbrido em Divinópolis-MG: Hyrox, corrida, cross training e hipertrofia em uma metodologia só. Aulas de segunda a sexta, manhã e tarde.',
      url: SITE,
      logo: SITE + 'assets/brand/icon-512.png',
      image: SITE + 'assets/og-cover.jpg',
      telephone: '+55 37 99961-1960',
      address: { '@type': 'PostalAddress', streetAddress: 'Rua Pitangui, 175 - Bom Pastor', addressLocality: 'Divinópolis', addressRegion: 'MG', postalCode: '35500-151', addressCountry: 'BR' },
      geo: { '@type': 'GeoCoordinates', latitude: -20.1250719, longitude: -44.8839479 },
      hasMap: 'https://maps.app.goo.gl/A3rmkWkCk5DWfzD1A',
      areaServed: { '@type': 'City', name: 'Divinópolis' },
      openingHoursSpecification: [
        { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '06:00', closes: '10:00' },
        { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '16:00', closes: '20:00' }
      ],
      knowsAbout: ['Hyrox', 'Treinamento híbrido', 'Cross training', 'Treinamento funcional', 'Corrida', 'Hipertrofia', 'Condicionamento físico'],
      sameAs: ['https://www.instagram.com/ft.training_/'],
      employee: {
        '@type': 'Person',
        name: 'Fábio Tanaka',
        jobTitle: 'Head Coach',
        sameAs: ['https://www.instagram.com/tankfabio/']
      },
      potentialAction: { '@type': 'ReserveAction', name: 'Agendar aula experimental', target: WPP }
    },
    {
      '@type': 'WebSite',
      '@id': SITE + '#website',
      url: SITE,
      name: 'FT Training',
      inLanguage: 'pt-BR',
      publisher: { '@id': SITE + '#gym' }
    },
    {
      '@type': 'FAQPage',
      '@id': SITE + '#faq',
      mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
    }
  ]
};
const ldHtml = `<!-- LD:START -->
  <script type="application/ld+json">
${JSON.stringify(ld, null, 2).split('\n').map((l) => '  ' + l).join('\n')}
  </script>
  <!-- LD:END -->`;

const replaceBlock = (src, start, end, block, fallbackAnchor, before) => {
  const re = new RegExp(`[ \\t]*<!-- ${start} -->[\\s\\S]*?<!-- ${end} -->`);
  if (re.test(src)) return src.replace(re, block);
  if (!src.includes(fallbackAnchor)) throw new Error('âncora não encontrada: ' + fallbackAnchor);
  return src.replace(fallbackAnchor, before ? block + '\n\n' + fallbackAnchor : fallbackAnchor + '\n' + block);
};

html = replaceBlock(html, 'LD:START', 'LD:END', '  ' + ldHtml.trimStart(), '</head>', true);
html = replaceBlock(html, 'FAQ:START', 'FAQ:END', '    ' + faqHtml, '    <!-- ============ CTA FINAL ============ -->', true);
fs.writeFileSync(file, html);
console.log('ok:', faq.length, 'perguntas');

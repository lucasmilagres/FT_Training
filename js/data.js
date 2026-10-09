/* ==========================================================
   FT TRAINING — CONTEÚDO EDITÁVEL
   Tudo que muda com frequência fica aqui.
   ========================================================== */
window.FT = {
  // WhatsApp (somente números, com DDI 55 + DDD)
  whatsapp: '5537999611960',

  instagram: 'ft.training_',

  /* ---------- BARALHO DE REELS ----------
     video: caminho do .mp4 em assets/reels (null = mostra a capa e abre no Instagram)
     Para trocar um vídeo, basta salvar o .mp4 com o mesmo nome. */
  reels: [
    { code: 'DeNMxKdCwNS', video: 'assets/reels/reel-01.mp4', poster: 'assets/reels/reel-01.jpg', tag: 'Intensidade' },
    { code: 'Ddq-kYfRLhA', video: 'assets/reels/reel-02.mp4', poster: 'assets/reels/reel-02.jpg', tag: 'Foco' },
    { code: 'Dcei2gFxEdQ', video: 'assets/reels/reel-03.mp4', poster: 'assets/reels/reel-03.jpg', tag: 'Condicionamento' },
    { code: 'DbtoUoMR-He', video: 'assets/reels/reel-04.mp4', poster: 'assets/reels/reel-04.jpg', tag: 'Mentalidade' },
    { code: 'DbysC9nxrUn', video: 'assets/reels/reel-05.mp4', poster: 'assets/reels/reel-05.jpg', tag: 'Competição' },
    { code: 'DeAcDbdxVnv', video: 'assets/reels/reel-06.mp4', poster: 'assets/reels/reel-06.jpg', tag: 'Workout' }
  ],

  /* ---------- FEED DO INSTAGRAM ----------
     Para o feed atualizar sozinho, crie um feed gratuito em https://behold.so
     (conecte o Instagram da FT, escolha "JSON") e cole a URL abaixo.
     Enquanto estiver vazio, o site usa o retrato salvo em assets/feed. */
  beholdFeedUrl: '',

  feedSnapshot: [
    { url: 'https://www.instagram.com/p/C6odf5FArgy/', img: 'assets/feed/post-01.jpg', video: false, alt: 'Aqui é outro patamar. Vem pro FT.' },
    { url: 'https://www.instagram.com/p/C8HiSMDAOEa/', img: 'assets/feed/post-02.jpg', video: false, alt: 'Vem pro FT: aulas de segunda a sexta.' },
    { url: 'https://www.instagram.com/reel/CzHjE8pAZWp/', img: 'assets/feed/post-03.jpg', video: true, alt: 'Aluno da FT Training no box.' },
    { url: 'https://www.instagram.com/reel/DeNMxKdCwNS/', img: 'assets/feed/post-04.jpg', video: true, alt: 'Atleta em treino intenso.' },
    { url: 'https://www.instagram.com/p/DeDL97uETzk/', img: 'assets/feed/post-05.jpg', video: false, alt: 'Treino no box FT.' },
    { url: 'https://www.instagram.com/reel/DeAcDbdxVnv/', img: 'assets/feed/post-06.jpg', video: true, alt: 'Workout com wall balls.' },
    { url: 'https://www.instagram.com/reel/Ddq-kYfRLhA/', img: 'assets/feed/post-07.jpg', video: true, alt: 'Treino de força.' },
    { url: 'https://www.instagram.com/reel/DdPPo64RI8_XZ7BaD1Lx_f7z74kMUSRJpVRIyE0/', img: 'assets/feed/post-08.jpg', video: true, alt: 'Pódio em prova de corrida híbrida.' },
    { url: 'https://www.instagram.com/p/DdM7idECcNr/', img: 'assets/feed/post-09.jpg', video: false, alt: 'Atletas no pódio.' },
    { url: 'https://www.instagram.com/p/DdMc5r8lku-/', img: 'assets/feed/post-10.jpg', video: false, alt: 'Prova na praia.' },
    { url: 'https://www.instagram.com/reel/DcrqMgUJDG7/', img: 'assets/feed/post-11.jpg', video: true, alt: 'Treino com medicine ball.' },
    { url: 'https://www.instagram.com/reel/Dcl5WwqusCv/', img: 'assets/feed/post-12.jpg', video: true, alt: 'Aluno comemorando o treino.' }
  ]
};

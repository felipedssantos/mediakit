export const ptBR = {
  common: {
    appName: "Conversor",
    backHome: "Início",
    errorStamp: "Falha",
    reasonStamp: "Motivo",
    choose: "Escolher",
    cancel: "Cancelar",
    retry: "De novo",
    openFolder: "Abrir pasta",
    delete: "Apagar",
    copy: "Copiar",
    copied: "Copiado",
    save: "Salvar",
    saving: "Salvando",
    emptyQueue: "Fila vazia",
    queuing: "Enfileirando",
    start: "Iniciar",
    originalSize: "tamanho original",
    sameAsInputDir: "Mesma pasta do arquivo original",
    outputDirLabel: "Pasta de destino",
    qualityLabel: "Qualidade",
    qualityHigh: "Alta qualidade",
    qualityBalanced: "Equilibrado",
    qualitySmaller: "Arquivo menor",
    concurrencyLabel: "Ao mesmo tempo",
    stepAdjustments: "Ajustes (opcional)",
    removeItem: (name: string) => `Remover ${name}`,
    filesCount: (count: number) =>
      `${count} arquivo${count === 1 ? "" : "s"}`,
  },
  boardStatus: {
    queued: "Na fila",
    running: "Em andamento",
    finalizing: "Juntando",
    completed: "Concluído",
    failed: "Falhou",
    cancelled: "Cancelado",
  },
  titleBar: {
    minimize: "Minimizar",
    maximize: "Maximizar",
    restore: "Restaurar",
    closeToTray: "Minimizar para a bandeja",
  },
  home: {
    tools: [
      {
        id: "video_compress" as const,
        name: "Comprimir vídeo",
        detail:
          "Diminua o tamanho do arquivo, com qualidade ou GPU. Vários vídeos de uma vez, na mesma fila.",
      },
      {
        id: "video_convert" as const,
        name: "Converter vídeo",
        detail:
          "Troque o tipo do arquivo: MP4, MKV, MOV, WebM ou AVI, ou tire só o áudio. Vários arquivos de uma vez.",
      },
      {
        id: "image_compress" as const,
        name: "Comprimir imagens",
        detail:
          "Diminua o tamanho das fotos, para enviar ou para guardar. Várias imagens de uma vez, na mesma fila.",
      },
      {
        id: "image_convert" as const,
        name: "Converter imagens",
        detail:
          "Troque o tipo da imagem: JPEG, PNG, WebP, BMP ou TIFF. Várias imagens de uma vez, na mesma fila.",
      },
      {
        id: "youtube" as const,
        name: "Baixar vídeo",
        detail:
          "Cole o link de YouTube, Vimeo e outros sites suportados. Vídeo ou só o áudio, na pasta que você escolher.",
      },
      {
        id: "screenshot" as const,
        name: "Print screen",
        detail:
          "Pressione Print Screen em qualquer lugar. Os prints ficam no menu Print screen. No overlay dá para anotar, copiar ou salvar.",
      },
    ],
  },
  dropZone: {
    defaultTitle: "Arraste seus vídeos para cá",
    defaultHint:
      "Ou clique para escolher um ou vários arquivos do computador.",
    probingTitle: "Lendo os arquivos",
    probingHint:
      "A placa está conferindo duração e tamanho de cada vídeo.",
  },
  converter: {
    compressTitle: "Comprimir vídeo",
    convertTitle: "Converter vídeo",
    compressDetail: "Escolha os vídeos, o preset e despache a fila",
    convertDetail: "Troque o formato ou tire só o áudio",
    stepChooseFiles: "Escolha os vídeos",
    dropTitle: "Arraste seus vídeos para cá",
    dropCompressHint:
      "Ou clique para escolher um ou vários arquivos para comprimir.",
    dropConvertHint:
      "Ou clique para escolher um ou vários arquivos para converter.",
    selectedTitle: "Vídeos escolhidos",
    noneSelected: "Nenhum vídeo escolhido ainda.",
    stepPreset: "O que você quer fazer?",
    saveAudioAs: "Salvar o áudio como",
    convertTo: "Converter para",
    startMany: (count: number) => `Iniciar ${count} vídeos`,
    startHint:
      "Escolha os vídeos acima. O botão libera quando pelo menos um arquivo estiver pronto.",
    queueCompressTitle: "Fila de compressão",
    queueConvertTitle: "Fila de conversão",
    queueCompressEmpty:
      "Assim que você iniciar a compressão, cada vídeo aparece aqui com o progresso ao vivo.",
    queueConvertEmpty:
      "Assim que você iniciar a conversão, cada vídeo aparece aqui com o progresso ao vivo.",
    totalSizeSuffix: "no total",
  },
  imageConverter: {
    compressTitle: "Comprimir imagens",
    convertTitle: "Converter imagens",
    compressDetail: "Escolha as fotos, o preset e despache a fila",
    convertDetail: "Troque o formato para JPEG, PNG ou WebP",
    stepChooseFiles: "Escolha as imagens",
    dropTitle: "Arraste suas imagens para cá",
    dropCompressHint:
      "JPG, PNG, WebP, GIF, BMP, TIFF, HEIC e AVIF. Ou clique para escolher o que comprimir.",
    dropConvertHint:
      "JPG, PNG, WebP, GIF, BMP, TIFF, HEIC e AVIF. Ou clique para escolher o que converter.",
    dropProbingHint:
      "A placa está conferindo tamanho e dimensões de cada imagem.",
    selectedTitle: "Imagens escolhidas",
    noneSelected: "Nenhuma imagem escolhida ainda.",
    stepCompressPreset: "O que você quer fazer?",
    stepConvertPreset: "Converter para",
    startMany: (count: number) => `Iniciar ${count} imagens`,
    startHint:
      "Escolha as imagens acima. O botão libera quando pelo menos um arquivo estiver pronto.",
    queueCompressTitle: "Fila de compressão",
    queueConvertTitle: "Fila de conversão",
    queueCompressEmpty:
      "Assim que você iniciar a compressão, cada imagem aparece aqui com o progresso ao vivo.",
    queueConvertEmpty:
      "Assim que você iniciar a conversão, cada imagem aparece aqui com o progresso ao vivo.",
    noImagesRecognized:
      "Nenhuma imagem reconhecida. Use JPG, PNG, WebP, GIF, BMP, TIFF, HEIC ou AVIF.",
    ignoredFiles: (skipped: number) =>
      `${skipped} arquivo${skipped === 1 ? "" : "s"} ignorado${skipped === 1 ? "" : "s"} — só imagens entram nesta fila.`,
  },
  outputSettings: {
    resolutionLabel: "Resolução",
    maxSizeLabel: "Tamanho máximo",
    codecLabel: "Codec",
    formatLabel: "Formato",
    nvidiaLabel: "Placa NVIDIA",
    nvidiaUnsupportedFormat:
      "Este tipo de arquivo não usa a placa NVIDIA.",
    nvidiaPresetLocked: "Este preset já usa a GPU.",
    nvidiaAvailable: "Converte mais rápido com a placa de vídeo.",
    nvidiaUnavailable: "Nenhuma NVIDIA compatível neste computador.",
    audioConcurrencyHint:
      "Números maiores terminam a fila mais rápido, mas deixam o computador mais ocupado.",
    losslessHint:
      "PNG, BMP e TIFF não perdem qualidade. O arquivo pode ficar maior que o original, principalmente se a foto já era JPEG.",
    fixedCodecWebm: "VP9 + Opus, exigido pelo WebM",
    fixedCodecAvi: "MPEG-4 + MP3, exigido pelo AVI",
    resOriginal: "Manter original",
    res1080p: "1080p (Full HD)",
    res720p: "720p (HD)",
    res480p: "480p (menor arquivo)",
    imgMax1920: "Até 1920 px",
    imgMax1280: "Até 1280 px",
    imgMax800: "Até 800 px",
    codecH264: "H.264 (mais compatível)",
    codecHevc: "H.265 (arquivo menor)",
    fmtJpeg: "JPEG (mais compatível)",
    fmtWebp: "WebP (arquivo menor)",
    fmtPng: "PNG (sem perda)",
    fmtBmp: "BMP (sem compressão)",
    fmtTiff: "TIFF (impressão)",
  },
  youtube: {
    title: "Baixar vídeo",
    detail: "Cole vários links, escolha vídeo ou áudio e baixe em lote",
    stepLinks: "Cole os links",
    placeholder: "https://www.youtube.com/watch?v=...\nhttps://vimeo.com/...",
    searching: "Buscando",
    searchingButton: "Buscando...",
    searchSingle: "Buscar",
    searchMany: (count: number) => `Buscar ${count} links`,
    linksInList: (count: number) =>
      `${count} link${count === 1 ? "" : "s"} na lista`,
    cookiesHint:
      "Um link por linha. Se o site pedir login, o app lê os cookies do Chrome, Edge, Firefox e outros navegadores instalados — entre na conta nesse navegador antes de buscar.",
    readyListTitle: "Prontos para baixar",
    probeStatusTitle: "Status da busca",
    readyBadge: "Pronto",
    removeLink: "Remover link",
    stepMode: "Como você quer salvar?",
    modeVideo: "Vídeo",
    modeVideoDetail: "Imagem e som, pronto para assistir.",
    modeAudio: "Só o áudio",
    modeAudioDetail: "Apenas o som, como música ou podcast.",
    videoQualityLabel: "Qualidade do vídeo",
    videoQualityHint:
      "Qualidades menores geram arquivos menores e baixam mais rápido.",
    qualityBest: "Melhor disponível",
    quality1080: "Até 1080p (Full HD)",
    quality720: "Até 720p (HD)",
    quality480: "Até 480p (arquivo menor)",
    audioFormatLabel: "Formato do áudio",
    audioFormatHint:
      "Na dúvida, escolha MP3 — funciona no celular, no carro e no computador.",
    audioM4a: "M4A (boa qualidade)",
    audioMp3: "MP3 (abre em qualquer lugar)",
    windowsVideosDir: "Pasta de vídeos do Windows",
    batchDirHint: "Todos os arquivos do lote vão para esta pasta.",
    downloadSingle: "Baixar",
    downloadMany: (count: number) => `Baixar ${count} vídeos`,
    downloadHint:
      "Cole os links e clique em Buscar. O botão libera quando pelo menos um vídeo estiver pronto.",
    queueTitle: "Fila de download",
    queueEmpty:
      "Cada download aparece aqui com o progresso ao vivo, e você pode cancelar a qualquer momento.",
    cardDownloading: "Baixando",
    cardFinalizingSpeed: "juntando arquivo",
    cardAudioDetail: (fmt: string) => `Áudio ${fmt}`,
    cardVideoDetail: (quality: string) =>
      `Vídeo ${quality === "best" ? "melhor disponível" : quality}`,
    errNoLinks: "Cole um ou mais links para continuar.",
    errProbeFirst: "Primeiro busque os vídeos colando os links.",
    errNoDir: "Escolha uma pasta para salvar os arquivos.",
  },
  screenshot: {
    title: "Print screen",
    detail: "A tecla Print Screen abre o overlay. Os prints ficam nesta lista.",
    stepHow: "Como tirar o print",
    howPart1: "Pressione",
    howKey: "Print Screen",
    howPart2:
      "em qualquer lugar. No overlay, anote se quiser e copie ou salve. Cada print entra nesta lista.",
    howHint:
      "Copiar e salvar no overlay não apaga o histórico. O arquivo fica no app para reabrir depois.",
    stepDir: "Pasta de destino",
    windowsPicturesDir: "Pasta de imagens do Windows",
    dirHint: "Salvar no overlay e nesta página envia o arquivo para esta pasta.",
    stepHistory: "Prints feitos",
    emptyHistory: "Nenhum print ainda. Use Print Screen para capturar.",
    selectedAlt: "Print selecionado",
    deleteDialogTitle: "Apagar print",
    deleteDialogBody:
      "Este print sai da lista e não dá para desfazer. Quer apagar mesmo?",
    toastCopied: "Imagem copiada para a área de transferência",
  },
  snip: {
    toolFullscreen: "Tela",
    toolWindow: "Janela",
    toolRegion: "Área",
    toolArrow: "Seta",
    toolRect: "Quadrado",
    toolText: "Texto",
    hintText: "Clique para escrever · Enter confirma",
    hintArrow: "Arraste para a seta",
    hintRect: "Arraste para o quadrado",
    hintWindowFallback: "Passe o mouse e clique na janela",
    hintRegion: "Arraste para selecionar a área",
    hintFullscreen: "Clique para capturar a tela toda",
    footerAnnotate: " · Copiar ou Salvar confirma · Ctrl+Z desfaz",
    footerCopy: " · copia na hora",
    footerSave: " · salva na pasta",
    footerEscape: " · Esc cancela",
  },
} as const;

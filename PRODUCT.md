# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Criadores de conteúdo e editores de vídeo que convertem e comprimem arquivos com frequência, geralmente em lote, numa máquina Windows enquanto trabalham em outra coisa. Conhecem o próprio fluxo de trabalho, mas não querem montar linha de comando de FFmpeg para cada tarefa.

## Product Purpose

Conversor é um app desktop Windows (Tauri 2 + React + FFmpeg/yt-dlp como sidecars) que comprime, converte e extrai áudio de vídeos, e baixa vídeos de YouTube e outros sites suportados pelo yt-dlp em vídeo ou áudio, salvando na pasta escolhida pelo usuário. Sucesso é o arquivo sair pronto, no tamanho e formato certos, sem o usuário precisar decidir nada sobre codec.

## Positioning

Tudo roda localmente na máquina: sem upload, sem limite de tamanho de arquivo, sem fila de servidor, sem anúncio. É a diferença que um conversor online não pode copiar. Em segundo plano, presets escritos em linguagem humana e velocidade (NVENC, fila de vários arquivos) sustentam a promessa.

## Operating Context

- App de janela própria com barra de título customizada (`TitleBar`), rodando em segundo plano enquanto o usuário trabalha.
- Fluxos: escolher a ferramenta na Home → arrastar arquivos ou colar link → escolher preset e pasta de saída → acompanhar a fila com progresso por item.
- Trabalho em lote é normal: vários jobs na fila, cada um com estado próprio (na fila, convertendo, concluído, erro, cancelado).
- Arquivos de entrada são grandes; conversões duram minutos. Progresso e tempo restante são informação de primeira classe.

## Capabilities and Constraints

- Presets: comprimir para enviar (H.264 CRF 28), comprimir com qualidade (H.265 CRF 23), converter para MP4, extrair só o áudio (.m4a), comprimir com GPU (h264_nvenc, quando há NVIDIA).
- Entradas de vídeo: mp4, mkv, mov, avi, webm, m4v, wmv, flv, mpeg, mpg, ts.
- Download de vídeo via yt-dlp sidecar (YouTube e outros sites reconhecidos), em vídeo ou só áudio. Quando o site pede login, o app tenta os cookies do Chrome, Edge, Firefox e outros navegadores instalados neste computador.
- Stack fixa: Tauri 2, React, TypeScript, Vite, Tailwind CSS v4, lucide-react. Sem novas dependências pesadas.
- Tema escuro (restrição do usuário).
- Interface em português do Brasil.
- Janela desktop redimensionável e pequena: o layout precisa funcionar por volta de 900×600 e escalar para cima; não é uma página web larga.

## Brand Commitments

Nome: Conversor. Sem logotipo, tipografia ou paleta fixados até agora — o mundo visual roxo/gradiente atual é incumbente sem aprovação e está explicitamente em substituição.

## Evidence on Hand

Código de produção funcional em `src/` (Home, Converter, Baixar vídeo), instalador gerado em `instalador/`, presets reais em `src/lib/presets.ts`. Não há métricas de desempenho medidas, depoimentos, base de usuários nem preço; nada disso pode ser inventado na interface.

## Product Principles

1. O arquivo pronto é o produto; a interface existe para não atrapalhar a fila.
2. Decisão em linguagem de resultado, nunca em jargão de codec — mas sem esconder o que está acontecendo de quem sabe.
3. Estado sempre visível: o usuário deve saber, de relance, o que está rodando, o que falta e o que falhou.
4. Local por padrão: nada sai da máquina, e a interface pode dizer isso com naturalidade.
5. Densidade honesta: janela pequena, trabalho em lote — espaço é recurso escasso, não estilo.

---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["src/pages/HomePage.tsx","src/pages/ConverterPage.tsx","src/pages/YoutubePage.tsx","src/index.css"]
---

# Surface brief — aplicativo Conversor (Home, Converter, YouTube)

Escopo: o shell inteiro do app e as três telas. Modo do visitante: Operate.
Público: criador de conteúdo/editor convertendo em lote no Windows, janela aberta em segundo plano.
Tarefa: soltar arquivos ou colar link, escolher preset e pasta, acompanhar a fila até o arquivo sair.
Restrições: Tauri 2 + React + Tailwind v4 + lucide-react, sem novas dependências pesadas; tema escuro; português; funcionar em ~900×600 e escalar.

## Direction contract

THESIS: a fila é um painel de partidas — colunas que nunca se movem, linhas vivas ranqueadas por tempo. Recusa o dashboard de cartões arredondados sobre gradiente.

OWN-WORLD: preto fosco de aba (#0E0E0E), moldura de aço escovado (#3A3F44), letra pintada branca (#F2F2F2), lâmpada âmbar (#E6A417) para o que está correndo, tijolo (#A8321F) para falha. Célula de caractere de largura fixa; grotesco condensado em caixa-alta e numeral tabular. Raio zero, sombra zero, gradiente zero: separa-se por fio de 1px e degrau de valor.

STORY: o usuário lê a placa de relance, sabe o que está correndo e o que falta, e volta ao trabalho.

FIRST VIEWPORT: moldura de aço ocupando a janela; faixa de cabeçalho com as duas ferramentas como destinos em caixa-alta; abaixo, a tabela de linhas — volume, arquivo, preset, entrada→saída, restante — colunas fixas em célula de caractere; a linha ativa acesa em âmbar; ação primária (soltar arquivo / colar link) fixa no rodapé da moldura.

FORM: Painel Split-Flap, desafiante competitivo adotado pelo usuário sobre a direção sorteada Doca de Expedição; seed fed34e4a.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Decisões em aberto

- Se a cascata de flap fica só em mudança de estado (recomendado) ou também nos contadores de fps.
- Build code-led: esta máquina não tem geração de imagem, então não há comp aprovada; a ambição vive no bloco FIRST VIEWPORT e na cascata como interação assinatura.

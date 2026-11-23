export type ImagePresetId =
  | "img_compress_web"
  | "img_compress_quality"
  | "img_convert_jpeg"
  | "img_convert_png"
  | "img_convert_webp";

export type ImageFormat = "jpeg" | "png" | "webp" | "bmp" | "tiff";

export interface ImagePresetDefinition {
  id: ImagePresetId;
  label: string;
  description: string;
  bestFor: string;
  defaultQuality: number | null;
  format: ImageFormat;
  usesGpu: boolean;
}

export const IMAGE_PRESETS: ImagePresetDefinition[] = [
  {
    id: "img_compress_web",
    label: "Comprimir para enviar",
    description: "Deixa o arquivo bem menor, em WebP.",
    bestFor: "Bom para WhatsApp, e-mail e upload rápido",
    defaultQuality: 75,
    format: "webp",
    usesGpu: false,
  },
  {
    id: "img_compress_quality",
    label: "Comprimir com qualidade",
    description: "Reduz o tamanho quase sem perder nitidez.",
    bestFor: "Bom para guardar fotos ocupando pouco espaço",
    defaultQuality: 90,
    format: "jpeg",
    usesGpu: false,
  },
  {
    id: "img_convert_jpeg",
    label: "Converter para JPEG",
    description: "Troca o formato para JPEG, o mais compatível.",
    bestFor: "Bom quando a imagem não abre em algum programa",
    defaultQuality: 85,
    format: "jpeg",
    usesGpu: false,
  },
  {
    id: "img_convert_png",
    label: "Converter para PNG",
    description: "Gera um PNG, sem perda e com transparência.",
    bestFor: "Bom para prints, logos e imagens com fundo transparente",
    defaultQuality: null,
    format: "png",
    usesGpu: false,
  },
  {
    id: "img_convert_webp",
    label: "Converter para WebP",
    description:
      "Troca o formato para WebP, menor que JPEG na mesma qualidade.",
    bestFor: "Bom para site, app e envio quando o destino aceita WebP",
    defaultQuality: 80,
    format: "webp",
    usesGpu: false,
  },
];

export const IMAGE_PRESET_CODES: Record<ImagePresetId, string> = {
  img_compress_web: "C1",
  img_compress_quality: "C2",
  img_convert_jpeg: "JP",
  img_convert_png: "PN",
  img_convert_webp: "WP",
};

export const IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "bmp",
  "tif",
  "tiff",
  "gif",
  "heic",
  "heif",
  "avif",
];

export const IMAGE_COMPRESS_PRESET_IDS = [
  "img_compress_web",
  "img_compress_quality",
] as const satisfies readonly ImagePresetId[];

export const IMAGE_CONVERT_PRESET_IDS = [
  "img_convert_jpeg",
  "img_convert_png",
  "img_convert_webp",
] as const satisfies readonly ImagePresetId[];

export const IMAGE_COMPRESS_PRESETS = IMAGE_PRESETS.filter((item) =>
  (IMAGE_COMPRESS_PRESET_IDS as readonly string[]).includes(item.id),
);

export const IMAGE_CONVERT_PRESETS = IMAGE_PRESETS.filter((item) =>
  (IMAGE_CONVERT_PRESET_IDS as readonly string[]).includes(item.id),
);

export function isImagePresetId(id: string): boolean {
  return id.startsWith("img_");
}

export function isImageCompressPreset(id: string): boolean {
  return (IMAGE_COMPRESS_PRESET_IDS as readonly string[]).includes(id);
}

export function isImageConvertPreset(id: string): boolean {
  return (IMAGE_CONVERT_PRESET_IDS as readonly string[]).includes(id);
}

/** Returns `true` when `path` has a supported image file extension. */
export function isImagePath(path: string): boolean {
  const ext = path.split(/[/\\]/).pop()?.split(".").pop()?.toLowerCase();
  return Boolean(ext && IMAGE_EXTENSIONS.includes(ext));
}

/** Looks up an image preset definition by its identifier. */
export function imagePresetById(id: string): ImagePresetDefinition | undefined {
  return IMAGE_PRESETS.find((item) => item.id === id);
}

export const IMAGE_OUTPUT_FORMATS: {
  id: ImageFormat;
  code: string;
  label: string;
  bestFor: string;
  usesGpu: boolean;
}[] = [
  {
    id: "jpeg",
    code: "JP",
    label: "JPEG",
    bestFor: "O mais compatível com foto, e-mail e celular",
    usesGpu: false,
  },
  {
    id: "png",
    code: "PN",
    label: "PNG",
    bestFor: "Sem perda, com transparência — prints e logos",
    usesGpu: false,
  },
  {
    id: "webp",
    code: "WP",
    label: "WebP",
    bestFor: "Menor que JPEG na mesma qualidade, bom para web",
    usesGpu: false,
  },
  {
    id: "bmp",
    code: "BM",
    label: "BMP",
    bestFor: "Sem compressão, para programas antigos",
    usesGpu: false,
  },
  {
    id: "tiff",
    code: "TF",
    label: "TIFF",
    bestFor: "Bom para impressão e edição profissional",
    usesGpu: false,
  },
];

export const IMAGE_OUTPUT_CODES: Record<ImageFormat, string> = {
  jpeg: "JP",
  png: "PN",
  webp: "WP",
  bmp: "BM",
  tiff: "TF",
};

/** Maps an output image format to its corresponding conversion preset ID. */
export function presetIdForImageFormat(format: ImageFormat): ImagePresetId {
  switch (format) {
    case "png":
      return "img_convert_png";
    case "webp":
      return "img_convert_webp";
    default:
      return "img_convert_jpeg";
  }
}

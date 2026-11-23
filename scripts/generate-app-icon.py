"""Gera o PNG mestre do ícone a partir da geometria do painel split-flap."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src-tauri" / "icons" / "icon.png"

STEEL_DIM = (42, 46, 50, 255)
STEEL = (58, 63, 68, 255)
FLAP_TOP = (31, 33, 36, 255)
FLAP = (23, 24, 26, 255)
SEAM = (10, 10, 11, 255)
LAMP = (230, 164, 23, 255)
PAINT = (242, 242, 242, 255)


def render(size: int = 1024) -> Image.Image:
    img = Image.new("RGBA", (size, size), STEEL_DIM)
    draw = ImageDraw.Draw(img)

    def u(n: float) -> float:
        return n * size / 1024

    steel = u(36)
    inner = u(56)
    seam_h = max(1.0, u(8))
    mid = size / 2

    draw.rectangle([steel, steel, size - 1 - steel, size - 1 - steel], fill=STEEL)
    draw.rectangle([inner, inner, size - 1 - inner, mid - seam_h / 2], fill=FLAP_TOP)
    draw.rectangle(
        [inner, mid + seam_h / 2, size - 1 - inner, size - 1 - inner],
        fill=FLAP,
    )
    draw.rectangle(
        [inner, mid - seam_h / 2, size - 1 - inner, mid + seam_h / 2],
        fill=SEAM,
    )

    lamp = u(80)
    lamp_origin = inner + u(36)
    draw.rectangle(
        [lamp_origin, lamp_origin, lamp_origin + lamp, lamp_origin + lamp],
        fill=LAMP,
    )

    cx, cy = size * 0.52, size * 0.51
    radius = size * 0.285
    width = max(2, int(round(size * 0.144)))
    bbox = [cx - radius, cy - radius, cx + radius, cy + radius]
    draw.arc(bbox, start=48, end=312, fill=PAINT, width=width)
    return img


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    render(1024).save(OUT, "PNG")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()

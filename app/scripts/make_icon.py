from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
SOURCE = ASSETS / "icon-source.png"
PNG_SIZE = 512
ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]


def square_icon(source: Image.Image, size: int) -> Image.Image:
    source = source.convert("RGBA")
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    scale = min(size / source.width, size / source.height)
    resized = source.resize(
        (max(1, round(source.width * scale)), max(1, round(source.height * scale))),
        Image.Resampling.LANCZOS,
    )
    position = ((size - resized.width) // 2, (size - resized.height) // 2)
    canvas.alpha_composite(resized, position)
    return canvas


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    if not SOURCE.exists():
        raise FileNotFoundError(f"Fonte do ícone não encontrada: {SOURCE}")

    icon = square_icon(Image.open(SOURCE), PNG_SIZE)
    icon.save(ASSETS / "icon.png", optimize=True)
    icon.save(
        ASSETS / "icon.ico",
        format="ICO",
        sizes=[(size, size) for size in ICO_SIZES],
    )


if __name__ == "__main__":
    main()

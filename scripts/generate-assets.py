"""Regenerate native launcher and splash assets from assets/logo.svg."""

from pathlib import Path
import io
import cairosvg
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
CREAM = "#F8F6EF"
svg = ROOT / "assets" / "logo.svg"


def logo(size: int) -> Image.Image:
    data = cairosvg.svg2png(url=str(svg), output_width=size, output_height=size)
    return Image.open(io.BytesIO(data)).convert("RGBA")


def splash(size: tuple[int, int]) -> Image.Image:
    output = Image.new("RGBA", size, CREAM)
    side = int(min(size) * 0.38)
    mark = logo(side)
    output.alpha_composite(mark, ((size[0] - side) // 2, (size[1] - side) // 2))
    return output.convert("RGB")


res = ROOT / "android" / "app" / "src" / "main" / "res"
for density, pixels in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
    folder = res / f"mipmap-{density}"
    mark = logo(pixels)
    background = Image.new("RGBA", mark.size, CREAM)
    background.alpha_composite(mark)
    background.convert("RGB").save(folder / "ic_launcher.png")

    mask = Image.new("L", mark.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, pixels - 1, pixels - 1), fill=255)
    round_icon = background.copy()
    round_icon.putalpha(mask)
    round_icon.save(folder / "ic_launcher_round.png")

    canvas = Image.new("RGBA", (pixels * 2, pixels * 2), (0, 0, 0, 0))
    inner = logo(int(pixels * 1.35))
    canvas.alpha_composite(inner, ((canvas.width - inner.width) // 2, (canvas.height - inner.height) // 2))
    canvas.save(folder / "ic_launcher_foreground.png")

for path in res.rglob("splash.png"):
    with Image.open(path) as existing:
        dimensions = existing.size
    splash(dimensions).save(path)

ios_assets = ROOT / "ios" / "App" / "App" / "Assets.xcassets"
ios_icon = Image.new("RGBA", (1024, 1024), CREAM)
ios_icon.alpha_composite(logo(1024))
ios_icon.convert("RGB").save(ios_assets / "AppIcon.appiconset" / "AppIcon-512@2x.png")
for path in (ios_assets / "Splash.imageset").glob("*.png"):
    splash((2732, 2732)).save(path)

print("Native app icon and splash assets updated")

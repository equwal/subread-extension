"""Make the Chrome Web Store graphics in store/graphics/.

screenshot-1280x800.png: docs/screenshots/player.png on a dark field.
promo-440x280.png: the icon and the name.
"""
import pathlib
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "store" / "graphics"
BG = (15, 15, 15)

def font(size: int) -> ImageFont.ImageFont:
    for name in ("segoeuib.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()

def screenshot() -> None:
    shot = Image.open(ROOT / "docs" / "screenshots" / "player.png").convert("RGB")
    shot = shot.resize((1280, round(shot.height * 1280 / shot.width)), Image.LANCZOS)
    canvas = Image.new("RGB", (1280, 800), BG)
    canvas.paste(shot, (0, (800 - shot.height) // 2))
    canvas.save(OUT / "screenshot-1280x800.png")

def promo() -> None:
    canvas = Image.new("RGB", (440, 280), BG)
    icon = Image.open(ROOT / "icons" / "128.png").convert("RGBA")
    canvas.paste(icon, ((440 - 128) // 2, 40), icon)
    draw = ImageDraw.Draw(canvas)
    for text, size, y in (("SubRead", 36, 190), ("your subtitles on YouTube", 20, 236)):
        f = font(size)
        w = draw.textlength(text, font=f)
        draw.text(((440 - w) / 2, y), text, font=f, fill=(240, 240, 240))
    canvas.save(OUT / "promo-440x280.png")

OUT.mkdir(parents=True, exist_ok=True)
screenshot()
promo()
for p in sorted(OUT.iterdir()):
    print(p.relative_to(ROOT), Image.open(p).size)

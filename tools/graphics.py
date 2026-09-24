"""Make the Chrome Web Store promo tiles in store/graphics/.

promo-440x280.png: the icon and the name.
marquee-1400x560.png: the icon, the name and a line of text, next to a store screenshot.
The screenshots come from tools/shots/ (see store/listing.md).
"""
import pathlib
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "store" / "graphics"
BG = (15, 15, 15)
FG = (240, 240, 240)
DIM = (170, 170, 170)

def font(size: int) -> ImageFont.ImageFont:
    for name in ("segoeuib.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()

def icon(size: int) -> Image.Image:
    return Image.open(ROOT / "icons" / "128.png").convert("RGBA").resize((size, size), Image.LANCZOS)

def promo() -> None:
    canvas = Image.new("RGB", (440, 280), BG)
    i = icon(128)
    canvas.paste(i, ((440 - 128) // 2, 40), i)
    draw = ImageDraw.Draw(canvas)
    for text, size, y in (("SubRead", 36, 190), ("your subtitles on YouTube", 20, 236)):
        f = font(size)
        w = draw.textlength(text, font=f)
        draw.text(((440 - w) / 2, y), text, font=f, fill=FG)
    canvas.save(OUT / "promo-440x280.png")

def marquee() -> None:
    canvas = Image.new("RGB", (1400, 560), BG)
    # The right side: the video area of a screenshot, with the book line on it.
    shot = Image.open(OUT / "screenshot-1-moby-dick.png").convert("RGB").crop((230, 56, 1040, 686))
    shot = shot.resize((round(shot.width * 480 / shot.height), 480), Image.LANCZOS)
    canvas.paste(shot, (1400 - shot.width - 40, 40))
    draw = ImageDraw.Draw(canvas)
    i = icon(112)
    canvas.paste(i, (64, 96), i)
    draw.text((64, 236), "SubRead", font=font(72), fill=FG)
    for n, line in enumerate(("Read along with audiobooks on YouTube,", "with subtitles made from the book itself.")):
        draw.text((64, 336 + n * 40), line, font=font(28), fill=DIM)
    canvas.save(OUT / "marquee-1400x560.png")

OUT.mkdir(parents=True, exist_ok=True)
promo()
marquee()
for p in sorted(OUT.iterdir()):
    print(p.relative_to(ROOT), Image.open(p).size)

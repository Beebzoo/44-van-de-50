"""Make the home-screen icons.

    python3 _tools/build-icons.py [path/to/BarlowSemiCondensed-Bold.ttf]

The icon is the lane from the app itself: an asphalt square, the number 44
in road-marking white, and five dashes under it with four filled, which is
the 44 of 50 in the name. Semantic colour only, no gradients, no shadows.

Two shapes. The plain icon fills the frame for the browser tab and Windows.
The maskable one keeps everything inside the middle 80 percent because
Android crops it to a circle and iOS to a squircle.

The font is the same Barlow Semi Condensed the app ships; the TTF is only
needed at build time and is not committed. Safe to re-run."""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, "icons")
TTF = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, "_tools", "_fonts", "BarlowSemiCondensed-Bold.ttf")

ASFALT = (42, 47, 54)
ASFALT_2 = (58, 64, 74)
MARKERING = (247, 247, 244)


def icon(size, safe):
    """safe: fraction of the frame the artwork may use."""
    ss = 4
    S = size * ss
    im = Image.new("RGB", (S, S), ASFALT)
    d = ImageDraw.Draw(im)
    box = S * safe
    ox = (S - box) / 2

    font = ImageFont.truetype(TTF, int(box * 0.66))
    text = "44"
    l, t, r, b = font.getbbox(text)
    tw, th = r - l, b - t
    tx = (S - tw) / 2 - l
    ty = ox + box * 0.05 - t
    d.text((tx, ty), text, font=font, fill=MARKERING)

    # the lane: five dashes, four filled, one still dim
    n = 5
    gap = box * 0.045
    dash_w = (box * 0.86 - gap * (n - 1)) / n
    dash_h = box * 0.075
    y0 = ox + box * 0.80
    x0 = (S - (dash_w * n + gap * (n - 1))) / 2
    for i in range(n):
        x = x0 + i * (dash_w + gap)
        d.rounded_rectangle([x, y0, x + dash_w, y0 + dash_h], radius=dash_h * 0.2,
                            fill=MARKERING if i < 4 else ASFALT_2)
    return im.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    jobs = [("icon-192.png", 192, 0.9), ("icon-512.png", 512, 0.9), ("icon-180.png", 180, 0.9),
            ("icon-maskable-512.png", 512, 0.68)]
    for name, size, safe in jobs:
        icon(size, safe).save(os.path.join(OUT, name), optimize=True)
        print(f"  {name:24} {size}x{size}  {os.path.getsize(os.path.join(OUT, name)) / 1024:.0f} KB")


if __name__ == "__main__":
    main()

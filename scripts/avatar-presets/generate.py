# -*- coding: utf-8 -*-
"""OrtakSat hazır profil karakterleri.

Kullanım (depo kökünden):  python scripts/avatar-presets/generate.py [--sheet onizleme.png]
Çıktı: public/avatars/k01.webp … (512×512). Hepsi bu betikle sıfırdan çizilir; dış görsel kullanılmaz.
Sade, yüz ayrıntısı olmayan düz çizim: kimseye benzemez, her yaşa ve her kullanıcıya uygundur.
"""
import os
import sys

from PIL import Image, ImageDraw

N = 1000  # çizim ızgarası
S = 2     # kenar yumuşatma için büyük çizip küçült

SKIN = ["#F6D3B3", "#EDBE96", "#CF9A6C", "#99643F"]
HAIR = {"black": "#2B2118", "brown": "#5A3A22", "auburn": "#A2622E", "blonde": "#D9B25F", "grey": "#9A9AA0"}

# (arka plan, ten, saç biçimi, saç rengi, giysi, ek)
PRESETS = [
    ("#DCE8FF", 0, "short", "brown", "#0645C9", None),
    ("#FFE6CC", 1, "long", "black", "#09275E", None),
    ("#E6E0FA", 2, "curly", "black", "#E8B33B", None),
    ("#FFF2C2", 0, "bun", "auburn", "#0645C9", None),
    ("#FADCE4", 1, "side", "black", "#5F6B7A", "glasses"),
    ("#DDEBF2", 0, "scarf", "#0645C9", "#09275E", None),
    ("#DCE8FF", 2, "beard", "black", "#D9452F", None),
    ("#FFE6CC", 0, "pony", "blonde", "#09275E", None),
    ("#E6E0FA", 3, "short", "black", "#FFFFFF", None),
    ("#FFF2C2", 1, "scarf", "#D9452F", "#5F6B7A", None),
    ("#FADCE4", 0, "grey", "grey", "#0645C9", "glasses"),
    ("#DDEBF2", 3, "curlylong", "black", "#E8B33B", None),
]


def rgb(h):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def shade(h, f):
    r, g, b = rgb(h)
    if f < 1:
        return (int(r * f), int(g * f), int(b * f))
    return (int(r + (255 - r) * (f - 1)), int(g + (255 - g) * (f - 1)), int(b + (255 - b) * (f - 1)))


K = 1.3          # figürü daireyi dolduracak kadar büyüt
OX, OY = 500, 470


def T(x, y):
    return ((OX + (x - OX) * K) * S, (OY + (y - OY) * K) * S)


def col(c):
    return c if isinstance(c, tuple) else rgb(c)


class C:
    def __init__(self, bg):
        self.im = Image.new("RGB", (N * S, N * S), rgb(bg))
        self.d = ImageDraw.Draw(self.im)

    def ell(self, cx, cy, rx, ry, c):
        self.d.ellipse([T(cx - rx, cy - ry), T(cx + rx, cy + ry)], fill=col(c))

    def rect(self, x0, y0, x1, y1, c, r=0):
        (a0, b0), (a1, b1) = T(x0, y0), T(x1, y1)
        self.d.rounded_rectangle([a0, b0, a1, b1], radius=r * S * K, fill=col(c))

    def poly(self, pts, c):
        self.d.polygon([T(x, y) for x, y in pts], fill=col(c))

    def half(self, cx, cy, rx, ry, c, lower=False):
        self.d.pieslice([T(cx - rx, cy - ry), T(cx + rx, cy + ry)], 0 if lower else 180, 180 if lower else 360, fill=col(c))

    def ring(self, cx, cy, rx, ry, c, w):
        self.d.ellipse([T(cx - rx, cy - ry), T(cx + rx, cy + ry)], outline=rgb(c), width=int(w * S * K))


def draw(bg, skin_i, style, hair_key, cloth, extra):
    c = C(bg)
    skin = SKIN[skin_i]
    hair = HAIR.get(hair_key, hair_key)
    hx, hy, rx, ry = 500, 425, 158, 188
    white = cloth.upper() == "#FFFFFF"

    # --- arkada kalan saç / örtü
    if style in ("long", "curlylong"):
        c.rect(hx - 205, hy - 80, hx + 205, 790, hair, 110)
        if style == "curlylong":
            for dx, dy, r in ((-205, 20, 66), (205, 20, 66), (-216, 160, 72), (216, 160, 72), (-200, 300, 66), (200, 300, 66)):
                c.ell(hx + dx, hy + dy, r, r, hair)
    if style == "pony":
        c.ell(hx + 176, hy + 70, 56, 150, hair)
    if style == "scarf":
        c.ell(hx, hy + 6, rx + 70, ry + 58, hair)
        c.poly([(hx - 226, hy + 30), (hx + 226, hy + 30), (hx + 286, 800), (hx - 286, 800)], hair)

    # --- omuzlar
    if white:
        c.ell(500, 1022, 350, 285, "#D5DDEC")
        c.ell(500, 1032, 346, 285, cloth)
    else:
        c.ell(500, 1026, 346, 285, cloth)

    # --- boyun
    if style != "scarf":
        c.rect(436, 560, 564, 790, shade(skin, 0.9), 46)
        c.poly([(408, 756), (592, 756), (500, 852)], shade(skin, 0.9))
    else:
        c.poly([(hx - 240, 730), (hx + 240, 730), (hx + 196, 900), (hx - 196, 900)], shade(hair, 0.88))

    # --- kulaklar + yüz
    if style != "scarf":
        c.ell(hx - rx + 2, hy + 24, 24, 36, shade(skin, 0.93))
        c.ell(hx + rx - 2, hy + 24, 24, 36, shade(skin, 0.93))
    c.ell(hx, hy, rx, ry, skin)

    # --- öndeki saç: baştan biraz büyük üst yarım + alın çizgisini veren ten rengi oval
    def cap(drop=0, shift=0, brow=118):
        c.half(hx, hy - 34 + drop, rx + 14, ry - 6 + drop, hair)
        c.ell(hx + shift, hy + 40, rx - 10, brow + 40, skin)

    if style in ("short", "beard", "grey", "bun", "pony"):
        cap()
        if style == "bun":
            c.ell(hx, hy - ry - 52, 76, 68, hair)
    elif style == "side":
        c.half(hx, hy - 34, rx + 14, ry - 6, hair)
        c.ell(hx + 28, hy + 44, rx - 32, 150, skin)
    elif style == "long":
        cap(drop=8)
    elif style in ("curly", "curlylong"):
        for dx, dy, r in ((-146, -66, 72), (-88, -146, 80), (0, -176, 84), (88, -146, 80), (146, -66, 72), (-172, 12, 50), (172, 12, 50)):
            c.ell(hx + dx, hy + dy, r, r, hair)
        c.ell(hx, hy + 24, rx - 10, 122, skin)
    elif style == "scarf":
        c.ell(hx, hy + 6, rx + 14, ry + 10, shade(hair, 0.88))
        c.ell(hx, hy + 30, rx - 26, ry - 44, skin)

    if style == "beard":
        c.half(hx, hy + 6, rx + 2, ry + 4, hair, lower=True)
        c.ell(hx, hy - 6, rx - 34, ry - 62, skin)

    if extra == "glasses":
        for sx in (-1, 1):
            c.ring(hx + sx * 70, hy + 30, 52, 44, "#2B2F3A", 10)
        c.rect(hx - 20, hy + 24, hx + 20, hy + 33, "#2B2F3A", 4)

    # --- yaka
    if style != "scarf":
        c.poly([(404, 772), (500, 880), (596, 772), (640, 802), (500, 952), (360, 802)], rgb("#D5DDEC") if white else shade(cloth, 0.84))
    return c.im.resize((512, 512), Image.LANCZOS)


def main():
    root = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
    ims = [draw(*p) for p in PRESETS]
    if "--sheet" in sys.argv:
        out = sys.argv[sys.argv.index("--sheet") + 1]
        sheet = Image.new("RGB", (6 * 260, 2 * 260), "white")
        for i, im in enumerate(ims):
            mask = Image.new("L", (240, 240), 0)
            ImageDraw.Draw(mask).ellipse([0, 0, 239, 239], fill=255)
            sheet.paste(im.resize((240, 240), Image.LANCZOS), ((i % 6) * 260 + 10, (i // 6) * 260 + 10), mask)
        sheet.save(out)
        return
    dst = os.path.join(root, "public", "avatars")
    os.makedirs(dst, exist_ok=True)
    for i, im in enumerate(ims, 1):
        im.save(os.path.join(dst, f"k{i:02d}.webp"), "WEBP", quality=88, method=6)
    print("ok", len(ims))


if __name__ == "__main__":
    main()

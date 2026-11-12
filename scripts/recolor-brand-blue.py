"""Marka görsellerini turkuazdan (ton ~183°) maviye (ton ~220°, colors.primary) çevirir.

Kullanım: python scripts/recolor-brand-blue.py
Gerekli: pip install pillow numpy

Yalnız turkuaz ton aralığındaki pikseller değişir; ikinci çalıştırma etkisizdir (mavi aralık dışında).
Maskot WebP'leri her seferinde public/assets/mascot/png-original kaynağından üretilir.
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MASCOT = ROOT / "public" / "assets" / "mascot"

IN_PLACE = [
    "public/apple-touch-icon.png",
    "public/logo-mark.png",
    "public/og-cover.png",
    "public/pwa-icon-192.png",
    "public/pwa-icon.png",
    "assets/android-icon-background.png",
    "assets/android-icon-foreground.png",
    "assets/brand-head.png",
    "assets/brand-head.webp",
    "assets/favicon.png",
    "assets/icon.png",
    "assets/splash-mascot.png",
]


def smooth(x, lo, hi):
    t = np.clip((x - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


def rgb_to_hsv(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(-1), rgb.min(-1)
    d = mx - mn
    safe = np.where(d == 0, 1, d)
    h = np.where(mx == r, ((g - b) / safe) % 6, np.where(mx == g, (b - r) / safe + 2, (r - g) / safe + 4))
    h = np.where(d == 0, 0, h * 60)
    s = np.where(mx == 0, 0, d / np.where(mx == 0, 1, mx))
    return h, s, mx


def hsv_to_rgb(h, s, v):
    h = (h % 360) / 60
    i = np.floor(h)
    f = h - i
    p, q, t = v * (1 - s), v * (1 - s * f), v * (1 - s * (1 - f))
    i = i.astype(int) % 6
    r = np.choose(i, [v, q, p, p, t, v])
    g = np.choose(i, [t, v, v, q, p, p])
    b = np.choose(i, [p, p, t, v, v, q])
    return np.stack([r, g, b], -1)


def recolor(im):
    a = np.asarray(im.convert("RGBA")).astype(np.float64) / 255
    h, s, v = rgb_to_hsv(a[..., :3])
    w = smooth(h, 150, 165) * (1 - smooth(h, 200, 212))
    h2 = h + w * (220 + (h - 183) * 0.5 - h)
    boost = w * smooth(s, 0.25, 0.6)
    s2 = s + boost * (1 - (1 - s) ** 3 - s)
    v2 = np.minimum(1, v * (1 + 0.07 * boost))
    out = np.concatenate([hsv_to_rgb(h2, s2, v2), a[..., 3:]], -1)
    return Image.fromarray(np.round(out * 255).astype(np.uint8), "RGBA")


def save(im, path):
    if path.suffix == ".webp":
        im.save(path, "WEBP", quality=88, method=6)
    else:
        im.save(path, "PNG", optimize=True)


for rel in IN_PLACE:
    p = ROOT / rel
    src = Image.open(p)
    had_alpha = src.mode in ("RGBA", "LA", "P")
    out = recolor(src)
    save(out if had_alpha else out.convert("RGB"), p)
    print("recolored", rel)

for orig in sorted((MASCOT / "png-original").glob("*.png")):
    blue_ref = MASCOT / "blue-1024" / orig.name
    big = Image.open(blue_ref).convert("RGBA") if blue_ref.exists() else recolor(Image.open(orig))
    for size in (1024, 512):
        save(big.resize((size, size), Image.LANCZOS), MASCOT / f"webp-{size}" / f"{orig.stem}.webp")
    print("mascot", orig.stem)

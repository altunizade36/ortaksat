# -*- coding: utf-8 -*-
"""OrtakSat il kapakları — çizim motoru.

Bütün görseller bu betikle, sıfırdan çizilerek üretilir; hiçbir dış görsel, fotoğraf ya da
hazır çizim kullanılmaz (telif riski yok). Çizim 2 kat büyük tuvalde yapılır, sonda küçültülür.
"""
import math
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H, S = 1920, 640, 2


def rgb(c):
    if isinstance(c, str):
        c = c.lstrip("#")
        return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16))
    return (c[0], c[1], c[2])


def col(c, a=None):
    if not isinstance(c, str) and len(c) == 4 and a is None:
        return tuple(c)
    r, g, b = rgb(c)
    return (r, g, b, 255 if a is None else int(a))


def mix(a, b, t):
    a, b = rgb(a), rgb(b)
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def lighten(c, t):
    return mix(c, "#FFFFFF", t)


def darken(c, t):
    return mix(c, "#000000", t)


class Canvas:
    def __init__(self, im):
        self.im = im

    @property
    def dr(self):
        return ImageDraw.Draw(self.im)

    @staticmethod
    def P(pts):
        return [(x * S, y * S) for x, y in pts]

    def poly(self, pts, c, a=None):
        self.dr.polygon(self.P(pts), fill=col(c, a))

    def rect(self, x0, y0, x1, y1, c, a=None):
        if x1 < x0:
            x0, x1 = x1, x0
        if y1 < y0:
            y0, y1 = y1, y0
        self.dr.rectangle([x0 * S, y0 * S, x1 * S, y1 * S], fill=col(c, a))

    def ell(self, x0, y0, x1, y1, c, a=None):
        if x1 < x0:
            x0, x1 = x1, x0
        if y1 < y0:
            y0, y1 = y1, y0
        self.dr.ellipse([x0 * S, y0 * S, x1 * S, y1 * S], fill=col(c, a))

    def circ(self, x, y, r, c, a=None):
        self.ell(x - r, y - r, x + r, y + r, c, a)

    def line(self, pts, c, w=1.0, a=None):
        self.dr.line(self.P(pts), fill=col(c, a), width=max(1, int(round(w * S))), joint="curve")

    def half(self, cx, by, rx, ry, c, a=None):
        """Tabanı by olan üst yarım elips (kubbe)."""
        self.dr.pieslice([(cx - rx) * S, (by - ry) * S, (cx + rx) * S, (by + ry) * S], 180, 360, fill=col(c, a))

    def erase_ell(self, x0, y0, x1, y1):
        self.dr.ellipse([x0 * S, y0 * S, x1 * S, y1 * S], fill=(0, 0, 0, 0))

    def erase_rect(self, x0, y0, x1, y1):
        self.dr.rectangle([x0 * S, y0 * S, x1 * S, y1 * S], fill=(0, 0, 0, 0))

    def erase_poly(self, pts):
        self.dr.polygon(self.P(pts), fill=(0, 0, 0, 0))


class Scene(Canvas):
    def __init__(self, seed):
        super().__init__(Image.new("RGBA", (W * S, H * S), (255, 255, 255, 255)))
        self.rnd = random.Random(seed)
        self.yw = None  # su çizgisi (varsa)
        self.yfn = lambda x: 420.0  # zemin yüksekliği
        self.pal = None

    # ---- katmanlar
    def layer(self):
        return Canvas(Image.new("RGBA", self.im.size, (0, 0, 0, 0)))

    def _comp(self, part, x, y):
        sx, sy = max(0, -x), max(0, -y)
        x, y = max(0, x), max(0, y)
        w = min(part.width - sx, self.im.width - x)
        h = min(part.height - sy, self.im.height - y)
        if w <= 0 or h <= 0:
            return
        self.im.alpha_composite(part.crop((sx, sy, sx + w, sy + h)), dest=(x, y))

    def put(self, L, blur=0.0, alpha=1.0):
        im = L.im
        bb = im.getbbox()
        if not bb:
            return
        if blur:
            pad = int(blur * S * 3)
            bb = (max(0, bb[0] - pad), max(0, bb[1] - pad), min(im.width, bb[2] + pad), min(im.height, bb[3] + pad))
            # Saydam kenarda koyu hale oluşmasın diye renk, saydamlıkla çarpılmış olarak bulanıklaştırılır.
            raw = np.asarray(im.crop(bb), dtype=np.float32)
            al = raw[..., 3:4] / 255.0
            pre = Image.fromarray((raw[..., :3] * al).astype(np.uint8), "RGB").filter(ImageFilter.GaussianBlur(blur * S))
            ab = Image.fromarray(raw[..., 3].astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(blur * S))
            an = np.asarray(ab, dtype=np.float32)[..., None]
            rgbn = np.clip(np.asarray(pre, dtype=np.float32) / np.maximum(an / 255.0, 1e-3), 0, 255)
            part = Image.fromarray(np.concatenate([rgbn, an], 2).astype(np.uint8), "RGBA")
        else:
            part = im.crop(bb)
        if alpha < 1:
            part.putalpha(part.getchannel("A").point(lambda v: int(v * alpha)))
        self.im.alpha_composite(part, dest=(bb[0], bb[1]))

    # ---- geçişler ve ışık
    def vband(self, y0, y1, stops, a0=None, a1=None, x0=0, x1=W):
        h = max(1, int(round((y1 - y0) * S)))
        w = max(1, int(round((x1 - x0) * S)))
        t = np.linspace(0, 1, h)
        ts = [p for p, _ in stops]
        cs = np.array([rgb(c) for _, c in stops], float)
        arr = np.stack([np.interp(t, ts, cs[:, i]) for i in range(3)], 1)
        block = np.broadcast_to(arr[:, None, :], (h, w, 3))
        if a0 is None:
            self.im.paste(Image.fromarray(np.ascontiguousarray(block).astype(np.uint8), "RGB"), (int(x0 * S), int(y0 * S)))
        else:
            A = np.broadcast_to((np.linspace(a0, a1, h) * 255)[:, None, None], (h, w, 1))
            out = np.concatenate([block, A], 2).astype(np.uint8)
            self._comp(Image.fromarray(np.ascontiguousarray(out), "RGBA"), int(x0 * S), int(y0 * S))

    def glow(self, cx, cy, r, c, strength=1.0, power=2.0):
        n = int(r * 2 * S)
        yy, xx = np.mgrid[0:n, 0:n]
        d = np.hypot(xx - n / 2, yy - n / 2) / (n / 2)
        a = (np.clip(1 - d, 0, 1) ** power) * 255 * strength
        cr = rgb(c)
        arr = np.empty((n, n, 4), np.uint8)
        arr[..., 0], arr[..., 1], arr[..., 2] = cr
        arr[..., 3] = np.clip(a, 0, 255)
        self._comp(Image.fromarray(arr, "RGBA"), int(cx * S - n / 2), int(cy * S - n / 2))

    def sun(self, x, y, r=26, c="#FFF6D8", halo="#FFE9B0", strength=0.75):
        self.glow(x, y, r * 9, halo, strength * 0.55, 2.2)
        self.glow(x, y, r * 3.2, halo, strength, 1.6)
        self.circ(x, y, r, c)

    def clouds(self, n, y0, y1, c="#FFFFFF", alpha=0.85, scale=1.0):
        L = self.layer()
        for _ in range(n):
            cx = self.rnd.uniform(-40, W + 40)
            cy = self.rnd.uniform(y0, y1)
            w = self.rnd.uniform(120, 280) * scale
            k = self.rnd.randint(4, 7)
            for i in range(k):
                px = cx + (i - (k - 1) / 2) * w / k * 0.9 + self.rnd.uniform(-8, 8)
                r = w / k * self.rnd.uniform(0.8, 1.45) * (1 - abs(i - (k - 1) / 2) / k * 1.1)
                L.ell(px - r * 1.5, cy - r * 0.95, px + r * 1.5, cy + r * 0.4, c)
            L.rect(cx - w * 0.46, cy - 2, cx + w * 0.46, cy + w / k * 0.42, c)
        self.put(L, blur=2.2, alpha=alpha)

    def haze(self, y, h, c, a=0.55, below=0.0):
        self.vband(y - h, y, [(0, c), (1, c)], 0.0, a)
        if below:
            self.vband(y, y + below, [(0, c), (1, c)], a, 0.0)

    def birds(self, n, x0, x1, y0, y1, c="#2B3442"):
        for _ in range(n):
            x, y, w = self.rnd.uniform(x0, x1), self.rnd.uniform(y0, y1), self.rnd.uniform(5, 9)
            self.line([(x - w, y - w * 0.35), (x - w * 0.4, y - w * 0.55), (x, y), (x + w * 0.4, y - w * 0.55), (x + w, y - w * 0.35)], c, 0.9)

    # ---- arazi
    def ridge_pts(self, y, amp, rough=6, scale=1.0, step=6):
        xs = np.arange(-12, W + 13, step, dtype=float)
        v = np.zeros_like(xs)
        tot = 0.0
        for k in range(rough):
            f = (2 ** k) * 1.15 * scale / W
            a = 0.52 ** k
            v += np.sin(xs * f * 2 * math.pi + self.rnd.uniform(0, 6.283)) * a
            tot += a
        return xs, y - amp * (v / tot * 0.5 + 0.5)

    def ridge(self, y, amp, c, rough=6, scale=1.0, snow=None, snow_c="#FFFFFF", cv=None, pts=None):
        """Dağ/tepe hattı; yfn(x) döndürür. snow: bu y'nin üstü karlı."""
        xs, ys = pts if pts is not None else self.ridge_pts(y, amp, rough, scale)
        cv = cv or self
        cv.poly(list(zip(xs, ys)) + [(W + 12, H), (-12, H)], c)
        if snow is not None:
            top = list(zip(xs, ys))
            bot = []
            for i, (x, yv) in enumerate(top):
                dep = min(max(0.0, snow - yv), 44.0)
                zig = 0.55 + 0.3 * math.sin(i * 1.3) + 0.15 * math.sin(i * 0.37 + 1)
                bot.append((x, yv + dep * 0.8 * zig))
            cv.poly(top + bot[::-1], snow_c)
        return lambda x, xs=xs, ys=ys: float(np.interp(x, xs, ys))

    def slope(self, pts, c, jitter=6.0, cv=None):
        """Verilen kırık çizgiden aşağısını dolduran yamaç (vadi kenarı)."""
        out = []
        for i in range(len(pts) - 1):
            (xa, ya), (xb, yb) = pts[i], pts[i + 1]
            n = max(2, int(abs(xb - xa) / 14))
            for j in range(n):
                t = j / n
                out.append((xa + (xb - xa) * t, ya + (yb - ya) * t + self.rnd.uniform(-jitter, jitter)))
        out.append(pts[-1])
        (cv or self).poly(out + [(pts[-1][0], H), (pts[0][0], H)], c)
        xs = [p[0] for p in out]
        ys = [p[1] for p in out]
        if xs[0] > xs[-1]:
            xs, ys = xs[::-1], ys[::-1]
        return lambda x, xs=xs, ys=ys: float(np.interp(x, xs, ys))

    def peak(self, cx, by, w, h, c, snow=0.38, snow_c="#FFFFFF", p=1.55, flat=0.05, shadow=0.2):
        """Tek başına yükselen (volkan biçimli) dağ."""
        n = 100
        pts = []
        for i in range(n + 1):
            t = -1 + 2 * i / n
            prof = min((1 - abs(t)) ** p, 1 - flat) / (1 - flat)
            wob = 1 + 0.03 * math.sin(i * 0.61 + cx * 0.01) + 0.018 * math.sin(i * 1.7)
            pts.append((cx + t * w / 2, by - h * prof * (wob if 0.03 < prof < 0.97 else 1)))
        self.poly(pts, c)
        if shadow:
            L = self.layer()
            mid = [(cx + w * 0.02 * math.sin(k * 1.9) + w * 0.012 * k, by - h + (h / 9) * k) for k in range(10)]
            L.poly(mid + [p_ for p_ in pts if p_[0] >= cx][::-1], darken(c, 0.5), 255)
            self.put(L, alpha=shadow)
        if snow:
            line_y = by - h * (1 - snow)
            top = [q for q in pts if q[1] <= line_y]
            if len(top) > 2:
                bot = []
                for i, (x, _y) in enumerate(top):
                    zig = math.sin(i * 1.15) * 0.5 + math.sin(i * 0.43 + 2) * 0.5
                    edge = 1 - abs((x - cx) / (top[-1][0] - cx + 1e-6))
                    bot.append((x, line_y + h * snow * 0.3 * zig * max(0.0, edge) ** 0.5))
                self.poly(top + bot[::-1], snow_c)
                L = self.layer()
                L.poly([q for q in top if q[0] >= cx] + [b for b in bot if b[0] >= cx][::-1], "#7D93B8", 255)
                self.put(L, alpha=0.28)

    def water(self, y0, top, bot, y1=H):
        self.vband(y0, y1, [(0, top), (1, bot)])
        self.yw = y0

    def glints(self, y0, y1=H, n=150, c="#FFFFFF", a=70, cx=None, spread=40):
        L = self.layer()
        for _ in range(n):
            t = self.rnd.random() ** 1.5
            y = y0 + 3 + t * (y1 - y0 - 4)
            ln = (8 + 70 * t) * self.rnd.uniform(0.4, 1.2)
            x = self.rnd.uniform(0, W) if cx is None else self.rnd.gauss(cx, spread * (0.4 + 2.2 * t))
            L.line([(x - ln / 2, y), (x + ln / 2, y)], c, 1.0 + 1.4 * t, int(a * self.rnd.uniform(0.45, 1.2)))
        self.put(L)

    def reflect(self, yw=None, depth=150, alpha=0.36):
        yw = self.yw if yw is None else yw
        depth = min(depth, H - yw, yw)
        src = self.im.crop((0, int((yw - depth) * S), W * S, int(yw * S))).transpose(Image.FLIP_TOP_BOTTOM)
        fade = (np.linspace(alpha, 0, src.height) * 255).astype(np.uint8)
        src.putalpha(Image.fromarray(np.repeat(fade[:, None], src.width, 1), "L"))
        self.im.alpha_composite(src.filter(ImageFilter.BoxBlur(1.2 * S)), dest=(0, int(yw * S)))

    def fields(self, y0, y1, cols_, n=30, vx=None, top=0.16, cv=None):
        """Ufka doğru daralan tarla şeritleri."""
        vx = W / 2 if vx is None else vx
        span = W * 2.6
        cv = cv or self
        for i in range(n):
            xa = vx - span / 2 + span * i / n
            xb = vx - span / 2 + span * (i + 1) / n
            cv.poly([(vx + (xa - vx) * top, y0), (vx + (xb - vx) * top, y0), (xb, y1), (xa, y1)], cols_[i % len(cols_)])

    def dots(self, y0, y1, n, cols_, r0=1.2, r1=4.5, x0=0, x1=W, cv=None):
        cv = cv or self
        pts = sorted((self.rnd.random() ** 1.3, self.rnd.uniform(x0, x1)) for _ in range(n))
        for t, x in pts:
            cv.circ(x, y0 + t * (y1 - y0), r0 + (r1 - r0) * t, self.rnd.choice(cols_))

    def shade_bottom(self, y0=470, a=0.22, c="#0B1E3A"):
        self.vband(y0, H, [(0, c), (1, c)], 0.0, a)

    # ---- bitkiler
    def pine(self, x, by, h, c):
        self.rect(x - h * 0.03, by - h * 0.2, x + h * 0.03, by, darken(c, 0.45))
        for i in range(3):
            yb = by - h * (0.12 + i * 0.26)
            ww = h * 0.44 * (1 - i * 0.24)
            self.poly([(x - ww / 2, yb), (x, yb - h * 0.42), (x + ww / 2, yb)], c)
            self.poly([(x, yb - h * 0.42), (x + ww / 2, yb), (x + ww * 0.08, yb)], darken(c, 0.16))

    def cypress(self, x, by, h, c):
        w = h * 0.2
        pts = [(x - w / 2 * math.sin(math.pi * t) ** 0.7, by - h * t) for t in np.linspace(0.04, 1, 12)]
        pts += [(x + w / 2 * math.sin(math.pi * t) ** 0.7, by - h * t) for t in np.linspace(1, 0.04, 12)]
        self.rect(x - h * 0.02, by - h * 0.1, x + h * 0.02, by, darken(c, 0.45))
        self.poly(pts, c)

    def tree(self, x, by, h, c, fruit=None):
        self.rect(x - h * 0.035, by - h * 0.45, x + h * 0.035, by, "#6B4E37")
        r = h * 0.3
        self.circ(x - r * 0.55, by - h * 0.52, r * 0.85, darken(c, 0.12))
        self.circ(x + r * 0.55, by - h * 0.5, r * 0.9, darken(c, 0.2))
        self.circ(x, by - h * 0.68, r, c)
        self.circ(x - r * 0.3, by - h * 0.76, r * 0.5, lighten(c, 0.16))
        if fruit:
            for _ in range(7):
                a, d = self.rnd.uniform(0, 6.283), self.rnd.uniform(0, r * 0.95)
                self.circ(x + math.cos(a) * d, by - h * 0.62 + math.sin(a) * d * 0.8, max(1.1, h * 0.03), fruit)

    def poplar(self, x, by, h, c):
        self.rect(x - h * 0.014, by - h * 0.2, x + h * 0.014, by, "#6B4E37")
        self.ell(x - h * 0.1, by - h, x + h * 0.1, by - h * 0.1, c)
        self.ell(x - h * 0.02, by - h * 0.96, x + h * 0.1, by - h * 0.12, darken(c, 0.14))

    def palm(self, x, by, h, c="#3F8F4E"):
        tx, ty = x + h * 0.03, by - h * 0.84
        self.line([(x, by), (x + h * 0.045, by - h * 0.45), (tx, ty)], "#8A6A4A", h * 0.045)
        for dx, dy in [(-0.34, 0.1), (-0.3, -0.08), (-0.14, -0.2), (0.14, -0.2), (0.3, -0.08), (0.34, 0.1), (0.0, -0.24)]:
            ex, ey = tx + dx * h, ty + dy * h + h * 0.06
            mx, my = tx + dx * h * 0.55, ty + dy * h - h * 0.07
            self.line([(tx, ty), (mx, my), (ex, ey)], c, h * 0.04)
            self.line([(tx, ty), (mx, my - h * 0.012)], lighten(c, 0.18), h * 0.016)

    def olive(self, x, by, h, c="#8A9A6B"):
        self.line([(x, by), (x - h * 0.05, by - h * 0.4)], "#6B5A45", h * 0.06)
        self.ell(x - h * 0.42, by - h, x + h * 0.36, by - h * 0.34, c)
        self.ell(x - h * 0.3, by - h * 0.96, x + h * 0.12, by - h * 0.6, lighten(c, 0.18))

    def forest(self, yfn, x0, x1, n, h0, h1, kind, cols_, sink=3.0):
        fn = {"pine": self.pine, "cypress": self.cypress, "tree": self.tree, "poplar": self.poplar, "palm": self.palm, "olive": self.olive}
        xs = sorted(self.rnd.uniform(x0, x1) for _ in range(n))
        items = [(yfn(x) + self.rnd.uniform(0, sink), x) for x in xs]
        for y, x in sorted(items):
            k = kind if isinstance(kind, str) else self.rnd.choice(kind)
            fn[k](x, y, self.rnd.uniform(h0, h1), self.rnd.choice(cols_))

    def flowers(self, x0, x1, y0, y1, n, cols_, stem="#3E7A45", droop=False, k=None):
        pts = sorted((self.rnd.uniform(y0, y1), self.rnd.uniform(x0, x1)) for _ in range(n))
        fixed = k
        for y, x in pts:
            k = fixed if fixed else 0.5 + (y - y0) / max(1.0, (y1 - y0))
            hgt = 16 * k
            self.line([(x, y), (x + (2 * k if droop else 0), y - hgt)], stem, 1.1 * k)
            c = self.rnd.choice(cols_)
            if droop:
                self.poly([(x - 2 * k, y - hgt), (x + 6 * k, y - hgt), (x + 5 * k, y - hgt + 7 * k), (x - 1 * k, y - hgt + 7 * k)], c)
            else:
                self.circ(x, y - hgt, 3.4 * k, c)
                self.circ(x, y - hgt, 1.3 * k, darken(c, 0.35))

    def save(self, path, quality=84):
        self.im.convert("RGB").resize((W, H), Image.LANCZOS).save(path, "WEBP", quality=quality, method=6)

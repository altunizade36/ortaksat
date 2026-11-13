# -*- coding: utf-8 -*-
"""OrtakSat il kapakları — 80 il için özgün manzara çizimleri üretir.

Kullanım (depo kökünden):
    python scripts/city-covers/generate.py                # hepsini üret + manifesti yaz
    python scripts/city-covers/generate.py --only Adana,Van
    python scripts/city-covers/generate.py --sheet out.png --only Adana,Van   # yalnız önizleme

Çıktı: public/city-covers/<il-slug>.webp ve data/city-cover-manifest.json
Görsellerin tamamı bu betikle çizilir; dış kaynak (fotoğraf, hazır çizim, arama) kullanılmaz.
İstanbul uygulamaya gömülü görseli kullandığı için burada üretilmez.
"""
import argparse
import datetime
import json
import math
import os
import re
import sys
import zlib

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import motifs as M  # noqa: E402
from engine import H, W, Scene, darken, lighten, mix  # noqa: E402

VERSION = 1
BASE_URL = "https://www.ortaksat.com/city-covers"

PAL = {
    "day": dict(sky=[(0, "#2A78D2"), (0.55, "#7DBBF0"), (1, "#DCEFFC")], haze="#EAF4FC", far=("#8FB0D0", "#6F95BC"), water=("#3E97DE", "#1C5EA8"), cloud="#FFFFFF", halo="#FFF3C4"),
    "gold": dict(sky=[(0, "#4A84C8"), (0.5, "#B9C6DC"), (0.78, "#F6CF9B"), (1, "#FDEBC8")], haze="#FDEBC8", far=("#B7A9B9", "#93879F"), water=("#7DAEDA", "#2F6FAE"), cloud="#FFF3DD", halo="#FFE2A0"),
    "dusk": dict(sky=[(0, "#2F2C6B"), (0.42, "#8E4E86"), (0.75, "#F3895C"), (1, "#FCD489")], haze="#FBC98C", far=("#7A5A8E", "#5A4478"), water=("#C07A82", "#3C3A78"), cloud="#F7B08A", halo="#FFD08A"),
    "dawn": dict(sky=[(0, "#3A5A9C"), (0.5, "#A9A6CF"), (0.82, "#F7C6A6"), (1, "#FDEAD2")], haze="#FCE3CF", far=("#9AA3C8", "#7482B4"), water=("#9DBBE0", "#3B6CB0"), cloud="#FFE1D2", halo="#FFDDB8"),
    "mist": dict(sky=[(0, "#6A9AC6"), (0.6, "#B5D0E5"), (1, "#EAF2F6")], haze="#EEF4F7", far=("#9DB9C9", "#7FA2B5"), water=("#74A8C8", "#2F6890"), cloud="#FFFFFF", halo="#FFFFFF"),
    "snow": dict(sky=[(0, "#4A7BBE"), (0.6, "#A7C7E8"), (1, "#EFF5FB")], haze="#F1F6FB", far=("#A9BDD8", "#8AA3C6"), water=("#A6C9E8", "#5E93C8"), cloud="#FFFFFF", halo="#FFFFFF"),
}

FG = {
    "pine": (7, 120, 190, ("#2F5E45", "#27503C", "#356B4E")),
    "palm": (3, 170, 230, ("#3F8F4E",)),
    "cypress": (5, 120, 200, ("#2F5E45", "#3A6B4C")),
    "tree": (4, 110, 170, ("#4F8A52", "#5E9A5A", "#3F7A4A")),
    "olive": (4, 84, 126, ("#8A9A6B", "#7C8C5E")),
    "poplar": (5, 150, 220, ("#6FA35F", "#5E9453")),
    "grass": (0, 0, 0, ()),
}

CITIES = {}


def city(name):
    def deco(f):
        CITIES[name] = f
        return f

    return deco


# ---------------------------------------------------------------- ortak sahne kalıpları
def backdrop(s, pal, sun=None, clouds=6, far=(110, 70), far_y=412, snow=None, rough=6, haze=0.5, cscale=1.0, farc=None):
    P = PAL[pal]
    s.pal = P
    s.vband(0, 480, P["sky"])
    if sun:
        s.sun(sun[0], sun[1], sun[2] if len(sun) > 2 else 26, "#FFF8E0", P["halo"])
    if clouds:
        s.clouds(clouds, 40, 220, P["cloud"], 0.8, cscale)
    cols_ = farc or P["far"]
    for i, a in enumerate(far):
        if a:
            s.ridge(far_y, a, cols_[min(i, len(cols_) - 1)], rough, 1.2 + i * 0.9, snow=(far_y - a * snow) if (snow and i == 0) else None)
    if haze:
        s.haze(far_y + 4, 70, P["haze"], haze)
    return P


def shore(s, pal, land="#6FA35F", yw=412, amp=28, scale=1.6, water=None, **kw):
    P = backdrop(s, pal, far_y=yw - 4, **kw)
    s.yfn = s.ridge(yw - 3, amp, land, 4, scale)
    s.water(yw, *(water or P["water"]))
    return P


def plain(s, pal, ground=("#D8BD6C", "#B9994A"), gy=416, fields=None, amp=10, **kw):
    P = backdrop(s, pal, far_y=gy, **kw)
    s.yfn = s.ridge(gy, amp, ground[0], 3, 1.0)
    s.vband(gy + 6, H, [(0, ground[0]), (1, ground[1])])
    if fields:
        s.fields(gy + 8, H, fields)
    return P


def valley(s, pal, cl="#3F7D4F", cr="#356F47", river=("#8FC0E2", "#3F7FB8"), **kw):
    P = backdrop(s, pal, far_y=360, **kw)
    yl = s.slope([(-12, 170), (240, 235), (520, 330), (800, 420), (1010, 478)], cl)
    yr = s.slope([(W + 12, 150), (1660, 225), (1400, 320), (1150, 410), (930, 478)], cr)
    s.poly([(900, 470), (1040, 470), (1380, H), (560, H)], darken(cl, 0.1))
    if river:
        s.poly([(940, 462), (1000, 462), (1250, H), (700, H)], river[0])
        s.poly([(965, 470), (990, 470), (1130, H), (850, H)], river[1])
        s.glints(470, H, 40, "#FFFFFF", 90, cx=970, spread=26)
    return P, yl, yr


def wet(s, refl=0.36, n=170, a=70, glint=True):
    if s.yw is None or getattr(s, "_wet", False):
        return
    s._wet = True
    s.reflect(alpha=refl)
    if glint:
        s.glints(s.yw, n=n, a=a)


def finish(s, fg=None, ground="#3F7A45", cols_=None, sides=(1, 1), shade=0.2, hs=1.0, flowers=None, droop=False, refl=0.36):
    wet(s, refl)
    if fg:
        n, h0, h1, dc = FG[fg]
        for side in (0, 1):
            if not sides[side]:
                continue
            base = [(-12, H + 2), (-12, 508), (80, 494), (200, 510), (320, 556), (430, H + 2)]
            s.poly([(W - x, y) if side else (x, y) for x, y in base], ground)

            def yf(x, side=side):
                return float(np.interp(W - x if side else x, [-12, 80, 200, 320, 430], [508, 494, 510, 556, 640]))

            x0, x1 = (W - 320, W - 8) if side else (8, 320)
            if n:
                s.forest(yf, x0, x1, n, h0 * hs, h1 * hs, fg, list(cols_ or dc), sink=10)
            if flowers:
                for _ in range(26):
                    x = s.rnd.uniform(x0, x1)
                    y = yf(x) + s.rnd.uniform(10, 80)
                    if y < H - 4:
                        s.flowers(x, x, y, y, 1, flowers, droop=droop, k=1.5)
    if shade:
        s.shade_bottom(480, shade)


def ridge_wall(s, yfn, x0, x1, h, m, every=90, tw=18.0, th=1.5):
    """Tepe hattını izleyen sur."""
    xs = [float(x) for x in np.arange(x0, x1 + 1, 10)]
    s.poly([(x, yfn(x) - h) for x in xs] + [(x, yfn(x) + 6) for x in xs[::-1]], m["m"])
    s.poly([(x, yfn(x) - h * 0.3) for x in xs] + [(x, yfn(x) + 6) for x in xs[::-1]], mix(m["m"], m["d"], 0.5))
    for i, x in enumerate(np.arange(x0, x1, 9)):
        if i % 2 == 0:
            s.rect(x, yfn(x) - h - 4, x + 5, yfn(x) - h + 1, m["m"])
    for x in np.arange(x0, x1 + 1, every):
        y = yfn(x)
        M.block(s, x - tw / 2, y - h * th, x + tw / 2, y + 6, m, 0.36)
        M.cren(s, x - tw / 2 - 1.5, x + tw / 2 + 1.5, y - h * th, m, 4, 4.4)


def orchard(s, x0, x1, rows, c="#5E9A4E", fruit=None, y0=432, dy=44, h0=30, grow=1.45):
    for r_ in range(rows):
        y = y0 + dy * r_ * (1 + 0.25 * r_)
        hh = h0 * grow ** r_
        n = max(4, int((x1 - x0) / (hh * 1.15)))
        for i in range(n + 1):
            x = x0 + (x1 - x0) * i / n + (hh * 0.5 if r_ % 2 else 0)
            if 560 < x < 1360 and r_ >= 2:
                continue
            s.tree(x, y, hh, c, fruit=fruit)


def mevlana(s, cx, by, k=1.0):
    """Yivli yeşil külahlı türbe ve yanındaki cami (Konya)."""
    M.mosque(s, cx + 190 * k, by, 0.85 * k, 2, M.STONE, M.LEAD)
    M.block(s, cx - 130 * k, by - 38 * k, cx + 50 * k, by, M.STONE, 0.14)
    M.windows(s, cx - 124 * k, by - 30 * k, cx + 44 * k, by - 6 * k, 8, 1, M.DARK, True, 7 * k, 18 * k)
    for i in range(5):
        M.dome(s, cx - 112 * k + i * 36 * k, by - 38 * k, 16 * k, 13 * k, M.LEAD, False)
    M.minaret(s, cx + 24 * k, by, 150 * k, M.STONE, bal=1)
    M.block(s, cx - 74 * k, by - 86 * k, cx - 26 * k, by - 38 * k, M.TILE, 0.34)
    s.rect(cx - 78 * k, by - 90 * k, cx - 22 * k, by - 86 * k, M.TILE["l"])
    s.poly([(cx - 76 * k, by - 90 * k), (cx - 50 * k, by - 156 * k), (cx - 24 * k, by - 90 * k)], M.TILE["m"])
    s.poly([(cx - 46 * k, by - 90 * k), (cx - 50 * k, by - 156 * k), (cx - 24 * k, by - 90 * k)], M.TILE["d"])
    for t in (-0.6, -0.3, 0.0, 0.3):
        s.line([(cx - 50 * k + t * 26 * k, by - 90 * k), (cx - 50 * k, by - 156 * k)], M.TILE["l"], 0.7)
    s.line([(cx - 50 * k, by - 156 * k), (cx - 50 * k, by - 172 * k)], M.GOLD, 1.0)
    s.circ(cx - 50 * k, by - 172 * k, 2.2 * k, M.GOLD)


# ---------------------------------------------------------------- iller
@city("Adana")
def _adana(s):
    shore(s, "gold", "#8FAE6C", sun=(1520, 150), far=(60, 40), amp=14)
    g = s.yfn
    M.houses(s, 60, 1860, g, 50, seed=1)
    M.mosque(s, 1000, g(1000) + 2, 1.12, 6, M.WHITE, M.LEAD)
    s.forest(g, 240, 1700, 9, 36, 54, "palm", ["#3F8F4E"])
    wet(s)
    M.arch_bridge(s, 230, 1700, s.yw + 30, 24, 15, M.STONE, pier=0.26)
    finish(s, "palm")


@city("Adıyaman")
def _adiyaman(s):
    backdrop(s, "dawn", sun=(1420, 300, 30), far=(120, 80), far_y=440, clouds=4)
    s.peak(960, 600, 2400, 262, "#A99A82", snow=0, p=1.1, shadow=0.12)
    M.nemrut(s, 960, 350, 1.25)
    s.ridge(610, 70, "#8C7D66", 3, 1.4)
    finish(s, None)


@city("Afyonkarahisar")
def _afyon(s):
    plain(s, "day", ("#9DBB72", "#6E9A52"), sun=(380, 120), far=(70, 40))
    g = s.yfn
    M.houses(s, 200, 1720, g, 60, seed=2)
    M.mosque(s, 1290, g(1290) + 2, 0.5, 2)
    top, xa, xb = M.crag(s, 960, g(960) + 8, 340, 196, "#8B7B6E", seed=3, steep=0.5, top=0.4)
    M.castle(s, 960, top + 4, 0.48, M.STONE, towers=4, w=250, h=36)
    finish(s, "poplar", flowers=("#E9463B", "#F6F1F1", "#B46BC9"))


@city("Ağrı")
def _agri(s):
    plain(s, "dawn", ("#F2F6FB", "#D3DFEE"), sun=(300, 250, 24), far=(40, 0), clouds=4)
    s.peak(820, 424, 1300, 304, "#7E8FB5", snow=0.44)
    s.peak(1480, 424, 560, 156, "#8A9ABD", snow=0.2)
    s.vband(418, H, [(0, "#F2F6FB"), (1, "#D3DFEE")])
    top, xa, xb = M.crag(s, 1040, 440, 460, 74, "#A58C73", seed=5, top=0.72, steep=0.7)
    M.palace(s, 1040, top + 5, 0.95)
    s.ridge(560, 50, "#E3EBF5", 3, 1.3)
    s.forest(lambda x: 470, 0, 620, 9, 30, 54, "pine", ["#3A5E6B", "#2F5260"], sink=40)
    s.forest(lambda x: 470, 1500, W, 9, 30, 54, "pine", ["#3A5E6B", "#2F5260"], sink=40)
    finish(s, "pine", ground="#DCE6F2", shade=0.12)


@city("Aksaray")
def _aksaray(s):
    plain(s, "gold", ("#D8BD6C", "#B9994A"), sun=(1560, 170), far=(40, 0), fields=["#D8BD6C", "#CDAF5C", "#E2C97D"])
    s.peak(880, 420, 1150, 252, "#8C86A6", snow=0.3)
    s.peak(1140, 420, 720, 200, "#8780A2", snow=0.25)
    s.vband(416, 426, [(0, "#D8BD6C"), (1, "#D8BD6C")])
    g = s.yfn
    M.caravanserai(s, 1040, 424, 0.82)
    M.minaret(s, 700, 424, 156, M.BRICK, w=11, lean=0.075, cap=dict(m="#8E4633", d="#6E3324", l="#C46E50"))
    M.houses(s, 380, 640, lambda x: 424, 9, seed=4, walls=("#F1E2C2", "#E6D2A8"))
    finish(s, "poplar")


@city("Amasya")
def _amasya(s):
    backdrop(s, "day", sun=(300, 110), far=(60, 0), far_y=300, clouds=5)
    cliff = s.ridge(330, 200, "#8E8478", 5, 1.4)
    s.ridge(360, 80, "#7B7268", 4, 2.6)
    for x in (680, 820, 960, 1100, 1240):
        M.arch(s, x, 322, 50, 66, "#B7AC9C")
        M.arch(s, x, 322, 32, 48, "#3A322B")
    M.castle(s, 990, cliff(990) + 4, 0.5, M.STONE, towers=4, w=260, h=30, keep=False, flag=True)
    s.rect(0, 368, W, 424, "#6B8F5C")
    s.forest(lambda x: 392, 0, W, 34, 34, 60, ["tree", "poplar"], ["#4F8A52", "#5E9A5A"])
    M.konaks(s, 60, 1860, lambda x: 418, 40, seed=5, w=(34, 50), h=(44, 62))
    s.water(420, "#6FAFC6", "#2F6F8E")
    finish(s, "tree")


@city("Ankara")
def _ankara(s):
    backdrop(s, "day", sun=(1560, 120), far=(50, 30), far_y=400)
    g1 = s.ridge(404, 56, "#A9BD92", 4, 1.2)
    M.towers_city(s, 60, 1860, g1, 64, seed=6)
    top, xa, xb = M.crag(s, 400, g1(400) + 14, 300, 96, "#9A8C7A", seed=7, top=0.6)
    M.castle(s, 400, top + 4, 0.56, M.BRICK, towers=5, w=280, h=30, keep=False)
    M.needle_tower(s, 1450, g1(1450) + 8, 1.0)
    s.peak(960, 452, 980, 116, "#7FA06C", snow=0, p=0.9, shadow=0.1)
    M.anitkabir(s, 960, 340, 1.05)
    g2 = s.ridge(476, 30, "#6E955F", 3, 1.3)
    s.forest(g2, 0, W, 26, 34, 58, ["tree", "pine"], ["#4F8A52", "#3F7A4A"])
    s.vband(480, H, [(0, "#6E955F"), (1, "#4F7A4A")])
    finish(s, "tree")


@city("Antalya")
def _antalya(s):
    backdrop(s, "day", sun=(1500, 110), far=(210, 120), far_y=360, snow=0.45, rough=7)
    s.rect(0, 346, W, 416, "#D2B089")
    for x in range(0, W, 46):
        s.line([(x + 8 * math.sin(x), 356), (x + 12, 414)], "#B8946C", 1.4)
    s.rect(0, 340, W, 352, "#7FA35A")
    f = lambda x: 346
    M.houses(s, 40, 1880, f, 62, seed=8)
    M.clock_tower(s, 1090, 346, 0.52, M.STONE)
    M.minaret(s, 900, 346, 138, M.BRICK, w=13, flute=True, cap=M.LEAD)
    s.forest(f, 60, 1860, 14, 40, 60, "palm", ["#3F8F4E"])
    M.waterfall(s, 1300, 350, 416, 34)
    s.water(416, *PAL["day"]["water"])
    wet(s)
    M.sailboat(s, 560, 474, 1.0)
    M.sailboat(s, 1560, 452, 0.7)
    finish(s, "palm")


@city("Ardahan")
def _ardahan(s):
    shore(s, "snow", "#F4F8FC", sun=(420, 130), far=(150, 90), snow=0.75, amp=30, water=("#EEF4FB", "#C3D5EA"))
    g = s.yfn
    top, xa, xb = M.crag(s, 1000, g(1000) + 10, 300, 150, "#8A8F9B", seed=9, top=0.4)
    M.castle(s, 1000, top + 4, 0.46, M.GREY, towers=4, w=250, h=34)
    s.forest(g, 100, 1820, 22, 30, 52, "pine", ["#2F5E45", "#3A6650"])
    M.houses(s, 300, 760, g, 9, seed=10, roofs=("#F6F9FC",))
    wet(s, refl=0.22, glint=False)
    for i in range(14):
        x, y = s.rnd.uniform(0, W), s.rnd.uniform(440, 620)
        s.line([(x, y), (x + s.rnd.uniform(60, 180), y + s.rnd.uniform(-8, 8))], "#FFFFFF", 1.4)
    finish(s, "pine", ground="#EAF1F9", shade=0.12)


@city("Artvin")
def _artvin(s):
    P, yl, yr = valley(s, "mist", "#3F7D4F", "#356F47", far=(170, 110), farc=("#7FA89A", "#5E8C7A"), clouds=5)
    s.forest(yl, 0, 780, 46, 40, 86, "pine", ["#2F5E45", "#27503C"], sink=30)
    s.forest(yr, 1150, W, 46, 40, 86, "pine", ["#2A5540", "#234A38"], sink=30)
    M.chalet(s, 420, yl(420) + 14, 1.2)
    M.chalet(s, 1520, yr(1520) + 16, 1.2)
    M.arch_bridge(s, 760, 1180, 486, 30, 1, M.STONE, hump=44, thick=0.2, pier=0.1)
    s.haze(300, 60, "#FFFFFF", 0.4, below=40)
    finish(s, "pine")


@city("Aydın")
def _aydin(s):
    plain(s, "gold", ("#A9B872", "#7F9652"), sun=(1500, 160), far=(70, 40))
    g = s.yfn
    s.forest(g, 60, 1860, 26, 30, 50, "olive", ["#8A9A6B", "#7C8C5E"])
    M.columns(s, 960, g(960) + 8, 1.7, n=6, m=M.WHITE, h=124, heights=[1, 1, 1, 0.36, 0.5, 0.2])
    for dx, r in ((250, 13), (290, 10), (-260, 12)):
        s.ell(960 + dx - r * 1.6, 428 - r, 960 + dx + r * 1.6, 428 + r, M.WHITE["m"])
        s.ell(960 + dx + r * 0.6, 428 - r, 960 + dx + r * 1.6, 428 + r, M.WHITE["d"])
    finish(s, "olive")


@city("Balıkesir")
def _balikesir(s):
    shore(s, "day", "#8DAE6A", sun=(360, 120), far=(80, 50), amp=54, scale=1.2)
    g = s.yfn
    s.forest(g, 40, 1880, 30, 22, 40, "olive", ["#8A9A6B", "#7C8C5E"])
    M.houses(s, 520, 1400, g, 74, seed=11, sink=14)
    M.clock_tower(s, 880, g(880) + 4, 0.56, M.STONE, style="spire")
    M.windmill(s, 1210, g(1210) + 2, 1.5)
    wet(s)
    M.boat(s, 620, 450, 1.3)
    M.sailboat(s, 1420, 470, 1.0)
    M.boat(s, 1040, 440, 1.0, "#2F6FB8")
    finish(s, "olive")


@city("Bartın")
def _bartin(s):
    shore(s, "day", "#5E9458", sun=(1480, 110), far=(70, 0), amp=60, scale=1.3)
    g = s.yfn
    s.forest(g, 40, 1880, 34, 26, 46, ["pine", "tree"], ["#2F5E45", "#4F8A52"])
    M.houses(s, 520, 1300, g, 54, seed=12, sink=16)
    M.castle(s, 900, 414, 0.9, M.STONE, towers=6, w=560, h=26, keep=False, flag=False, gate=False)
    wet(s)
    f = M.islet(s, 1520, 440, 300, 70, "#5E9458")
    s.forest(f, 1410, 1630, 9, 24, 40, "pine", ["#2F5E45"])
    M.arch_bridge(s, 1190, 1400, 430, 16, 2, M.STONE, pier=0.3)
    M.boat(s, 640, 470, 1.4)
    M.boat(s, 980, 452, 1.0, "#2F6FB8")
    finish(s, "pine")


@city("Batman")
def _batman(s):
    shore(s, "dusk", "#8B6F5C", sun=(1380, 300, 30), far=(90, 60), amp=22, clouds=4)
    g = s.yfn
    for x, k in ((330, 1.0), (520, 0.7), (1500, 1.0), (1690, 0.75)):
        M.pumpjack(s, x, g(x) + 3, k)
    wet(s, refl=0.42)
    dark = dict(l="#C99A6E", m="#A87C55", d="#7A573B")
    M.arch_bridge(s, 600, 1320, 452, 44, 3, dark, hump=50, pointed=True, big=3.4, thick=0.2, pier=0.24)
    finish(s, None)


@city("Bayburt")
def _bayburt(s):
    backdrop(s, "day", sun=(380, 110), far=(90, 50), far_y=380)
    g1 = s.ridge(370, 120, "#A39B80", 4, 1.1)
    ridge_wall(s, g1, 560, 1400, 20, M.STONE, every=84)
    g2 = s.ridge(436, 26, "#7FA06C", 3, 1.4)
    M.houses(s, 200, 1720, g2, 60, seed=13)
    M.clock_tower(s, 1180, g2(1180) + 4, 0.62, M.STONE)
    M.mosque(s, 780, g2(780) + 4, 0.5, 1)
    s.water(470, "#7FB2DA", "#35699E")
    finish(s, "poplar")


@city("Bilecik")
def _bilecik(s):
    backdrop(s, "gold", sun=(1500, 160), far=(110, 70), far_y=400, farc=("#9FB08E", "#7F9A72"))
    g = s.ridge(436, 44, "#6F9A62", 4, 1.3)
    M.konaks(s, 240, 1700, g, 26, seed=14)
    M.mosque(s, 1290, g(1290) + 4, 0.62, 1)
    top, xa, xb = M.crag(s, 940, g(940) + 12, 250, 124, "#9C8F7C", seed=15, top=0.36)
    M.clock_tower(s, 940, top + 3, 0.72, M.STONE)
    s.ridge(520, 40, "#5E8C58", 3, 1.2)
    finish(s, "tree")


@city("Bingöl")
def _bingol(s):
    backdrop(s, "dawn", sun=(960, 268, 44), far=(0, 0), clouds=5)
    for i, (y, a, c) in enumerate(((380, 120, "#A9A6CF"), (410, 110, "#8E8FC0"), (440, 100, "#7479AE"), (474, 80, "#5B6398"))):
        s.ridge(y, a, c, 5, 1.0 + i * 0.4)
        s.haze(y + 6, 50, "#FCE3CF", 0.28)
    s.water(492, "#C9B4D4", "#4E5E9E")
    wet(s, refl=0.5, n=90)
    for x, y, w in ((520, 540, 120), (900, 580, 170), (1340, 548, 130)):
        s.ell(x - w / 2, y - 10, x + w / 2, y + 12, "#4F7A52")
        s.ell(x - w * 0.4, y - 13, x + w * 0.3, y + 4, "#6B9A5E")
        s.tree(x, y - 4, 44, "#4F8A52")
    finish(s, None)


@city("Bitlis")
def _bitlis(s):
    shore(s, "day", "#B9B07A", sun=(360, 120), far=(110, 70), snow=0.5, amp=22)
    s.peak(1380, 408, 900, 232, "#7C90B8", snow=0.42)
    g = s.ridge(409, 22, "#B9B07A", 4, 1.6)
    s.water(412, *PAL["day"]["water"])
    tuff = dict(l="#C99A80", m="#A97660", d="#7E5444")
    M.tombstones(s, 520, 800, 412, 12, seed=16)
    M.tombstones(s, 1160, 1380, 412, 9, seed=17)
    M.kumbet(s, 900, 412, 1.6, tuff)
    M.kumbet(s, 1070, 412, 1.1, tuff)
    finish(s, "tree", ground="#8C8A52")


@city("Bolu")
def _bolu(s):
    backdrop(s, "mist", sun=None, far=(0, 0), clouds=5)
    s.ridge(404, 170, "#6E9A7C", 5, 1.0)
    s.haze(404, 80, "#EEF4F7", 0.35)
    g = s.ridge(410, 96, "#3F7355", 5, 1.5)
    s.forest(g, 0, W, 90, 34, 70, "pine", ["#2F5E45", "#27503C", "#356B4E"], sink=60)
    s.forest(lambda x: 410, 0, W, 34, 30, 52, "tree", ["#D98B3A", "#C4692E", "#E0B040", "#B9502C"])
    M.chalet(s, 1120, 412, 1.6)
    s.water(412, "#6FA3C4", "#2F6890")
    wet(s, refl=0.5, n=110)
    M.boat(s, 760, 470, 1.0, "#8A6547", "#B58E6C")
    finish(s, "pine")


@city("Burdur")
def _burdur(s):
    shore(s, "day", "#FBFBF6", sun=(1500, 110), far=(120, 80), farc=("#9DB59A", "#7F9F84"), amp=8, water=("#63C6EE", "#1F7FC4"))
    g = s.yfn
    s.forest(lambda x: g(x) - 4, 0, W, 34, 30, 54, "pine", ["#3A6B4C", "#2F5E45"])
    s.rect(0, 404, W, 413, "#FBFBF6")
    M.columns(s, 800, 408, 0.86, n=5, m=M.WHITE, h=110, heights=[1, 1, 1, 0.5, 0.3])
    finish(s, "pine", ground="#EDEBDD")


@city("Bursa")
def _bursa(s):
    backdrop(s, "day", sun=(340, 110), far=(0, 0), clouds=6)
    s.ridge(390, 240, "#6F8FB0", 5, 0.8, snow=390 - 240 * 0.55)
    s.haze(392, 70, "#EAF4FC", 0.4)
    s.ridge(404, 110, "#3F7355", 5, 1.5)
    g = s.ridge(436, 24, "#6FA35F", 3, 1.3)
    M.houses(s, 60, 1860, g, 70, seed=18)
    s.forest(g, 100, 1820, 18, 44, 70, "cypress", ["#2F5E45", "#3A6B4C"])
    M.mosque(s, 940, g(940) + 4, 1.15, 2, M.STONE, M.LEAD, tall=0.92, multi=5)
    M.kumbet(s, 1300, g(1300) + 4, 1.0, M.TILE, roof=M.LEAD)
    M.cable_car(s, 1440, 392, 1840, 214, 3)
    s.vband(440, H, [(0, "#6FA35F"), (1, "#4F8A52")])
    finish(s, "cypress")


@city("Çanakkale")
def _canakkale(s):
    shore(s, "gold", "#8FAE6C", sun=(1560, 160), far=(60, 0), amp=40, scale=1.2)
    g = s.yfn
    s.forest(g, 40, 1880, 26, 26, 46, "pine", ["#3A6B4C", "#2F5E45"])
    M.houses(s, 300, 1000, g, 34, seed=19)
    M.trojan_horse(s, 760, g(760) + 4, 1.0)
    M.monument(s, 1180, g(1180) + 4, 1.0)
    wet(s)
    M.steamer(s, 430, 486, 0.8)
    finish(s, "pine")


@city("Çankırı")
def _cankiri(s):
    plain(s, "day", ("#C9C07A", "#9FA05A"), sun=(1500, 120), far=(90, 60))
    g = s.yfn
    M.houses(s, 200, 1720, g, 56, seed=20)
    top, xa, xb = M.crag(s, 720, g(720) + 10, 380, 130, "#A39480", seed=21, top=0.5)
    M.kumbet(s, 720, top + 4, 0.7, M.STONE)
    M.castle(s, 790, top + 4, 0.3, M.STONE, towers=3, w=220, h=30, keep=False, flag=True, gate=False)
    M.clock_tower(s, 1140, g(1140) + 4, 0.86, M.STONE)
    M.mosque(s, 1380, g(1380) + 4, 0.46, 2)
    finish(s, "poplar")


@city("Çorum")
def _corum(s):
    plain(s, "gold", ("#DCC06E", "#BC9D4C"), sun=(1520, 170), far=(70, 40), fields=["#DCC06E", "#D0B25E", "#E6CD82"])
    g = s.yfn
    s.rect(0, 414, W, 426, "#DCC06E")
    M.houses(s, 300, 1640, g, 44, seed=22)
    M.mosque(s, 1330, g(1330) + 4, 0.5, 2)
    M.gate_stones(s, 600, 430, 1.0)
    M.clock_tower(s, 980, g(980) + 6, 1.1, M.STONE, style="balcony", h=176)
    finish(s, "poplar")


@city("Denizli")
def _denizli(s):
    backdrop(s, "day", sun=(1520, 110), far=(80, 50), far_y=330)
    g1 = s.ridge(322, 40, "#A8B48A", 3, 0.8)
    s.rect(0, 320, W, 440, "#A8B48A")
    M.columns(s, 700, 296, 0.5, n=5, m=M.STONE, h=110, heights=[1, 1, 1, 1, 0.4])
    s.forest(lambda x: 300, 1100, 1700, 9, 40, 64, "cypress", ["#3A6B4C"])
    M.travertine(s, 500, 1420, 300, 432, 8, seed=23)
    s.vband(432, H, [(0, "#8FB06A"), (1, "#5E8A4C")])
    s.ell(560, 438, 1360, 486, "#FFFFFF")
    s.ell(580, 442, 1340, 482, "#7DCBEF")
    s.ell(640, 448, 1100, 466, "#B5E3F8")
    finish(s, "poplar")


@city("Diyarbakır")
def _diyarbakir(s):
    shore(s, "dusk", "#7C7A52", sun=(420, 280, 28), far=(50, 0), amp=40, scale=1.0, clouds=4)
    g = s.yfn
    M.houses(s, 300, 1640, lambda x: g(x) - 10, 30, seed=24, walls=("#8E8478", "#A39887"), flat=True, h=(16, 26))
    s.rect(1010, g(1010) - 96, 1030, g(1010), M.BASALT["m"])
    s.rect(1022, g(1010) - 96, 1030, g(1010), M.BASALT["d"])
    M.dome(s, 1020, g(1010) - 96, 9, 8, M.BASALT)
    ridge_wall(s, g, 220, 1700, 26, M.BASALT, every=96, tw=24, th=1.4)
    s.forest(lambda x: 410, 0, W, 30, 22, 40, ["tree", "poplar"], ["#4F7A4A", "#5E8A52"])
    wet(s, refl=0.42)
    M.arch_bridge(s, 480, 1440, 452, 30, 10, M.BASALT, pier=0.3)
    finish(s, "poplar", cols_=("#4F7A4A", "#5E8A52"))


@city("Düzce")
def _duzce(s):
    P, yl, yr = valley(s, "mist", "#3F7D4F", "#356F47", far=(190, 120), farc=("#6E9A7C", "#4F8062"), clouds=4)
    top, xa, xb = M.crag(s, 965, 474, 420, 250, "#6E7C74", seed=25, top=0.6, steep=0.4)
    s.forest(lambda x: top + 4, xa, xb, 12, 40, 66, "pine", ["#2F5E45"])
    M.waterfall(s, 965, top + 2, 470, 64)
    s.forest(yl, 0, 760, 50, 44, 90, ["pine", "tree"], ["#2F5E45", "#27503C", "#4F8A52"], sink=30)
    s.forest(yr, 1170, W, 50, 44, 90, ["pine", "tree"], ["#2A5540", "#234A38", "#3F7A4A"], sink=30)
    finish(s, "pine")


@city("Edirne")
def _edirne(s):
    shore(s, "gold", "#8FAE6C", sun=(400, 170), far=(40, 0), amp=16)
    g = s.yfn
    M.houses(s, 100, 1820, g, 54, seed=26)
    s.forest(g, 100, 1820, 14, 34, 56, ["poplar", "tree"], ["#5E9453", "#4F8A52"])
    M.mosque(s, 960, g(960) + 3, 1.25, 4, M.STONE, M.LEAD, tall=1.22)
    wet(s)
    M.arch_bridge(s, 280, 1640, 444, 22, 12, M.STONE, hump=7, pointed=True, pier=0.3)
    finish(s, "poplar", flowers=("#F6C21C", "#F9D648"))


@city("Elazığ")
def _elazig(s):
    shore(s, "day", "#A9B47A", sun=(1520, 110), far=(130, 80), amp=30)
    g = s.yfn
    M.houses(s, 200, 1720, g, 50, seed=27)
    M.mosque(s, 1320, g(1320) + 3, 0.5, 2)
    top, xa, xb = M.crag(s, 930, g(930) + 10, 360, 150, "#9A8B78", seed=28, top=0.5)
    M.castle(s, 930, top + 4, 0.62, M.STONE, towers=5, w=270, h=34)
    finish(s, "tree")


@city("Erzincan")
def _erzincan(s):
    backdrop(s, "day", sun=(360, 110), far=(230, 150), far_y=400, snow=0.5, rough=8)
    g = s.ridge(440, 30, "#7FA868", 3, 1.2)
    top, xa, xb = M.crag(s, 960, 452, 440, 176, "#8B8378", seed=29, top=0.66, steep=0.4)
    s.forest(lambda x: top + 4, xa, xb, 9, 28, 44, "tree", ["#4F8A52"])
    M.waterfall(s, 960, top + 2, 448, 80)
    M.houses(s, 200, 700, g, 18, seed=30, walls=("#E6DCC8", "#D8CCB4"))
    M.houses(s, 1240, 1720, g, 18, seed=31, walls=("#E6DCC8", "#D8CCB4"))
    s.vband(446, H, [(0, "#7FA868"), (1, "#5E8A52")])
    s.poly([(900, 448), (1030, 448), (1200, H), (760, H)], "#8FC0E2")
    finish(s, "poplar")


@city("Erzurum")
def _erzurum(s):
    backdrop(s, "snow", sun=(1540, 120), far=(0, 0), clouds=5)
    s.ridge(404, 230, "#93A9CC", 5, 0.8, snow=404 - 230 * 0.5)
    s.forest(lambda x: 398, 0, W, 50, 18, 34, "pine", ["#3A5E6B", "#2F5260"])
    g = s.ridge(416, 10, "#F4F8FC", 3, 1.0)
    s.vband(420, H, [(0, "#F4F8FC"), (1, "#D5E1EF")])
    M.houses(s, 200, 1720, g, 46, seed=32, roofs=("#F8FAFD", "#E9EFF6"), walls=("#D9CBB8", "#C9BBA6"))
    for x, k in ((1260, 0.9), (1340, 0.72), (1410, 0.66)):
        M.kumbet(s, x, g(x) + 5, k, M.GREY)
    M.twin_minaret_portal(s, 880, g(880) + 6, 1.25, M.GREY, M.BRICK)
    finish(s, "pine", ground="#E6EEF7", shade=0.12)


@city("Eskişehir")
def _eskisehir(s):
    backdrop(s, "day", sun=(1520, 110), far=(60, 40), far_y=380)
    s.rect(0, 372, W, 432, "#7FA868")
    f = lambda x: 416
    s.forest(lambda x: 404, 0, W, 30, 50, 84, "tree", ["#4F8A52", "#5E9A5A", "#3F7A4A"])
    M.konaks(s, 40, 1880, f, 44, seed=33, w=(36, 52), h=(46, 64), walls=("#F2C14E", "#E8896B", "#7FA8D9", "#F4F1DE", "#D98BB0", "#FBF7EE"))
    s.rect(0, 416, W, 432, "#CFC6B4")
    s.rect(0, 416, W, 419, "#E9E2D2")
    s.water(432, "#6FAFD6", "#2F6FA8")
    wet(s, refl=0.42)
    M.arch_bridge(s, 1220, 1560, 452, 12, 1, M.WHITE, hump=22, thick=0.3, pier=0.08)
    s.poly([(820, 492), (940, 492), (924, 502), (836, 502)], "#1F2A3A")
    s.line([(820, 492), (808, 482)], "#1F2A3A", 2)
    s.line([(940, 492), (952, 482)], "#1F2A3A", 2)
    s.rect(916, 468, 920, 492, "#1F2A3A")
    s.circ(918, 464, 4, "#1F2A3A")
    s.line([(924, 470), (950, 508)], "#6B5A45", 1.2)
    finish(s, "tree")


@city("Gaziantep")
def _gaziantep(s):
    plain(s, "gold", ("#CDB37A", "#A98C52"), sun=(1540, 160), far=(60, 40))
    g = s.yfn
    M.houses(s, 100, 1820, g, 60, seed=34, walls=("#F1DDB4", "#E6CC9C", "#F6E7C6"), flat=True)
    M.mosque(s, 1420, g(1420) + 4, 0.5, 1, M.HONEY, M.LEAD)
    s.peak(960, 440, 700, 96, "#B99A6B", snow=0, p=0.7, shadow=0.16)
    M.castle(s, 960, 352, 0.95, M.HONEY, towers=7, w=350, h=34, keep=False, round_t=True)
    s.line([(960, 320), (960, 282)], "#5B5148", 1.2)
    s.poly([(960, 282), (984, 288), (960, 296)], M.FLAG)
    orchard(s, 40, W - 40, 2, "#6E9A52", fruit="#E58AA0", y0=470, dy=60, h0=46)
    finish(s, "tree", ground="#7F8F4E")


@city("Giresun")
def _giresun(s):
    shore(s, "day", "#3F7D4F", sun=(380, 110), far=(110, 0), farc=("#5E9470",), amp=110, scale=1.0)
    g = s.yfn
    s.forest(g, 0, W, 60, 24, 44, "tree", ["#3F7A4A", "#4F8A52", "#2F6B45"], sink=50)
    M.houses(s, 300, 1500, lambda x: 408 - s.rnd.uniform(0, 40), 80, seed=35, sink=2)
    top, xa, xb = M.crag(s, 900, g(900) + 30, 260, 90, "#7E8A78", seed=36, top=0.5)
    M.castle(s, 900, top + 4, 0.5, M.STONE, towers=4, w=220, h=30)
    wet(s)
    f = M.islet(s, 1480, 486, 320, 64, "#3F7D4F")
    s.forest(f, 1360, 1600, 12, 22, 40, "tree", ["#2F6B45", "#4F8A52"])
    M.boat(s, 620, 470, 1.3)
    M.boat(s, 980, 520, 1.6, "#2F6FB8")
    finish(s, "tree")


@city("Gümüşhane")
def _gumushane(s):
    P, yl, yr = valley(s, "mist", "#4F8A5C", "#3F7A50", far=(200, 130), farc=("#8FA8A0", "#6E8E84"), clouds=5, snow=0.25)
    s.forest(yl, 0, 780, 40, 40, 84, "pine", ["#2F5E45", "#27503C"], sink=30)
    s.forest(yr, 1150, W, 40, 40, 84, "pine", ["#2A5540", "#234A38"], sink=30)
    for x in (300, 470):
        M.chalet(s, x, yl(x) + 16, 1.2)
    for x in (1460, 1620):
        M.chalet(s, x, yr(x) + 16, 1.2)
    M.arch_bridge(s, 800, 1140, 484, 26, 1, M.GREY, hump=30, thick=0.24, pier=0.1)
    finish(s, "pine")


@city("Hakkari")
def _hakkari(s):
    backdrop(s, "snow", sun=(1520, 110), far=(0, 0), clouds=5)
    s.ridge(410, 300, "#8FA3C8", 8, 1.6, snow=410 - 300 * 0.35)
    s.ridge(416, 190, "#7489B2", 8, 2.2, snow=416 - 190 * 0.5)
    s.haze(418, 60, "#F1F6FB", 0.35)
    g = s.ridge(446, 36, "#6FA35F", 3, 1.2)
    M.houses(s, 500, 1400, g, 22, seed=37, walls=("#D9CDB8", "#C9BCA4"), flat=True)
    s.vband(450, H, [(0, "#6FA35F"), (1, "#4F8A52")])
    s.flowers(40, 680, 500, 630, 30, ("#E8632B", "#D9451F", "#F08A3C"), droop=True, k=2.4)
    s.flowers(1240, 1880, 500, 630, 30, ("#E8632B", "#D9451F", "#F08A3C"), droop=True, k=2.4)
    finish(s, None, shade=0.14)


@city("Hatay")
def _hatay(s):
    backdrop(s, "gold", sun=(1540, 150), far=(0, 0), clouds=5)
    s.ridge(380, 200, "#9C8E78", 5, 1.0)
    s.haze(384, 60, "#FDEBC8", 0.3)
    s.rect(0, 380, W, 446, "#B7A27C")
    M.stone_town(s, 960, 430, 1500, 70, M.STONE, seed=38, rows=4)
    M.mosque(s, 800, 432, 0.6, 1, M.STONE, M.LEAD)
    M.clock_tower(s, 1150, 432, 0.56, M.STONE, style="spire")
    s.forest(lambda x: 436, 60, 1860, 12, 44, 66, "palm", ["#3F8F4E"])
    s.water(440, "#8FB6C8", "#3F7896")
    finish(s, "palm")


@city("Iğdır")
def _igdir(s):
    plain(s, "dawn", ("#8FB86A", "#5E8F4C"), sun=(300, 240, 24), far=(40, 0), clouds=4, fields=["#8FB86A", "#A5C57A", "#D9C86E", "#7FAA5E"])
    s.peak(1180, 424, 1340, 312, "#7C8DB6", snow=0.45)
    s.peak(480, 424, 600, 176, "#8898BE", snow=0.22)
    s.rect(0, 416, W, 428, "#8FB86A")
    s.forest(lambda x: 424, 0, W, 44, 34, 60, "poplar", ["#5E9453", "#6FA35F"])
    M.houses(s, 600, 1400, lambda x: 426, 24, seed=39)
    finish(s, "poplar")


@city("Isparta")
def _isparta(s):
    shore(s, "day", "#7FA868", sun=(1500, 110), far=(170, 110), snow=0.3, amp=26)
    g = s.yfn
    M.houses(s, 500, 1400, g, 40, seed=40)
    M.mosque(s, 960, g(960) + 3, 0.6, 2)
    s.forest(g, 60, 1860, 20, 30, 50, ["poplar", "cypress"], ["#3A6B4C", "#5E9453"])
    wet(s)
    s.fields(498, H, ["#8E6BBF", "#A583D1", "#7A58AC", "#9A78C8"], n=44, top=0.3)
    s.vband(492, 500, [(0, "#5E8A4C"), (1, "#5E8A4C")])
    s.dots(500, H, 500, ["#C9A9EA", "#B592E0", "#F3B6CC"], 1.2, 4)
    finish(s, None)


@city("İzmir")
def _izmir(s):
    shore(s, "day", "#9DB58A", sun=(1540, 110), far=(90, 60), amp=70, scale=1.1)
    g = s.yfn
    M.houses(s, 40, 1880, lambda x: g(x) + s.rnd.uniform(0, 50), 150, seed=41, sink=2)
    M.towers_city(s, 100, 1820, lambda x: 404, 22, seed=42, h=(30, 70))
    s.rect(0, 404, W, 413, "#D9D2C2")
    s.forest(lambda x: 408, 60, 1860, 16, 44, 62, "palm", ["#3F8F4E"])
    M.clock_tower(s, 960, 410, 1.2, M.WHITE, M.LEAD, "dome", 168)
    wet(s)
    M.ferry(s, 500, 480, 1.0)
    M.sailboat(s, 1460, 462, 0.9)
    finish(s, "palm")


@city("Kahramanmaraş")
def _kmaras(s):
    backdrop(s, "gold", sun=(380, 150), far=(0, 0), clouds=5)
    s.ridge(400, 240, "#9A93A8", 6, 0.9, snow=400 - 240 * 0.8)
    s.haze(402, 60, "#FDEBC8", 0.35)
    g = s.ridge(436, 26, "#9DB06E", 3, 1.2)
    M.houses(s, 100, 1820, g, 64, seed=43)
    M.mosque(s, 1330, g(1330) + 3, 0.6, 1)
    s.peak(940, 446, 560, 90, "#A8996E", snow=0, p=0.75, shadow=0.15)
    M.castle(s, 940, 362, 0.8, M.STONE, towers=5, w=300, h=34)
    s.vband(440, H, [(0, "#9DB06E"), (1, "#73894E")])
    finish(s, "tree")


@city("Karabük")
def _karabuk(s):
    backdrop(s, "day", sun=(1520, 110), far=(120, 80), far_y=380, farc=("#7FA88A", "#5E8F70"))
    g1 = s.ridge(404, 80, "#6F9A62", 4, 1.2)
    M.konaks(s, 100, 1820, g1, 34, seed=44, w=(30, 44), h=(38, 54))
    g2 = s.ridge(452, 54, "#5E8C58", 4, 1.5)
    M.mosque(s, 1000, g2(1000) + 3, 0.66, 1)
    M.konaks(s, 60, 1860, g2, 34, seed=45, w=(34, 50), h=(44, 62))
    s.forest(g2, 0, W, 16, 40, 64, ["tree", "poplar"], ["#3F7A4A", "#4F8A52"])
    s.ridge(540, 40, "#4F7F4F", 3, 1.2)
    finish(s, "tree")


@city("Karaman")
def _karaman(s):
    plain(s, "gold", ("#DCC06E", "#BC9D4C"), sun=(380, 160), far=(110, 70), fields=["#DCC06E", "#D0B25E", "#E6CD82"])
    s.rect(0, 414, W, 428, "#DCC06E")
    g = s.yfn
    M.houses(s, 200, 1720, g, 40, seed=46, walls=("#F1E2C2", "#E6D2A8"))
    M.castle(s, 880, g(880) + 8, 0.95, M.STONE, towers=5, w=320, h=42)
    M.mosque(s, 1290, g(1290) + 6, 0.62, 1)
    finish(s, "poplar")


@city("Kars")
def _kars(s):
    plain(s, "snow", ("#F4F8FC", "#D5E1EF"), sun=(380, 120), far=(110, 70), snow=0.5)
    g = s.yfn
    s.forest(g, 0, W, 16, 26, 44, "pine", ["#3A5E6B", "#2F5260"])
    top, xa, xb = M.crag(s, 1330, g(1330) + 10, 360, 150, "#7E8492", seed=47, top=0.5)
    M.castle(s, 1330, top + 4, 0.6, M.BASALT, towers=5, w=280, h=34)
    M.ruin_church(s, 800, g(800) + 8, 1.4)
    for dx in (-190, -150, 150, 200, 250):
        s.rect(800 + dx - 10, g(800) - 6 - abs(dx) % 17, 800 + dx + 10, g(800) + 8, "#B98162")
    finish(s, "pine", ground="#E6EEF7", shade=0.12)


@city("Kastamonu")
def _kastamonu(s):
    backdrop(s, "mist", sun=None, far=(150, 100), far_y=390, farc=("#7FA89A", "#4F8062"))
    g = s.ridge(430, 40, "#5E8C58", 4, 1.3)
    s.forest(lambda x: g(x) - 6, 0, W, 40, 30, 54, "pine", ["#2F5E45", "#27503C"])
    M.konaks(s, 200, 1720, g, 30, seed=48)
    top, xa, xb = M.crag(s, 800, g(800) + 12, 330, 150, "#8E8478", seed=49, top=0.52)
    M.castle(s, 800, top + 4, 0.56, M.STONE, towers=5, w=280, h=32)
    t2, xa, xb = M.crag(s, 1250, g(1250) + 10, 200, 70, "#7E8A78", seed=50, top=0.4)
    M.clock_tower(s, 1250, t2 + 3, 0.7, M.STONE)
    s.ridge(530, 40, "#4F7F4F", 3, 1.2)
    finish(s, "pine")


@city("Kayseri")
def _kayseri(s):
    plain(s, "day", ("#B9C07A", "#8F9A5A"), sun=(340, 110), far=(40, 0))
    s.peak(960, 424, 1560, 306, "#7F92B8", snow=0.5)
    s.rect(0, 414, W, 430, "#B9C07A")
    g = s.yfn
    M.towers_city(s, 100, 1820, lambda x: 420, 40, seed=51, h=(24, 56))
    M.castle(s, 860, 430, 0.95, M.BASALT, towers=6, w=380, h=40, keep=False)
    M.kumbet(s, 1300, 430, 1.1, M.STONE)
    M.mosque(s, 520, 428, 0.5, 2)
    finish(s, "poplar")


@city("Kırıkkale")
def _kirikkale(s):
    shore(s, "day", "#C9BC7A", sun=(1520, 110), far=(90, 60), farc=("#B9B08E", "#A39A78"), amp=22, water=("#C48E70", "#8E5A48"))
    g = s.yfn
    M.houses(s, 200, 1720, g, 40, seed=52)
    s.forest(g, 60, 1860, 30, 40, 70, "poplar", ["#5E9453", "#6FA35F"])
    wet(s)
    M.arch_bridge(s, 440, 1480, 448, 30, 9, M.STONE, hump=10, pointed=True, pier=0.3)
    finish(s, "poplar")


@city("Kırklareli")
def _kirklareli(s):
    shore(s, "mist", "#3F7D4F", sun=None, far=(0, 0), amp=60, scale=1.2)
    g = s.yfn
    s.forest(g, 0, W, 80, 34, 64, ["tree", "pine"], ["#2F6B45", "#3F7A4A", "#4F8A52", "#27503C"], sink=40)
    top, xa, xb = M.crag(s, 1000, 414, 300, 60, "#9A9486", seed=53, top=0.6)
    M.lighthouse(s, 980, top + 3, 1.2)
    wet(s)
    M.boat(s, 520, 470, 1.3, "#2F6FB8")
    finish(s, "tree")


@city("Kırşehir")
def _kirsehir(s):
    shore(s, "gold", "#C9BC7A", sun=(1540, 160), far=(70, 40), amp=14)
    g = s.yfn
    M.houses(s, 300, 1640, g, 36, seed=54)
    M.mosque(s, 900, g(900) + 3, 0.95, 1, M.STONE, M.LEAD)
    M.kumbet(s, 1160, g(1160) + 3, 1.25, M.WHITE)
    wet(s)
    M.flamingos(s, 380, 860, 462, 14, seed=55)
    M.flamingos(s, 1180, 1560, 486, 10, seed=56)
    for x in range(40, W, 60):
        if x < 340 or x > 1600:
            for j in range(5):
                s.line([(x + j * 6, 560), (x + j * 6 + s.rnd.uniform(-6, 6), 520 - s.rnd.uniform(0, 26))], "#6E8A4C", 1.4)
    finish(s, None)


@city("Kilis")
def _kilis(s):
    plain(s, "gold", ("#C9B272", "#A38A4E"), sun=(380, 150), far=(60, 40))
    g = s.yfn
    s.peak(1300, 428, 460, 150, "#B7A27A", snow=0, p=1.0, shadow=0.16)
    M.castle(s, 1300, 284, 0.36, M.HONEY, towers=3, w=200, h=30, keep=True, flag=False)
    M.houses(s, 300, 1100, g, 30, seed=57, walls=("#F1DDB4", "#E6CC9C"), flat=True)
    M.mosque(s, 820, g(820) + 4, 0.82, 1, M.HONEY, M.LEAD)
    for r_, (y, hh) in enumerate(((448, 34), (486, 50), (540, 74))):
        n = int(W / (hh * 1.5))
        for i in range(n + 1):
            x = i * hh * 1.5 + (hh * 0.7 if r_ % 2 else 0)
            if not (600 < x < 1320 and r_ == 2):
                s.olive(x, y, hh)
    finish(s, "olive")


@city("Kocaeli")
def _kocaeli(s):
    shore(s, "day", "#6FA35F", sun=(360, 110), far=(100, 60), farc=("#8FB09A", "#6F9A80"), amp=60, scale=1.2)
    g = s.yfn
    s.forest(g, 0, W, 30, 26, 46, ["pine", "tree"], ["#2F5E45", "#4F8A52"])
    M.houses(s, 100, 1100, lambda x: g(x) + s.rnd.uniform(0, 30), 70, seed=58, sink=2)
    M.towers_city(s, 200, 900, lambda x: 404, 12, seed=59, h=(30, 60))
    M.clock_tower(s, 640, 412, 0.9, M.STONE)
    wet(s)
    M.suspension(s, 760, 2060, 470, 190)
    M.ferry(s, 420, 500, 0.8)
    finish(s, "pine", sides=(1, 0))


@city("Konya")
def _konya(s):
    plain(s, "gold", ("#DCC06E", "#BC9D4C"), sun=(1560, 160), far=(60, 40), fields=["#DCC06E", "#D0B25E", "#E6CD82"])
    s.rect(0, 414, W, 430, "#DCC06E")
    g = s.yfn
    M.houses(s, 200, 1720, g, 44, seed=60, walls=("#F1E2C2", "#E6D2A8"))
    mevlana(s, 900, 430, 1.1)
    finish(s, "poplar", flowers=("#E9463B", "#F6C21C"))


@city("Kütahya")
def _kutahya(s):
    backdrop(s, "day", sun=(1520, 110), far=(90, 50), far_y=380)
    g1 = s.ridge(380, 120, "#8FA878", 4, 1.0)
    ridge_wall(s, g1, 420, 1500, 20, M.STONE, every=62, tw=20, th=1.45)
    g2 = s.ridge(440, 30, "#6F9A62", 3, 1.3)
    M.houses(s, 100, 1820, g2, 60, seed=61)
    M.mosque(s, 960, g2(960) + 4, 0.8, 2, M.WHITE, M.TILE, cap=M.LEAD)
    s.vband(444, H, [(0, "#6F9A62"), (1, "#4F7F4F")])
    finish(s, "tree")


@city("Malatya")
def _malatya(s):
    plain(s, "gold", ("#A9BC72", "#7F9652"), sun=(1540, 160), far=(140, 90), snow=0.7)
    g = s.yfn
    M.caravanserai(s, 960, g(960) + 8, 1.0, M.STONE)
    orchard(s, 20, W - 20, 3, "#5E9A4E", fruit="#F39C2E", y0=452, dy=40, h0=34)
    finish(s, None)


@city("Manisa")
def _manisa(s):
    backdrop(s, "day", sun=(380, 110), far=(0, 0), clouds=6)
    s.ridge(390, 240, "#8C93A6", 7, 0.9)
    s.haze(392, 60, "#EAF4FC", 0.35)
    s.ridge(410, 90, "#5E8F62", 4, 1.5)
    g = s.ridge(440, 24, "#7FA868", 3, 1.3)
    M.houses(s, 100, 1820, g, 64, seed=62)
    M.mosque(s, 900, g(900) + 4, 1.0, 2)
    M.mosque(s, 1300, g(1300) + 4, 0.6, 2)
    s.forest(g, 100, 1820, 14, 40, 64, "cypress", ["#2F5E45"])
    s.vband(446, H, [(0, "#7FA868"), (1, "#5E8A4C")])
    s.fields(470, H, ["#6E9A52", "#8FB86A"], n=56, top=0.3)
    finish(s, "cypress")


@city("Mardin")
def _mardin(s):
    backdrop(s, "dusk", sun=(1560, 330, 34), far=(0, 0), clouds=4)
    s.vband(404, H, [(0, "#B98A6E"), (1, "#6E4E5C")])
    for y in range(416, H, 22):
        s.line([(0, y), (W, y + 6)], "#A67A62", 1.0)
    s.peak(900, 520, 1700, 290, "#A47A52", snow=0, p=0.85, shadow=0.2)
    top, xa, xb = M.crag(s, 900, 250, 380, 46, "#8E6A48", seed=63, top=0.6)
    M.stone_town(s, 900, 470, 1000, 190, M.HONEY, seed=64, rows=8)
    M.minaret(s, 730, 340, 136, M.HONEY, w=10, bal=2, cap=M.HONEY)
    M.dome(s, 1080, 322, 32, 28, M.HONEY)
    finish(s, None)


@city("Mersin")
def _mersin(s):
    shore(s, "day", "#E9D9B0", sun=(380, 110), far=(180, 110), snow=0.3, amp=10)
    g = s.yfn
    M.towers_city(s, 100, 1820, g, 44, seed=65, h=(30, 78), cols_=("#F4F1EA", "#E6EDF4", "#DCE6F0"))
    s.forest(g, 60, 1860, 22, 40, 60, "palm", ["#3F8F4E"])
    wet(s)
    s.ell(730, 466, 1190, 506, "#B9A582")
    M.castle(s, 960, 484, 1.0, M.STONE, towers=5, w=380, h=42)
    s.vband(486, 520, [(0, "#B9A582"), (1, "#B9A582")], 0.5, 0.0, 760, 1160)
    M.sailboat(s, 420, 470, 0.9)
    finish(s, "palm")


@city("Muğla")
def _mugla(s):
    shore(s, "day", "#8DAE6A", sun=(1540, 110), far=(110, 70), amp=110, scale=1.1)
    g = s.yfn
    s.forest(g, 0, W, 30, 22, 40, ["olive", "pine"], ["#7C8C5E", "#3A6B4C"])
    M.houses(s, 200, 1720, lambda x: g(x) + s.rnd.uniform(6, 80), 150, seed=66, walls=("#FFFFFF", "#F6F4EE"), flat=True, sink=2, w=(14, 24), h=(11, 18))
    for x in (1330, 1420):
        M.windmill(s, x, g(x) + 2, 0.9)
    M.castle(s, 940, 414, 0.95, M.STONE, towers=4, w=300, h=40)
    wet(s)
    M.sailboat(s, 520, 478, 1.2)
    M.sailboat(s, 1380, 462, 0.9)
    M.sailboat(s, 1560, 500, 1.3)
    finish(s, "palm")


@city("Muş")
def _mus(s):
    shore(s, "dawn", "#8FB86A", sun=(380, 250, 26), far=(170, 110), snow=0.5, amp=10, clouds=4)
    g = s.yfn
    s.forest(g, 0, W, 26, 34, 58, "poplar", ["#5E9453", "#6FA35F"])
    M.houses(s, 400, 1500, g, 26, seed=67)
    wet(s)
    M.arch_bridge(s, 400, 1520, 446, 26, 12, M.STONE, hump=8, pointed=True, pier=0.3)
    finish(s, "grass", ground="#5E8F4C", flowers=("#E9463B", "#D9252A", "#F06A4E"))


@city("Nevşehir")
def _nevsehir(s):
    backdrop(s, "dawn", sun=(460, 300, 34), far=(70, 40), far_y=420, clouds=3)
    g = s.ridge(440, 44, "#E0C49A", 4, 1.3)
    top, xa, xb = M.crag(s, 1270, g(1270) + 10, 260, 176, "#D9BD95", seed=68, top=0.24, steep=0.8)
    for i in range(18):
        s.rect(1200 + (i * 37) % 130, 300 + (i * 53) % 110, 1204 + (i * 37) % 130, 307 + (i * 53) % 110, M.DARK)
    M.chimneys(s, 220, 1700, g, 18, seed=69)
    s.vband(446, H, [(0, "#E0C49A"), (1, "#B9966A")])
    M.chimneys(s, 60, 520, lambda x: 520, 4, seed=70, hmin=110, hmax=170)
    M.chimneys(s, 1500, 1880, lambda x: 530, 4, seed=71, hmin=110, hmax=170)
    for x, y, r, a, b in ((300, 150, 44, "#D9452F", "#F6C21C"), (620, 230, 26, "#1E5FB8", "#FFFFFF"), (860, 120, 36, "#F08A3C", "#FFF1D0"), (1040, 250, 22, "#D9452F", "#FFFFFF"),
                          (1500, 130, 40, "#1E5FB8", "#F6C21C"), (1720, 240, 28, "#F6C21C", "#D9452F"), (1180, 90, 20, "#B46BC9", "#FFFFFF"), (140, 280, 20, "#F08A3C", "#1E5FB8")):
        M.balloon(s, x, y, r, a, b)
    finish(s, None)


@city("Niğde")
def _nigde(s):
    plain(s, "day", ("#A9BC72", "#7F9652"), sun=(1540, 110), far=(250, 150), snow=0.45, rough=8)
    g = s.yfn
    M.houses(s, 200, 1720, g, 46, seed=72)
    top, xa, xb = M.crag(s, 1060, g(1060) + 10, 340, 110, "#A39480", seed=73, top=0.56)
    M.castle(s, 1090, top + 4, 0.4, M.STONE, towers=3, w=260, h=30, keep=False, flag=False, gate=False)
    M.clock_tower(s, 1000, top + 4, 0.6, M.STONE)
    M.kumbet(s, 680, g(680) + 6, 1.3, M.STONE)
    orchard(s, 20, W - 20, 2, "#5E9A4E", fruit="#D9252A", y0=474, dy=56, h0=46)
    finish(s, "poplar")


@city("Ordu")
def _ordu(s):
    shore(s, "day", "#3F7D4F", sun=(380, 110), far=(90, 0), farc=("#5E9470",), amp=40)
    g = s.yfn
    s.peak(1330, 416, 980, 236, "#3F7D4F", snow=0, p=0.9, shadow=0.16)
    s.forest(lambda x: 412 - 200 * max(0.0, 1 - abs(x - 1330) / 490) ** 0.9, 900, 1780, 70, 20, 36, "tree", ["#2F6B45", "#4F8A52"], sink=60)
    M.houses(s, 100, 1200, lambda x: g(x) + s.rnd.uniform(0, 22), 90, seed=74, sink=2)
    M.towers_city(s, 200, 900, lambda x: 404, 12, seed=75, h=(28, 56))
    M.mosque(s, 520, 410, 0.46, 2)
    M.cable_car(s, 640, 372, 1300, 176, 3)
    wet(s)
    M.boat(s, 520, 470, 1.3)
    M.boat(s, 1100, 500, 1.5, "#2F6FB8")
    finish(s, "tree")


@city("Osmaniye")
def _osmaniye(s):
    plain(s, "gold", ("#8FB86A", "#5E8F4C"), sun=(1540, 160), far=(170, 110), fields=["#8FB86A", "#7FAA5E", "#A5C57A"])
    s.rect(0, 414, W, 430, "#8FB86A")
    g = s.yfn
    M.houses(s, 200, 700, g, 18, seed=76)
    M.houses(s, 1240, 1720, g, 18, seed=77)
    s.peak(960, 432, 600, 124, "#7E8A5E", snow=0, p=0.85, shadow=0.16)
    M.castle(s, 960, 318, 0.8, M.BASALT, towers=6, w=320, h=36, keep=False)
    finish(s, "tree")


@city("Rize")
def _rize(s):
    backdrop(s, "mist", sun=None, far=(190, 130), far_y=330, farc=("#7FA89A", "#5E8C7A"), clouds=5)
    g1 = s.ridge(350, 180, "#3F7D4F", 4, 1.0)
    M.terraces(s, g1, 0, W, rows=12, gap=12)
    top, xa, xb = M.crag(s, 1180, g1(1180) + 30, 240, 110, "#6E7C74", seed=78, top=0.4)
    M.castle(s, 1180, top + 4, 0.42, M.GREY, towers=3, w=220, h=34)
    s.haze(400, 70, "#FFFFFF", 0.5, below=30)
    g2 = s.ridge(470, 120, "#2F6B45", 4, 1.4)
    M.terraces(s, g2, 0, W, rows=14, gap=13, c="#3F8A4C")
    for x in (420, 760, 1380):
        M.chalet(s, x, g2(x) + 20, 1.5)
    finish(s, "pine")


@city("Sakarya")
def _sakarya(s):
    shore(s, "day", "#5E9458", sun=(1540, 110), far=(130, 90), farc=("#7FA88A", "#5E8F70"), amp=40)
    g = s.yfn
    s.forest(g, 0, W, 40, 30, 54, ["tree", "pine"], ["#2F6B45", "#4F8A52"])
    M.houses(s, 200, 1720, g, 40, seed=79)
    wet(s)
    M.arch_bridge(s, 360, 1560, 452, 34, 8, M.STONE, pier=0.34, thick=0.34)
    finish(s, "tree")


@city("Samsun")
def _samsun(s):
    shore(s, "day", "#5E9458", sun=(360, 110), far=(80, 0), farc=("#7FA88A",), amp=60, scale=1.2)
    g = s.yfn
    s.forest(g, 0, W, 30, 24, 44, "tree", ["#2F6B45", "#4F8A52"])
    M.houses(s, 100, 1820, lambda x: g(x) + s.rnd.uniform(0, 30), 110, seed=80, sink=2)
    M.towers_city(s, 300, 1600, lambda x: 404, 18, seed=81, h=(28, 60))
    M.lighthouse(s, 560, 412, 0.72)
    M.statue(s, 1320, 412, 1.4)
    wet(s)
    M.steamer(s, 920, 496, 1.15)
    finish(s, "tree")


@city("Siirt")
def _siirt(s):
    backdrop(s, "gold", sun=(380, 150), far=(150, 100), far_y=390, farc=("#B9A58E", "#A38C72"))
    g = s.ridge(430, 30, "#B7A27A", 3, 1.2)
    M.houses(s, 300, 1640, g, 30, seed=82, walls=("#F1DDB4", "#E6CC9C"), flat=True)
    M.mosque(s, 940, g(940) + 4, 1.0, 4, M.STONE, M.TILE, cap=M.LEAD, tall=0.9)
    M.kumbet(s, 1240, g(1240) + 4, 1.0, M.STONE, roof=M.TILE)
    s.ridge(520, 60, "#9C8760", 4, 1.6)
    s.ridge(590, 50, "#7F6E4E", 4, 2.0)
    finish(s, None)


@city("Sinop")
def _sinop(s):
    shore(s, "day", "#5E9458", sun=(1540, 110), far=(0, 0), amp=44, scale=1.1)
    g = s.yfn
    s.forest(g, 0, W, 30, 24, 44, ["pine", "tree"], ["#2F5E45", "#4F8A52"])
    M.houses(s, 300, 1500, g, 60, seed=83, sink=14)
    M.lighthouse(s, 1640, g(1640) + 2, 0.6)
    M.castle(s, 880, 416, 1.0, M.STONE, towers=7, w=620, h=30, keep=False, flag=False, gate=False)
    wet(s)
    for x, y, k, c in ((420, 470, 1.2, "#C8432F"), (700, 452, 0.9, "#2F6FB8"), (1040, 480, 1.4, "#E8B33B"), (1300, 456, 1.0, "#C8432F"), (1500, 500, 1.5, "#2F6FB8")):
        M.boat(s, x, y, k, c)
    finish(s, "pine")


@city("Sivas")
def _sivas(s):
    plain(s, "gold", ("#C9C07A", "#9FA05A"), sun=(1560, 160), far=(110, 70))
    g = s.yfn
    M.houses(s, 200, 1720, g, 50, seed=84)
    M.twin_minaret_portal(s, 840, g(840) + 6, 1.3, M.STONE, M.BRICK)
    M.twin_minaret_portal(s, 1290, g(1290) + 6, 0.8, M.WHITE, M.TILE, tile="#F4EFE6")
    finish(s, "poplar")


@city("Şanlıurfa")
def _urfa(s):
    plain(s, "dusk", ("#C99A6E", "#7E5A52"), sun=(1500, 320, 32), far=(40, 0), clouds=4, amp=6)
    g = s.yfn
    s.peak(820, 452, 900, 60, "#B98A5E", snow=0, p=0.8, shadow=0.12)
    M.t_pillars(s, 820, 404, 1.25)
    M.beehives(s, 1260, 1620, 430, 7)
    finish(s, None)


@city("Şırnak")
def _sirnak(s):
    backdrop(s, "day", sun=(1540, 110), far=(0, 0), clouds=5)
    s.ridge(410, 280, "#8F8E86", 7, 0.7, snow=410 - 280 * 0.82)
    s.haze(412, 60, "#EAF4FC", 0.3)
    s.ridge(430, 110, "#A39478", 5, 1.5)
    g = s.ridge(470, 60, "#8FA868", 4, 1.2)
    M.stone_town(s, 960, g(960) + 20, 700, 60, M.STONE, seed=85, rows=4)
    M.mosque(s, 1260, g(1260) + 6, 0.5, 1)
    s.forest(g, 0, W, 20, 36, 60, ["tree", "poplar"], ["#4F8A52", "#5E9453"])
    finish(s, "tree")


@city("Tekirdağ")
def _tekirdag(s):
    backdrop(s, "gold", sun=(1500, 170), far=(0, 0), clouds=6)
    s.vband(380, 470, [(0, "#7DAEDA"), (1, "#3F7FB8")])
    s.glints(382, 470, 60, "#FFFFFF", 80)
    M.steamer(s, 500, 410, 0.5)
    g = s.ridge(452, 30, "#7FA35A", 3, 1.2)
    M.houses(s, 500, 1500, g, 40, seed=86)
    M.mosque(s, 1000, g(1000) + 4, 0.62, 2)
    s.forest(g, 100, 1820, 12, 34, 56, ["tree", "poplar"], ["#4F8A52", "#5E9453"])
    s.vband(458, H, [(0, "#7FA35A"), (1, "#5E8A36")])
    s.fields(476, H, ["#6E9A3F", "#5E8A36"], n=60, top=0.3)
    pts = sorted((s.rnd.random() ** 1.2, s.rnd.uniform(0, W)) for _ in range(520))
    for t, x in pts:
        y, r = 480 + t * 160, 2.2 + 7.5 * t
        s.circ(x, y, r, s.rnd.choice(["#F6C21C", "#F9D648", "#EFAE12"]))
        s.circ(x, y, r * 0.42, "#6B4423")
    finish(s, None, shade=0.1)


@city("Tokat")
def _tokat(s):
    backdrop(s, "day", sun=(1540, 110), far=(120, 80), far_y=390, farc=("#8FB09A", "#6F9A80"))
    g = s.ridge(440, 30, "#6F9A62", 3, 1.3)
    top, xa, xb = M.crag(s, 1010, g(1010) + 12, 480, 204, "#8E8478", seed=87, top=0.46, steep=0.6)
    M.castle(s, 1010, top + 4, 0.6, M.STONE, towers=5, w=330, h=30)
    M.konaks(s, 100, 1820, g, 34, seed=88)
    M.clock_tower(s, 640, g(640) + 4, 0.86, M.STONE)
    M.mosque(s, 1380, g(1380) + 4, 0.5, 1)
    s.water(470, "#7FB2DA", "#35699E")
    wet(s)
    M.arch_bridge(s, 1180, 1560, 492, 18, 5, M.STONE, pier=0.3)
    finish(s, "tree")


@city("Trabzon")
def _trabzon(s):
    backdrop(s, "mist", sun=None, far=(210, 140), far_y=380, farc=("#7FA89A", "#4F8062"), clouds=5)
    yl = s.slope([(-12, 250), (300, 330), (640, 440), (900, 500)], "#3F7D4F")
    s.forest(yl, 0, 700, 40, 44, 90, "pine", ["#2F5E45", "#27503C"], sink=30)
    M.cliff_monastery(s, 1040, 500, 1.0)
    s.forest(lambda x: 520, 600, W, 40, 60, 110, "pine", ["#2F5E45", "#27503C", "#356B4E"], sink=40)
    s.haze(300, 60, "#FFFFFF", 0.35, below=40)
    finish(s, "pine")


@city("Tunceli")
def _tunceli(s):
    P, yl, yr = valley(s, "day", "#5E9A5A", "#4F8A52", far=(250, 160), snow=0.4, rough=8, clouds=5)
    s.forest(yl, 0, 780, 30, 34, 70, ["tree", "pine"], ["#3F7A4A", "#2F5E45"], sink=30)
    s.forest(yr, 1150, W, 30, 34, 70, ["tree", "pine"], ["#357045", "#2A5540"], sink=30)
    M.houses(s, 300, 640, lambda x: yl(x) + 20, 8, seed=89, walls=("#E6DCC8",))
    s.flowers(80, 600, 520, 630, 30, ("#F6C21C", "#FFFFFF", "#B46BC9"))
    s.flowers(1320, 1860, 520, 630, 30, ("#F6C21C", "#FFFFFF", "#E9463B"))
    finish(s, None, shade=0.14)


@city("Uşak")
def _usak(s):
    backdrop(s, "gold", sun=(1540, 160), far=(90, 60), far_y=360)
    s.vband(356, H, [(0, "#B9A27A"), (1, "#8E7858")])
    s.poly([(840, 500), (1080, 500), (1240, H), (680, H)], "#7DAEDA")
    for side in (0, 1):
        pts = [(-12, 330), (480, 338), (700, 352), (760, 420), (820, 520), (860, H), (-12, H)]
        pts = [(W - x, y) if side else (x, y) for x, y in pts]
        s.poly(pts, "#C9A77C" if side == 0 else "#B8946C")
        top = [(-12, 318), (480, 326), (700, 342), (710, 356), (480, 344), (-12, 336)]
        s.poly([(W - x, y) if side else (x, y) for x, y in top], "#8FAE6C")
        for y in (380, 420, 470, 530):
            a, b = (0, 760 + (y - 380) * 0.4)
            s.line([(W - a, y) if side else (a, y), (W - b, y + 8) if side else (b, y + 8)], "#A8855E", 1.4)
    s.forest(lambda x: 330, 40, 640, 10, 34, 54, ["tree", "poplar"], ["#4F8A52", "#5E9453"])
    s.forest(lambda x: 330, 1280, 1880, 10, 34, 54, ["tree", "poplar"], ["#4F8A52", "#5E9453"])
    M.arch_bridge(s, 720, 1200, 468, 26, 1, M.STONE, hump=40, thick=0.18, pier=0.06)
    finish(s, None)


@city("Van")
def _van(s):
    shore(s, "day", "#B9B07A", sun=(1540, 110), far=(210, 130), snow=0.5, amp=18)
    g = s.yfn
    top, xa, xb = M.crag(s, 380, 412, 520, 70, "#A8997F", seed=90, top=0.7, steep=0.5)
    ridge_wall(s, lambda x: top, xa + 20, xb - 20, 12, M.STONE, every=70, tw=12)
    wet(s)
    f = M.islet(s, 980, 500, 760, 70, "#9CAF6E", "#B9A88C")
    M.island_church(s, 980, 446, 1.3)
    for x, hh in ((720, 44), (800, 56), (1160, 52), (1240, 40), (1100, 36)):
        s.tree(x, f(x) + 4, hh, "#F4B6CC")
    finish(s, None)


@city("Yalova")
def _yalova(s):
    shore(s, "day", "#4F8A52", sun=(380, 110), far=(110, 0), farc=("#5E9470",), amp=90, scale=1.1)
    g = s.yfn
    s.forest(g, 0, W, 60, 26, 48, ["tree", "pine"], ["#2F6B45", "#3F7A4A", "#4F8A52"], sink=50)
    M.houses(s, 200, 1720, lambda x: 408 - s.rnd.uniform(0, 30), 60, seed=91, sink=2)
    s.rect(0, 406, W, 413, "#D9D2C2")
    s.tree(1070, 412, 130, "#3F7A4A")
    M.kiosk(s, 950, 410, 1.3)
    s.forest(lambda x: 410, 60, 1860, 14, 44, 62, "palm", ["#3F8F4E"])
    wet(s)
    M.ferry(s, 1340, 488, 1.0)
    finish(s, "palm")


@city("Yozgat")
def _yozgat(s):
    backdrop(s, "day", sun=(380, 110), far=(120, 80), far_y=380, farc=("#6E9A7C", "#4F8062"))
    g1 = s.ridge(404, 90, "#3F7355", 4, 1.2)
    s.forest(g1, 0, W, 90, 30, 60, "pine", ["#2F5E45", "#27503C", "#356B4E"], sink=50)
    g = s.ridge(446, 30, "#8FAE6C", 3, 1.3)
    M.houses(s, 200, 1720, g, 54, seed=92)
    M.mosque(s, 1300, g(1300) + 4, 0.56, 2)
    M.clock_tower(s, 960, g(960) + 6, 1.12, M.STONE, style="spire")
    s.vband(450, H, [(0, "#8FAE6C"), (1, "#6E8F52")])
    finish(s, "pine")


@city("Zonguldak")
def _zonguldak(s):
    shore(s, "mist", "#3F7D4F", sun=None, far=(0, 0), amp=120, scale=1.0)
    g = s.yfn
    s.forest(g, 0, W, 60, 24, 44, ["tree", "pine"], ["#2F6B45", "#3F7A4A"], sink=60)
    M.houses(s, 200, 1720, lambda x: 408 - s.rnd.uniform(0, 44), 70, seed=93, sink=2)
    s.rect(640, 400, 1300, 414, "#8E9AA8")
    M.headframe(s, 960, 402, 1.15)
    wet(s)
    s.poly([(1300, 420), (1760, 440), (1760, 448), (1300, 430)], "#8E9AA8")
    M.lighthouse(s, 1760, 442, 0.34, M.WHITE, band="#C8432F")
    M.steamer(s, 520, 500, 1.0, hull="#2B3340", top="#E9E4D8", funnel="#1E5FB8")
    finish(s, "pine")


# ---------------------------------------------------------------- çalıştırma
def provinces(root):
    src = open(os.path.join(root, "data", "tr-locations.ts"), encoding="utf-8").read()
    m = re.search(r"export const provinces: Province\[\] = (\[.*?\]);", src, re.S)
    return json.loads(m.group(1))


def render(name):
    s = Scene(zlib.crc32(name.encode("utf-8")))
    CITIES[name](s)
    return s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--sheet", default="")
    args = ap.parse_args()
    root = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
    provs = provinces(root)
    names = [p["name"] for p in provs if p["name"] != "İstanbul"]
    missing = [n for n in names if n not in CITIES]
    extra = [n for n in CITIES if n not in names]
    if missing or extra:
        print("EKSİK:", missing, "FAZLA:", extra)
        if not args.only:
            sys.exit(1)
    todo = [n for n in names if n in CITIES and (not args.only or n in args.only.split(","))]
    if args.sheet:
        cols = 3
        tw, th = 640, 214
        sheet = Image.new("RGB", (tw * cols, th * math.ceil(len(todo) / cols)), "white")
        for i, n in enumerate(todo):
            sheet.paste(render(n).im.convert("RGB").resize((tw, th), Image.LANCZOS), ((i % cols) * tw, (i // cols) * th))
            print("ok", n, flush=True)
        sheet.save(args.sheet, quality=88)
        return
    out = os.path.join(root, "public", "city-covers")
    os.makedirs(out, exist_ok=True)
    slug = {p["name"]: p["slug"] for p in provs}
    for n in todo:
        render(n).save(os.path.join(out, slug[n] + ".webp"))
        print("ok", n, flush=True)
    if not args.only:
        entries = [
            {
                "city": n,
                "url": f"{BASE_URL}/{slug[n]}.webp?v={VERSION}",
                "sourceUrl": f"{BASE_URL}/{slug[n]}.webp",
                "title": f"{n} — OrtakSat özgün il kapağı",
                "artist": "OrtakSat",
                "license": "OrtakSat özgün çalışması (tüm hakları OrtakSat'a aittir)",
            }
            for n in names
        ]
        manifest = {"generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"), "source": "OrtakSat özgün üretim (scripts/city-covers/generate.py)", "entries": entries}
        with open(os.path.join(root, "data", "city-cover-manifest.json"), "w", encoding="utf-8", newline="\n") as fh:
            json.dump(manifest, fh, ensure_ascii=False, indent=2)
            fh.write("\n")
        print("manifest:", len(entries))


if __name__ == "__main__":
    main()

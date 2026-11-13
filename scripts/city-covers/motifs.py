# -*- coding: utf-8 -*-
"""OrtakSat il kapakları — yapı ve simge çizimleri (hepsi temel şekillerden, özgün)."""
import math
import random

from engine import darken, lighten, mix

STONE = dict(l="#F6E9D0", m="#E2CCA4", d="#BC9F73")
WHITE = dict(l="#FFFFFF", m="#F4EFE6", d="#CFC8BA")
HONEY = dict(l="#F9DFAC", m="#E8BC76", d="#BC884B")
BASALT = dict(l="#6C7280", m="#494E5A", d="#2D313A")
BRICK = dict(l="#E3A07E", m="#C46E50", d="#914937")
GREY = dict(l="#D9DDE2", m="#B3B9C2", d="#808793")
LEAD = dict(l="#AEC0D3", m="#7C93AD", d="#566D88")
ROOF = dict(l="#E89068", m="#CB6342", d="#9E472E")
WOOD = dict(l="#B58E6C", m="#8C6748", d="#5F422D")
TILE = dict(l="#6FB7C9", m="#3F8FA8", d="#2C6C84")
GOLD = "#E9B949"
DARK = "#33291F"
FLAG = "#D6262B"


def block(s, x0, y0, x1, y1, m, sh=0.3):
    s.rect(x0, y0, x1, y1, m["m"])
    if sh:
        s.rect(x1 - (x1 - x0) * sh, y0, x1, y1, m["d"])


def cren(s, x0, x1, y, m, cw=5.0, ch=5.0, key="m"):
    x, i = x0, 0
    while x < x1 - 0.5:
        if i % 2 == 0:
            s.rect(x, y - ch, min(x + cw, x1), y + 0.5, m[key])
        x += cw
        i += 1


def arch(s, cx, by, w, h, c, pointed=False):
    """Kemerli açıklık (kapı/pencere)."""
    if pointed:
        s.poly([(cx - w / 2, by), (cx - w / 2, by - h * 0.55), (cx, by - h), (cx + w / 2, by - h * 0.55), (cx + w / 2, by)], c)
    else:
        s.rect(cx - w / 2, by - h + w / 2, cx + w / 2, by, c)
        s.circ(cx, by - h + w / 2, w / 2, c)


def windows(s, x0, y0, x1, y1, nx, ny, c=DARK, arched=False, w=None, h=None):
    cw = (x1 - x0) / nx
    chh = (y1 - y0) / ny
    w = w or cw * 0.42
    h = h or chh * 0.6
    for i in range(nx):
        for j in range(ny):
            cx = x0 + cw * (i + 0.5)
            by = y0 + chh * (j + 0.5) + h / 2
            if arched:
                arch(s, cx, by, w, h, c)
            else:
                s.rect(cx - w / 2, by - h, cx + w / 2, by, c)


def dome(s, cx, by, rx, ry, m=LEAD, finial=True):
    s.half(cx, by, rx, ry, m["d"])
    s.half(cx - rx * 0.1, by, rx * 0.88, ry * 0.95, m["m"])
    s.half(cx - rx * 0.34, by, rx * 0.46, ry * 0.74, m["l"])
    if finial:
        s.line([(cx, by - ry), (cx, by - ry - max(4.0, ry * 0.3))], GOLD, 0.9)
        s.circ(cx, by - ry - max(4.0, ry * 0.3), max(1.1, ry * 0.05), GOLD)


def minaret(s, x, by, h, m=STONE, w=None, bal=1, cap=LEAD, flute=False, bands=None, lean=0.0):
    w = w or max(3.2, h * 0.055)

    def X(px, py):
        return (px + lean * (by - py), py)

    top = by - h * 0.86
    s.poly([X(x - w / 2, by), X(x - w / 2, top), X(x + w / 2, top), X(x + w / 2, by)], m["m"])
    s.poly([X(x + w * 0.12, by), X(x + w * 0.12, top), X(x + w / 2, top), X(x + w / 2, by)], m["d"])
    if flute:
        for i in (-0.3, -0.05):
            s.line([X(x + i * w, by), X(x + i * w, top)], m["l"], 0.5)
    if bands:
        for t in (0.2, 0.34, 0.48):
            yb = by - h * t
            s.poly([X(x - w / 2, yb), X(x - w / 2, yb - h * 0.035), X(x + w / 2, yb - h * 0.035), X(x + w / 2, yb)], bands)
    for i in range(bal):
        yb = by - h * (0.66 + (0.13 * (i - (bal - 1))))
        s.poly([X(x - w * 0.95, yb), X(x - w * 0.95, yb - h * 0.022), X(x + w * 0.95, yb - h * 0.022), X(x + w * 0.95, yb)], m["l"])
        s.poly([X(x - w * 0.72, yb + h * 0.014), X(x - w * 0.95, yb), X(x + w * 0.95, yb), X(x + w * 0.72, yb + h * 0.014)], m["d"])
    s.poly([X(x - w * 0.62, top), X(x, by - h), X(x + w * 0.62, top)], cap["m"])
    s.poly([X(x + w * 0.1, top), X(x, by - h), X(x + w * 0.62, top)], cap["d"])
    s.line([X(x, by - h), X(x, by - h * 1.035)], GOLD, 0.8)


def mosque(s, cx, by, k=1.0, mins=2, m=STONE, dm=LEAD, tall=1.0, multi=0, cap=None):
    """Klasik kubbeli cami. multi>0: çok kubbeli (ulu cami) düzen."""
    cap = cap or dm
    bw, bh = 150 * k, 44 * k
    spots = {0: [], 1: [0.62], 2: [-0.62, 0.62], 4: [-0.64, -0.4, 0.4, 0.64], 6: [-0.98, -0.64, -0.42, 0.42, 0.64, 0.98]}[mins]
    for t in spots:
        hh = 158 * k * tall * (0.8 if abs(t) > 0.9 else 1.0)
        minaret(s, cx + t * bw, by, hh, m, bal=2 if hh > 110 else 1, cap=cap)
    block(s, cx - bw / 2, by - bh, cx + bw / 2, by, m, 0.22)
    s.rect(cx - bw / 2 - 2 * k, by - bh - 3 * k, cx + bw / 2 + 2 * k, by - bh, m["l"])
    windows(s, cx - bw / 2 + 6 * k, by - bh + 8 * k, cx + bw / 2 - 6 * k, by - 4 * k, 7, 1, DARK, True, 7 * k, 20 * k)
    if multi:
        n = multi
        for i in range(n):
            dome(s, cx - bw / 2 + bw * (i + 0.5) / n, by - bh - 3 * k, bw / n * 0.46, bw / n * 0.42, dm, finial=(i == n // 2))
        return
    block(s, cx - bw * 0.36, by - bh - 22 * k, cx + bw * 0.36, by - bh - 3 * k, m, 0.22)
    for sx in (-1, 1):
        dome(s, cx + sx * bw * 0.4, by - bh - 3 * k, 14 * k, 12 * k, dm, False)
        dome(s, cx + sx * bw * 0.25, by - bh - 22 * k, 20 * k, 17 * k, dm, False)
    block(s, cx - bw * 0.22, by - bh - 34 * k, cx + bw * 0.22, by - bh - 22 * k, m, 0.22)
    windows(s, cx - bw * 0.2, by - bh - 33 * k, cx + bw * 0.2, by - bh - 23 * k, 6, 1, DARK, False, 3 * k, 6 * k)
    dome(s, cx, by - bh - 34 * k, 36 * k, 31 * k, dm)


def castle(s, cx, by, k=1.0, m=STONE, towers=4, w=260.0, h=44.0, keep=True, flag=True, round_t=False, gate=True):
    w, h = w * k, h * k
    x0, x1 = cx - w / 2, cx + w / 2
    if keep:
        kw, kh, kx = 44 * k, h * 2.0, cx + w * 0.1
        block(s, kx - kw / 2, by - kh, kx + kw / 2, by, m, 0.32)
        cren(s, kx - kw / 2 - 2 * k, kx + kw / 2 + 2 * k, by - kh, m, 5 * k, 5 * k)
        windows(s, kx - kw / 2 + 4 * k, by - kh + 8 * k, kx + kw / 2 - 4 * k, by - h - 4 * k, 2, 2, DARK, True, 4.4 * k, 9 * k)
        if flag:
            s.line([(kx, by - kh), (kx, by - kh - 26 * k)], "#5B5148", 1.0 * k)
            s.poly([(kx, by - kh - 26 * k), (kx + 17 * k, by - kh - 22 * k), (kx, by - kh - 16 * k)], FLAG)
    s.rect(x0, by - h, x1, by, m["m"])
    s.rect(x0, by - h * 0.3, x1, by, mix(m["m"], m["d"], 0.5))
    cren(s, x0, x1, by - h, m, 5 * k, 5 * k)
    for i in range(towers):
        tx = x0 + w * (i / (towers - 1)) if towers > 1 else cx
        tw, th = 22 * k, h * (1.5 if i in (0, towers - 1) else 1.32)
        block(s, tx - tw / 2, by - th, tx + tw / 2, by, m, 0.36)
        if round_t:
            s.rect(tx - tw / 2, by - th, tx - tw * 0.3, by, m["l"])
        cren(s, tx - tw / 2 - 1.6 * k, tx + tw / 2 + 1.6 * k, by - th, m, 4.2 * k, 5 * k)
        s.rect(tx - 1.2 * k, by - th * 0.7, tx + 1.2 * k, by - th * 0.52, DARK)
    if gate:
        arch(s, cx - w * 0.16, by, 15 * k, 26 * k, DARK)


def crag(s, cx, by, w, h, c, seed=1, steep=0.55, top=0.42, strata=True):
    """Dik kayalık tepe; (düzlük y, x0, x1) döndürür."""
    r = random.Random(seed)
    L, n = [], 7
    for i in range(n + 1):
        t = i / n
        L.append((cx - w / 2 + (w * (1 - top) / 2) * t + r.uniform(-w * 0.018, w * 0.018), by - h * (t ** steep) + (r.uniform(-h * 0.035, h * 0.035) if 0 < i < n else 0)))
    R = []
    for i in range(n + 1):
        t = i / n
        R.append((cx + w / 2 - (w * (1 - top) / 2) * t + r.uniform(-w * 0.018, w * 0.018), by - h * (t ** (steep * 1.15)) + (r.uniform(-h * 0.035, h * 0.035) if 0 < i < n else 0)))
    s.poly(L + R[::-1], c)
    s.poly([(cx + w * top * 0.1, by - h * 0.98)] + R[::-1] + [(cx + w * 0.16, by)], darken(c, 0.2))
    s.poly([L[2], L[5], (cx - w * top * 0.25, by - h * 0.7), (cx - w * 0.2, by - h * 0.2)], lighten(c, 0.1))
    if strata:
        for t in (0.3, 0.55, 0.78):
            yy = by - h * t
            s.line([(cx - w * 0.3 * (1.3 - t), yy), (cx + w * 0.05, yy + h * 0.02), (cx + w * 0.3 * (1.3 - t), yy - h * 0.01)], darken(c, 0.14), 1.0)
    return by - h, cx - w * top / 2, cx + w * top / 2


def arch_bridge(s, x0, x1, by, h, n, m=STONE, hump=0.0, pointed=False, pier=0.2, thick=0.3, big=None):
    """Taş kemer köprü. big: ortadaki kemerin yan kemerlere oranı (tek büyük göz için)."""
    L = s.layer()
    span = x1 - x0

    def ytop(x):
        return by - h - hump * math.sin(math.pi * (x - x0) / span)

    top = [(x0 + span * i / 40, ytop(x0 + span * i / 40)) for i in range(41)]
    L.poly([(x0 - h * 0.6, by)] + top + [(x1 + h * 0.6, by)], m["m"])
    L.poly([(x0 - h * 0.6, by), (x0, ytop(x0)), (x0 + 2, by)], m["m"])
    widths = [1.0] * n
    if big and n >= 3:
        widths[n // 2] = big
    tot = sum(widths)
    xa = x0 + span * 0.02
    usable = span * 0.96
    for i in range(n):
        seg = usable * widths[i] / tot
        a0, a1 = xa + seg * pier / 2, xa + seg * (1 - pier / 2)
        mid = (a0 + a1) / 2
        ah = (by - ytop(mid)) * (1 - thick)
        if pointed:
            L.poly([(a0 - 2, by), (a0 - 2, by - ah * 0.5), (mid, by - ah - 3), (a1 + 2, by - ah * 0.5), (a1 + 2, by)], m["d"])
            L.erase_poly([(a0, by + 1), (a0, by - ah * 0.5), (mid, by - ah), (a1, by - ah * 0.5), (a1, by + 1)])
        else:
            L.ell(a0 - 2.5, by - ah - 2.5, a1 + 2.5, by + ah + 2.5, m["d"])
            L.erase_ell(a0, by - ah, a1, by + ah)
        xa += seg
    L.erase_rect(x0 - h, by, x1 + h, by + h * 3)
    L.line(top, m["l"], 1.6)
    s.put(L)


def suspension(s, x0, x1, by, th, c="#8E9AA8", deck="#5F6B7A"):
    span = x1 - x0
    t0, t1 = x0 + span * 0.24, x0 + span * 0.76
    dy = by - th * 0.3
    for tx in (t0, t1):
        s.rect(tx - 3.2, by - th, tx - 1.2, by, c)
        s.rect(tx + 1.2, by - th, tx + 3.2, by, darken(c, 0.2))
        for t in (0.25, 0.55, 0.85):
            s.rect(tx - 3.2, by - th * t - 1.2, tx + 3.2, by - th * t + 1.2, c)

    def cable(xa, ya, xb, yb, sag):
        return [(xa + (xb - xa) * i / 30, ya + (yb - ya) * i / 30 + sag * 4 * (i / 30) * (1 - i / 30)) for i in range(31)]

    main = cable(t0, by - th, t1, by - th, th * 0.62)
    for pts in (main, cable(x0, dy, t0, by - th, th * 0.08), cable(t1, by - th, x1, dy, th * 0.08)):
        s.line(pts, c, 1.3)
    for px, py in main[1:-1]:
        s.line([(px, py), (px, dy)], lighten(c, 0.15), 0.5)
    s.rect(x0, dy - 1.8, x1, dy + 1.8, deck)
    s.line([(x0, dy - 1.8), (x1, dy - 1.8)], lighten(deck, 0.4), 0.7)


def clock_tower(s, cx, by, k=1.0, m=STONE, cap=LEAD, style="dome", h=170.0):
    h *= k
    w0, w1 = 34 * k, 26 * k
    y1 = by - h * 0.3
    y2 = by - h * 0.68
    y3 = by - h * 0.84
    block(s, cx - w0 / 2, y1, cx + w0 / 2, by, m, 0.3)
    arch(s, cx - w0 * 0.08, by, w0 * 0.34, h * 0.16, DARK)
    s.rect(cx - w0 / 2 - 2 * k, y1 - 3 * k, cx + w0 / 2 + 2 * k, y1, m["l"])
    block(s, cx - w1 / 2, y2, cx + w1 / 2, y1 - 3 * k, m, 0.3)
    arch(s, cx - w1 * 0.08, y1 - h * 0.08, w1 * 0.3, h * 0.14, DARK)
    s.rect(cx - w0 / 2, y2 - 3 * k, cx + w0 / 2, y2, m["l"])
    block(s, cx - w0 * 0.46, y3, cx + w0 * 0.46, y2 - 3 * k, m, 0.3)
    r = w0 * 0.3
    cy = (y3 + y2 - 3 * k) / 2
    s.circ(cx - w0 * 0.05, cy, r, "#FFFFFF")
    s.circ(cx - w0 * 0.05, cy, r * 0.82, "#FBF6E9")
    s.line([(cx - w0 * 0.05, cy), (cx - w0 * 0.05, cy - r * 0.62)], DARK, 0.9 * k)
    s.line([(cx - w0 * 0.05, cy), (cx - w0 * 0.05 + r * 0.42, cy + r * 0.14)], DARK, 0.9 * k)
    s.rect(cx - w0 / 2 - 2 * k, y3 - 3 * k, cx + w0 / 2 + 2 * k, y3, m["l"])
    if style == "dome":
        for sx in (-1, 1):
            s.rect(cx + sx * w1 * 0.36 - 1.2 * k, y3 - h * 0.1, cx + sx * w1 * 0.36 + 1.2 * k, y3 - 3 * k, m["m"])
        s.rect(cx - w1 * 0.46, y3 - h * 0.11, cx + w1 * 0.46, y3 - h * 0.095, m["l"])
        dome(s, cx, y3 - h * 0.11, w1 * 0.44, h * 0.07, cap)
    elif style == "spire":
        s.poly([(cx - w1 * 0.5, y3 - 3 * k), (cx, by - h * 1.06), (cx + w1 * 0.5, y3 - 3 * k)], cap["m"])
        s.poly([(cx + w1 * 0.06, y3 - 3 * k), (cx, by - h * 1.06), (cx + w1 * 0.5, y3 - 3 * k)], cap["d"])
        s.line([(cx, by - h * 1.06), (cx, by - h * 1.12)], GOLD, 0.9)
    else:  # balkonlu, minare biçimli ince kule
        s.rect(cx - w1 * 0.3, y3 - h * 0.12, cx + w1 * 0.3, y3 - 3 * k, m["m"])
        s.rect(cx - w1 * 0.55, y3 - h * 0.05, cx + w1 * 0.55, y3 - h * 0.035, m["l"])
        s.poly([(cx - w1 * 0.36, y3 - h * 0.12), (cx, by - h * 1.08), (cx + w1 * 0.36, y3 - h * 0.12)], cap["m"])


def chimneys(s, x0, x1, yfn, n, seed=3, hmin=46, hmax=120, m=None):
    m = m or dict(l="#F5E4C8", m="#E4C8A0", d="#BE9C72")
    r = random.Random(seed)
    items = sorted(((r.uniform(x0, x1), r.uniform(hmin, hmax)) for _ in range(n)), key=lambda t: t[1], reverse=True)
    for x, h in items:
        by = yfn(x) + 4
        w = h * r.uniform(0.3, 0.4)
        s.poly([(x - w / 2, by), (x - w * 0.24, by - h * 0.8), (x + w * 0.24, by - h * 0.8), (x + w / 2, by)], m["m"])
        s.poly([(x + w * 0.04, by), (x + w * 0.05, by - h * 0.8), (x + w * 0.24, by - h * 0.8), (x + w / 2, by)], m["d"])
        s.poly([(x - w * 0.32, by - h * 0.78), (x - w * 0.06, by - h), (x + w * 0.06, by - h), (x + w * 0.32, by - h * 0.78)], "#9A7D62")
        s.poly([(x + w * 0.02, by - h * 0.78), (x + w * 0.02, by - h), (x + w * 0.06, by - h), (x + w * 0.32, by - h * 0.78)], "#7B624C")
        if h > 70:
            for j in range(r.randint(1, 3)):
                wy = by - h * r.uniform(0.2, 0.6)
                s.rect(x - w * 0.14 + j * 3, wy - 5, x - w * 0.14 + j * 3 + 3, wy, DARK)


def balloon(s, x, y, r, c1, c2):
    s.poly([(x - r * 0.62, y + r * 0.62), (x + r * 0.62, y + r * 0.62), (x + r * 0.16, y + r * 1.28), (x - r * 0.16, y + r * 1.28)], c1)
    s.ell(x - r, y - r, x + r, y + r * 1.05, c1)
    s.ell(x - r * 0.62, y - r, x + r * 0.62, y + r * 1.12, c2)
    s.ell(x - r * 0.26, y - r, x + r * 0.26, y + r * 1.16, c1)
    s.rect(x - r * 0.13, y + r * 1.42, x + r * 0.13, y + r * 1.62, "#7A5638")
    s.line([(x - r * 0.15, y + r * 1.28), (x - r * 0.12, y + r * 1.42)], "#5B4634", 0.5)
    s.line([(x + r * 0.15, y + r * 1.28), (x + r * 0.12, y + r * 1.42)], "#5B4634", 0.5)


def travertine(s, x0, x1, y0, y1, steps=7, seed=5):
    r = random.Random(seed)
    for i in range(steps):
        yt = y0 + (y1 - y0) * i / steps
        yb = y0 + (y1 - y0) * (i + 1) / steps
        xi0 = x0 - (x1 - x0) * 0.05 * i + r.uniform(-12, 12)
        xi1 = x1 + (x1 - x0) * 0.05 * i + r.uniform(-12, 12)
        s.rect(xi0, yt, xi1, yb + 2, "#F7FAFC" if i % 2 == 0 else "#E6EEF4")
        x = xi0
        while x < xi1:
            rw = r.uniform(26, 58)
            s.ell(x, yt - 5, x + rw, yt + 9, "#FFFFFF")
            s.ell(x + 3, yt - 3, x + rw - 3, yt + 5, "#7DCBEF")
            s.ell(x + 7, yt - 2, x + rw * 0.6, yt + 2, "#B5E3F8")
            for _ in range(3):
                dx = x + r.uniform(4, rw - 4)
                s.line([(dx, yt + 8), (dx, min(yb + 1, yt + r.uniform(12, 22)))], "#C9D8E3", 0.9)
            x += rw * 0.92


def columns(s, cx, by, k=1.0, n=5, m=WHITE, h=120.0, ped=False, heights=None, gap=30.0, beam=True):
    h, gap = h * k, gap * k
    w = 11 * k
    x0 = cx - gap * (n - 1) / 2
    s.rect(x0 - 18 * k, by - 6 * k, x0 + gap * (n - 1) + 18 * k, by, m["d"])
    s.rect(x0 - 12 * k, by - 11 * k, x0 + gap * (n - 1) + 12 * k, by - 6 * k, m["m"])
    hs = heights or [1.0] * n
    for i in range(n):
        x, hh = x0 + gap * i, h * hs[i]
        s.rect(x - w / 2, by - 11 * k - hh, x + w / 2, by - 11 * k, m["l"])
        s.rect(x + w * 0.14, by - 11 * k - hh, x + w / 2, by - 11 * k, m["d"])
        s.line([(x - w * 0.18, by - 11 * k - hh), (x - w * 0.18, by - 11 * k)], m["m"], 0.6)
        if hs[i] >= 0.99:
            s.rect(x - w * 0.8, by - 11 * k - hh - 4 * k, x + w * 0.8, by - 11 * k - hh, m["m"])
        s.rect(x - w * 0.75, by - 14 * k, x + w * 0.75, by - 11 * k, m["m"])
    full = [i for i in range(n) if hs[i] >= 0.99]
    if beam and len(full) >= 2:
        run = [full[0]]
        best = run
        for i in full[1:]:
            run = run + [i] if i == run[-1] + 1 else [i]
            if len(run) > len(best):
                best = run
        if len(best) >= 2:
            xa, xb = x0 + gap * best[0] - w, x0 + gap * best[-1] + w
            s.rect(xa, by - 11 * k - h - 15 * k, xb, by - 11 * k - h - 4 * k, m["m"])
            s.rect(xa, by - 11 * k - h - 15 * k, xb, by - 11 * k - h - 12 * k, m["l"])
            if ped:
                s.poly([(xa - 3 * k, by - 11 * k - h - 15 * k), ((xa + xb) / 2, by - 11 * k - h - 15 * k - (xb - xa) * 0.17), (xb + 3 * k, by - 11 * k - h - 15 * k)], m["m"])


def trojan_horse(s, cx, by, k=1.0, m=WOOD):
    def X(v):
        return cx + v * k

    for lx in (-34, -20, 14, 28):
        s.poly([(X(lx), by), (X(lx + 3), by - 46 * k), (X(lx + 11), by - 46 * k), (X(lx + 8), by)], m["d"] if lx in (-20, 28) else m["m"])
    s.rect(X(-46), by - 4 * k, X(44), by, m["d"])
    for wx in (-36, 34):
        s.circ(X(wx), by - 1 * k, 6 * k, "#4A3523")
    s.ell(X(-42), by - 78 * k, X(40), by - 38 * k, m["m"])
    s.rect(X(-30), by - 76 * k, X(30), by - 44 * k, m["m"])
    for i in range(6):
        s.line([(X(-36 + i * 13), by - 74 * k), (X(-36 + i * 13), by - 42 * k)], m["d"], 0.8 * k)
    s.rect(X(-26), by - 98 * k, X(12), by - 74 * k, m["l"])
    s.poly([(X(-32), by - 96 * k), (X(-7), by - 114 * k), (X(18), by - 96 * k)], m["d"])
    windows(s, X(-22), by - 94 * k, X(8), by - 78 * k, 3, 1, DARK)
    s.poly([(X(22), by - 66 * k), (X(40), by - 60 * k), (X(64), by - 112 * k), (X(46), by - 118 * k)], m["m"])
    s.poly([(X(44), by - 122 * k), (X(66), by - 118 * k), (X(86), by - 94 * k), (X(78), by - 86 * k), (X(58), by - 100 * k)], m["l"])
    s.poly([(X(46), by - 122 * k), (X(50), by - 136 * k), (X(56), by - 120 * k)], m["d"])
    s.poly([(X(26), by - 70 * k), (X(46), by - 120 * k), (X(40), by - 122 * k), (X(18), by - 76 * k)], "#4A3523")
    s.poly([(X(-42), by - 62 * k), (X(-56), by - 30 * k), (X(-50), by - 28 * k), (X(-38), by - 54 * k)], "#4A3523")


def monument(s, cx, by, k=1.0, m=STONE):
    """Dört ayaklı anıt (Çanakkale Şehitler Abidesi biçimi)."""
    w, h = 78 * k, 124 * k
    s.rect(cx - w * 0.9, by - 8 * k, cx + w * 0.9, by, m["d"])
    s.rect(cx - w * 0.72, by - 14 * k, cx + w * 0.72, by - 8 * k, m["m"])
    for t, mm in ((-0.42, "m"), (-0.14, "d"), (0.14, "m"), (0.42, "d")):
        if abs(t) < 0.2:
            s.rect(cx + t * w - 5 * k, by - h, cx + t * w + 5 * k, by - 14 * k, m["d"])
    for t in (-0.42, 0.42):
        block(s, cx + t * w - 9 * k, by - h, cx + t * w + 9 * k, by - 14 * k, m, 0.36)
    s.rect(cx - w * 0.6, by - h - 18 * k, cx + w * 0.6, by - h, m["m"])
    s.rect(cx - w * 0.6, by - h - 18 * k, cx + w * 0.6, by - h - 14 * k, m["l"])
    s.rect(cx + w * 0.3, by - h - 14 * k, cx + w * 0.6, by - h, m["d"])


def lighthouse(s, cx, by, k=1.0, m=WHITE, band=None, lit=True):
    h, w = 120 * k, 26 * k
    s.poly([(cx - w / 2, by), (cx - w * 0.32, by - h), (cx + w * 0.32, by - h), (cx + w / 2, by)], m["m"])
    s.poly([(cx + w * 0.1, by), (cx + w * 0.08, by - h), (cx + w * 0.32, by - h), (cx + w / 2, by)], m["d"])
    if band:
        for t in (0.25, 0.6):
            ww = w * (0.5 - 0.18 * t)
            s.poly([(cx - ww, by - h * t), (cx - ww + 1.2, by - h * (t + 0.14)), (cx + ww - 1.2, by - h * (t + 0.14)), (cx + ww, by - h * t)], band)
    s.rect(cx - w * 0.5, by - h - 3 * k, cx + w * 0.5, by - h, "#3B4250")
    s.rect(cx - w * 0.24, by - h - 16 * k, cx + w * 0.24, by - h - 3 * k, "#FFE9A6" if lit else "#C9D8E3")
    s.poly([(cx - w * 0.34, by - h - 16 * k), (cx, by - h - 28 * k), (cx + w * 0.34, by - h - 16 * k)], "#3B4250")
    s.rect(cx - 2 * k, by - 18 * k, cx + 2 * k, by, DARK)
    if lit:
        s.glow(cx, by - h - 10 * k, 50 * k, "#FFF2B8", 0.75, 2.0)
    block(s, cx + w * 0.7, by - 24 * k, cx + w * 0.7 + 40 * k, by, m, 0.3)
    s.poly([(cx + w * 0.7 - 3 * k, by - 24 * k), (cx + w * 0.7 + 20 * k, by - 36 * k), (cx + w * 0.7 + 43 * k, by - 24 * k)], ROOF["m"])


def anitkabir(s, cx, by, k=1.0, m=STONE):
    w, h = 190 * k, 62 * k
    for i, ww in enumerate((1.25, 1.12)):
        s.rect(cx - w * ww / 2, by - 6 * k * (i + 1), cx + w * ww / 2, by - 6 * k * i, m["d"] if i == 0 else m["m"])
    by2 = by - 12 * k
    s.rect(cx - w / 2 + 6 * k, by2 - h, cx + w / 2 - 6 * k, by2, mix(m["d"], DARK, 0.45))
    n = 10
    for i in range(n):
        x = cx - w / 2 + 8 * k + (w - 16 * k) * i / (n - 1)
        s.rect(x - 4.4 * k, by2 - h, x + 4.4 * k, by2, m["l"])
        s.rect(x + 1.2 * k, by2 - h, x + 4.4 * k, by2, m["d"])
    s.rect(cx - w / 2 - 4 * k, by2 - h - 16 * k, cx + w / 2 + 4 * k, by2 - h, m["m"])
    s.rect(cx - w / 2 - 4 * k, by2 - h - 16 * k, cx + w / 2 + 4 * k, by2 - h - 12 * k, m["l"])


def needle_tower(s, cx, by, k=1.0, c="#B9C4D1"):
    h = 190 * k
    s.rect(cx - 4 * k, by - h * 0.74, cx + 4 * k, by, c)
    s.rect(cx + 1 * k, by - h * 0.74, cx + 4 * k, by, darken(c, 0.2))
    s.ell(cx - 26 * k, by - h * 0.86, cx + 26 * k, by - h * 0.68, lighten(c, 0.25))
    s.ell(cx - 26 * k, by - h * 0.8, cx + 26 * k, by - h * 0.7, "#4A6FA5")
    s.half(cx, by - h * 0.82, 15 * k, 10 * k, c)
    s.line([(cx, by - h * 0.86), (cx, by - h)], c, 1.4 * k)


def terraces(s, yfn, x0, x1, rows=9, gap=11.0, c="#4F9A52", depth=None):
    """Çay bahçesi sıraları: tepe hattını izleyen açık renkli şeritler."""
    xs = [x0 + (x1 - x0) * i / 60 for i in range(61)]
    for r_ in range(rows):
        off = 8 + r_ * gap
        pts = [(x, yfn(x) + off + 3 * math.sin(x * 0.02 + r_)) for x in xs]
        s.line(pts, lighten(c, 0.22) if r_ % 2 == 0 else c, 3.4 + r_ * 0.25)


def cliff_monastery(s, cx, by, k=1.0, rock="#8C8F8A"):
    """Yalçın kayaya yaslanmış manastır (Sümela biçimi)."""
    w, h = 300 * k, 300 * k
    s.poly([(cx - w * 0.6, by + 40), (cx - w * 0.5, by - h * 0.7), (cx - w * 0.3, by - h), (cx + w * 0.1, by - h * 1.06), (cx + w * 0.45, by - h * 0.86), (cx + w * 0.62, by - h * 0.4), (cx + w * 0.7, by + 40)], rock)
    s.poly([(cx + w * 0.1, by - h * 1.06), (cx + w * 0.45, by - h * 0.86), (cx + w * 0.62, by - h * 0.4), (cx + w * 0.7, by + 40), (cx + w * 0.3, by + 40), (cx + w * 0.22, by - h * 0.5)], darken(rock, 0.2))
    for t in (-0.3, -0.05, 0.16):
        s.line([(cx + w * t, by - h * 0.95), (cx + w * (t - 0.06), by - h * 0.5), (cx + w * (t - 0.02), by)], darken(rock, 0.12), 1.4)
    fy = by - h * 0.36
    block(s, cx - w * 0.34, fy - 60 * k, cx + w * 0.12, fy, WHITE, 0.2)
    windows(s, cx - w * 0.32, fy - 56 * k, cx + w * 0.1, fy - 4 * k, 9, 4, DARK, False, 4.6 * k, 7 * k)
    s.poly([(cx - w * 0.36, fy - 60 * k), (cx - w * 0.3, fy - 70 * k), (cx + w * 0.1, fy - 70 * k), (cx + w * 0.14, fy - 60 * k)], ROOF["m"])
    block(s, cx + w * 0.12, fy - 40 * k, cx + w * 0.28, fy, STONE, 0.3)
    windows(s, cx + w * 0.13, fy - 36 * k, cx + w * 0.27, fy - 6 * k, 3, 2, DARK, True, 4.4 * k, 8 * k)
    arch_bridge(s, cx - w * 0.36, cx - w * 0.02, fy + 34 * k, 30 * k, 6, STONE, pier=0.3, thick=0.2)
    s.rect(cx - w * 0.36, fy, cx + w * 0.28, fy + 5 * k, STONE["d"])


def konak(s, x, by, w, h, wall="#FBF7EE", wood="#6E4D36", roof=ROOF, floors=2):
    """Ahşap çıkmalı eski ev."""
    g = h * 0.34
    s.rect(x - w * 0.42, by - g, x + w * 0.42, by, "#DCCBAC")
    s.rect(x + w * 0.2, by - g, x + w * 0.42, by, "#BFAE90")
    s.rect(x - w * 0.06, by - g * 0.72, x + w * 0.06, by, wood)
    s.rect(x - w / 2, by - h, x + w / 2, by - g, wall)
    s.rect(x + w * 0.26, by - h, x + w / 2, by - g, darken(wall, 0.13))
    s.rect(x - w / 2, by - g - 1.6, x + w / 2, by - g + 1.2, wood)
    nx = max(2, int(w / 11))
    for f in range(floors - 1 if floors > 1 else 1):
        y0 = by - h + (h - g) * f / max(1, floors - 1) + (h - g) * 0.12
        windows(s, x - w / 2 + 2, y0, x + w / 2 - 2, y0 + (h - g) / max(1, floors - 1) * 0.7, nx, 1, wood, False, w / nx * 0.44)
    s.poly([(x - w * 0.6, by - h), (x - w * 0.34, by - h - h * 0.24), (x + w * 0.34, by - h - h * 0.24), (x + w * 0.6, by - h)], roof["m"])
    s.poly([(x + w * 0.12, by - h), (x + w * 0.2, by - h - h * 0.24), (x + w * 0.34, by - h - h * 0.24), (x + w * 0.6, by - h)], roof["d"])


def konaks(s, x0, x1, yfn, n, seed=7, w=(26, 40), h=(34, 52), walls=("#FBF7EE", "#F4EEDF", "#FFFDF6"), roof=ROOF):
    r = random.Random(seed)
    items = sorted((yfn(x) + r.uniform(0, 4), x) for x in (r.uniform(x0, x1) for _ in range(n)))
    for y, x in items:
        konak(s, x, y, r.uniform(*w), r.uniform(*h), r.choice(walls), roof=roof, floors=r.choice((2, 2, 3)))


def houses(s, x0, x1, yfn, n, seed=9, walls=("#F7F1E4", "#EFE6D2", "#FFFFFF"), roofs=("#CB6342", "#B9553A", "#D97A55"), w=(14, 26), h=(12, 24), flat=False, sink=6.0):
    """Küçük ev kümeleri (uzaktaki yerleşim)."""
    r = random.Random(seed)
    items = sorted((yfn(x) + r.uniform(0, sink), x) for x in (r.uniform(x0, x1) for _ in range(n)))
    for y, x in items:
        ww, hh = r.uniform(*w), r.uniform(*h)
        wall = r.choice(walls)
        s.rect(x - ww / 2, y - hh, x + ww / 2, y, wall)
        s.rect(x + ww * 0.2, y - hh, x + ww / 2, y, darken(wall, 0.14))
        if not flat:
            rc = r.choice(roofs)
            s.poly([(x - ww * 0.58, y - hh), (x - ww * 0.2, y - hh - ww * 0.3), (x + ww * 0.2, y - hh - ww * 0.3), (x + ww * 0.58, y - hh)], rc)
        if hh > 15:
            windows(s, x - ww / 2 + 1, y - hh + 2, x + ww / 2 - 1, y - 2, 2, 2 if hh > 19 else 1, "#5A4A3C", False, 2.2, 3.2)
        else:
            s.rect(x - 1.2, y - hh * 0.6, x + 1.2, y - hh * 0.3, "#5A4A3C")


def towers_city(s, x0, x1, yfn, n, seed=11, cols_=("#DCE6F0", "#C8D6E4", "#EDF2F7", "#B8C9DA"), h=(30, 80)):
    """Çağdaş kent silueti (yüksek binalar)."""
    r = random.Random(seed)
    for x in sorted(r.uniform(x0, x1) for _ in range(n)):
        ww, hh = r.uniform(12, 24), r.uniform(*h)
        c = r.choice(cols_)
        y = yfn(x) + 4
        s.rect(x - ww / 2, y - hh, x + ww / 2, y, c)
        s.rect(x + ww * 0.2, y - hh, x + ww / 2, y, darken(c, 0.12))
        for j in range(int(hh / 7)):
            s.rect(x - ww / 2 + 2, y - hh + 3 + j * 7, x + ww * 0.14, y - hh + 5 + j * 7, darken(c, 0.3))


def stone_town(s, cx, by, w, h, m=HONEY, seed=13, rows=6):
    """Yamaca basamak basamak dizilen taş evler (Mardin dokusu)."""
    r = random.Random(seed)
    for row in range(rows - 1, -1, -1):
        t = row / (rows - 1)
        y = by - h * t
        span = w * (1 - 0.55 * t)
        x = cx - span / 2
        while x < cx + span / 2:
            ww, hh = r.uniform(26, 50), r.uniform(16, 28)
            c = dict(m) if r.random() < 0.6 else dict(l=m["l"], m=mix(m["m"], m["l"], 0.4), d=m["m"])
            block(s, x, y - hh, x + ww, y + 6, c, 0.26)
            s.rect(x - 1, y - hh - 2, x + ww + 1, y - hh, m["l"])
            k = max(1, int(ww / 13))
            for i in range(k):
                arch(s, x + ww * (i + 0.5) / k, y - 1, 5.2, 11, "#7A5230")
            if r.random() < 0.14:
                dome(s, x + ww / 2, y - hh - 2, ww * 0.3, ww * 0.24, m, False)
            x += ww + r.uniform(-2, 5)


def t_pillars(s, cx, by, k=1.0, m=STONE):
    """Halka düzeninde T biçimli dikilitaşlar (Göbeklitepe)."""
    s.ell(cx - 150 * k, by - 22 * k, cx + 150 * k, by + 26 * k, m["d"])
    s.ell(cx - 136 * k, by - 15 * k, cx + 136 * k, by + 19 * k, mix(m["d"], "#8A6E4C", 0.55))
    spots = [(-118, -4, 0.6), (-78, -15, 0.56), (-30, -20, 0.52), (30, -20, 0.52), (78, -15, 0.56), (118, -4, 0.6), (-36, 6, 1.0), (40, 6, 1.0)]
    for dx, dy, sc in spots:
        x, y, hh, ww = cx + dx * k, by + dy * k, 78 * k * sc, 13 * k * sc
        s.rect(x - ww / 2, y - hh, x + ww / 2, y, m["m"])
        s.rect(x + ww * 0.1, y - hh, x + ww / 2, y, m["d"])
        s.rect(x - ww * 1.25, y - hh - ww * 0.9, x + ww * 1.25, y - hh, m["l"])
        s.rect(x + ww * 0.3, y - hh - ww * 0.9, x + ww * 1.25, y - hh, m["m"])


def beehives(s, x0, x1, by, n, m=HONEY):
    """Kümbet damlı kerpiç evler (Harran)."""
    w = (x1 - x0) / n
    for i in range(n):
        x = x0 + w * (i + 0.5)
        hh = w * (1.5 + 0.2 * math.sin(i * 2.1))
        s.rect(x - w * 0.5, by - w * 0.5, x + w * 0.5, by, m["m"])
        pts = [(x - w * 0.5, by - w * 0.5)] + [(x - w * 0.5 * (1 - t) ** 0.6, by - w * 0.5 - (hh - w * 0.5) * t) for t in (0.3, 0.6, 0.85, 1.0)]
        pts += [(x + w * 0.5 * (1 - t) ** 0.6, by - w * 0.5 - (hh - w * 0.5) * t) for t in (0.85, 0.6, 0.3)] + [(x + w * 0.5, by - w * 0.5)]
        s.poly(pts, m["m"])
        s.poly([(x + w * 0.08, by)] + pts[len(pts) // 2:] + [(x + w * 0.5, by)], m["d"])
        arch(s, x - w * 0.1, by, w * 0.26, w * 0.5, "#5E3F22")


def nemrut(s, cx, by, k=1.0):
    """Çakıl tümsek ve önünde taş başlar (Nemrut)."""
    w, h = 380 * k, 150 * k
    s.poly([(cx - w / 2, by), (cx - w * 0.1, by - h * 0.94), (cx, by - h), (cx + w * 0.1, by - h * 0.94), (cx + w / 2, by)], "#CFC3B2")
    s.poly([(cx, by - h), (cx + w * 0.1, by - h * 0.94), (cx + w / 2, by), (cx + w * 0.1, by)], "#A99C8A")
    for i, dx in enumerate((-150, -92, -34, 30, 92, 150)):
        x, sc = cx + dx * k, (1.0, 0.86, 1.08, 1.0, 0.86, 1.0)[i] * k
        s.rect(x - 14 * sc, by - 6, x + 14 * sc, by + 6, "#9E8E78")
        s.ell(x - 13 * sc, by - 38 * sc, x + 13 * sc, by, STONE["m"])
        s.ell(x + 1 * sc, by - 36 * sc, x + 13 * sc, by - 2, STONE["d"])
        if i in (1, 4):
            s.poly([(x - 5 * sc, by - 22 * sc), (x - 20 * sc, by - 16 * sc), (x - 4 * sc, by - 12 * sc)], STONE["d"])
        else:
            s.poly([(x - 12 * sc, by - 32 * sc), (x, by - 62 * sc), (x + 12 * sc, by - 32 * sc)], STONE["m"])
            s.poly([(x + 1 * sc, by - 32 * sc), (x, by - 62 * sc), (x + 12 * sc, by - 32 * sc)], STONE["d"])
        s.rect(x - 6 * sc, by - 22 * sc, x - 2 * sc, by - 19 * sc, DARK)


def palace(s, cx, by, k=1.0, m=HONEY):
    """Kubbeli, çizgili minareli sınır sarayı (İshak Paşa biçimi)."""
    w, h = 250 * k, 46 * k
    block(s, cx - w / 2, by - h, cx + w / 2, by, m, 0.2)
    s.rect(cx - w / 2 - 2, by - h - 3 * k, cx + w / 2 + 2, by - h, m["l"])
    windows(s, cx - w / 2 + 8 * k, by - h + 8 * k, cx + w / 2 - 8 * k, by - 8 * k, 11, 1, "#7A5230", True, 6 * k, 16 * k)
    block(s, cx - w * 0.2, by - h - 22 * k, cx + w * 0.12, by - h - 3 * k, m, 0.3)
    block(s, cx - w * 0.5, by - h - 34 * k, cx - w * 0.38, by - h - 3 * k, m, 0.3)
    arch(s, cx - w * 0.44, by, 15 * k, 40 * k, "#7A5230", True)
    s.rect(cx - w * 0.09, by - h - 36 * k, cx + w * 0.03, by - h - 22 * k, m["m"])
    dome(s, cx - w * 0.03, by - h - 36 * k, 21 * k, 22 * k, dict(l="#F3E3C0", m="#D8BC8A", d="#AE8C5C"))
    minaret(s, cx + w * 0.22, by - h, 118 * k, m, w=8 * k, bands="#B5613E", cap=dict(m="#B5613E", d="#8C4630", l="#D58564"))


def island_church(s, cx, by, k=1.0, m=None):
    """Konik külahlı ada kilisesi (Akdamar biçimi)."""
    m = m or dict(l="#E9B78C", m="#CE9366", d="#A46E48")
    block(s, cx - 34 * k, by - 40 * k, cx + 34 * k, by, m, 0.3)
    block(s, cx - 58 * k, by - 28 * k, cx - 34 * k, by, m, 0.0)
    s.poly([(cx - 60 * k, by - 28 * k), (cx - 46 * k, by - 40 * k), (cx - 32 * k, by - 28 * k)], m["d"])
    s.poly([(cx - 38 * k, by - 40 * k), (cx, by - 58 * k), (cx + 38 * k, by - 40 * k)], m["d"])
    block(s, cx - 15 * k, by - 80 * k, cx + 15 * k, by - 46 * k, m, 0.34)
    windows(s, cx - 13 * k, by - 76 * k, cx + 8 * k, by - 54 * k, 3, 1, DARK, True, 3 * k, 12 * k)
    s.poly([(cx - 18 * k, by - 80 * k), (cx, by - 112 * k), (cx + 18 * k, by - 80 * k)], m["m"])
    s.poly([(cx + 2 * k, by - 80 * k), (cx, by - 112 * k), (cx + 18 * k, by - 80 * k)], m["d"])
    arch(s, cx - 8 * k, by, 9 * k, 18 * k, DARK)


def kumbet(s, cx, by, k=1.0, m=STONE, roof=None):
    """Selçuklu kümbeti: silindir gövde, konik külah."""
    roof = roof or m
    w, h = 40 * k, 62 * k
    block(s, cx - w * 0.62, by - 12 * k, cx + w * 0.62, by, m, 0.3)
    block(s, cx - w / 2, by - h, cx + w / 2, by - 12 * k, m, 0.36)
    s.rect(cx - w / 2, by - h, cx - w * 0.3, by - 12 * k, m["l"])
    s.rect(cx - w * 0.54, by - h - 4 * k, cx + w * 0.54, by - h, m["l"])
    s.rect(cx - w / 2, by - h * 0.62, cx + w / 2, by - h * 0.57, m["d"])
    arch(s, cx - w * 0.06, by - 12 * k, 9 * k, 20 * k, DARK, True)
    s.poly([(cx - w * 0.56, by - h - 4 * k), (cx, by - h - 44 * k), (cx + w * 0.56, by - h - 4 * k)], roof["m"])
    s.poly([(cx + w * 0.06, by - h - 4 * k), (cx, by - h - 44 * k), (cx + w * 0.56, by - h - 4 * k)], roof["d"])


def twin_minaret_portal(s, cx, by, k=1.0, m=STONE, mm=BRICK, tile="#3F8FA8"):
    """Çifte minareli taç kapı."""
    w, h = 84 * k, 96 * k
    block(s, cx - w * 1.5, by - h * 0.56, cx + w * 1.5, by, m, 0.14)
    cren(s, cx - w * 1.5, cx + w * 1.5, by - h * 0.56, m, 6 * k, 4 * k)
    for sx in (-1, 1):
        minaret(s, cx + sx * w * 0.36, by - h, 124 * k, mm, w=11 * k, flute=True, bands=tile, cap=dict(m=mm["d"], d=darken(mm["d"], 0.2), l=mm["m"]))
    block(s, cx - w / 2, by - h, cx + w / 2, by, m, 0.16)
    s.rect(cx - w / 2 - 2 * k, by - h - 3 * k, cx + w / 2 + 2 * k, by - h, m["l"])
    arch(s, cx, by, w * 0.56, h * 0.82, m["d"], True)
    arch(s, cx, by, w * 0.34, h * 0.58, DARK, True)
    for sx in (-1, 1):
        block(s, cx + sx * w * 1.5 - 9 * k, by - h * 0.7, cx + sx * w * 1.5 + 9 * k, by, m, 0.4)


def ruin_church(s, cx, by, k=1.0, m=None):
    """Yarı yıkık kubbe kasnaklı taş kilise (Ani)."""
    m = m or dict(l="#D9A688", m="#B98162", d="#8B5B43")
    block(s, cx - 46 * k, by - 62 * k, cx + 46 * k, by, m, 0.3)
    s.poly([(cx - 50 * k, by - 62 * k), (cx, by - 88 * k), (cx + 50 * k, by - 62 * k)], m["m"])
    s.poly([(cx + 4 * k, by - 62 * k), (cx, by - 88 * k), (cx + 50 * k, by - 62 * k)], m["d"])
    s.poly([(cx - 17 * k, by - 80 * k), (cx - 17 * k, by - 128 * k), (cx - 6 * k, by - 134 * k), (cx + 4 * k, by - 116 * k), (cx + 12 * k, by - 108 * k), (cx + 17 * k, by - 80 * k)], m["m"])
    s.poly([(cx + 4 * k, by - 116 * k), (cx + 12 * k, by - 108 * k), (cx + 17 * k, by - 80 * k), (cx + 5 * k, by - 80 * k)], m["d"])
    windows(s, cx - 15 * k, by - 124 * k, cx + 3 * k, by - 98 * k, 2, 1, DARK, True, 3.6 * k, 16 * k)
    for dx in (-28, 0, 26):
        arch(s, cx + dx * k, by - 14 * k, 6 * k, 30 * k, DARK)
    arch(s, cx - 2 * k, by, 12 * k, 22 * k, DARK)


def pumpjack(s, cx, by, k=1.0, c="#2C3340", acc="#D84F3A"):
    s.rect(cx - 44 * k, by - 4 * k, cx + 40 * k, by, c)
    s.poly([(cx - 12 * k, by - 4 * k), (cx - 2 * k, by - 58 * k), (cx + 2 * k, by - 58 * k), (cx + 12 * k, by - 4 * k), (cx + 7 * k, by - 4 * k), (cx, by - 44 * k), (cx - 7 * k, by - 4 * k)], c)
    s.line([(cx - 48 * k, by - 50 * k), (cx + 42 * k, by - 66 * k)], acc, 4.4 * k)
    s.poly([(cx + 40 * k, by - 80 * k), (cx + 54 * k, by - 68 * k), (cx + 48 * k, by - 46 * k), (cx + 38 * k, by - 54 * k)], acc)
    s.line([(cx + 50 * k, by - 50 * k), (cx + 50 * k, by - 4 * k)], c, 1.0 * k)
    s.circ(cx - 38 * k, by - 22 * k, 13 * k, c)
    s.line([(cx - 46 * k, by - 50 * k), (cx - 38 * k, by - 22 * k)], c, 2.2 * k)
    s.rect(cx - 52 * k, by - 18 * k, cx - 26 * k, by - 4 * k, c)


def headframe(s, cx, by, k=1.0, c="#3A4350"):
    """Maden kuyu kulesi."""
    h = 130 * k
    for sx in (-1, 1):
        s.line([(cx + sx * 20 * k, by), (cx + sx * 9 * k, by - h)], c, 3 * k)
    for i in range(5):
        y0, y1 = by - h * i / 5, by - h * (i + 1) / 5
        w0, w1 = 20 * k - 11 * k * i / 5, 20 * k - 11 * k * (i + 1) / 5
        s.line([(cx - w0, y0), (cx + w1, y1)], c, 1.3 * k)
        s.line([(cx + w0, y0), (cx - w1, y1)], c, 1.3 * k)
        s.line([(cx - w1, y1), (cx + w1, y1)], c, 1.6 * k)
    s.line([(cx + 9 * k, by - h), (cx + 86 * k, by)], c, 3 * k)
    s.line([(cx + 30 * k, by - h * 0.72), (cx + 14 * k, by - h * 0.45)], c, 1.4 * k)
    s.rect(cx - 16 * k, by - h - 5 * k, cx + 16 * k, by - h, c)
    for sx in (-1, 1):
        s.circ(cx + sx * 9 * k, by - h - 14 * k, 11 * k, c)
        s.circ(cx + sx * 9 * k, by - h - 14 * k, 7 * k, "#8E9AA8")
        s.circ(cx + sx * 9 * k, by - h - 14 * k, 2 * k, c)
    block(s, cx - 70 * k, by - 34 * k, cx - 24 * k, by, BRICK, 0.3)
    s.poly([(cx - 74 * k, by - 34 * k), (cx - 47 * k, by - 50 * k), (cx - 20 * k, by - 34 * k)], "#5A6270")
    windows(s, cx - 66 * k, by - 28 * k, cx - 28 * k, by - 10 * k, 3, 1, DARK, True, 6 * k, 14 * k)


def cable_car(s, x0, y0, x1, y1, n=3, c="#3F4854", cab="#E74C3C"):
    pts = [(x0 + (x1 - x0) * i / 24, y0 + (y1 - y0) * i / 24 + 14 * 4 * (i / 24) * (1 - i / 24)) for i in range(25)]
    s.line(pts, c, 0.9)
    for j in range(n):
        px, py = pts[int(24 * (j + 0.8) / (n + 0.6))]
        s.line([(px, py), (px, py + 8)], c, 0.8)
        s.rect(px - 7, py + 8, px + 7, py + 20, cab)
        s.rect(px - 5.4, py + 10, px + 5.4, py + 15, "#DDEFFB")
    for px, py in (pts[0], pts[-1]):
        s.rect(px - 1.6, py, px + 1.6, py + 26, c)


def steamer(s, cx, by, k=1.0, hull="#2B3340", top="#F6F1E6", funnel="#C8432F"):
    s.poly([(cx - 78 * k, by - 16 * k), (cx + 84 * k, by - 16 * k), (cx + 66 * k, by + 2 * k), (cx - 66 * k, by + 2 * k)], hull)
    s.rect(cx - 70 * k, by - 18 * k, cx + 76 * k, by - 15 * k, "#C8432F")
    s.rect(cx - 44 * k, by - 30 * k, cx + 40 * k, by - 18 * k, top)
    windows(s, cx - 42 * k, by - 28 * k, cx + 38 * k, by - 20 * k, 10, 1, "#2B3340", False, 3 * k, 4 * k)
    s.rect(cx - 20 * k, by - 40 * k, cx + 14 * k, by - 30 * k, top)
    s.rect(cx - 8 * k, by - 62 * k, cx + 4 * k, by - 40 * k, funnel)
    s.rect(cx - 8 * k, by - 62 * k, cx + 4 * k, by - 56 * k, "#22272F")
    for mx in (-56, 54):
        s.line([(cx + mx * k, by - 16 * k), (cx + mx * k, by - 70 * k)], "#5B5148", 1.0 * k)
    L = s.layer()
    for i in range(6):
        L.circ(cx - 2 * k - i * 15 * k, by - 70 * k - i * 7 * k, (6 + i * 3.4) * k, "#FFFFFF", 150 - i * 20)
    s.put(L, blur=2.0)


def sailboat(s, cx, by, k=1.0, hull="#FFFFFF", sail="#FFFFFF"):
    s.poly([(cx - 22 * k, by - 6 * k), (cx + 24 * k, by - 6 * k), (cx + 16 * k, by + 1 * k), (cx - 16 * k, by + 1 * k)], hull)
    s.line([(cx, by - 6 * k), (cx, by - 56 * k)], "#6B5A45", 0.9 * k)
    s.poly([(cx + 2 * k, by - 54 * k), (cx + 2 * k, by - 10 * k), (cx + 24 * k, by - 10 * k)], sail)
    s.poly([(cx - 2 * k, by - 48 * k), (cx - 2 * k, by - 10 * k), (cx - 18 * k, by - 10 * k)], darken(sail, 0.08))


def boat(s, cx, by, k=1.0, hull="#C8432F", cabin="#FFFFFF"):
    s.poly([(cx - 20 * k, by - 7 * k), (cx + 24 * k, by - 8 * k), (cx + 16 * k, by + 1 * k), (cx - 15 * k, by + 1 * k)], hull)
    s.rect(cx - 8 * k, by - 15 * k, cx + 5 * k, by - 7 * k, cabin)
    s.line([(cx + 8 * k, by - 8 * k), (cx + 8 * k, by - 24 * k)], "#5B5148", 0.8 * k)


def ferry(s, cx, by, k=1.0):
    s.poly([(cx - 60 * k, by - 12 * k), (cx + 64 * k, by - 12 * k), (cx + 54 * k, by + 1 * k), (cx - 54 * k, by + 1 * k)], "#FFFFFF")
    s.rect(cx - 56 * k, by - 13 * k, cx + 60 * k, by - 10.5 * k, "#1E5FB8")
    s.rect(cx - 46 * k, by - 24 * k, cx + 44 * k, by - 13 * k, "#F3F6FA")
    windows(s, cx - 44 * k, by - 22 * k, cx + 42 * k, by - 15 * k, 12, 1, "#2B4A75", False, 4 * k, 4 * k)
    s.rect(cx - 22 * k, by - 32 * k, cx + 18 * k, by - 24 * k, "#F3F6FA")
    s.rect(cx - 4 * k, by - 42 * k, cx + 6 * k, by - 32 * k, "#E8B33B")


def windmill(s, cx, by, k=1.0):
    w, h = 30 * k, 46 * k
    s.poly([(cx - w / 2, by), (cx - w * 0.4, by - h), (cx + w * 0.4, by - h), (cx + w / 2, by)], "#FFFFFF")
    s.poly([(cx + w * 0.12, by), (cx + w * 0.1, by - h), (cx + w * 0.4, by - h), (cx + w / 2, by)], "#D8D2C6")
    s.poly([(cx - w * 0.5, by - h), (cx, by - h - 20 * k), (cx + w * 0.5, by - h)], "#8A6B4B")
    arch(s, cx - w * 0.08, by, 6 * k, 13 * k, DARK)
    hx, hy = cx - w * 0.3, by - h - 4 * k
    for i in range(8):
        a = i * math.pi / 4 + 0.2
        ex, ey = hx + math.cos(a) * 34 * k, hy + math.sin(a) * 34 * k
        s.line([(hx, hy), (ex, ey)], "#6B5A45", 0.8 * k)
        a2 = a + math.pi / 4
        s.poly([(hx + math.cos(a) * 12 * k, hy + math.sin(a) * 12 * k), (ex, ey), (hx + math.cos(a2) * 22 * k, hy + math.sin(a2) * 22 * k)], "#F7F3EA")


def waterfall(s, cx, y0, y1, w, a=235):
    L = s.layer()
    L.poly([(cx - w * 0.36, y0), (cx + w * 0.36, y0), (cx + w * 0.56, y1), (cx - w * 0.56, y1)], "#FFFFFF", a)
    for i in range(7):
        x = cx - w * 0.4 + w * 0.8 * i / 6
        L.line([(x, y0 + 4), (x + (x - cx) * 0.3, y1 - 2)], "#CFE6F5", max(0.8, w * 0.03), 220)
    s.put(L)
    L = s.layer()
    for i in range(9):
        L.circ(cx + (i - 4) * w * 0.2, y1 + 2, w * 0.24, "#FFFFFF", 150)
    s.put(L, blur=3.0)


def caravanserai(s, cx, by, k=1.0, m=HONEY):
    w, h = 300 * k, 50 * k
    block(s, cx - w / 2, by - h, cx + w / 2, by, m, 0.12)
    s.rect(cx - w / 2, by - h - 2.5 * k, cx + w / 2, by - h, m["l"])
    for i in range(7):
        x = cx - w / 2 + w * i / 6
        if i != 3:
            block(s, x - 9 * k, by - h * 1.1, x + 9 * k, by, m, 0.4)
    block(s, cx - 30 * k, by - h * 1.5, cx + 30 * k, by, m, 0.16)
    s.rect(cx - 32 * k, by - h * 1.5 - 3 * k, cx + 32 * k, by - h * 1.5, m["l"])
    arch(s, cx, by, 34 * k, h * 1.26, m["d"], True)
    arch(s, cx, by, 20 * k, h * 0.9, "#5E3F22", True)


def islet(s, cx, by, w, h, c="#5E8F5A", rock="#9A8F7E", seed=4):
    r = random.Random(seed)
    pts = [(cx - w / 2, by)] + [(cx - w / 2 + w * t, by - h * math.sin(math.pi * t) ** 0.7 * (0.85 + 0.15 * r.random())) for t in [i / 12 for i in range(1, 12)]] + [(cx + w / 2, by)]
    s.poly(pts, c)
    s.poly([(cx - w / 2, by), (cx - w * 0.44, by - h * 0.16), (cx + w * 0.44, by - h * 0.16), (cx + w / 2, by)], rock)
    return lambda x: by - h * max(0.0, math.sin(math.pi * min(1, max(0, (x - (cx - w / 2)) / w)))) ** 0.7 * 0.9


def statue(s, cx, by, k=1.0, c="#4B5563"):
    """Kaide üzerinde anıt (şahlanan at ve binicisi, sade siluet)."""
    block(s, cx - 16 * k, by - 40 * k, cx + 16 * k, by, STONE, 0.3)
    s.rect(cx - 20 * k, by - 6 * k, cx + 20 * k, by, STONE["d"])
    s.ell(cx - 18 * k, by - 66 * k, cx + 14 * k, by - 48 * k, c)
    s.line([(cx - 12 * k, by - 54 * k), (cx - 14 * k, by - 40 * k)], c, 3 * k)
    s.line([(cx - 4 * k, by - 54 * k), (cx - 6 * k, by - 40 * k)], c, 3 * k)
    s.line([(cx + 8 * k, by - 58 * k), (cx + 20 * k, by - 68 * k), (cx + 18 * k, by - 58 * k)], c, 3 * k)
    s.poly([(cx + 6 * k, by - 62 * k), (cx + 16 * k, by - 84 * k), (cx + 26 * k, by - 78 * k), (cx + 22 * k, by - 74 * k), (cx + 14 * k, by - 58 * k)], c)
    s.rect(cx - 6 * k, by - 80 * k, cx, by - 62 * k, c)
    s.circ(cx - 3 * k, by - 84 * k, 4 * k, c)
    s.line([(cx - 18 * k, by - 60 * k), (cx - 26 * k, by - 50 * k)], c, 2 * k)


def chalet(s, x, by, k=1.0):
    """Ahşap yayla evi."""
    w, h = 36 * k, 20 * k
    s.rect(x - w / 2, by - h * 0.4, x + w / 2, by, "#B9B4AA")
    s.rect(x - w / 2, by - h, x + w / 2, by - h * 0.4, WOOD["m"])
    s.rect(x + w * 0.2, by - h, x + w / 2, by, WOOD["d"])
    s.poly([(x - w * 0.64, by - h), (x, by - h - 17 * k), (x + w * 0.64, by - h)], "#5A4636")
    s.poly([(x + w * 0.04, by - h), (x, by - h - 17 * k), (x + w * 0.64, by - h)], "#44352A")
    windows(s, x - w * 0.4, by - h * 0.92, x + w * 0.16, by - h * 0.5, 2, 1, "#2B2118", False, 4 * k, 5 * k)


def tombstones(s, x0, x1, by, n, seed=6, m=None):
    """Uzun, ince Selçuklu mezar taşları (Ahlat)."""
    m = m or dict(l="#C98F74", m="#A86E55", d="#7E4E3C")
    r = random.Random(seed)
    for x in sorted(r.uniform(x0, x1) for _ in range(n)):
        hh, ww = r.uniform(28, 54), r.uniform(7, 10)
        ln = r.uniform(-0.06, 0.06)
        s.poly([(x - ww / 2, by), (x - ww / 2 + ln * hh, by - hh), (x + ww / 2 + ln * hh, by - hh), (x + ww / 2, by)], m["m"])
        s.poly([(x + ww * 0.1, by), (x + ww * 0.1 + ln * hh, by - hh), (x + ww / 2 + ln * hh, by - hh), (x + ww / 2, by)], m["d"])
        s.rect(x - ww / 2 + ln * hh - 1, by - hh - 2, x + ww / 2 + ln * hh + 1, by - hh, m["l"])


def flamingos(s, x0, x1, by, n, seed=8):
    r = random.Random(seed)
    for x in sorted(r.uniform(x0, x1) for _ in range(n)):
        k = r.uniform(0.8, 1.2)
        y = by + r.uniform(-4, 6)
        s.line([(x, y), (x, y - 13 * k)], "#E58AA0", 0.8)
        s.ell(x - 6 * k, y - 20 * k, x + 6 * k, y - 12 * k, "#F6A9BB")
        s.line([(x + 4 * k, y - 17 * k), (x + 8 * k, y - 27 * k), (x + 11 * k, y - 24 * k)], "#F6A9BB", 1.3)


def gate_stones(s, cx, by, k=1.0, m=GREY):
    """İki yanında aslan yontulu taş kapı (Hattuşa)."""
    for sx in (-1, 1):
        s.poly([(cx + sx * 44 * k, by), (cx + sx * 40 * k, by - 62 * k), (cx + sx * 22 * k, by - 66 * k), (cx + sx * 12 * k, by - 40 * k), (cx + sx * 14 * k, by)], m["m"] if sx < 0 else m["d"])
        s.ell(cx + sx * 24 * k - 7 * k, by - 50 * k, cx + sx * 24 * k + 7 * k, by - 34 * k, m["l"])
        s.rect(cx + sx * 24 * k - 2 * k, by - 42 * k, cx + sx * 24 * k + 2 * k, by - 39 * k, DARK)
    for i in range(7):
        s.rect(cx - 110 * k + i * 32 * k, by - 16 * k - (i % 2) * 5 * k, cx - 82 * k + i * 32 * k, by, m["m"] if i % 2 else m["d"])


def kiosk(s, cx, by, k=1.0):
    """İki katlı beyaz ahşap köşk."""
    w, h = 70 * k, 46 * k
    block(s, cx - w / 2, by - h, cx + w / 2, by, WHITE, 0.24)
    s.rect(cx - w / 2 - 3 * k, by - h * 0.52, cx + w / 2 + 3 * k, by - h * 0.47, WHITE["d"])
    windows(s, cx - w / 2 + 3 * k, by - h * 0.95, cx + w / 2 - 3 * k, by - h * 0.56, 5, 1, "#36507A", False, 6 * k, 13 * k)
    windows(s, cx - w / 2 + 3 * k, by - h * 0.44, cx + w / 2 - 3 * k, by - h * 0.04, 5, 1, "#36507A", False, 6 * k, 13 * k)
    s.poly([(cx - w * 0.62, by - h), (cx - w * 0.3, by - h - 16 * k), (cx + w * 0.3, by - h - 16 * k), (cx + w * 0.62, by - h)], "#B9553A")

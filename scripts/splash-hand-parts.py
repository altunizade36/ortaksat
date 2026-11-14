# -*- coding: utf-8 -*-
"""Açılış animasyonunun el parçalarını hazırlar (assets/splash/hand-left.png, hand-right.png).

Kullanım (depo kökünden):  python scripts/splash-hand-parts.py <ham-sol.png> <ham-sağ.png> [kenar-piksel]
Ham parçalar: elin kendisi + çevresinde beyaz kenar çizgisi, 512×512, logo ile AYNI tuvalde.

Ham parçalardaki üç kusuru giderir (ölçüm: assets/brand-head-blue.png ile karşılaştırma):
  1. Kenar çizgisi özgün logodakinin ~2 katı kalındı → eller birleşince özgün logoya geçişte çizgi "inceliyordu".
     Çizgi, elin gövdesine KENAR pikselden yakın olan kısımla sınırlanır.
  2. Çizgi saf beyazdı; özgün logoda orası SAYDAM bir boşluktur (zemin görünür). Açılış zemini #E5F0FF olduğu
     için çizgi o renge boyanır: zeminde görünmez, halkanın üstünde özgün logodaki boşlukla aynı durur.
  3. Halkadan kalma kırıntılar (sağ elin yanındaki koyu leke, çizginin dışındaki mavimsi saçak) silinir.
"""
import sys
import cv2
import numpy as np

EDGE = float(sys.argv[3]) if len(sys.argv) > 3 else 5.5  # kenar çizgisi kalınlığı (512 tuvalde piksel)
MIN_AREA = 300  # gövde sayılacak en küçük parça (en küçük parmak boğumu 555 piksel; silinen kırıntı 88)
BACKGROUND = (255, 240, 229)  # #E5F0FF — BGR; components/intro-splash.tsx → BACKGROUND ile AYNI

def read(path):
    return cv2.imdecode(np.fromfile(path, dtype=np.uint8), cv2.IMREAD_UNCHANGED)

def build(raw):
    alpha = raw[:, :, 3].astype(np.float32) / 255.0
    color = raw[:, :, :3].astype(np.float32)
    opaque = alpha > 0.5
    whitish = color.min(axis=2) > 200
    # Gövde: beyaz olmayan, yeterince büyük bağlı parçalar (beyaz çizgi kırıntıları gövdeden ayırır).
    count, labels, stats, _ = cv2.connectedComponentsWithStats((opaque & ~whitish).astype(np.uint8), 8)
    core = np.zeros(alpha.shape, np.uint8)
    for i in range(1, count):
        if stats[i, cv2.CC_STAT_AREA] >= MIN_AREA:
            core[labels == i] = 1
    # Gövdeye uzaklık (piksel): çizgi yalnız EDGE içinde kalır, kenarı 1 piksel yumuşatılır.
    distance = cv2.distanceTransform(1 - core, cv2.DIST_L2, 5)
    edge_alpha = np.clip(EDGE + 0.5 - distance, 0, 1)
    core_soft = np.where(core > 0, alpha, 0.0)  # gövdenin kendi yumuşak kenarı
    # Gövde kenarındaki karışık (yarı beyaz) pikseller gövde renginde kalsın diye renk, gövde içinden taşırılır.
    inner = cv2.inpaint(raw[:, :, :3], ((core == 0) * 255).astype(np.uint8), 3, cv2.INPAINT_TELEA).astype(np.float32)
    body_alpha = np.clip(cv2.GaussianBlur(core.astype(np.float32), (0, 0), 0.7) * 1.15, 0, 1)
    body_alpha = np.maximum(body_alpha * (distance < 1.5), core_soft)
    out_alpha = np.maximum(edge_alpha, body_alpha)
    bg = np.empty_like(color); bg[:] = BACKGROUND
    out_color = inner * body_alpha[:, :, None] + bg * (1 - body_alpha[:, :, None])
    return np.dstack([np.clip(out_color, 0, 255), out_alpha * 255]).astype(np.uint8)

def main():
    for src, dst in ((sys.argv[1], "assets/splash/hand-left.png"), (sys.argv[2], "assets/splash/hand-right.png")):
        raw = read(src)
        assert raw is not None and raw.shape == (512, 512, 4), src
        ok, data = cv2.imencode(".png", build(raw), [cv2.IMWRITE_PNG_COMPRESSION, 9])
        assert ok
        data.tofile(dst)
        print("ok", dst)

if __name__ == "__main__":
    main()

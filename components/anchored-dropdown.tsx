import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import type { ViewStyle } from "react-native";

import { colors } from "@/components/colors";

export type AnchorRect = { x: number; y: number; width: number; height: number };

/**
 * Tetikleyicinin ekrandaki konumunu ölçer. Açılır listeyi buna göre çapalarız.
 * measureInWindow hem native'de hem react-native-web'de çalışır.
 *
 * `active` (liste açık mı): açıkken sayfa KAYDIRILIRSA veya pencere boyutu değişirse
 * çapa yeniden ölçülür → katman tetikleyiciyle birlikte hareket eder. Aksi halde liste
 * sabit ekran koordinatında kalıp kutudan KOPUYOR ("açılınca kayma" sorunu).
 */
export function useAnchor(active = false) {
  const ref = useRef<View>(null);
  const [rect, setRect] = useState<AnchorRect | null>(null);
  const measure = useCallback(() => {
    ref.current?.measureInWindow?.((x, y, width, height) => {
      // Ölçüm bazen 0 döner (henüz layout olmamış) — o durumda eskiyi koru.
      if (!(width > 0 || height > 0)) return;
      // KAYMA HATASI: eskiden her ölçümde YENİ nesne set ediliyordu. scroll dinleyicisi
      // capture:true olduğu için açılır listenin KENDİ iç kaydırması da tetikliyor →
      // her karede yeni rect → Modal içeriği sürekli yeniden render → kullanıcı listede
      // aşağı inerken liste yukarı sıçrıyordu. Değer değişmediyse ÖNCEKİ nesneyi koru.
      setRect((prev) =>
        prev && prev.x === x && prev.y === y && prev.width === width && prev.height === height
          ? prev
          : { x, y, width, height }
      );
    });
  }, []);

  useEffect(() => {
    if (!active || Platform.OS !== "web" || typeof window === "undefined") return;
    let frame = 0;
    const onMove = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    // capture:true → iç ScrollView'ların kaydırmasını da yakala.
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [active, measure]);

  return { ref, rect, measure };
}

/**
 * ÇAPALANMIŞ AÇILIR LİSTE (ticari sitelerdeki davranış).
 *
 * NEDEN: Açılır listeler daha önce normal AKIŞTA render ediliyordu →
 *  (1) sayfayı aşağı itiyor, kullanıcı listeyi görmek için kaydırmak zorunda kalıyordu;
 *  (2) `overflow:hidden` olan bir kart/panel içindeyse KIRPILIP görünmez oluyordu
 *      ("il/ilçe çıkmıyor" şikayetinin sebebi);
 *  (3) düşük zIndex yüzünden komşu bölümlerin altında kalabiliyordu.
 *
 * ÇÖZÜM: Modal (portal) içinde, tetikleyicinin ÖLÇÜLEN ekran koordinatına
 * konumlandırılır. Böylece hiçbir kapsayıcı kırpamaz, düzeni itmez. Altta yer
 * yoksa YUKARI açılır. Dışına/backdrop'a dokununca kapanır.
 */
export function AnchoredDropdown({
  visible,
  anchor,
  onClose,
  children,
  maxHeight = 320,
  minWidth = 200
}: {
  visible: boolean;
  anchor: AnchorRect | null;
  onClose: () => void;
  children: React.ReactNode;
  maxHeight?: number;
  minWidth?: number;
}) {
  const { height: winH, width: winW } = useWindowDimensions();
  if (!visible || !anchor) return null;

  const GAP = 4;
  const EDGE = 8;
  const spaceBelow = winH - (anchor.y + anchor.height) - EDGE;
  const spaceAbove = anchor.y - EDGE;
  // Altta yeterli yer yoksa ve üstte daha çok yer varsa YUKARI aç.
  const openUp = spaceBelow < Math.min(maxHeight, 200) && spaceAbove > spaceBelow;
  const available = Math.max(140, openUp ? spaceAbove - GAP : spaceBelow - GAP);
  const height = Math.min(maxHeight, available);

  // Yatayda ekran dışına taşmasın.
  const width = Math.max(minWidth, Math.min(anchor.width, winW - EDGE * 2));
  const left = Math.max(EDGE, Math.min(anchor.x, winW - width - EDGE));

  const pos: ViewStyle = openUp
    ? { bottom: winH - anchor.y + GAP }
    : { top: anchor.y + anchor.height + GAP };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {/* Backdrop: dışarı dokununca kapan. Şeffaf — sayfa görünmeye devam eder. */}
      <Pressable accessibilityLabel="Kapat" onPress={onClose} style={StyleSheet.absoluteFill} />
      <View
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.primary,
          borderRadius: 12,
          borderWidth: 1,
          elevation: 12,
          left,
          maxHeight: height,
          overflow: "hidden",
          position: "absolute",
          shadowColor: "#0B3A44",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.18,
          shadowRadius: 20,
          width,
          ...pos
        }}
      >
        {children}
      </View>
    </Modal>
  );
}

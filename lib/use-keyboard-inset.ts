import { useEffect, useState } from "react";
import { Platform } from "react-native";

/**
 * Mobil web klavye düzeltmesi.
 *
 * Mobil tarayıcıda yumuşak klavye açılınca GÖRÜNÜR viewport (visualViewport) küçülür
 * ama LAYOUT viewport (window.innerHeight) küçülmez. react-native-web'de
 * KeyboardAvoidingView web'de no-op olduğundan, sayfanın altına sabitlenmiş giriş
 * kutuları (sohbet composer'ı, soru-cevap, filtre/arama alanları) klavyenin ALTINDA
 * kalıyor → kullanıcı yazdığı yeri göremiyor. Bu hook klavye yüksekliğini (px) döndürür;
 * kök layout buna paddingBottom uygulayarak tüm içerik alanını klavyenin üstüne çeker.
 *
 * Web dışında ve masaüstünde daima 0 döner (no-op). Yalnızca gerçekten bir metin alanı
 * odaktayken uygulanır → adres çubuğu göster/gizle gibi küçük viewport oynamaları
 * yanlışlıkla klavye sanılmaz.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    let raf = 0;
    const update = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const active = document.activeElement as HTMLElement | null;
        const editable = !!active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);
        // Klavye yüksekliği = layout viewport − görünür viewport (sayfa kaydırmasından
        // bağımsız sabittir; offsetTop çıkarılmaz, yoksa kaydırınca inset küçülürdü).
        const overlap = Math.max(0, window.innerHeight - vv.height);
        // Sadece bir metin alanı odaktayken ve anlamlı bir örtüşme varsa uygula.
        setInset(editable && overlap > 60 ? Math.round(overlap) : 0);
      });
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("focusout", update, true);
    window.addEventListener("focusin", update, true);
    update();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("focusout", update, true);
      window.removeEventListener("focusin", update, true);
    };
  }, []);

  return inset;
}

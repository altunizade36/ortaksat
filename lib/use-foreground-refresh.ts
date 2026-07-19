import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";

/**
 * Uygulama/sekme ÖN PLANA döndüğünde verilen fonksiyonu çağırır (mesaj/teklif gibi UZAKTAN
 * değişen veriyi tazelemek için).
 *
 * NEDEN: Mobil-web'in TEK canlı yolu Supabase realtime WS aboneliğidir. Kullanıcı telefonu
 * kilitleyip/başka uygulamaya geçince tarayıcı sekmeyi askıya alır ve WS düşer; dönüşte
 * realtime-js yeniden bağlanır ama KAÇAN INSERT'leri TEKRAR OYNATMAZ. Sohbet ekranında manuel
 * yenileme de yoktu → gelen yanıtı tam da bekleyen kişi kaçırıyordu. Bu hook, ön plana dönünce
 * (web: visibilitychange, native: AppState 'active') bir kez tazeler (min aralıkla gürültü engellenir).
 */
export function useForegroundRefresh(fn: () => Promise<unknown> | void, minGapMs = 8000): void {
  const lastRef = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    const run = () => {
      const now = Date.now();
      if (now - lastRef.current < minGapMs) return; // arka-arkaya odak değişimlerini yut
      lastRef.current = now;
      try {
        void fnRef.current();
      } catch {
        // sessiz
      }
    };

    if (Platform.OS === "web") {
      if (typeof document === "undefined") return;
      const onVis = () => { if (document.visibilityState === "visible") run(); };
      document.addEventListener("visibilitychange", onVis);
      window.addEventListener("focus", run);
      return () => {
        document.removeEventListener("visibilitychange", onVis);
        window.removeEventListener("focus", run);
      };
    }

    const sub = AppState.addEventListener("change", (state) => { if (state === "active") run(); });
    return () => sub.remove();
  }, [minGapMs]);
}

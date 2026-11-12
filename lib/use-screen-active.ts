import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { AppState, Platform } from "react-native";

/**
 * Ekran GERÇEKTEN kullanıcının önünde mi?
 *
 * "Okundu" işaretlemek için kullanılır. Sohbet/gelen kutusu ekranı şu durumlarda MOUNT'lu
 * kalır ama kullanıcı onu GÖRMEZ:
 *   - başka sekmeye geçildi (tabs ekranları unmount olmaz),
 *   - sohbetten ilan detayına gidildi (stack alttaki ekranı tutar),
 *   - tarayıcı sekmesi arka planda / uygulama arka planda.
 * Eskiden bu durumlarda gelen mesajlar da anında "okundu" yazılıyordu: okunmamış rozeti hiç
 * görünmeden siliniyor, gönderen de "okundu" görüyordu.
 *
 * true = ekran odakta VE sekme görünür / uygulama aktif.
 */
export function useScreenActive(): boolean {
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(() => {
    if (Platform.OS === "web") return typeof document === "undefined" ? false : document.visibilityState === "visible";
    return AppState.currentState !== "background" && AppState.currentState !== "inactive";
  });

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );

  useEffect(() => {
    if (Platform.OS === "web") {
      if (typeof document === "undefined") return;
      const sync = () => setForeground(document.visibilityState === "visible");
      sync();
      document.addEventListener("visibilitychange", sync);
      return () => document.removeEventListener("visibilitychange", sync);
    }
    const sub = AppState.addEventListener("change", (state) => setForeground(state === "active"));
    return () => sub.remove();
  }, []);

  return focused && foreground;
}

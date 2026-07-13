import { useEffect } from "react";
import { AppState, Platform } from "react-native";

import { supabase } from "@/lib/supabase";
import { configurePushHandler, registerForPush } from "@/lib/push";

/**
 * Native push kaydı: uygulama açıldığında bildirim davranışını ayarlar ve
 * oturum açık kullanıcı için Expo push token'ını kaydeder. Web'de tamamen no-op.
 * Görsel bir şey render etmez. İlgili: push_on_notification tetikleyicisi (sunucu).
 */
export function PushRegistrar() {
  useEffect(() => {
    if (Platform.OS === "web" || !supabase) return;
    let cancelled = false;

    async function tryRegister() {
      if (cancelled || !supabase) return;
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) await registerForPush();
      } catch {
        /* sessizce yut — push kritik değil */
      }
    }

    void configurePushHandler();
    void tryRegister();
    // Uygulama öne gelince (yeni giriş / izin değişimi) tekrar dene.
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") void tryRegister(); });
    return () => { cancelled = true; sub.remove(); };
  }, []);

  return null;
}

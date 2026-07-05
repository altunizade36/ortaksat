import { useEffect } from "react";
import { AppState, Platform } from "react-native";

import { supabase } from "@/lib/supabase";

/**
 * Canlı kullanıcı (presence) sinyali: oturum açık kullanıcı için düzenli olarak
 * `heartbeat` RPC'sini çağırır → profiles.last_seen_at güncellenir ve o günün
 * "aktif kullanıcı" kaydı (user_active_days) atılır. Böylece admin panelindeki
 * "şu an aktif / günlük / haftalık" analitiği GERÇEK veriyle beslenir.
 * Görsel bir şey render etmez.
 */
export function PresenceHeartbeat() {
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    async function ping() {
      if (cancelled || !supabase) return;
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) await supabase.rpc("heartbeat");
      } catch {
        // sessizce yut — presence kritik değil
      }
    }

    void ping();
    const interval = setInterval(() => void ping(), 60_000);

    if (Platform.OS === "web" && typeof document !== "undefined") {
      const onVis = () => { if (document.visibilityState === "visible") void ping(); };
      document.addEventListener("visibilitychange", onVis);
      return () => { cancelled = true; clearInterval(interval); document.removeEventListener("visibilitychange", onVis); };
    }
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") void ping(); });
    return () => { cancelled = true; clearInterval(interval); sub.remove(); };
  }, []);

  return null;
}

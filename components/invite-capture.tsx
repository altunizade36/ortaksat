import { useEffect, useRef } from "react";

import { captureInvite } from "@/lib/live-service";
import { useStore } from "@/lib/use-store";

/**
 * Y8: Kullanıcı-daveti yakalama. /davet/<kod> ziyaretinde kod localStorage'a yazılır;
 * kullanıcı GİRİŞ YAPINCA (kayıt ya da login — hangisi olursa) davet edeni BİR KEZ ayarlar.
 * Her zaman mount (app/_layout) → tüm auth yollarını kapsar. Görsel yok.
 */
export function InviteCapture() {
  const { currentUser } = useStore();
  const done = useRef(false);

  useEffect(() => {
    if (!currentUser?.id || done.current) return;
    let code: string | null = null;
    try {
      if (typeof localStorage !== "undefined") code = localStorage.getItem("ortaksat_inv");
    } catch {
      /* localStorage erişilemez → yok say */
    }
    if (!code) return;
    done.current = true;
    void captureInvite(code).finally(() => {
      try {
        if (typeof localStorage !== "undefined") localStorage.removeItem("ortaksat_inv");
      } catch {
        /* yok */
      }
    });
  }, [currentUser?.id]);

  return null;
}

import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

/**
 * AKTİFLİK GÖSTERGESİ — profilde "Bugün aktif" / "Bu hafta aktif".
 * Sunucu yalnız kaba aralık döndürür (kesin saat ya da "çevrim içi" bilgisi yoktur; bkz.
 * supabase/migrations/20261114060000_profile_activity.sql). Bilinmiyorsa ya da kullanıcı gizlediyse boş metin.
 */
const LABELS: Record<string, string> = { today: "Bugün aktif", week: "Bu hafta aktif" };

export function useProfileActivity(userId: string | undefined | null): string {
  const [label, setLabel] = useState("");
  useEffect(() => {
    let alive = true;
    setLabel("");
    if (!supabase || !userId) return;
    void Promise.resolve(supabase.rpc("profile_activity", { p_id: userId }))
      .then(({ data, error }) => { if (alive && !error && typeof data === "string") setLabel(LABELS[data] ?? ""); })
      .catch(() => { /* gösterge zorunlu değil */ });
    return () => { alive = false; };
  }, [userId]);
  return label;
}

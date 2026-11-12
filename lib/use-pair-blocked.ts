import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * İki kullanıcı arasında (HERHANGİ bir yönde) engel var mı? Sunucudaki `is_blocked` RPC'si.
 *
 * Store yalnız BENİM engellediklerimi bilir (blocked_users RLS: blocker_id = ben). Karşı taraf
 * beni engellediyse composer açık kalıyor, kullanıcı yazıyor, her mesaj RESTRICTIVE policy'ye
 * takılıp "Gönderilemedi · tekrar dene" döngüsüne giriyordu. Bu hook sohbet açılınca (ve
 * `recheckKey` değişince, ör. başarısız mesaj sayısı) sunucuya sorar; true ise ekran composer
 * yerine net bir bant gösterir.
 *
 * Hata/çevrimdışı: false (engel varsayma; gönderim yine sunucuda denetlenir).
 */
export function usePairBlocked(meId: string | undefined, otherId: string | undefined, recheckKey: string | number = 0): boolean {
  // Sonuç, AİT OLDUĞU çiftle birlikte tutulur. Tek hook örneği birden çok konuşmaya hizmet
  // ettiğinde (masaüstü gelen kutusu: seçili konuşma değişir) önceki çiftin "engelli" sonucu yeni
  // konuşmaya taşınmasın — RPC dönene kadar (ve hata verirse kalıcı olarak) yanlış bant çıkıyordu.
  const pair = meId && otherId ? `${meId}:${otherId}` : "";
  const [result, setResult] = useState<{ pair: string; blocked: boolean }>({ pair: "", blocked: false });

  useEffect(() => {
    const client = supabase;
    if (!client || !meId || !otherId || !UUID.test(meId) || !UUID.test(otherId)) return;
    const forPair = `${meId}:${otherId}`;
    let alive = true;
    void (async () => {
      try {
        const { data, error } = await client.rpc("is_blocked", { a: meId, b: otherId });
        if (alive && !error) setResult({ pair: forPair, blocked: data === true });
      } catch {
        /* geçici hata: bu çift için mevcut değeri koru */
      }
    })();
    return () => { alive = false; };
  }, [meId, otherId, recheckKey]);

  return pair !== "" && result.pair === pair && result.blocked;
}

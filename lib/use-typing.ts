import { useEffect, useRef, useState } from "react";

import { supabase } from "@/lib/supabase";

/**
 * Konuşma bazlı "yazıyor…" göstergesi. Supabase realtime *broadcast* kanalı
 * kullanır (kalıcı kayıt yok, anlık). Canlı olmayan modda (supabase yok) sessizce
 * devre dışı kalır.
 *
 * - `otherTyping`: karşı taraf son ~2.5 sn içinde yazıyor sinyali gönderdi mi.
 * - `notifyTyping()`: kendi yazma sinyalini gönderir (1.5 sn'de bir kısılır).
 */
export function useTypingIndicator(conversationId: string | undefined, currentUserId: string) {
  const [otherTyping, setOtherTyping] = useState(false);
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSent = useRef(0);

  useEffect(() => {
    setOtherTyping(false);
    if (!supabase || !conversationId) return;
    const client = supabase;
    const channel = client.channel(`typing-${conversationId}`, { config: { broadcast: { self: false } } });
    channel.on("broadcast", { event: "typing" }, (payload) => {
      const uid = (payload?.payload as { userId?: string } | undefined)?.userId;
      if (!uid || uid === currentUserId) return;
      setOtherTyping(true);
      if (clearTimer.current) clearTimeout(clearTimer.current);
      clearTimer.current = setTimeout(() => setOtherTyping(false), 2600);
    });
    channel.subscribe();
    channelRef.current = channel;
    return () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
      channelRef.current = null;
      void client.removeChannel(channel);
    };
  }, [conversationId, currentUserId]);

  const notifyTyping = () => {
    const ch = channelRef.current;
    if (!ch) return;
    const now = Date.now();
    if (now - lastSent.current < 1500) return; // aşırı mesaj göndermeyi kıs
    lastSent.current = now;
    void ch.send({ type: "broadcast", event: "typing", payload: { userId: currentUserId } });
  };

  return { otherTyping, notifyTyping };
}

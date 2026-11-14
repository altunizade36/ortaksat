import { supabase } from "@/lib/supabase";

/**
 * ORTAKLIKTA ÖZEL NOT — her taraf yalnız KENDİ notunu görür (karşı taraf okuyamaz).
 * Sunucu kuralı: supabase/migrations/20261114070000_partnership_notes.sql (satır yalnız yazarına açık; yazar o
 * ortaklığın ortağı ya da ilan sahibi olmalı).
 */
export async function fetchMyPartnershipNote(partnershipId: string, userId: string): Promise<string | null> {
  if (!supabase || !partnershipId || !userId) return null;
  const { data, error } = await supabase.from("partnership_notes").select("body").eq("partnership_id", partnershipId).eq("author_id", userId).maybeSingle();
  if (error) return null;
  return typeof data?.body === "string" ? data.body : "";
}

/** Notu kaydeder; boş metin notu siler. Başarıda true. */
export async function saveMyPartnershipNote(partnershipId: string, userId: string, body: string): Promise<boolean> {
  if (!supabase || !partnershipId || !userId) return false;
  const text = body.trim().slice(0, 2000);
  try {
    if (!text) {
      const { error } = await supabase.from("partnership_notes").delete().eq("partnership_id", partnershipId).eq("author_id", userId);
      return !error;
    }
    const { error } = await supabase.from("partnership_notes").upsert({ partnership_id: partnershipId, author_id: userId, body: text, updated_at: new Date().toISOString() }, { onConflict: "partnership_id,author_id" });
    return !error;
  } catch {
    return false;
  }
}

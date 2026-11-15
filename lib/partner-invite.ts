import { supabase } from "@/lib/supabase";

/**
 * Satıcı, beğendiği bir ortağı kendi ilanına DAVET eder (sunucu: invite_partner_to_listing —
 * supabase/migrations/20261115150000_partner_invites_price_history.sql).
 * Davet yalnız bir çağrıdır: ortağa bildirim gider, ortaklık yine ortağın başvurusuyla kurulur.
 */
export type InviteResult =
  | { ok: true; state: "sent" | "already" | "joined" }
  | { ok: false; message: string };

export async function invitePartnerToListing(listingId: string, partnerId: string): Promise<InviteResult> {
  if (!supabase) return { ok: false, message: "Bağlantı kurulamadı." };
  try {
    const { data, error } = await supabase.rpc("invite_partner_to_listing", { p_listing: listingId, p_partner: partnerId });
    if (error) {
      // Sunucu iletisi kullanıcıya yöneliktir (Türkçe, nedenini söyler); teknik hata ise genel ileti.
      const text = error.message || "";
      return { ok: false, message: /[çğıöşüÇĞİÖŞÜ]|davet|ilan/i.test(text) ? text : "Davet gönderilemedi. Lütfen tekrar dene." };
    }
    const state = data === "already" || data === "joined" ? data : "sent";
    return { ok: true, state };
  } catch {
    return { ok: false, message: "Davet gönderilemedi. Bağlantını kontrol edip tekrar dene." };
  }
}

export function inviteResultText(state: "sent" | "already" | "joined"): string {
  if (state === "already") return "Bu ortağı bu ilana daha önce davet etmiştin.";
  if (state === "joined") return "Bu ortak bu ilana zaten başvurmuş ya da ortak olmuş.";
  return "Davet gönderildi. Ortak bildirimi görünce ilanını inceleyebilir.";
}

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

/** Davet durumu sunucuda hesaplanır (supabase/migrations/20261116090000_partner_invites_inbox.sql). */
export type PartnerInviteState = "pending" | "applied" | "active" | "dismissed" | "closed";
export type PartnerInvite = {
  id: string;
  /** received = bana gelen (ortak olarak), sent = benim gönderdiğim (satıcı olarak). */
  direction: "received" | "sent";
  state: PartnerInviteState;
  createdAt: string;
  listingId: string;
  listingTitle: string;
  listingImage: string | null;
  price: number;
  currency: "TRY" | "USD" | "EUR";
  commissionAmount: number;
  otherId: string;
  otherName: string;
  otherAvatar: string | null;
};

const INVITE_STATES: PartnerInviteState[] = ["pending", "applied", "active", "dismissed", "closed"];

/** Gelen ve giden davetler (son 90 gün). Hata olursa boş liste: davet kutusu sayfayı bozmamalı. */
export async function fetchMyPartnerInvites(): Promise<PartnerInvite[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.rpc("my_partnership_invites");
    if (error || !Array.isArray(data)) return [];
    return (data as Record<string, unknown>[]).map((row) => {
      const currency = row.currency === "USD" || row.currency === "EUR" ? row.currency : "TRY";
      const state = INVITE_STATES.includes(row.state as PartnerInviteState) ? (row.state as PartnerInviteState) : "pending";
      return {
        id: String(row.id),
        direction: row.direction === "sent" ? "sent" : "received",
        state,
        createdAt: String(row.created_at ?? ""),
        listingId: String(row.listing_id),
        listingTitle: String(row.listing_title ?? ""),
        listingImage: typeof row.listing_image === "string" && row.listing_image ? row.listing_image : null,
        price: Number(row.price) || 0,
        currency,
        commissionAmount: Number(row.commission_amount) || 0,
        otherId: String(row.other_id),
        otherName: String(row.other_name ?? ""),
        otherAvatar: typeof row.other_avatar === "string" && row.other_avatar ? row.other_avatar : null
      };
    });
  } catch {
    return [];
  }
}

/** Ortak, kendisine gelen daveti kapatır ("ilgilenmiyorum"). Satıcıya bildirim gitmez. */
export async function dismissPartnerInvite(inviteId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.rpc("dismiss_partnership_invite", { p_invite: inviteId });
    return !error && data === true;
  } catch {
    return false;
  }
}

/** Satıcının gönderdiği davetin durum etiketi. */
export function inviteStateLabel(state: PartnerInviteState): string {
  if (state === "active") return "Ortak oldu";
  if (state === "applied") return "Başvurdu";
  if (state === "dismissed") return "İlgilenmedi";
  if (state === "closed") return "İlan kapalı";
  return "Yanıt bekliyor";
}

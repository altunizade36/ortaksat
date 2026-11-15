import type { Conversation, Offer, Partnership, PartnershipStatus } from "@/lib/types";

export type ConversationGroup = "buyers" | "sellers" | "partner";

type ConversationParties = Pick<Conversation, "listingId" | "sellerId" | "participantIds">;

/**
 * Sohbette ilan sahibi OLMAYAN katılımcı (alıcı ya da ortak). `ownerId` verilmezse konuşmanın satıcısı
 * (sunucu, satıcının iki taraftan biri olmasını zorunlu tutar) ilan sahibi sayılır.
 */
export function conversationCounterpartId(conversation: ConversationParties, ownerId?: string): string | undefined {
  const owner = ownerId ?? conversation.sellerId;
  if (!conversation.participantIds.includes(owner)) return undefined;
  return conversation.participantIds.find((id) => id !== owner);
}

// Aynı ilan + kişi için birden çok kayıt varsa güncel olanı öne al: aktif > bekleyen > geçmiş.
const PARTNERSHIP_RANK: Record<PartnershipStatus, number> = { active: 0, pending: 1, completed: 2, cancelled: 3, rejected: 4, blocked: 5 };

/**
 * Sohbetin ortaklığı: ilan sahibi olmayan katılımcının O İLANDAKİ ortaklık kaydı (yoksa undefined).
 *
 * `conversations.partner_id` KULLANILMAZ: o alan sohbet açılırken bir kez yazılır, sunucuda
 * doğrulanmaz ve sonradan güncellenmez — ortaklık sohbet açıldıktan sonra kurulunca (ya da bitince)
 * sohbet yanlış grupta kalıyordu. Tek doğru kaynak `partnerships` satırının güncel durumudur.
 */
export function conversationPartnership(conversation: ConversationParties, partnerships: Partnership[], ownerId?: string): Partnership | undefined {
  const counterpart = conversationCounterpartId(conversation, ownerId);
  if (!counterpart) return undefined;
  let best: Partnership | undefined;
  for (const item of partnerships) {
    if (item.listingId !== conversation.listingId || item.partnerId !== counterpart) continue;
    const better = !best || PARTNERSHIP_RANK[item.status] < PARTNERSHIP_RANK[best.status] ||
      (PARTNERSHIP_RANK[item.status] === PARTNERSHIP_RANK[best.status] && item.createdAt > best.createdAt);
    if (better) best = item;
  }
  return best;
}

/** Ortaklık sohbeti mi? Yalnız AKTİF ya da ONAY BEKLEYEN ortaklık sayılır (biten/reddedilen sayılmaz). */
export function isPartnershipConversation(conversation: ConversationParties, partnerships: Partnership[], ownerId?: string): boolean {
  const status = conversationPartnership(conversation, partnerships, ownerId)?.status;
  return status === "active" || status === "pending";
}

/**
 * Sohbetin iki katılımcısı arasında, bu ilan için EN SON kabul edilmiş teklif (yoksa undefined).
 * Kabul edilen teklifte `amount` anlaşılan tutardır (karşı teklif kabul edilince sunucu tutarı oraya yazar).
 */
export function latestAcceptedOffer(conversation: Pick<Conversation, "listingId" | "participantIds">, offers: Offer[]): Offer | undefined {
  let best: Offer | undefined;
  for (const offer of offers) {
    if (offer.status !== "accepted" || offer.listingId !== conversation.listingId) continue;
    if (offer.buyerId === offer.sellerId || !conversation.participantIds.includes(offer.buyerId) || !conversation.participantIds.includes(offer.sellerId)) continue;
    const stamp = offer.respondedAt ?? offer.createdAt;
    if (!best || stamp > (best.respondedAt ?? best.createdAt)) best = offer;
  }
  return best;
}

/** Tabs describe the other participant, not a permanent role assigned to a user. */
export function conversationGroup(conversation: Conversation, userId: string, partnerships: Partnership[]): ConversationGroup {
  if (isPartnershipConversation(conversation, partnerships)) return "partner";
  return conversation.sellerId === userId ? "buyers" : "sellers";
}

/**
 * Hiç mesaj yazılmamış "hayalet" konuşma mı?
 *
 * İlan/ortaklık ekranındaki "Mesaj" düğmesi, kullanıcı tek satır yazmadan da konuşma satırını
 * oluşturur. Karşı tarafın gelen kutusunda içi boş, önizlemesiz bir satır beliriyordu (ve geri
 * dönüp hiç yazmayan her ziyaretçi için bir tane daha). Boş konuşma, ilk mesaj gelene kadar
 * listede gösterilmez; doğrudan açılan (seçili) konuşma her zaman görünür.
 *
 * `lastMessageAt === createdAt` şartı güvenlik içindir: istemci yalnız son ~1000 mesajı tutar;
 * mesajı OLAN ama yerelde yüklenmemiş eski bir konuşma (lastMessageAt ilerlemiş) asla gizlenmez.
 *
 * O karşılaştırma SANİYEYE kırpılmış damgalarla yapılır; ilk mesaj çoğu akışta konuşmadan birkaç
 * yüz ms sonra yazıldığından iki damga aynı saniyeye düşer. Bu yüzden sunucunun HAM damgalarından
 * "mesajı var" bilgisi ayrıca tutulur (bkz. noteThreadActivity) ve o konuşma asla gizlenmez.
 */
export function isEmptyThread(conversation: Conversation, hasLocalMessages: boolean): boolean {
  return !hasLocalMessages && !threadsWithActivity.has(conversation.id) && conversation.lastMessageAt === conversation.createdAt;
}

// Sunucuda en az bir mesajı olduğu BİLİNEN konuşmalar (yalnız büyür; yanlış-pozitifin tek etkisi
// boş bir satırın listede görünmesidir). Kimlikler konuşmaya özgü UUID'dir → hesaplar arası sızmaz.
const threadsWithActivity = new Set<string>();

/**
 * Konuşma satırı sunucudan okunurken çağrılır: `last_message_at`, `created_at`'ten FARKLIYSA
 * (ham, mikrosaniye hassasiyetli metinler) konuşmaya mesaj yazılmıştır.
 */
export function noteThreadActivity(conversationId: string | null | undefined, lastMessageAtRaw: unknown, createdAtRaw: unknown): void {
  if (!conversationId) return;
  if (typeof lastMessageAtRaw === "string" && typeof createdAtRaw === "string" && lastMessageAtRaw !== createdAtRaw) threadsWithActivity.add(conversationId);
}

/** Sunucudan bu konuşmaya ait bir MESAJ satırı görüldü (realtime). */
export function noteThreadHasMessages(conversationId: string | null | undefined): void {
  if (conversationId) threadsWithActivity.add(conversationId);
}


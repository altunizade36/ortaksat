import type { Conversation, Listing, Notification, Partnership } from "@/lib/types";

type Context = { userId: string; listings: Listing[]; partnerships: Partnership[]; conversations: Conversation[] };
export function notificationTarget(n: Pick<Notification, "type" | "metadata">, context: Context): { href: string; label: string } | null {
  const meta = n.metadata, encode = encodeURIComponent;
  if (meta?.trust_event) {
    const id = meta.trust_transaction_id;
    return { href: id && /^[a-f\d-]{36}$/i.test(id) ? `/guven-merkezi?transaction=${encode(id)}` : "/guven-merkezi?view=agreements", label: "İşlem kaydını aç" };
  }
  if (n.type === "message") {
    const conversations = context.conversations.filter(c => c.participantIds.includes(context.userId));
    const conversation = meta?.conversationId ? conversations.find(c => c.id === meta.conversationId) : meta?.listingId ? conversations.filter(c => c.listingId === meta.listingId).sort((a,b) => b.lastMessageAt.localeCompare(a.lastMessageAt))[0] : undefined;
    return conversation ? { href: `/chat/${encode(conversation.id)}`, label: "Sohbeti Aç" } : { href: "/messages", label: "Mesajları Aç" };
  }
  if (n.type === "offer") return { href: "/offers", label: "Teklifleri Aç" };
  if (meta?.partnershipId) {
    const partnership = context.partnerships.find(p => p.id === meta.partnershipId);
    const listing = context.listings.find(l => l.id === partnership?.listingId);
    if (partnership && (partnership.partnerId === context.userId || listing?.ownerId === context.userId)) return { href: `/partnership/${encode(partnership.id)}`, label: "Ortaklık Detayı" };
  }
  if (meta?.requestId) return { href: "/ortak-araniyor", label: "Ortaklık Taleplerini Aç" };
  if (n.type === "payout") return { href: "/earnings", label: "Kazanç Kayıtlarını Aç" };
  if (meta?.listingId) {
    const listing = context.listings.find(l => l.id === meta.listingId);
    if (n.type === "system" && !listing) return null;
    if (["lead", "sale", "application"].includes(n.type) && listing?.ownerId === context.userId) return { href: `/seller?view=advanced&focus=${encode(listing.id)}`, label: "İlan Yönetimini Aç" };
    return { href: `/listing/${encode(meta.listingId)}`, label: "İlanı Aç" };
  }
  return null;
}

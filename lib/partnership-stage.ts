import type { Lead, Partnership, Sale } from "@/lib/types";

/**
 * ORTAKLIK AŞAMASI — her ortaklıkta görünen TEK durum (ürün sahibinin dokuz aşaması, 2026-11-14):
 * Başvuru Bekliyor → Kabul Edildi → Müşteri Bulundu → Görüşülüyor → Satış Bekleniyor → Satıldı →
 * Komisyon Bekleniyor → Tamamlandı (+ İptal Edildi / Reddedildi / Anlaşmazlık).
 *
 * Yeni bir alan DEĞİL: ortaklık durumu + o ortaklığın müşteri kayıtları + satış kayıtlarından türetilir; en ilerideki
 * kayıt belirleyicidir. Eskiden bu üç bilgi ayrı ekranlarda duruyor, ortaklık kartında yalnız "Aktif" yazıyordu.
 */
export type StageKey = "pending" | "accepted" | "customer" | "talking" | "awaiting_sale" | "sold" | "commission_due" | "completed" | "cancelled" | "rejected" | "disputed";
export type StageTone = "info" | "progress" | "success" | "warning" | "muted" | "danger";
export type PartnershipStage = { key: StageKey; label: string; tone: StageTone; hint: string };

const STAGES: Record<StageKey, Omit<PartnershipStage, "key">> = {
  pending: { label: "Başvuru Bekliyor", tone: "warning", hint: "Satıcının yanıtı bekleniyor." },
  accepted: { label: "Kabul Edildi", tone: "info", hint: "Ortaklık aktif; henüz müşteri kaydı yok." },
  customer: { label: "Müşteri Bulundu", tone: "progress", hint: "Yeni bir müşteri kaydı var." },
  talking: { label: "Görüşülüyor", tone: "progress", hint: "Müşteriyle görüşme sürüyor." },
  awaiting_sale: { label: "Satış Bekleniyor", tone: "progress", hint: "Müşteri ilgileniyor; satışın tamamlanması bekleniyor." },
  sold: { label: "Satıldı", tone: "success", hint: "Satış kaydedildi; onay ya da iade süresi bekleniyor." },
  commission_due: { label: "Komisyon Bekleniyor", tone: "warning", hint: "Satış onaylandı; komisyon ödemesi bekleniyor." },
  completed: { label: "Tamamlandı", tone: "success", hint: "Komisyon ödendi olarak onaylandı." },
  cancelled: { label: "İptal Edildi", tone: "muted", hint: "Ortaklık sona erdi." },
  rejected: { label: "Reddedildi", tone: "danger", hint: "Başvuru kabul edilmedi." },
  disputed: { label: "Anlaşmazlık", tone: "danger", hint: "Satış kaydında anlaşmazlık bildirildi." }
};

const stage = (key: StageKey): PartnershipStage => ({ key, ...STAGES[key] });
const newest = <T extends { createdAt?: string }>(rows: T[]): T | undefined => [...rows].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))[0];

export function partnershipStage(partnership: Partnership, leads: Lead[], sales: Sale[]): PartnershipStage {
  if (partnership.status === "pending") return stage("pending");
  if (partnership.status === "rejected") return stage("rejected");
  if (partnership.status === "cancelled" || partnership.status === "blocked") return stage("cancelled");
  const mySales = sales.filter((sale) => sale.partnershipId === partnership.id && sale.status !== "cancelled");
  const sale = newest(mySales);
  if (sale) {
    if (sale.status === "disputed") return stage("disputed");
    if (sale.status === "paid") return stage("completed");
    if (sale.status === "approved" || sale.status === "seller_paid") return stage("commission_due");
    return stage("sold"); // pending / return_pending
  }
  if (partnership.status === "completed") return stage("completed");
  const lead = newest(leads.filter((row) => row.partnershipId === partnership.id && row.status !== "lost"));
  if (lead) {
    if (lead.status === "converted") return stage("sold");
    if (lead.status === "interested") return stage("awaiting_sale");
    if (lead.status === "contacted") return stage("talking");
    return stage("customer");
  }
  return stage("accepted");
}

export type TimelineEvent = { at: string; label: string; detail?: string };

/** O ortaklığın İŞLEM GÜNLÜĞÜ: başvuru → kabul → müşteri kayıtları → satış → ödeme adımları, tarih sırasıyla. */
export function partnershipTimeline(partnership: Partnership, leads: Lead[], sales: Sale[], money: (amount: number) => string): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const push = (at: string | undefined, label: string, detail?: string) => { if (at) events.push({ at, label, detail }); };
  push(partnership.createdAt, "Başvuru yapıldı");
  if (partnership.status !== "pending" && partnership.status !== "rejected") push(partnership.approvedAt || partnership.agreedAt, "Kabul edildi");
  if (partnership.status === "rejected") push(partnership.approvedAt, "Başvuru reddedildi", partnership.rejectionReason);
  for (const lead of leads.filter((row) => row.partnershipId === partnership.id)) push(lead.createdAt, "Müşteri eklendi", lead.buyerName || undefined);
  for (const sale of sales.filter((row) => row.partnershipId === partnership.id)) {
    push(sale.createdAt, "Satış kaydedildi", `${money(sale.amount)} · komisyon ${money(sale.commissionAmount)}`);
    push(sale.approvedAt, "Satış onaylandı");
    push(sale.disputeOpenedAt, "Anlaşmazlık bildirildi", sale.disputeReason);
    push(sale.sellerMarkedPaidAt, "Satıcı komisyonu ödedi olarak işaretledi");
    push(sale.partnerConfirmedPaidAt || sale.paidAt, "Komisyon ödemesi onaylandı");
  }
  return events.sort((a, b) => a.at.localeCompare(b.at));
}

/**
 * İlan risk-puanı motoru (spec 37/47/60/81 — sahte/şüpheli ilan tespiti).
 * Çok sinyalli: yasaklı/şüpheli kelime, fiyat anomalisi, mükerrer ilan, iletişim/
 * platform-dışı yönlendirme, eksik fotoğraf, gerçek dışı komisyon, doğrulanmamış satıcı.
 * Yalnızca kural-tabanlı ve şeffaf; admin panelinde bayraklarıyla gösterilir.
 */

import { scanTextLocal } from "@/lib/moderation";
import type { Listing, User } from "@/lib/types";

export type RiskLevel = "low" | "medium" | "high";
export type RiskResult = { score: number; level: RiskLevel; flags: string[] };

function norm(s: string): string {
  return (s ?? "").toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
}

// Açıklamada platform-dışına çekme / iletişim spam'i işaretleri.
const CONTACT_PATTERNS: Array<{ re: RegExp; flag: string }> = [
  { re: /\b\d[\d\s().-]{9,}\b/, flag: "Açıklamada telefon numarası" },
  { re: /(whatsapp|wa\.me|watsap|watsup)/i, flag: "WhatsApp'a yönlendirme" },
  { re: /(instagram|insta\b|ig\b|dm['’]?den|dm at)/i, flag: "Instagram/DM'e yönlendirme" },
  { re: /(telegram|t\.me)/i, flag: "Telegram'a yönlendirme" },
  { re: /(https?:\/\/|www\.)/i, flag: "Dış bağlantı (link)" },
  { re: /(kapora|kaparo|önce para|peşin gönder|iban['’]?a yatır|hesaba yatır)/i, flag: "Ön ödeme/kapora talebi" },
  { re: /(elden görüş|dışarıdan hallederiz|site dışı|platform dışı)/i, flag: "Platform dışına yönlendirme" }
];

/**
 * @param listing İncelenen ilan.
 * @param all Tüm ilanlar (fiyat anomalisi + mükerrer tespiti için).
 * @param owner İlan sahibi (doğrulama/puan sinyali için).
 */
export function computeListingRisk(listing: Listing, all: Listing[], owner?: User): RiskResult {
  const flags: string[] = [];
  let score = 0;

  // 1) Yasaklı/şüpheli kelime taraması (başlık + açıklama).
  const scan = scanTextLocal(`${listing.title}\n${listing.description}`);
  if (scan.verdict === "block") { score += 60; flags.push(`Yasaklı ifade: "${scan.matched}"`); }
  else if (scan.verdict === "review") { score += 30; flags.push(`Dikkat gerektiren ifade: "${scan.matched}"`); }

  // 2) İletişim / platform-dışı yönlendirme spam'i.
  const desc = `${listing.title} ${listing.description} ${listing.salesPitch.join(" ")}`;
  const contactHits = CONTACT_PATTERNS.filter((p) => p.re.test(desc));
  if (contactHits.length) { score += Math.min(30, 12 + contactHits.length * 6); flags.push(...contactHits.map((h) => h.flag)); }

  // 3) Fiyat anomalisi: aynı kategoride medyan fiyatın çok altında (%25) → sahte olabilir.
  const peers = all.filter((l) => l.id !== listing.id && l.status === "active" && l.category === listing.category && l.price > 0).map((l) => l.price).sort((a, b) => a - b);
  if (peers.length >= 4 && listing.price > 0) {
    const median = peers[Math.floor(peers.length / 2)];
    if (listing.price < median * 0.25) { score += 25; flags.push(`Fiyat piyasa medyanının çok altında (₺${listing.price} ≪ ₺${median})`); }
  }

  // 4) Mükerrer ilan: aynı başlık başka aktif ilanda var.
  const nt = norm(listing.title);
  if (nt.length > 8) {
    const dup = all.find((l) => l.id !== listing.id && l.status === "active" && norm(l.title) === nt);
    if (dup) { score += 20; flags.push(dup.ownerId === listing.ownerId ? "Aynı satıcıda mükerrer ilan" : "Başka ilanla aynı başlık (kopya olabilir)"); }
  }

  // 5) Fotoğraf zayıflığı: ek görsel yoksa.
  if (!listing.adAssets || listing.adAssets.length === 0) { score += 8; flags.push("Ek fotoğraf yok"); }

  // 6) Gerçek dışı komisyon: yüzde > %50 ya da 0.
  if (listing.commissionType === "rate") {
    if (listing.commissionValue > 50) { score += 15; flags.push(`Aşırı yüksek komisyon (%${listing.commissionValue})`); }
    else if (listing.commissionValue <= 0) { score += 6; flags.push("Komisyon girilmemiş"); }
  }

  // 7) Doğrulanmamış / yeni satıcı.
  if (owner) {
    const verified = owner.verifiedPhone || owner.verifiedIdentity;
    if (!verified && (owner.rating ?? 0) <= 0 && (owner.successfulSales ?? 0) === 0) { score += 10; flags.push("Doğrulanmamış yeni satıcı"); }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level: RiskLevel = score >= 55 ? "high" : score >= 25 ? "medium" : "low";
  return { score, level, flags };
}

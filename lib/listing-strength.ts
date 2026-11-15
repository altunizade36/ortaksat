import { listingMedia, listingPhotos } from "@/lib/mobile-listing";
import type { Listing } from "@/lib/types";

/**
 * İLAN GÜCÜ (2026-11-15) — satıcıya "ilanım ne kadar dolu, neyi eklersem daha iyi olur?" sorusunun cevabı.
 *
 * Puan yalnız ilanın KENDİ içeriğinden hesaplanır (fotoğraf, video, başlık, açıklama, özellikler, konum, ortaklık);
 * görüntülenme / satış gibi sonuç verisi katılmaz, kimseyle karşılaştırılmaz. Amaç sıralama değil YÖNLENDİRME:
 * her eksik için kaç puan kazandıracağını söyleyen somut bir öneri döner (en çok kazandıran önce).
 * Ağırlıklar toplamı 100'dür; değiştirirsen toplamı koru.
 */
export type ListingTip = { key: string; text: string; points: number };
export type ListingStrength = { score: number; level: "Zayıf" | "Orta" | "İyi" | "Çok iyi"; tips: ListingTip[] };

const VIDEO_URL = /\.(mp4|mov|m4v|webm)(\?|$)/i;

export function listingStrength(listing: Listing): ListingStrength {
  const tips: ListingTip[] = [];
  let score = 0;
  const seeking = listing.attributes?._formKey === "arayan"; // talep ilanı: fotoğraf/komisyon beklenmez

  // Fotoğraf (30)
  const photos = listingPhotos(listing).length;
  const photoPoints = photos >= 5 ? 30 : photos >= 3 ? 22 : photos === 2 ? 16 : photos === 1 ? 10 : 0;
  if (seeking) score += 30;
  else {
    score += photoPoints;
    if (photos === 0) tips.push({ key: "photo", text: "Fotoğraf ekle: fotoğrafsız ilanlar çok az tıklanır.", points: 30 });
    else if (photos < 5) tips.push({ key: "photo", text: `${5 - photos} fotoğraf daha ekle (farklı açılar, yakın çekim).`, points: 30 - photoPoints });
  }

  // Video (8)
  const hasVideo = listingMedia(listing).some((uri) => VIDEO_URL.test(uri));
  if (seeking || hasVideo) score += 8;
  else tips.push({ key: "video", text: "Kısa bir video ekle (en fazla 30 sn).", points: 8 });

  // Başlık (10)
  const title = (listing.title ?? "").trim();
  const titleOk = title.length >= 20 && title.split(/\s+/).length >= 3;
  if (titleOk) score += 10;
  else tips.push({ key: "title", text: "Başlığa marka, model ya da öne çıkan özelliği ekle.", points: 10 });

  // Açıklama (20)
  const description = (listing.description ?? "").trim().length;
  const descPoints = description >= 300 ? 20 : description >= 120 ? 12 : description >= 40 ? 6 : 0;
  score += descPoints;
  if (descPoints < 20) tips.push({ key: "description", text: description < 40 ? "Açıklama yaz: durum, kullanım süresi, teslimat." : "Açıklamayı ayrıntılandır (durum, eksikler, teslimat, garanti).", points: 20 - descPoints });

  // Özellikler (12) — "_" ile başlayan anahtarlar iç alandır (kategori yolu vb.)
  const filled = Object.entries(listing.attributes ?? {}).filter(([key, value]) => !key.startsWith("_") && value !== "" && value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0)).length;
  const attrPoints = filled >= 5 ? 12 : filled >= 2 ? 7 : 0;
  score += attrPoints;
  if (attrPoints < 12) tips.push({ key: "attributes", text: "Ürün özelliklerini doldur (marka, model, durum…); filtrelerde çıkarsın.", points: 12 - attrPoints });

  // Konum (8)
  const locationPoints = listing.districtId ? 8 : listing.provinceId ? 4 : 0;
  score += locationPoints;
  if (locationPoints < 8) tips.push({ key: "location", text: listing.provinceId ? "İlçeyi ekle; yakındaki alıcılar seni bulsun." : "İl ve ilçe seç.", points: 8 - locationPoints });

  // Ortaklık (12)
  const partnerReady = listing.partnershipMode !== "none" && listing.commissionValue > 0;
  if (seeking || partnerReady) score += 12;
  else tips.push({ key: "partnership", text: "Komisyon belirleyip ilanı ortaklara aç; ortaklar senin yerine tanıtsın.", points: 12 });

  const bounded = Math.max(0, Math.min(100, Math.round(score)));
  const level = bounded >= 85 ? "Çok iyi" : bounded >= 65 ? "İyi" : bounded >= 40 ? "Orta" : "Zayıf";
  return { score: bounded, level, tips: tips.sort((a, b) => b.points - a.points) };
}

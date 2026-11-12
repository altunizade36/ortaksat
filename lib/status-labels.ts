import type { PartnershipStatus, SaleStatus } from "@/lib/types";

/**
 * DURUM ETİKETLERİ — varlık başına TEK kaynak.
 *
 * Eskiden her ekran kendi haritasını tutuyordu: aynı ilan bir ekranda "Aktif", diğerinde "Yayında";
 * bekleyen ortaklık "Bekliyor" / "Onay bekliyor" / "Onay Bekliyor"; satış "Satıcı ödedi" / "Onay
 * bekliyor" / "Ödeme onayı bekliyor" diye görünüyordu. Yeni ekranlar etiketi BURADAN almalı.
 */

// İlan durumu (kaynağı lib/mobile-listing.ts; tek harita oradan yeniden dışa aktarılır).
export { listingStatusLabels } from "@/lib/mobile-listing";

/** Ortaklık durumu — liste satırı, filtre çipi ve rozetlerde kullanılan kısa etiket. */
export const partnershipStatusLabels: Record<PartnershipStatus, string> = {
  active: "Aktif",
  pending: "Onay bekliyor",
  rejected: "Reddedildi",
  cancelled: "Sonlandırıldı",
  completed: "Tamamlandı",
  blocked: "Kapatıldı"
};

/** Ortaklık durumu — detay ekranındaki kart başlığı (aynı durumların uzun biçimi). */
export const partnershipStatusTitles: Record<PartnershipStatus, string> = {
  active: "Aktif Ortaklık",
  pending: "Onay Bekliyor",
  rejected: "Talep Reddedildi",
  cancelled: "Ortaklık Sonlandırıldı",
  completed: "Ortaklık Tamamlandı",
  blocked: "Ortaklık Kapatıldı"
};

/**
 * Satış / komisyon durumu. `seller_paid`: satıcı "ödedim" dedi, ortağın "ödemeyi aldım" onayı
 * bekleniyor → iki taraf için de doğru okunan nötr ifade.
 */
export const saleStatusLabels: Record<SaleStatus, string> = {
  pending: "Bekliyor",
  return_pending: "İade süresi",
  approved: "Onaylandı",
  seller_paid: "Ödeme onayı bekliyor",
  paid: "Ödendi",
  cancelled: "İptal",
  disputed: "İtiraz"
};

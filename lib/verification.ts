// Güven / doğrulama rozetleri — YALNIZCA GERÇEKTEN UYGULANAN seviyeler.
// Kural (kullanıcı): "Gerçekte uygulanmayan doğrulama seviyeleri gösterilmemeli."
//   Uygulanan: Kimlik, Telefon, Instagram, Başarılı işlem geçmişi.
//   UYGULANMAYAN (gösterme): Şirket doğrulaması, Banka hesabı doğrulaması.
//   E-posta: kayıt otomatik-onaylı (herkeste var, ayırt edici değil) → rozet DEĞİL.
import type { User } from "./types";

export type VerificationBadge = { key: string; label: string; desc: string; icon: string };

type VUser = Pick<User, "verifiedPhone" | "verifiedIdentity" | "verifiedInstagram" | "successfulSales">;

// Bir kullanıcının GERÇEKTEN kazandığı rozetler (sırayla güçten zayıfa).
export function verificationBadges(user: VUser | undefined | null): VerificationBadge[] {
  if (!user) return [];
  const out: VerificationBadge[] = [];
  if (user.verifiedIdentity) out.push({ key: "identity", label: "Kimlik doğrulandı", desc: "Satıcının resmi kimlik belgesi OrtakSat tarafından kontrol edildi.", icon: "card-account-details-outline" });
  if (user.verifiedPhone) out.push({ key: "phone", label: "Telefon doğrulandı", desc: "Telefon numarası SMS kodu ile doğrulandı.", icon: "phone-check-outline" });
  if (user.verifiedInstagram) out.push({ key: "instagram", label: "Instagram doğrulandı", desc: "Sosyal medya hesabının satıcıya ait olduğu doğrulandı.", icon: "instagram" });
  if ((user.successfulSales ?? 0) > 0) out.push({ key: "sales", label: "Başarılı işlem geçmişi", desc: "Platformda tamamlanmış satışları olan satıcı.", icon: "check-decagram" });
  return out;
}

// "Doğrulanmış satıcı" sayılması için en az bir güçlü doğrulama (kimlik veya telefon).
export function isVerifiedSeller(user: VUser | undefined | null): boolean {
  return Boolean(user && (user.verifiedIdentity || user.verifiedPhone));
}

// Açıklayıcı: OrtakSat'ta HANGİ doğrulama seviyeleri VAR (ve olmayanı dürüstçe belirt).
// /guvenli-alisveris ve /trust'ta gösterilir; "Doğrulanmış satıcılar" iddiasını temellendirir.
export const VERIFICATION_LEVELS: VerificationBadge[] = [
  { key: "identity", label: "Kimlik doğrulandı", desc: "Satıcının resmi kimlik belgesi kontrol edilir.", icon: "card-account-details-outline" },
  { key: "phone", label: "Telefon doğrulandı", desc: "Telefon numarası SMS koduyla doğrulanır.", icon: "phone-check-outline" },
  { key: "instagram", label: "Instagram doğrulandı", desc: "Sosyal medya hesabının satıcıya ait olduğu doğrulanır.", icon: "instagram" },
  { key: "sales", label: "Başarılı işlem geçmişi", desc: "Platformda tamamlanmış satışlarla oluşan güven geçmişi.", icon: "check-decagram" }
];

// Henüz SUNULMAYAN seviyeler — kullanıcıya şeffaflık için "yol haritası" olarak gösterilebilir,
// ama satıcıya rozet olarak ASLA atanmaz.
export const VERIFICATION_ROADMAP: Array<{ label: string; desc: string; icon: string }> = [
  { label: "Şirket doğrulaması", desc: "Kurumsal satıcılar için vergi/ticaret sicili doğrulaması — yakında.", icon: "office-building-outline" },
  { label: "Banka hesabı doğrulaması", desc: "IBAN/hesap doğrulaması — yakında.", icon: "bank-outline" }
];

/**
 * Profil simgesindeki harf: YALNIZ adın ilk harfi ("Osman Çelik" → "O").
 * Ad + soyad baş harflerini birleştirmek ("OÇ") istenmeyen kısaltmalar üretiyordu (kullanıcı kararı, 2026-11-27).
 * Harf/rakam içermeyen ad boş döner.
 */
export function nameInitial(name?: string | null): string {
  const first = String(name ?? "")
    .split(/\s+/)
    .map((part) => part.replace(/[^\p{L}\p{N}]/gu, ""))
    .find(Boolean);
  return first ? (Array.from(first)[0] ?? "").toLocaleUpperCase("tr-TR") : "";
}

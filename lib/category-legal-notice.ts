/**
 * Kategoriye özel YASAL UYARI (ilan verme akışında yayın adımından önce gösterilir).
 *
 * Emlak ve vasıta ilanları, Taşınmaz Ticareti Hakkında Yönetmelik ile İkinci El Motorlu Kara Taşıtlarının
 * Ticareti Hakkında Yönetmelik'e tabidir: ilanı yalnız malik, mevzuatın izin verdiği yakınları veya yetki
 * belgeli + malikçe yetkilendirilmiş işletmeler verebilir ve mevzuat kimlik/yetki doğrulaması öngörür.
 * İş ilanlarında aracılık İŞKUR iznine tabidir; iş arayandan ücret istenemez.
 *
 * Bu uyarı, İlan Verme Kuralları md. 13–15'in arayüzdeki karşılığıdır (lib/legal-content.ts → ilan).
 * NOT: Uyarı tek başına mevzuatın öngördüğü doğrulamanın (EİDS) yerini TUTMAZ; yalnız ilan vereni
 * bilgilendirir ve beyanını kayıt altına alır. Metni değiştirirsen sözleşme maddelerini de güncelle.
 */
export type CategoryLegalNotice = { title: string; body: string };

/** `rootSlug`: kategori ağacındaki kök düğümün slug'ı (emlak, vasita, is-ilanlari…). */
export function categoryLegalNotice(rootSlug: string | undefined | null): CategoryLegalNotice | null {
  switch (rootSlug) {
    case "emlak":
      return {
        title: "Emlak ilanında yetki koşulu",
        body: "Bu kategoride ilanı yalnızca taşınmazın maliki, mevzuatın izin verdiği yakınları veya yetki belgesine sahip ve malik tarafından yetkilendirilmiş emlak işletmeleri verebilir. İlanı yayınlayarak buna yetkili olduğunu beyan edersin. Mevzuat kimlik ve yetki doğrulaması öngördüğünden senden doğrulama istenebilir; doğrulanamayan ilan yayından kaldırılabilir. Emlak işletmesiysen yetki belgesi numaranı açıklamada belirt."
      };
    case "vasita":
      return {
        title: "Vasıta ilanında yetki koşulu",
        body: "Bu kategoride ilanı yalnızca taşıtın maliki, mevzuatın izin verdiği yakınları veya yetki belgesine sahip ve malik tarafından yetkilendirilmiş işletmeler verebilir. İlanı yayınlayarak buna yetkili olduğunu beyan edersin. Mevzuat kimlik ve yetki doğrulaması öngördüğünden senden doğrulama istenebilir; doğrulanamayan ilan yayından kaldırılabilir. İkinci el taşıt ticareti yapıyorsan yetki belgesi numaranı açıklamada belirt; kilometre, hasar ve tramer bilgisini doğru yaz."
      };
    case "is-ilanlari":
      return {
        title: "İş ilanı kuralları",
        body: "İş ilanını yalnızca işveren, kendi açık pozisyonu için verebilir. Adaylardan başvuru, eğitim, kıyafet, depozito veya başka hiçbir ad altında ücret isteyemezsin. İlanda cinsiyet, din, dil, ırk, engellilik gibi nedenlere dayalı ayrımcı koşul yer alamaz."
      };
    default:
      return null;
  }
}

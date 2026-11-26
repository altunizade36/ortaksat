/**
 * Kendi <Head>'i olmayan (ya da giriş kapısı yüzünden Head'ini çizmeyen) sayfalar için
 * tarayıcı sekmesi başlığı. Kök düzendeki varsayılan <Head> bunu kullanır; sayfanın kendi
 * Head'i varsa o yine öne geçer. Anahtarlar expo-router'ın iç (İngilizce) yollarıdır.
 */
const EXACT: Record<string, string> = {
  "/explore": "İlanları Keşfet",
  "/explore-feed": "Keşfet Akışı",
  "/favorites": "Favorilerim",
  "/following": "Takip Ettiklerim",
  "/messages": "Mesajlarım",
  "/notifications": "Bildirimler",
  "/notifications-tab": "Bildirimler",
  "/notification-settings": "Bildirim Ayarları",
  "/partner": "Ortak Satış Paneli",
  "/seller": "İlanlarım",
  "/profile": "Hesabım",
  "/profile-edit": "Profili Düzenle",
  "/account-settings": "Hesap Ayarları",
  "/account-security": "Hesap Güvenliği",
  "/earnings": "Kazançlarım",
  "/offers": "Tekliflerim",
  "/buyer-requests": "Alıcı Talepleri",
  "/support": "Destek",
  "/reports": "Şikâyetlerim",
  "/report": "Şikâyet Et",
  "/review": "Değerlendirme",
  "/legal": "Yasal & Destek",
  "/trust": "Güven Merkezi",
  "/market-tools": "Satıcı Araçları",
  "/mobile-tools": "İlan Araçları",
  "/toplu-ilan": "Toplu İlan Yükle",
  "/magaza-sirasi": "Mağaza Sırası",
  "/engellenenler": "Engellenen Kullanıcılar",
  "/kurumsal-bilgiler": "Kurumsal Hesap Bilgileri",
  "/menu": "Menü",
  "/admin": "Yönetim Paneli",
  "/auth": "Giriş Yap",
  "/create": "İlan Ver"
};

const PREFIX: [string, string][] = [
  ["/chat/", "Sohbet"],
  ["/listing-edit/", "İlanı Düzenle"],
  ["/listing-stats/", "İlan İstatistikleri"],
  ["/listing/", "İlan Detayı"],
  ["/store/", "Mağaza"],
  ["/partnership-request/", "Ortaklık Başvurusu"],
  ["/partnership/", "Ortaklık"],
  ["/ortak/", "Ortak Vitrini"],
  ["/onay/", "Onay"]
];

export function routeTitle(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (EXACT[p]) return EXACT[p];
  for (const [prefix, title] of PREFIX) if (p.startsWith(prefix)) return title;
  return null;
}

import { toInternalUrl } from "@/lib/url-aliases";

/**
 * Uygulamaya dışarıdan gelen bağlantı (paylaşılan ilan, bildirim, uygulama bağlantısı) yönlendiriciye verilmeden
 * önce buradan geçer. Site adresleri Türkçe (/ilan/…, /magaza/…, /ortak-satis?sekme=…); uygulamanın iç rotaları
 * İngilizce dosya adlarıdır → Türkçe adres iç rotaya çevrilir (bkz. lib/url-aliases.ts).
 *
 * BİLEREK TUTUCU: yalnız tanınan üç biçim ele alınır ("/yol", "ortaksat://yol", "https://(www.)ortaksat.com/yol") ve
 * yalnız çeviri gerçekten bir şey değiştiriyorsa yeni yol döner. Diğer her şey (Expo Go'nun "exp://…/--/…" adresleri,
 * eski İngilizce adresler, tanınmayan yollar) OLDUĞU GİBİ geçer; hata olursa bağlantı hiç değiştirilmez.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    if (!path) return path;
    let local: string | null = null;
    if (path.startsWith("/")) local = path;
    else {
      const match = path.match(/^(?:ortaksat:\/\/|https?:\/\/(?:www\.)?ortaksat\.com)(\/?.*)$/i);
      if (match) local = match[1].startsWith("/") ? match[1] : `/${match[1]}`;
    }
    if (local === null) return path;
    const internal = toInternalUrl(local);
    return internal === local ? path : internal;
  } catch {
    return path;
  }
}

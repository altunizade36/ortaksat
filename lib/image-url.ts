/**
 * KART GÖRSELİ — küçük varyant seçici.
 *
 * Sorun: ilan kartları ekranda ~180-256px genişliğinde, ama ilan görselleri tam boyut
 * geliyordu (demo JPEG'ler 1024x1024 / 130-260kB). Keşfet sayfası tek açılışta 23 görsel
 * × ~150kB indiriyordu → masaüstünde LCP 2.3-3.1sn (ölçüldü: e2e/79-explore-lcp).
 *
 * Demo görsellerinin 512px WebP varyantları üretildi (public/demo/t/<ad>.webp, ort. 15kB).
 * Bu fonksiyon kart için o varyantı seçer. Tanımadığı bir URL'i (kullanıcı yüklemesi,
 * kategori görseli, harici link) AYNEN döndürür — yani bilinmeyen kaynakta sessizce
 * bozulmaz, sadece optimize edilmemiş olur.
 */
export function cardImageUrl(url?: string | null): string | undefined {
  if (!url) return undefined;

  // Demo ilanları: build'de üretilen 512px WebP varyantı.
  const demo = url.match(/^(.*)\/demo\/([^/?#]+)\.jpe?g(\?.*)?$/i);
  if (demo) return `${demo[1]}/demo/t/${demo[2]}.webp`;

  // Kullanıcı yüklemeleri: Supabase görsel dönüşümü bu planda KAPALI (render/image → 403),
  // bu yüzden küçük varyant yükleme anında yanına konur: <uuid>.jpg → <uuid>-t.jpg
  // (bkz. uploadListingImage). Yoksa SafeRemoteImage orijinale geri döner.
  const up = url.match(/^(.*\/listing-images\/.+)\.(jpe?g|png|webp)(\?.*)?$/i);
  if (up && !/-t$/i.test(up[1])) return `${up[1]}-t.jpg`;

  return url;
}

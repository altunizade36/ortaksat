/**
 * REKLAM AĞI KİMLİKLERİ (Google AdSense) — yalnız web sitesi; uygulamada reklam yoktur.
 *
 * İkisi de BOŞKEN sitede reklamla ilgili hiçbir şey çalışmaz (betik yüklenmez, alan çizilmez).
 * Kimlikler gizli değildir (yayıncı kimliği public/ads.txt içinde zaten herkese açıktır).
 *
 * Kurulum: `python scripts/ads.py kur ca-pub-XXXXXXXXXXXXXXXX <reklam birimi no>` bu dosyayı ve public/ads.txt'yi
 * yazar. Reklamların GÖRÜNMESİ ayrıca sunucudaki anahtara bağlıdır (platform_settings.ads_enabled →
 * `python scripts/ads.py ac | kapat`, yeniden yayın gerekmez) ve ziyaretçinin "Hedefleme ve Reklam" iznine.
 *
 * Ortam değişkenleri yalnız yerel deneme içindir (canlı değerler aşağıdaki sabitlerdir).
 */
const FILE_CLIENT = "";
const FILE_SIDE_SLOT = "";

/** Yayıncı kimliği: "ca-pub-" + rakamlar. */
export const ADSENSE_CLIENT = (process.env.EXPO_PUBLIC_ADSENSE_CLIENT ?? "").trim() || FILE_CLIENT;
/** Yan (dikey) reklam biriminin numarası. Otomatik reklamlar KULLANILMAZ: yalnız bu birim, yalnız yan boşluklarda. */
export const ADSENSE_SIDE_SLOT = (process.env.EXPO_PUBLIC_ADSENSE_SIDE_SLOT ?? "").trim() || FILE_SIDE_SLOT;

export const adsConfigured = /^ca-pub-\d{10,20}$/.test(ADSENSE_CLIENT) && /^\d{6,20}$/.test(ADSENSE_SIDE_SLOT);

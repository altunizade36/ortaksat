// Türkiye il listesi + şehir slug/eşleşme yardımcıları.
// SEO şehir×kategori sayfaları (/kategori/[slug]/[sehir]) ve sitemap bunu kullanır.
// citySlug(), category-tree.ts'deki sl() ile AYNI TR kurallarını uygular (İ→i, ı→i, ç→c…).

const TR_MAP: Record<string, string> = { "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u", "â": "a", "î": "i", "û": "u", "&": "ve" };

export function citySlug(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .split("")
    .map((ch) => TR_MAP[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// 81 il (plaka sırası).
export const TR_PROVINCES: string[] = [
  "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Amasya", "Ankara", "Antalya", "Artvin", "Aydın", "Balıkesir",
  "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli",
  "Diyarbakır", "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkari",
  "Hatay", "Isparta", "Mersin", "İstanbul", "İzmir", "Kars", "Kastamonu", "Kayseri", "Kırklareli", "Kırşehir",
  "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Kahramanmaraş", "Mardin", "Muğla", "Muş", "Nevşehir",
  "Niğde", "Ordu", "Rize", "Sakarya", "Samsun", "Siirt", "Sinop", "Sivas", "Tekirdağ", "Tokat",
  "Trabzon", "Tunceli", "Şanlıurfa", "Uşak", "Van", "Yozgat", "Zonguldak", "Aksaray", "Bayburt", "Karaman",
  "Kırıkkale", "Batman", "Şırnak", "Bartın", "Ardahan", "Iğdır", "Yalova", "Karabük", "Kilis", "Osmaniye", "Düzce"
];

// Slug -> il adı (görüntüleme için).
export const PROVINCE_BY_SLUG: Record<string, string> = Object.fromEntries(
  TR_PROVINCES.map((p) => [citySlug(p), p])
);

export function findProvince(slug: string | undefined): string | undefined {
  if (!slug) return undefined;
  return PROVINCE_BY_SLUG[citySlug(slug)];
}

// SEO odaklı büyük şehirler — sitemap ve şehir çipleri bunları kullanır.
export const SEO_CITY_SLUGS: string[] = [
  "istanbul", "ankara", "izmir", "bursa", "antalya", "adana",
  "konya", "gaziantep", "kocaeli", "mersin", "kayseri", "eskisehir"
];

// Şehir×kategori statik sayfalarının kategori tarafı. scripts/generate-sitemap.mjs
// içindeki CITY_CATEGORY_SLUGS ile BİREBİR aynı olmalı.
export const CITY_CATEGORY_SLUGS: string[] = [
  "emlak", "vasita", "cep-telefonu", "dizustu-bilgisayar", "televizyon", "beyaz-esya",
  "mobilya", "kadin-giyim", "erkek-giyim", "ayakkabi", "spor-ve-outdoor", "kucuk-ev-aletleri"
];

// Bir ilanın konumu verilen şehre ait mi? location "İstanbul" ya da
// "Kadıköy, İstanbul" gibi olabilir; token bazlı (il adları tek kelime) eşleşir.
export function listingInCity(location: string | undefined, wantedCitySlug: string): boolean {
  if (!location) return false;
  return citySlug(location).split("-").includes(wantedCitySlug);
}

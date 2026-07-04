import type { Listing } from "@/lib/types";

const DEMO_ROOT = "/demo-products";

const CATEGORY_FALLBACKS = {
  vehicles: `${DEMO_ROOT}/vehicles/fallback.png`,
  "real-estate": `${DEMO_ROOT}/real-estate/fallback.png`,
  electronics: `${DEMO_ROOT}/electronics/fallback.png`,
  home: `${DEMO_ROOT}/home/fallback.png`,
  garden: `${DEMO_ROOT}/garden/fallback.png`,
  fashion: `${DEMO_ROOT}/fashion/fallback.png`,
  camera: `${DEMO_ROOT}/camera/fallback.png`,
  games: `${DEMO_ROOT}/games/fallback.png`
} as const;

type DemoCategory = keyof typeof CATEGORY_FALLBACKS;

const CATEGORY_BY_LISTING_CATEGORY: Record<string, DemoCategory> = {
  Otomobil: "vehicles",
  Motosiklet: "vehicles",
  "Deniz Araçları": "vehicles",
  "Konut - Satılık": "real-estate",
  "Konut - Kiralık": "real-estate",
  "Arsa & İşyeri": "real-estate",
  "Cep Telefonu": "electronics",
  "Dizüstü Bilgisayar": "electronics",
  Televizyon: "electronics",
  Tablet: "electronics",
  Kulaklık: "electronics",
  "Beyaz Eşya": "home",
  "Küçük Ev Aleti": "home",
  "Koltuk Takımı": "home",
  "Yemek Odası": "home",
  "Yatak Odası": "home",
  "Ev Dekorasyon": "home",
  "Yapı Market & Bahçe": "garden",
  "Kadın Giyim": "fashion",
  "Erkek Giyim": "fashion",
  Ayakkabı: "fashion",
  Çanta: "fashion",
  Saat: "fashion",
  "Güneş Gözlüğü": "fashion",
  Parfüm: "fashion",
  Kozmetik: "fashion",
  "Fotoğraf & Kamera": "camera",
  "Oyun & Konsol": "games"
};

const IMAGE_BY_TITLE: Record<string, { category: DemoCategory; file: string; alt: string }> = {
  "Jet Ski Yamaha": { category: "vehicles", file: "jet-ski-yamaha.jpg", alt: "Yamaha jet ski örnek ilan fotoğrafı" },
  "Şişme Bot 4 Kişilik": { category: "vehicles", file: "sisme-bot-4-kisilik.jpg", alt: "4 kişilik şişme bot örnek ilan fotoğrafı" },
  "Profesyonel Matkap Seti": { category: "garden", file: "profesyonel-matkap-seti.jpg", alt: "Profesyonel matkap seti örnek ilan fotoğrafı" },
  "Benzinli Çim Biçme Makinesi": { category: "garden", file: "benzinli-cim-bicme-makinesi.jpg", alt: "Benzinli çim biçme makinesi örnek ilan fotoğrafı" },
  "Plaza Kat Ofis": { category: "real-estate", file: "plaza-kat-ofis.jpg", alt: "Modern plaza kat ofis örnek ilan fotoğrafı" },
  "Cadde Üstü Dükkan": { category: "real-estate", file: "cadde-ustu-dukkan.jpg", alt: "Cadde üstü dükkan cephesi örnek ilan fotoğrafı" },
  "İmarlı Arsa 500m²": { category: "real-estate", file: "imarli-arsa-500m.jpg", alt: "İmarlı arsa ve tarla örnek ilan fotoğrafı" },
  "2+1 Eşyalı Kiralık": { category: "real-estate", file: "2-1-esyali-kiralik.jpg", alt: "Eşyalı 2+1 daire salonu örnek ilan fotoğrafı" },
  "1+1 Kiralık Daire": { category: "real-estate", file: "1-1-kiralik-daire.jpg", alt: "Modern 1+1 kiralık daire içi örnek ilan fotoğrafı" },
  "Müstakil Villa Havuzlu": { category: "real-estate", file: "mustakil-villa-havuzlu.jpg", alt: "Havuzlu müstakil villa örnek ilan fotoğrafı" },
  "DJI Mini 4 Pro Drone": { category: "camera", file: "dji-mini-4-pro-drone.jpg", alt: "DJI Mini 4 Pro drone örnek ilan fotoğrafı" },
  "Sony Alpha A7 IV": { category: "camera", file: "sony-alpha-a7-iv.jpg", alt: "Sony Alpha A7 IV kamera gövdesi örnek ilan fotoğrafı" },
  "Canon EOS R6 Body": { category: "camera", file: "canon-eos-r6-body.jpg", alt: "Canon EOS R6 kamera gövdesi örnek ilan fotoğrafı" },
  "Nintendo Switch OLED": { category: "games", file: "nintendo-switch-oled.jpg", alt: "Nintendo Switch OLED tarzı oyun konsolu örnek ilan fotoğrafı" },
  "Xbox Series X": { category: "games", file: "xbox-series-x.jpg", alt: "Xbox Series X konsol örnek ilan fotoğrafı" }
};

export function getDemoCategory(category?: string | null): DemoCategory {
  return (category && CATEGORY_BY_LISTING_CATEGORY[category]) || "electronics";
}

export function getDemoFallbackCategoryImage(category?: string | null) {
  return CATEGORY_FALLBACKS[getDemoCategory(category)];
}

export function getDemoProductImageMeta(input: Pick<Listing, "title" | "category" | "image">) {
  const exact = IMAGE_BY_TITLE[input.title];
  const fallbackCategoryImage = CATEGORY_FALLBACKS[exact?.category ?? getDemoCategory(input.category)];
  const imageUrl = exact ? `${DEMO_ROOT}/${exact.category}/${exact.file}` : input.image;

  return {
    title: input.title,
    category: input.category,
    subcategory: input.category,
    imageUrl,
    imageAlt: exact?.alt ?? `${input.title} örnek ilan görseli`,
    fallbackCategoryImage
  };
}
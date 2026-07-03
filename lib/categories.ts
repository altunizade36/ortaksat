import { MaterialCommunityIcons } from "@expo/vector-icons";

export type ListingCategory = {
  key: string;
  label: string;
  shortLabel: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  subcategories: string[];
  requiredDetails: string[];
  partnerHint: string;
};

export const listingCategories: ListingCategory[] = [
  {
    key: "Elektronik",
    label: "Elektronik",
    shortLabel: "Tekno",
    icon: "cellphone-link",
    subcategories: ["Telefon aksesuarı", "Akıllı cihaz", "Ses ve kulaklık", "Araç elektroniği", "Aydınlatma"],
    requiredDetails: ["Model/uyumluluk", "Garanti durumu", "Kutu içeriği", "Renk/stok seçeneği"],
    partnerHint: "Teknik özellik, garanti ve uyumluluk bilgisi net olmalı."
  },
  {
    key: "Moda",
    label: "Moda",
    shortLabel: "Moda",
    icon: "hanger",
    subcategories: ["Çanta", "Takı", "Ayakkabı", "Giyim", "Aksesuar"],
    requiredDetails: ["Beden/ölçü", "Malzeme", "Renk", "İade şartı"],
    partnerHint: "Beden, renk ve gerçek ürün fotoğrafı ortakların satışını hızlandırır."
  },
  {
    key: "Ev & Yaşam",
    label: "Ev & Yaşam",
    shortLabel: "Ev",
    icon: "home-variant",
    subcategories: ["Mutfak", "Dekorasyon", "Küçük ev aleti", "Mobilya", "Düzenleyici"],
    requiredDetails: ["Ölçü", "Kullanım alanı", "Malzeme", "Teslimat/kargo notu"],
    partnerHint: "Ölçü ve kullanım senaryosu açık yazılırsa yanlış talep azalır."
  },
  {
    key: "Anne & Bebek",
    label: "Anne & Bebek",
    shortLabel: "Bebek",
    icon: "baby-face-outline",
    subcategories: ["Bakım çantası", "Oyuncak", "Tekstil", "Beslenme", "Güvenlik"],
    requiredDetails: ["Yaş aralığı", "Malzeme", "Temizlik bilgisi", "Güvenlik uyarısı"],
    partnerHint: "Yaş aralığı ve güvenlik notu mutlaka paylaşım metninde olmalı."
  },
  {
    key: "Spor",
    label: "Spor",
    shortLabel: "Spor",
    icon: "dumbbell",
    subcategories: ["Fitness", "Yoga", "Outdoor", "Suluk", "Spor aksesuarı"],
    requiredDetails: ["Ölçü/ağırlık", "Kullanım seviyesi", "Malzeme", "Taşıma bilgisi"],
    partnerHint: "Kullanım videosu ve hedef kitle notu dönüşümü artırır."
  },
  {
    key: "Hediye",
    label: "Hediye",
    shortLabel: "Hediye",
    icon: "gift-outline",
    subcategories: ["Kupa", "Mum", "Kişisel hediye", "Set ürün", "Dekoratif"],
    requiredDetails: ["Paketleme", "Kişiselleştirme", "Teslim süresi", "Toplu sipariş"],
    partnerHint: "Hediye dili, paketleme ve teslim süresi net anlatılmalı."
  },
  {
    key: "Otomotiv",
    label: "Otomotiv",
    shortLabel: "Oto",
    icon: "car-outline",
    subcategories: ["Araç içi ürün", "Kamera", "Bakım", "Aksesuar", "Telefon tutucu"],
    requiredDetails: ["Araç uyumluluğu", "Montaj durumu", "Garanti", "Kutu içeriği"],
    partnerHint: "Uyumluluk ve montaj vaadi dikkatli yazılmalı."
  },
  {
    key: "Kozmetik",
    label: "Kozmetik",
    shortLabel: "Kozmetik",
    icon: "face-woman-shimmer-outline",
    subcategories: ["Cilt bakım", "Makyaj", "Saç bakım", "Parfüm", "Kişisel bakım"],
    requiredDetails: ["İçerik", "Cilt tipi", "Son kullanma", "Hijyen/iade kuralı"],
    partnerHint: "İçerik ve hijyen/iade kuralları açık yazılmalı."
  },
  {
    key: "Kitap & Hobi",
    label: "Kitap & Hobi",
    shortLabel: "Hobi",
    icon: "book-open-page-variant-outline",
    subcategories: ["Kitap", "Hobi seti", "Puzzle", "Sanat", "Koleksiyon"],
    requiredDetails: ["Dil", "Yaş/kitle", "Set içeriği", "Kondisyon"],
    partnerHint: "Kitle ve set içeriği netleşirse doğru alıcı gelir."
  },
  {
    key: "Dijital Ürün",
    label: "Dijital Ürün",
    shortLabel: "Dijital",
    icon: "cloud-download-outline",
    subcategories: ["Eğitim", "Şablon", "Yazılım", "Dijital dosya", "Online hizmet"],
    requiredDetails: ["Teslim yöntemi", "Lisans/kullanım hakkı", "İade kuralı", "Destek süresi"],
    partnerHint: "Teslim ve kullanım hakkı şartları yazılı olmalı."
  },
  {
    key: "Telefon & Aksesuar",
    label: "Telefon & Aksesuar",
    shortLabel: "Telefon",
    icon: "cellphone",
    subcategories: ["Telefon", "Kılıf", "Şarj & kablo", "Powerbank", "Ekran koruyucu"],
    requiredDetails: ["Model/uyumluluk", "Garanti", "Kutu içeriği", "Renk"],
    partnerHint: "Model ve uyumluluk bilgisi paylaşımda net olmalı."
  },
  {
    key: "Bilgisayar & Oyun",
    label: "Bilgisayar & Oyun",
    shortLabel: "Bilgisayar",
    icon: "laptop",
    subcategories: ["Dizüstü", "Bileşen", "Oyun konsolu", "Klavye & mouse", "Aksesuar"],
    requiredDetails: ["Teknik özellik", "Garanti", "Kondisyon", "Kutu içeriği"],
    partnerHint: "Teknik özellik ve performans bilgisi alıcıyı ikna eder."
  },
  {
    key: "Ayakkabı & Çanta",
    label: "Ayakkabı & Çanta",
    shortLabel: "Ayakkabı",
    icon: "bag-personal-outline",
    subcategories: ["Spor ayakkabı", "Bot", "Sırt çantası", "El çantası", "Cüzdan"],
    requiredDetails: ["Numara/ölçü", "Malzeme", "Renk", "İade şartı"],
    partnerHint: "Numara, ölçü ve gerçek fotoğraf satışı hızlandırır."
  },
  {
    key: "Takı & Aksesuar",
    label: "Takı & Aksesuar",
    shortLabel: "Takı",
    icon: "diamond-stone",
    subcategories: ["Kolye", "Yüzük", "Bileklik", "Küpe", "Saat"],
    requiredDetails: ["Malzeme/ayar", "Ölçü", "Sertifika", "İade şartı"],
    partnerHint: "Malzeme ve ölçü bilgisi güven verir."
  },
  {
    key: "Mutfak",
    label: "Mutfak",
    shortLabel: "Mutfak",
    icon: "silverware-fork-knife",
    subcategories: ["Pişirme", "Saklama", "Küçük ev aleti", "Sofra", "Düzenleme"],
    requiredDetails: ["Ölçü/kapasite", "Malzeme", "Garanti", "Teslimat"],
    partnerHint: "Kapasite ve kullanım senaryosu açık yazılmalı."
  },
  {
    key: "Dekorasyon",
    label: "Dekorasyon",
    shortLabel: "Dekor",
    icon: "sofa-outline",
    subcategories: ["Aydınlatma", "Tablo", "Vazo", "Tekstil", "Aksesuar"],
    requiredDetails: ["Ölçü", "Malzeme", "Renk", "Teslimat notu"],
    partnerHint: "Ölçü ve mekân görseli yanlış talebi azaltır."
  },
  {
    key: "Koleksiyon",
    label: "Koleksiyon",
    shortLabel: "Koleksiyon",
    icon: "trophy-outline",
    subcategories: ["Figür", "Pul & para", "Kart", "Plak", "Antika"],
    requiredDetails: ["Orijinallik", "Kondisyon", "Yıl", "Sertifika"],
    partnerHint: "Orijinallik ve kondisyon kanıtı değeri artırır."
  },
  {
    key: "Ofis & Kırtasiye",
    label: "Ofis & Kırtasiye",
    shortLabel: "Ofis",
    icon: "pencil-box-outline",
    subcategories: ["Kırtasiye", "Ofis mobilya", "Yazıcı & sarf", "Defter", "Düzenleyici"],
    requiredDetails: ["Ölçü", "Adet/paket", "Uyumluluk", "Teslimat"],
    partnerHint: "Paket adedi ve uyumluluk bilgisi net olmalı."
  },
  {
    key: "Evcil Hayvan",
    label: "Evcil Hayvan",
    shortLabel: "Evcil",
    icon: "paw",
    subcategories: ["Mama", "Oyuncak", "Tasma", "Bakım", "Yatak & kafes"],
    requiredDetails: ["Tür/ırk uyumu", "Yaş", "İçerik", "Son kullanma"],
    partnerHint: "Tür uyumu ve içerik bilgisi güven verir."
  }
];

const IMG = (id: string) => `https://images.unsplash.com/photo-${id}?w=600&q=80&auto=format&fit=crop`;

/** Curated, on-topic hero image per category (used for category tiles everywhere). */
export const categoryImages: Record<string, string> = {
  "Elektronik": IMG("1498049794561-7780e7231661"),
  "Moda": IMG("1483985988355-763728e1935b"),
  "Ev & Yaşam": IMG("1586023492125-27b2c045efd7"),
  "Anne & Bebek": IMG("1515488042361-ee00e0ddd4e4"),
  "Spor": IMG("1517836357463-d25dfeac3438"),
  "Hediye": IMG("1549465220-1a8b9238cd48"),
  "Otomotiv": IMG("1503376780353-7e6692767b70"),
  "Kozmetik": IMG("1522335789203-aabd1fc54bc9"),
  "Kitap & Hobi": IMG("1512820790803-83ca734da794"),
  "Dijital Ürün": IMG("1498050108023-c5249f4df085"),
  "Telefon & Aksesuar": IMG("1511707171634-5f897ff02aa9"),
  "Bilgisayar & Oyun": IMG("1542751371-adc38448a05e"),
  "Ayakkabı & Çanta": IMG("1460353581641-37baddab0fa2"),
  "Takı & Aksesuar": IMG("1515562141207-7a88fb7ce338"),
  "Mutfak": IMG("1556909114-f6e7ad7d3136"),
  "Dekorasyon": IMG("1513161455079-7dc1de15ef3e"),
  "Koleksiyon": IMG("1606760227091-3dd870d97f1d"),
  "Ofis & Kırtasiye": IMG("1497032628192-86f99bcd76bc"),
  "Evcil Hayvan": IMG("1450778869180-41d0601e046e")
};

export function getCategoryImage(category: string) {
  return categoryImages[category] ?? IMG("1441986300917-64674bd600d8");
}

export function getCategory(category: string) {
  return listingCategories.find((item) => item.key === category);
}

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

// Her kategori/alt-kategori için belirgin ikon — sahibinden-tarzı taksonomi dahil.
const CATEGORY_ICONS: Record<string, IconName> = {
  // Üst kategoriler
  "Emlak": "home-city-outline",
  "Vasıta": "car-outline",
  "Yedek Parça, Aksesuar & Tuning": "car-wrench",
  "İkinci El & Sıfır Alışveriş": "shopping-outline",
  "İş Makineleri & Sanayi": "excavator",
  "Ustalar & Hizmetler": "account-hard-hat",
  "Özel Ders & Eğitim": "school-outline",
  "İş İlanları": "briefcase-outline",
  "Yardımcı Arayanlar": "account-search-outline",
  "Hayvanlar Alemi": "paw",
  "Arayanlar / Talep İlanları": "hand-heart-outline",
  "Dijital Ürünler & Hizmetler": "cloud-download-outline",
  "Yapı Market & Bahçe": "hammer-wrench",
  "Müzik Enstrümanları": "guitar-electric",
  "Sağlık & Medikal": "medical-bag",
  "Diğer": "dots-horizontal-circle-outline",
  // Önemli alt kategoriler (kenar çubuğu / filtre / ilan-ver)
  "Elektronik": "cellphone-link",
  "Cep Telefonu": "cellphone",
  "Telefon & Aksesuar": "cellphone",
  "Televizyon": "television",
  "Tablet": "tablet",
  "Ses & Kulaklık": "headphones",
  "Foto & Kamera": "camera-outline",
  "Bilgisayar & Oyun": "laptop",
  "Dizüstü Bilgisayar": "laptop",
  "Masaüstü Bilgisayar": "desktop-tower-monitor",
  "Oyun & Konsol": "controller-classic-outline",
  "Ev & Yaşam": "home-variant-outline",
  "Mobilya": "sofa-outline",
  "Beyaz Eşya": "fridge-outline",
  "Buzdolabı": "fridge-outline",
  "Çamaşır Makinesi": "washing-machine",
  "Bulaşık Makinesi": "dishwasher",
  "Klima": "air-conditioner",
  "Mutfak": "silverware-fork-knife",
  "Süpermarket & Gıda": "basket-outline",
  "Küçük Ev Aletleri": "kettle-outline",
  "Bahçe & Yaşam": "flower-outline",
  "Moda": "hanger",
  "Kadın Giyim": "human-female",
  "Erkek Giyim": "human-male",
  "Çocuk Giyim": "human-child",
  "Ayakkabı": "shoe-sneaker",
  "Ayakkabı & Çanta": "shoe-sneaker",
  "Çanta": "bag-personal-outline",
  "Saat": "watch-variant",
  "Gözlük": "glasses",
  "Takı & Mücevher": "diamond-stone",
  "Takı & Aksesuar": "diamond-stone",
  "Anne & Bebek": "baby-carriage",
  "Kozmetik & Kişisel Bakım": "lipstick",
  "Spor & Outdoor": "dumbbell",
  "Fitness & Kondisyon": "dumbbell",
  "Bisiklet": "bike",
  "Kamp & Doğa": "tent",
  "Kitap & Hobi": "book-open-page-variant-outline",
  "Kitap": "book-open-variant",
  "Müzik & Film": "filmstrip",
  "Koleksiyon & Antika": "treasure-chest",
  "Koleksiyon Ürünleri": "treasure-chest",
  "Oyuncak": "teddy-bear",
  "Ofis & Kırtasiye": "pencil-box-outline",
  "Dijital Ürünler": "cloud-download-outline",
  "Evcil Hayvan Ürünleri": "paw",
  // Emlak / vasıta alt dalları
  "Konut": "home-outline",
  "İş Yeri": "office-building-outline",
  "Arsa / Arazi": "island",
  "Bina": "office-building-outline",
  "Otomobil": "car-outline",
  "Arazi, SUV & Pickup": "truck-outline",
  "Motosiklet": "motorbike",
  "Minivan & Panelvan": "van-passenger",
  "Ticari Araçlar": "truck-outline",
  "Deniz Araçları": "sail-boat",
  "Karavan": "rv-truck",
  "Hasarlı Araçlar": "car-wrench"
};

// Etiket eşleşmezse anahtar-kelimeyle en yakın ikonu bul.
const ICON_KEYWORDS: Array<[RegExp, IconName]> = [
  [/telefon|cep/, "cellphone"],
  [/bilgisayar|laptop|pc/, "laptop"],
  [/televizyon|tv/, "television"],
  [/kulaklık|ses|hoparlör/, "headphones"],
  [/kamera|foto/, "camera-outline"],
  [/oyun|konsol/, "controller-classic-outline"],
  [/beyaz eşya|buzdolab|çamaşır|bulaşık|kurutma|fırın|ocak/, "fridge-outline"],
  [/klima|kombi|ısıt/, "air-conditioner"],
  [/mobilya|koltuk|kanepe/, "sofa-outline"],
  [/mutfak/, "silverware-fork-knife"],
  [/süpermarket|gıda|market|bakkal|içecek|kahve|çay|atıştırmalık/, "basket-outline"],
  [/küçük ev|blender|ütü|süpürge|airfryer|kettle|tost/, "kettle-outline"],
  [/bahçe|çiçek|saksı|mangal|barbekü/, "flower-outline"],
  [/giyim|moda|elbise|gömlek/, "hanger"],
  [/ayakkabı/, "shoe-sneaker"],
  [/çanta|valiz|bavul/, "bag-personal-outline"],
  [/saat/, "watch-variant"],
  [/gözlük/, "glasses"],
  [/takı|mücevher|altın|pırlanta/, "diamond-stone"],
  [/bebek|anne/, "baby-carriage"],
  [/kozmetik|makyaj|parfüm|bakım/, "lipstick"],
  [/spor|fitness|outdoor/, "dumbbell"],
  [/bisiklet/, "bike"],
  [/kamp|çadır/, "tent"],
  [/kitap|dergi|roman/, "book-open-variant"],
  [/müzik|enstrüman|gitar/, "guitar-electric"],
  [/film|dvd|plak/, "filmstrip"],
  [/koleksiyon|antika|pul|para/, "treasure-chest"],
  [/oyuncak/, "teddy-bear"],
  [/kırtasiye|ofis|kalem/, "pencil-box-outline"],
  [/hayvan|evcil|kedi|köpek/, "paw"],
  [/emlak|konut|daire|ev|arsa|arazi|bina/, "home-city-outline"],
  [/araç|araba|otomobil|vasıta|motosiklet/, "car-outline"],
  [/yedek parça|tuning|aksesuar/, "car-wrench"],
  [/iş makinesi|sanayi|fabrika/, "excavator"],
  [/usta|hizmet|tesisat|tamir/, "account-hard-hat"],
  [/eğitim|ders|kurs|okul/, "school-outline"],
  [/iş ilan|kariyer/, "briefcase-outline"],
  [/dijital|yazılım|lisans/, "cloud-download-outline"],
  [/yapı market|bahçe|hırdavat/, "hammer-wrench"],
  [/sağlık|medikal|tıbbi/, "medical-bag"],
  [/hediye/, "gift-outline"]
];

export function getCategoryIcon(category: string): IconName {
  if (CATEGORY_ICONS[category]) return CATEGORY_ICONS[category];
  const fromCfg = getCategory(category)?.icon;
  if (fromCfg) return fromCfg;
  const lower = category.toLocaleLowerCase("tr-TR");
  for (const [re, icon] of ICON_KEYWORDS) if (re.test(lower)) return icon;
  return "shape-outline";
}

export function getCategoryShortLabel(category: string) {
  return getCategory(category)?.shortLabel ?? category;
}

export function getCategorySubcategories(category: string) {
  return getCategory(category)?.subcategories ?? ["Genel", "Vitrin", "Kampanya"];
}

export function getCategoryRequiredDetails(category: string) {
  return getCategory(category)?.requiredDetails ?? ["Fiyat", "Stok", "Teslimat", "İade"];
}

export function getCategoryPartnerHint(category: string) {
  return getCategory(category)?.partnerHint ?? "Ortakların ürünü doğru anlatması için ölçü, stok, teslimat ve iade bilgisi net olmalı.";
}

export function inferListingSubcategory(input: { category: string; tags?: string[]; title?: string }) {
  const text = [input.title, ...(input.tags ?? [])].join(" ").toLocaleLowerCase("tr-TR");
  const options = getCategorySubcategories(input.category);
  const exact = options.find((option) => text.includes(option.toLocaleLowerCase("tr-TR")));
  if (exact) return exact;
  if (text.includes("kulaklık") || text.includes("ses")) return "Ses ve kulaklık";
  if (text.includes("çanta")) return input.category === "Anne & Bebek" ? "Bakım çantası" : "Çanta";
  if (text.includes("kolye") || text.includes("takı")) return "Takı";
  if (text.includes("kamera")) return input.category === "Otomotiv" ? "Kamera" : "Araç elektroniği";
  if (text.includes("blender") || text.includes("kahve") || text.includes("kupa")) return input.category === "Hediye" ? "Kupa" : "Mutfak";
  if (text.includes("led") || text.includes("ışık")) return "Aydınlatma";
  return options[0] ?? input.category;
}

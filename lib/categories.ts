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

export function getCategory(category: string) {
  return listingCategories.find((item) => item.key === category);
}

export function getCategoryIcon(category: string): keyof typeof MaterialCommunityIcons.glyphMap {
  return getCategory(category)?.icon ?? "tag-outline";
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

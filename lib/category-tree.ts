// Sahibinden-style multi-level category taxonomy for OrtakSat.
// Top → sub → detail nodes, each resolving to a category-specific form schema.
// Designed so the listing form changes by category (a phone listing ≠ a flat listing).

const TR_MAP: Record<string, string> = { "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u", "â": "a", "î": "i", "û": "u", "&": "ve" };
function sl(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .split("")
    .map((ch) => TR_MAP[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type FieldType = "text" | "textarea" | "number" | "select" | "bool" | "tags";
export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  suffix?: string;
};
export type FormSchema = { key: string; title: string; fields: FieldDef[] };

export type CategoryNode = {
  key: string;
  label: string;
  slug: string;
  image?: string;
  formKey?: string;
  children?: CategoryNode[];
};

const IMG = (id: string) => `https://images.unsplash.com/photo-${id}?w=600&q=80&auto=format&fit=crop`;

// ---- builders ------------------------------------------------------------
function leaf(label: string, formKey?: string): CategoryNode {
  return { key: sl(label), label, slug: sl(label), formKey };
}
function node(label: string, children: CategoryNode[], formKey?: string, image?: string): CategoryNode {
  return { key: sl(label), label, slug: sl(label), children, formKey, image };
}
const leaves = (labels: string[], formKey?: string) => labels.map((l) => leaf(l, formKey));

// ---- marka/değer listeleri ----------------------------------------------
export const CAR_BRANDS = ["Audi", "BMW", "Chevrolet", "Citroën", "Dacia", "Fiat", "Ford", "Honda", "Hyundai", "Kia", "Mercedes-Benz", "Nissan", "Opel", "Peugeot", "Renault", "Seat", "Škoda", "Toyota", "Volkswagen", "Volvo", "Tesla", "BYD", "Togg", "Diğer"];
export const MOTO_BRANDS = ["Honda", "Yamaha", "Kawasaki", "Suzuki", "KTM", "BMW", "Bajaj", "TVS", "CFMoto", "Mondial", "Kuba", "RKS", "Diğer"];
export const WHITE_GOODS_BRANDS = ["Arçelik", "Beko", "Bosch", "Siemens", "Vestel", "Samsung", "LG", "Profilo", "Altus", "Grundig", "Diğer"];
const CAR_COLORS = ["Beyaz", "Siyah", "Gri", "Gümüş", "Kırmızı", "Mavi", "Lacivert", "Yeşil", "Kahverengi", "Bej", "Turuncu", "Diğer"];

// ---- shared field fragments ---------------------------------------------
const F = {
  title: { key: "title", label: "İlan başlığı", type: "text", required: true, placeholder: "Kısa ve net bir başlık" } as FieldDef,
  price: { key: "price", label: "Fiyat", type: "number", required: true, suffix: "₺" } as FieldDef,
  desc: { key: "description", label: "Açıklama", type: "textarea", required: true, placeholder: "Ürünü/ilanı detaylı anlat" } as FieldDef,
  durum: { key: "condition", label: "Ürün durumu", type: "select", required: true, options: ["Sıfır", "İkinci el", "Yenilenmiş"] } as FieldDef,
  garanti: { key: "warranty", label: "Garanti durumu", type: "select", options: ["Garantili", "Garantisiz", "Yok"] } as FieldDef,
  fatura: { key: "invoice", label: "Fatura var mı?", type: "bool" } as FieldDef,
  stok: { key: "stock", label: "Stok adedi", type: "number" } as FieldDef,
  renk: { key: "color", label: "Renk", type: "text" } as FieldDef,
  kargo: { key: "shipping", label: "Kargo / teslimat", type: "select", options: ["Kargo var", "Şehir içi elden", "Alıcı öder", "Ücretsiz kargo"] } as FieldDef,
  pazarlik: { key: "negotiable", label: "Pazarlık olur mu?", type: "bool" } as FieldDef,
  takas: { key: "swap", label: "Takas olur mu?", type: "bool" } as FieldDef,
  marka: { key: "brand", label: "Marka", type: "text", required: true } as FieldDef,
  model: { key: "model", label: "Model", type: "text", required: true } as FieldDef
};

// ---- form schemas (category-specific) ------------------------------------
export const formSchemas: Record<string, FormSchema> = {
  konut: {
    key: "konut",
    title: "Konut bilgileri",
    fields: [
      F.title,
      { key: "listingType", label: "İlan tipi", type: "select", required: true, options: ["Satılık", "Kiralık", "Devren", "Günlük"] },
      F.price,
      { key: "grossM2", label: "m² (brüt)", type: "number", required: true, suffix: "m²" },
      { key: "netM2", label: "m² (net)", type: "number", suffix: "m²" },
      { key: "rooms", label: "Oda sayısı", type: "select", required: true, options: ["1+0", "1+1", "2+1", "3+1", "4+1", "5+1", "5+ üzeri"] },
      { key: "buildingAge", label: "Bina yaşı", type: "select", options: ["0 (Sıfır)", "1-5", "6-10", "11-20", "21+"] },
      { key: "floor", label: "Bulunduğu kat", type: "text" },
      { key: "floorCount", label: "Kat sayısı", type: "number" },
      { key: "heating", label: "Isıtma tipi", type: "select", options: ["Doğalgaz (Kombi)", "Merkezi", "Klima", "Soba", "Yerden ısıtma", "Yok"] },
      { key: "bathrooms", label: "Banyo sayısı", type: "number" },
      { key: "balcony", label: "Balkon var mı?", type: "bool" },
      { key: "furnished", label: "Eşyalı mı?", type: "bool" },
      { key: "usage", label: "Kullanım durumu", type: "select", options: ["Boş", "Kiracılı", "Mülk sahibi"] },
      { key: "inSite", label: "Site içinde mi?", type: "bool" },
      { key: "dues", label: "Aidat", type: "number", suffix: "₺" },
      { key: "creditEligible", label: "Krediye uygun mu?", type: "bool" },
      { key: "deed", label: "Tapu durumu", type: "select", options: ["Kat Mülkiyetli", "Kat İrtifaklı", "Hisseli", "Müstakil Tapulu"] },
      F.takas,
      F.desc
    ]
  },
  isyeri: {
    key: "isyeri",
    title: "İş yeri bilgileri",
    fields: [
      F.title,
      { key: "listingType", label: "İlan tipi", type: "select", required: true, options: ["Satılık", "Kiralık", "Devren"] },
      F.price,
      { key: "grossM2", label: "m² (brüt)", type: "number", required: true, suffix: "m²" },
      { key: "rooms", label: "Bölüm / oda sayısı", type: "number" },
      { key: "buildingAge", label: "Bina yaşı", type: "text" },
      { key: "heating", label: "Isıtma", type: "select", options: ["Doğalgaz", "Merkezi", "Klima", "Yok"] },
      { key: "deed", label: "Tapu durumu", type: "text" },
      F.takas,
      F.desc
    ]
  },
  arsa: {
    key: "arsa",
    title: "Arsa bilgileri",
    fields: [
      F.title,
      { key: "listingType", label: "İlan tipi", type: "select", required: true, options: ["Satılık", "Kiralık", "Kat Karşılığı"] },
      F.price,
      { key: "m2", label: "m²", type: "number", required: true, suffix: "m²" },
      { key: "zoning", label: "İmar durumu", type: "select", options: ["Konut İmarlı", "Ticari İmarlı", "Sanayi İmarlı", "Tarla", "Bağ-Bahçe", "İmarsız"] },
      { key: "deed", label: "Tapu durumu", type: "select", options: ["Müstakil Tapulu", "Hisseli", "Tahsis"] },
      F.takas,
      F.desc
    ]
  },
  otomobil: {
    key: "otomobil",
    title: "Araç bilgileri",
    fields: [
      F.title,
      { key: "brand", label: "Marka", type: "select", required: true, options: CAR_BRANDS },
      { key: "series", label: "Seri", type: "text" },
      F.model,
      { key: "year", label: "Yıl", type: "number", required: true },
      { key: "fuel", label: "Yakıt", type: "select", required: true, options: ["Benzin", "Dizel", "LPG", "Hibrit", "Elektrik"] },
      { key: "gear", label: "Vites", type: "select", required: true, options: ["Manuel", "Otomatik", "Yarı Otomatik"] },
      { key: "km", label: "Kilometre", type: "number", required: true, suffix: "km" },
      { key: "body", label: "Kasa tipi", type: "select", options: ["Sedan", "Hatchback", "Station Wagon", "SUV", "Coupe", "Cabrio", "MPV", "Pickup"] },
      { key: "enginePower", label: "Motor gücü", type: "text", suffix: "hp" },
      { key: "engineCc", label: "Motor hacmi", type: "text", suffix: "cc" },
      { key: "color", label: "Renk", type: "select", options: CAR_COLORS },
      { key: "traction", label: "Çekiş", type: "select", options: ["Önden Çekiş", "Arkadan İtiş", "4x4"] },
      F.garanti,
      { key: "damage", label: "Hasar kaydı", type: "select", options: ["Yok", "Var", "Ağır Hasar Kayıtlı"] },
      { key: "paint", label: "Boya / değişen", type: "text", placeholder: "Örn. Tamamı orijinal" },
      { key: "from", label: "Kimden", type: "select", options: ["Sahibinden", "Galeriden"] },
      F.price,
      F.takas,
      { key: "creditEligible", label: "Krediye uygun mu?", type: "bool" },
      F.desc
    ]
  },
  motosiklet: {
    key: "motosiklet",
    title: "Motosiklet bilgileri",
    fields: [
      F.title, { key: "brand", label: "Marka", type: "select", required: true, options: MOTO_BRANDS }, F.model,
      { key: "year", label: "Yıl", type: "number", required: true },
      { key: "km", label: "Kilometre", type: "number", required: true, suffix: "km" },
      { key: "engineCc", label: "Motor hacmi", type: "text", suffix: "cc" },
      F.renk, F.garanti, F.price, F.takas, F.desc
    ]
  },
  vasitaGenel: {
    key: "vasitaGenel",
    title: "Araç bilgileri",
    fields: [F.title, F.marka, F.model, { key: "year", label: "Yıl", type: "number", required: true }, { key: "km", label: "Kilometre", type: "number", suffix: "km" }, F.price, F.takas, F.desc]
  },
  yedekParca: {
    key: "yedekParca",
    title: "Parça / aksesuar bilgileri",
    fields: [
      F.title,
      { key: "compatBrand", label: "Uyumlu marka", type: "text" },
      { key: "compatModel", label: "Uyumlu model", type: "text" },
      F.durum,
      { key: "origin", label: "Orijinal / yan sanayi", type: "select", options: ["Orijinal", "Yan Sanayi", "Çıkma"] },
      F.garanti, F.stok, F.price, F.kargo, F.desc
    ]
  },
  alisverisGenel: {
    key: "alisverisGenel",
    title: "Ürün bilgileri",
    fields: [F.title, { key: "brand", label: "Marka", type: "text" }, { key: "model", label: "Model", type: "text" }, F.durum, F.garanti, F.fatura, F.stok, F.renk, { key: "size", label: "Beden / ölçü", type: "text" }, F.kargo, F.price, F.pazarlik, F.takas, F.desc]
  },
  telefon: {
    key: "telefon",
    title: "Cep telefonu bilgileri",
    fields: [
      F.title,
      { key: "brand", label: "Marka", type: "select", required: true, options: ["iPhone", "Samsung", "Xiaomi", "Huawei", "Oppo", "Realme", "Vivo", "Tecno", "General Mobile", "Diğer"] },
      { key: "model", label: "Model", type: "text", required: true },
      { key: "storage", label: "Depolama", type: "select", required: true, options: ["64 GB", "128 GB", "256 GB", "512 GB", "1 TB"] },
      { key: "ram", label: "RAM", type: "text" },
      F.renk,
      F.garanti, F.fatura,
      { key: "box", label: "Kutu var mı?", type: "bool" },
      { key: "battery", label: "Pil sağlığı (iPhone)", type: "text", suffix: "%" },
      { key: "cosmetic", label: "Kozmetik durum", type: "select", options: ["Kusursuz", "Çok iyi", "İyi", "Yıpranmış"] },
      { key: "partChanged", label: "Değişen parça var mı?", type: "bool" },
      { key: "imei", label: "IMEI kayıt durumu", type: "select", options: ["Kayıtlı", "Kayıtsız", "Yurt dışı"] },
      { key: "charger", label: "Şarj cihazı dahil mi?", type: "bool" },
      { key: "condition", label: "Ürün durumu", type: "select", required: true, options: ["Sıfır", "İkinci el", "Yenilenmiş"] },
      F.stok, F.price, F.kargo, F.desc
    ]
  },
  isMakinesi: {
    key: "isMakinesi",
    title: "Makine / sanayi bilgileri",
    fields: [
      { key: "title", label: "Makine / ürün adı", type: "text", required: true },
      F.marka, F.model,
      { key: "year", label: "Üretim yılı", type: "number" },
      { key: "workHours", label: "Çalışma saati", type: "number", suffix: "saat" },
      F.durum, F.garanti,
      { key: "service", label: "Servis geçmişi", type: "text" },
      F.price,
      { key: "transport", label: "Nakliye bilgisi", type: "text" },
      F.desc
    ]
  },
  hizmet: {
    key: "hizmet",
    title: "Hizmet bilgileri",
    fields: [
      { key: "title", label: "Hizmet başlığı", type: "text", required: true },
      { key: "serviceType", label: "Hizmet tipi", type: "select", required: true, options: ["Yerinde", "Uzaktan", "Randevulu"] },
      { key: "priceType", label: "Fiyat tipi", type: "select", required: true, options: ["Sabit", "Saatlik", "Proje bazlı", "Teklif al"] },
      { key: "price", label: "Başlangıç fiyatı", type: "number", suffix: "₺" },
      { key: "experience", label: "Deneyim (yıl)", type: "number" },
      { key: "certificate", label: "Sertifika var mı?", type: "bool" },
      { key: "workHours", label: "Çalışma saatleri", type: "text" },
      F.desc
    ]
  },
  ders: {
    key: "ders",
    title: "Ders bilgileri",
    fields: [
      { key: "title", label: "Ders başlığı", type: "text", required: true },
      { key: "branch", label: "Branş", type: "text", required: true },
      { key: "level", label: "Eğitim seviyesi", type: "select", options: ["İlkokul", "Ortaokul", "Lise", "Üniversite", "Yetişkin"] },
      { key: "format", label: "Ders şekli", type: "select", required: true, options: ["Online", "Yüz yüze", "Hibrit"] },
      { key: "price", label: "Saatlik ücret", type: "number", suffix: "₺" },
      { key: "experience", label: "Deneyim (yıl)", type: "number" },
      { key: "graduation", label: "Mezuniyet / sertifika", type: "text" },
      { key: "availability", label: "Uygun günler", type: "text" },
      F.desc
    ]
  },
  isIlani: {
    key: "isIlani",
    title: "İş ilanı bilgileri",
    fields: [
      { key: "title", label: "Pozisyon adı", type: "text", required: true },
      { key: "company", label: "Şirket adı", type: "text" },
      { key: "workType", label: "Çalışma tipi", type: "select", required: true, options: ["Tam Zamanlı", "Yarı Zamanlı", "Freelance", "Staj", "Uzaktan"] },
      { key: "salary", label: "Maaş aralığı", type: "text" },
      { key: "experience", label: "Deneyim seviyesi", type: "select", options: ["Deneyimsiz", "1-3 yıl", "3-5 yıl", "5+ yıl"] },
      { key: "education", label: "Eğitim seviyesi", type: "select", options: ["Fark etmez", "Lise", "Önlisans", "Lisans", "Yüksek Lisans"] },
      { key: "benefits", label: "Yan haklar", type: "text" },
      F.desc
    ]
  },
  yardimci: {
    key: "yardimci",
    title: "Yardımcı / bakım talebi",
    fields: [
      { key: "title", label: "Aranan kişi / hizmet", type: "text", required: true },
      { key: "workType", label: "Çalışma şekli", type: "select", required: true, options: ["Yatılı", "Gündüzlü", "Saatlik", "Part-time"] },
      { key: "schedule", label: "Gün / saat bilgisi", type: "text" },
      { key: "salary", label: "Maaş / ücret", type: "number", suffix: "₺" },
      { key: "experience", label: "Deneyim beklentisi", type: "text" },
      F.desc
    ]
  },
  hayvan: {
    key: "hayvan",
    title: "Hayvan ilanı bilgileri",
    fields: [
      { key: "title", label: "İlan başlığı", type: "text", required: true },
      { key: "adType", label: "İlan tipi", type: "select", required: true, options: ["Sahiplendirme", "Ürün satışı", "Hizmet", "Kayıp ilanı"] },
      { key: "species", label: "Tür", type: "text", required: true },
      { key: "breed", label: "Irk", type: "text" },
      { key: "age", label: "Yaş", type: "text" },
      { key: "gender", label: "Cinsiyet", type: "select", options: ["Erkek", "Dişi", "Belirtilmemiş"] },
      { key: "vaccine", label: "Aşı durumu", type: "select", options: ["Tam", "Eksik", "Yok"] },
      { key: "price", label: "Ücret (varsa)", type: "number", suffix: "₺" },
      F.desc
    ]
  }
};

// ---- the tree ------------------------------------------------------------
export const categoryTree: CategoryNode[] = [
  node("Emlak", [
    node("Konut", leaves(["Satılık Daire", "Kiralık Daire", "Satılık Müstakil Ev", "Kiralık Müstakil Ev", "Satılık Villa", "Kiralık Villa", "Residence", "Yazlık", "Prefabrik Ev", "Kooperatif", "Devren Konut", "Öğrenciye Uygun Konut", "Apart", "Oda Kiralama"], "konut"), "konut"),
    node("İş Yeri", leaves(["Satılık Dükkan & Mağaza", "Kiralık Dükkan & Mağaza", "Ofis", "Plaza Katı", "Depo & Antrepo", "Fabrika", "Atölye", "Cafe & Restoran", "Otel & Pansiyon", "Sağlık Merkezi", "Spor Tesisi", "Benzin İstasyonu", "Devren İş Yeri"], "isyeri"), "isyeri"),
    node("Arsa", leaves(["Satılık Arsa", "Kiralık Arsa", "Tarla", "Bahçe", "Zeytinlik", "Bağ", "İmarlı Arsa", "Konut İmarlı", "Ticari İmarlı", "Sanayi İmarlı", "Kat Karşılığı", "Hisseli Arsa"], "arsa"), "arsa"),
    leaf("Bina", "isyeri"),
    leaf("Devre Mülk", "konut"),
    leaf("Turistik Tesis", "isyeri"),
    leaf("Günlük Kiralık", "konut"),
    leaf("Emlak Projeleri", "konut")
  ], "konut", IMG("1560518883-ce09059eeffa")),

  node("Vasıta", [
    leaf("Otomobil", "otomobil"),
    leaf("Arazi, SUV & Pickup", "otomobil"),
    node("Motosiklet", leaves(["Scooter", "Naked", "Touring", "Chopper", "Racing", "Enduro", "Cross", "Elektrikli Motosiklet", "Moped", "ATV"], "motosiklet"), "motosiklet"),
    leaf("Minivan & Panelvan", "vasitaGenel"),
    leaf("Ticari Araçlar", "vasitaGenel"),
    leaf("Elektrikli Araçlar", "otomobil"),
    leaf("Kiralık Araçlar", "vasitaGenel"),
    leaf("Hasarlı Araçlar", "otomobil"),
    leaf("Klasik Araçlar", "otomobil"),
    leaf("Deniz Araçları", "vasitaGenel"),
    leaf("Karavan", "vasitaGenel"),
    leaf("ATV", "vasitaGenel"),
    leaf("UTV", "vasitaGenel"),
    leaf("Kamyon & Kamyonet", "vasitaGenel"),
    leaf("Otobüs & Minibüs", "vasitaGenel"),
    leaf("Çekici", "vasitaGenel"),
    leaf("Römork", "vasitaGenel")
  ], "vasitaGenel", IMG("1503376780353-7e6692767b70")),

  node("Yedek Parça, Aksesuar & Tuning", leaves([
    "Otomobil Yedek Parça", "Motosiklet Yedek Parça", "Araç Aksesuarları", "Jant & Lastik", "Ses & Görüntü Sistemleri", "Tuning Ürünleri", "Araç Bakım Ürünleri", "Oto Elektronik", "Navigasyon", "Araç Kamerası", "Park Sensörü", "Far & Aydınlatma", "Tampon & Kaporta", "Motor Parçaları", "Fren Sistemi", "Süspansiyon", "İç Aksesuar", "Dış Aksesuar"
  ], "yedekParca"), "yedekParca", IMG("1486262715619-67b85e0b08d3")),

  node("İkinci El & Sıfır Alışveriş", [
    node("Elektronik", [
      node("Cep Telefonu", leaves(["iPhone", "Samsung", "Xiaomi", "Huawei", "Oppo", "Realme", "Vivo", "Tecno", "General Mobile", "Diğer Marka"], "telefon"), "telefon"),
      ...leaves(["Tablet", "Akıllı Saat", "Kulaklık", "Hoparlör", "Televizyon", "Kamera", "Fotoğraf Makinesi", "Oyun Konsolu", "Drone", "Akıllı Ev Ürünleri", "Güvenlik Kamerası", "Projeksiyon", "Elektronik Aksesuar"], "alisverisGenel")
    ], "alisverisGenel"),
    node("Telefon & Aksesuar", leaves(["Cep Telefonu", "Kılıf", "Şarj & Kablo", "Powerbank", "Ekran Koruyucu", "Kulaklık"], "alisverisGenel"), "alisverisGenel"),
    node("Bilgisayar & Oyun", leaves(["Dizüstü Bilgisayar", "Masaüstü Bilgisayar", "Monitör", "Klavye & Mouse", "Oyuncu Ekipmanları", "Oyun Konsolu", "Konsol Oyunları", "Ekran Kartı", "İşlemci", "Anakart", "RAM", "SSD & HDD", "Yazıcı & Tarayıcı", "Modem & Network", "Yazılım Lisansı"], "alisverisGenel"), "alisverisGenel"),
    node("Ev & Yaşam", [
      node("Mobilya", leaves(["Koltuk Takımı", "Köşe Koltuk", "Kanepe", "Berjer", "Masa", "Sandalye", "Yatak", "Baza", "Gardırop", "Kitaplık", "TV Ünitesi", "Çalışma Masası", "Bebek Mobilyası"], "alisverisGenel"), "alisverisGenel"),
      ...leaves(["Dekorasyon", "Aydınlatma", "Ev Tekstili", "Banyo", "Bahçe & Balkon", "Temizlik Ürünleri", "Düzenleyiciler", "Ev Gereçleri"], "alisverisGenel")
    ], "alisverisGenel"),
    node("Beyaz Eşya", leaves(["Buzdolabı", "Çamaşır Makinesi", "Bulaşık Makinesi", "Fırın", "Ocak", "Davlumbaz", "Klima", "Derin Dondurucu", "Kurutma Makinesi", "Kombi", "Elektrikli Süpürge", "Robot Süpürge"], "alisverisGenel"), "alisverisGenel"),
    leaf("Mutfak", "alisverisGenel"),
    node("Moda", [
      node("Kadın Giyim", leaves(["Elbise", "Bluz", "Gömlek", "Pantolon", "Etek", "Ceket", "Mont", "Kazak", "Sweatshirt", "Takım", "Abiye", "İç Giyim"], "alisverisGenel"), "alisverisGenel"),
      node("Erkek Giyim", leaves(["Tişört", "Gömlek", "Pantolon", "Ceket", "Mont", "Takım Elbise", "Sweatshirt", "Kazak", "Spor Giyim", "İç Giyim"], "alisverisGenel"), "alisverisGenel"),
      ...leaves(["Çocuk Giyim", "Ayakkabı", "Çanta", "Saat", "Gözlük", "Takı", "Aksesuar", "Tesettür Giyim", "Spor Giyim"], "alisverisGenel")
    ], "alisverisGenel"),
    leaf("Ayakkabı & Çanta", "alisverisGenel"),
    leaf("Takı & Aksesuar", "alisverisGenel"),
    node("Anne & Bebek", leaves(["Bebek Arabası", "Oto Koltuğu", "Bebek Giyim", "Bebek Bakım", "Mama Sandalyesi", "Beşik", "Oyuncak", "Bebek Güvenlik", "Anne Ürünleri", "Hamile Giyim"], "alisverisGenel"), "alisverisGenel"),
    node("Kozmetik & Kişisel Bakım", leaves(["Cilt Bakımı", "Saç Bakımı", "Makyaj", "Parfüm", "Erkek Bakım", "Kişisel Bakım Cihazları", "Ağız Bakımı", "Tıraş Ürünleri", "Güneş Bakımı"], "alisverisGenel"), "alisverisGenel"),
    node("Spor & Outdoor", leaves(["Fitness Ekipmanları", "Kamp Malzemeleri", "Bisiklet", "Koşu Ürünleri", "Yoga & Pilates", "Futbol", "Basketbol", "Tenis", "Balıkçılık", "Outdoor Giyim"], "alisverisGenel"), "alisverisGenel"),
    node("Kitap & Hobi", leaves(["Kitap", "Dergi", "Müzik Aletleri", "Plak & CD", "Hobi Malzemeleri", "El Sanatları", "Puzzle", "Maket", "Koleksiyon Ürünleri"], "alisverisGenel"), "alisverisGenel"),
    leaf("Koleksiyon", "alisverisGenel"),
    leaf("Ofis & Kırtasiye", "alisverisGenel"),
    leaf("Oyuncak", "alisverisGenel"),
    node("Dijital Ürünler", leaves(["Yazılım Lisansı", "Dijital Eğitim", "E-kitap", "Tasarım Dosyası", "Oyun Kodu", "Tema & Şablon", "Dijital Hesap", "Online Hizmet"], "alisverisGenel"), "alisverisGenel"),
    leaf("Hediyelik Ürünler", "alisverisGenel"),
    leaf("Evcil Hayvan Ürünleri", "alisverisGenel"),
    leaf("Diğer Alışveriş", "alisverisGenel")
  ], "alisverisGenel", IMG("1498049794561-7780e7231661")),

  node("İş Makineleri & Sanayi", leaves([
    "İş Makineleri", "Tarım Makineleri", "Sanayi Makineleri", "Elektrik & Enerji", "İnşaat Malzemeleri", "Hırdavat", "Endüstriyel Ürünler", "Forklift", "Vinç", "Kompresör", "Jeneratör", "CNC", "Matbaa Makineleri", "Gıda Üretim Makineleri", "Tekstil Makineleri", "Medikal Ekipman", "Laboratuvar Ekipmanı"
  ], "isMakinesi"), "isMakinesi", IMG("1581094794329-c8112a89af12")),

  node("Ustalar & Hizmetler", leaves([
    "Ev Tadilat", "Boya & Badana", "Elektrikçi", "Tesisatçı", "Kombi & Klima Servisi", "Nakliyat", "Temizlik Hizmeti", "Oto Servis", "Mobilya Montaj", "Bilgisayar Teknik Servis", "Telefon Tamiri", "Web Tasarım", "Grafik Tasarım", "Sosyal Medya Yönetimi", "Fotoğraf & Video", "Düğün Organizasyon", "Catering", "Özel Güvenlik", "Danışmanlık", "Muhasebe", "Hukuki Danışmanlık", "Sağlık & Bakım Hizmetleri"
  ], "hizmet"), "hizmet", IMG("1581578731548-c64695cc6952")),

  node("Özel Ders & Eğitim", leaves([
    "İlkokul Dersleri", "Ortaokul Dersleri", "Lise Dersleri", "Üniversite Dersleri", "Yabancı Dil", "Sınav Hazırlık", "Yazılım & Kodlama", "Müzik Dersleri", "Spor Dersleri", "Sanat Dersleri", "Online Eğitim", "Kariyer Eğitimi", "Direksiyon Dersi", "Kişisel Gelişim"
  ], "ders"), "ders", IMG("1503676260728-1c00da094a0b")),

  node("İş İlanları", leaves([
    "Tam Zamanlı", "Yarı Zamanlı", "Freelance", "Staj", "Uzaktan Çalışma", "Satış & Pazarlama", "Mağaza Personeli", "Kurye", "Çağrı Merkezi", "Yazılım", "Tasarım", "Muhasebe", "İnsan Kaynakları", "Üretim", "Lojistik", "Sağlık", "Eğitim", "Turizm", "Güvenlik", "Hizmet Sektörü"
  ], "isIlani"), "isIlani", IMG("1521737604893-d14cc237f11d")),

  node("Yardımcı Arayanlar", leaves([
    "Bebek Bakıcısı", "Çocuk Bakıcısı", "Yaşlı Bakıcısı", "Hasta Bakıcısı", "Ev Yardımcısı", "Temizlikçi", "Gündelik Yardımcı", "Bahçıvan", "Şoför", "Özel Ders Yardımcısı", "Evcil Hayvan Bakıcısı"
  ], "yardimci"), "yardimci", IMG("1576091160550-2173dba999ef")),

  node("Hayvanlar Alemi", leaves([
    "Evcil Hayvanlar", "Kedi", "Köpek", "Kuş", "Balık", "Kemirgen", "Sürüngen", "Çiftlik Hayvanları", "Akvaryum", "Mama & Yem", "Kafes & Aksesuar", "Pet Bakım Ürünleri", "Veteriner Hizmetleri", "Sahiplendirme", "Kayıp Hayvan İlanı"
  ], "hayvan"), "hayvan", IMG("1450778869180-41d0601e046e")),

  node("Diğer", [leaf("Kategori öner", "alisverisGenel")], "alisverisGenel", IMG("1441986300917-64674bd600d8"))
];

// ---- lookups & helpers ---------------------------------------------------
export function topCategories(): CategoryNode[] {
  return categoryTree;
}

/** Resolve the form schema for a category path (array of node keys, deepest last). */
export function resolveFormKey(path: CategoryNode[]): string {
  for (let i = path.length - 1; i >= 0; i--) {
    if (path[i].formKey) return path[i].formKey as string;
  }
  return "alisverisGenel";
}

export function getFormSchema(formKey: string): FormSchema {
  return formSchemas[formKey] ?? formSchemas.alisverisGenel;
}

export type SuggestHit = { path: CategoryNode[]; labels: string[]; formKey: string; image?: string };

const TR_S: Record<string, string> = { "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u", "â": "a" };
function key(value: string) {
  return value.toLocaleLowerCase("tr-TR").split("").map((c) => TR_S[c] ?? c).join("").replace(/[^a-z0-9\s]+/g, " ").replace(/\s+/g, " ").trim();
}

// Manual hints so common product words land on the right path even if the word
// isn't a category label (e.g. "araba" → Vasıta > Otomobil).
const HINTS: Array<{ words: string[]; path: string[] }> = [
  { words: ["iphone", "telefon", "samsung", "xiaomi", "cep telefonu"], path: ["İkinci El & Sıfır Alışveriş", "Elektronik", "Cep Telefonu"] },
  { words: ["arac ici kamera", "arac kamerasi", "dashcam"], path: ["Yedek Parça, Aksesuar & Tuning", "Araç Kamerası"] },
  { words: ["araba", "otomobil", "araç", "arac"], path: ["Vasıta", "Otomobil"] },
  { words: ["kose koltuk", "koltuk", "kanepe"], path: ["İkinci El & Sıfır Alışveriş", "Ev & Yaşam", "Mobilya"] },
  { words: ["daire", "ev", "kiralik", "satilik", "konut"], path: ["Emlak", "Konut"] },
  { words: ["arsa", "tarla"], path: ["Emlak", "Arsa"] },
  { words: ["motosiklet", "motor", "scooter"], path: ["Vasıta", "Motosiklet"] },
  { words: ["bisiklet"], path: ["İkinci El & Sıfır Alışveriş", "Spor & Outdoor", "Bisiklet"] },
  { words: ["kopek", "kedi", "yavru"], path: ["Hayvanlar Alemi", "Evcil Hayvanlar"] }
];

function pathByLabels(labels: string[]): CategoryNode[] {
  const out: CategoryNode[] = [];
  let level = categoryTree;
  for (const label of labels) {
    const found = level.find((n) => n.label === label);
    if (!found) break;
    out.push(found);
    level = found.children ?? [];
  }
  return out;
}

/** Search the tree for matching leaf/branch paths. */
export function suggestCategories(query: string, limit = 8): SuggestHit[] {
  const k = key(query);
  if (!k) return [];
  const hits: SuggestHit[] = [];
  const seen = new Set<string>();

  const pushPath = (path: CategoryNode[]) => {
    if (!path.length) return;
    const id = path.map((p) => p.key).join(">");
    if (seen.has(id)) return;
    seen.add(id);
    hits.push({ path, labels: path.map((p) => p.label), formKey: resolveFormKey(path), image: path.find((p) => p.image)?.image });
  };

  for (const hint of HINTS) {
    if (hint.words.some((w) => k.includes(w) || w.includes(k))) pushPath(pathByLabels(hint.path));
  }

  const walk = (nodes: CategoryNode[], trail: CategoryNode[]) => {
    for (const n of nodes) {
      const path = [...trail, n];
      if (key(n.label).includes(k)) pushPath(path);
      if (n.children) walk(n.children, path);
    }
  };
  walk(categoryTree, []);

  return hits.slice(0, limit);
}

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

// Marka listesini marka->model ağacına çevirir. Modeli olan marka bir alt seviye
// (node) olur; olmayan marka yaprak (leaf) kalır. Binlerce alt düğümü ucuza üretir.
function brandModelNodes(brands: string[], models: Record<string, string[]>, formKey: string): CategoryNode[] {
  return brands.map((b) => {
    const ms = models[b];
    return ms && ms.length ? node(b, [...leaves(ms, formKey), leaf("Diğer Model", formKey)], formKey) : leaf(b, formKey);
  });
}

// ---- marka/değer listeleri ----------------------------------------------
export const CAR_BRANDS = ["Alfa Romeo", "Audi", "BMW", "BYD", "Chery", "Chevrolet", "Citroën", "Dacia", "Fiat", "Ford", "Honda", "Hyundai", "Jeep", "Kia", "Land Rover", "Mazda", "Mercedes-Benz", "MG", "Mini", "Mitsubishi", "Nissan", "Opel", "Peugeot", "Renault", "Seat", "Škoda", "Suzuki", "Tesla", "Togg", "Toyota", "Volkswagen", "Volvo", "Diğer"];
export const MOTO_BRANDS = ["Honda", "Yamaha", "Kawasaki", "Suzuki", "KTM", "BMW", "Bajaj", "TVS", "CFMoto", "Mondial", "Kuba", "RKS", "Diğer"];
export const WHITE_GOODS_BRANDS = ["Arçelik", "Beko", "Bosch", "Siemens", "Vestel", "Samsung", "LG", "Profilo", "Altus", "Grundig", "Diğer"];
const CAR_COLORS = ["Beyaz", "Siyah", "Gri", "Gümüş", "Kırmızı", "Mavi", "Lacivert", "Yeşil", "Kahverengi", "Bej", "Turuncu", "Diğer"];

// Marka -> model haritası (bağımlı model seçimi için). Marka seçilince model bu
// listeden gelir; markası burada yoksa model serbest metin olarak girilir.
export const MODELS_BY_BRAND: Record<string, string[]> = {
  // Otomobil
  Renault: ["Clio", "Megane", "Fluence", "Symbol", "Captur", "Austral", "Taliant", "Kadjar", "Talisman", "Zoe", "Koleos", "Latitude", "Laguna", "Scenic", "Twingo"],
  Fiat: ["Egea", "Linea", "Doblo", "Fiorino", "Panda", "500", "500L", "500X", "Punto", "Tipo", "Bravo", "Albea", "Palio", "Marea"],
  Volkswagen: ["Golf", "Polo", "Passat", "Jetta", "Tiguan", "T-Roc", "T-Cross", "Touareg", "Transporter", "Caddy", "Arteon", "Scirocco", "Bora", "Beetle", "ID.4", "ID.3"],
  Toyota: ["Corolla", "Yaris", "Yaris Cross", "C-HR", "RAV4", "Hilux", "Camry", "Auris", "Avensis", "Land Cruiser", "Proace", "bZ4X"],
  Hyundai: ["i10", "i20", "i30", "Accent", "Elantra", "Tucson", "Bayon", "Kona", "Getz", "Santa Fe", "ix35", "Accent Blue", "IONIQ"],
  Ford: ["Focus", "Fiesta", "Mondeo", "Courier", "Transit", "Kuga", "Puma", "Ranger", "EcoSport", "Explorer", "Tourneo", "C-Max", "Connect"],
  Honda: ["Civic", "City", "Accord", "CR-V", "Jazz", "HR-V", "ZR-V", "e:Ny1", "Insight"],
  BMW: ["1 Serisi", "2 Serisi", "3 Serisi", "4 Serisi", "5 Serisi", "6 Serisi", "7 Serisi", "8 Serisi", "X1", "X2", "X3", "X4", "X5", "X6", "X7", "i3", "i4", "iX", "Z4", "M Serisi"],
  "Mercedes-Benz": ["A Serisi", "B Serisi", "C Serisi", "E Serisi", "S Serisi", "CLA", "CLS", "GLA", "GLB", "GLC", "GLE", "GLS", "G Serisi", "EQC", "EQE", "AMG", "Vito", "Sprinter"],
  Audi: ["A1", "A3", "A4", "A5", "A6", "A7", "A8", "Q2", "Q3", "Q5", "Q7", "Q8", "TT", "R8", "e-tron", "RS Serisi", "S Serisi"],
  Opel: ["Corsa", "Astra", "Insignia", "Mokka", "Crossland", "Grandland", "Vectra", "Zafira", "Meriva", "Combo Life"],
  Peugeot: ["208", "301", "308", "2008", "3008", "5008", "508", "Partner", "Rifter", "207", "206", "406", "e-208"],
  "Citroën": ["C3", "C4", "C5 Aircross", "C5 X", "Berlingo", "C-Elysee", "C3 Aircross", "DS3", "DS4", "Xsara"],
  Nissan: ["Qashqai", "Juke", "Micra", "X-Trail", "Note", "Navara", "Leaf", "Pulsar", "Primera"],
  Kia: ["Rio", "Ceed", "Sportage", "Stonic", "Picanto", "Cerato", "Sorento", "Niro", "Soul", "EV6", "Venga"],
  Dacia: ["Sandero", "Duster", "Logan", "Jogger", "Lodgy", "Dokker", "Spring"],
  Tesla: ["Model 3", "Model Y", "Model S", "Model X"],
  Togg: ["T10X", "T10F"],
  BYD: ["Atto 3", "Seal", "Dolphin", "Han"],
  // Cep telefonu
  iPhone: ["iPhone 16 Pro Max", "iPhone 16 Pro", "iPhone 16", "iPhone 15 Pro Max", "iPhone 15", "iPhone 14", "iPhone 13", "iPhone 12", "iPhone 11", "iPhone SE"],
  Samsung: ["Galaxy S24 Ultra", "Galaxy S24+", "Galaxy S24", "Galaxy S23 Ultra", "Galaxy S23", "Galaxy S22", "Galaxy A55", "Galaxy A35", "Galaxy A25", "Galaxy A15", "Galaxy A05", "Galaxy M Serisi", "Galaxy Z Fold5", "Galaxy Z Flip5", "Galaxy Note 20", "Galaxy S21 FE"],
  Xiaomi: ["14 Pro", "14", "13T Pro", "13T", "Redmi Note 13 Pro", "Redmi Note 13", "Redmi Note 12", "Redmi 13C", "Redmi 12", "Poco X6 Pro", "Poco X6", "Poco F5", "Poco C65"],
  Huawei: ["P60", "P50", "Mate 50", "Nova 12", "Nova 11"],
  Oppo: ["Reno 11", "Reno 10", "A98", "A78", "A58"],
  Realme: ["C67", "C55", "11 Pro", "GT Neo", "Number serisi"],
  // Ek otomobil markaları
  Chevrolet: ["Cruze", "Aveo", "Spark", "Captiva", "Trax"],
  Seat: ["Ibiza", "Leon", "Arona", "Ateca", "Toledo"],
  "Škoda": ["Octavia", "Superb", "Fabia", "Kamiq", "Karoq", "Scala"],
  Volvo: ["XC40", "XC60", "XC90", "S60", "V40"],
  Suzuki: ["Swift", "Vitara", "SX4", "Baleno", "Jimny"],
  Mitsubishi: ["Lancer", "ASX", "Outlander", "L200", "Space Star"],
  Mini: ["Cooper", "Countryman", "Clubman"],
  "Land Rover": ["Range Rover", "Evoque", "Discovery", "Defender"],
  Jeep: ["Renegade", "Compass", "Cherokee", "Wrangler"],
  Mazda: ["2", "3", "6", "CX-3", "CX-5"],
  "Alfa Romeo": ["Giulietta", "Giulia", "Stelvio", "Mito"],
  MG: ["ZS", "HS", "MG4", "MG5"],
  Chery: ["Tiggo 7", "Tiggo 8", "Omoda 5"],
  // Ek cep telefonu markaları
  Vivo: ["Y36", "Y22", "V29", "V27", "X90"],
  Tecno: ["Camon 20", "Spark 10", "Pova 5", "Phantom X2"],
  "General Mobile": ["GM 24", "GM 23", "GM 22", "GM 21"],
  OnePlus: ["12", "11", "Nord 3", "Nord CE 3"],
  Nothing: ["Phone (2)", "Phone (2a)", "Phone (1)"],
  Reeder: ["S19 Max Pro", "P13 Blue Max", "S23 Pro"]
};

// Motosiklet markaları -> model/seri (araba markalarıyla çakışmasın diye ayrı).
export const MOTO_MODELS: Record<string, string[]> = {
  Honda: ["CBR", "CB", "PCX", "Forza", "Africa Twin", "CG", "Activa"],
  Yamaha: ["YZF-R", "MT", "NMAX", "XMAX", "Tenere", "Crypton", "PW"],
  Kawasaki: ["Ninja", "Z", "Versys", "Vulcan", "KLX"],
  Suzuki: ["GSX-R", "V-Strom", "Burgman", "Address", "GSX-S"],
  KTM: ["Duke", "RC", "Adventure", "SX", "EXC"],
  BMW: ["G 310", "F 750 GS", "R 1250 GS", "S 1000 RR"],
  Bajaj: ["Pulsar", "Dominar", "Boxer", "Avenger"],
  TVS: ["Apache", "Ntorq", "Raider"],
  CFMoto: ["150NK", "250NK", "650NK", "700CL-X"],
  Mondial: ["Drift", "150 MG", "Roadster", "XCR"],
  Kuba: ["Milano", "Titan", "GTS"],
  RKS: ["Beta", "Titanic", "Falcon"]
};

// Dizüstü / masaüstü bilgisayar markaları -> seri.
export const COMPUTER_BRANDS = ["Apple", "Asus", "Lenovo", "HP", "Dell", "Acer", "MSI", "Monster", "Casper", "Huawei", "Samsung", "Toshiba", "Gigabyte", "Diğer"];
export const COMPUTER_MODELS: Record<string, string[]> = {
  Apple: ["MacBook Air", "MacBook Pro", "iMac", "Mac Mini", "Mac Studio"],
  Asus: ["ROG", "TUF Gaming", "Zenbook", "Vivobook", "ProArt", "ExpertBook"],
  Lenovo: ["ThinkPad", "IdeaPad", "Legion", "Yoga", "LOQ", "ThinkBook"],
  HP: ["Pavilion", "Omen", "Victus", "EliteBook", "ProBook", "Envy", "Spectre"],
  Dell: ["XPS", "Inspiron", "Latitude", "Alienware", "Vostro", "G Serisi"],
  Acer: ["Aspire", "Nitro", "Predator", "Swift", "TravelMate"],
  MSI: ["Katana", "Stealth", "Raider", "Modern", "Cyborg", "Thin"],
  Monster: ["Tulpar", "Abra", "Semruk"],
  Casper: ["Excalibur", "Nirvana"],
  Huawei: ["MateBook D", "MateBook X", "MateBook 14"],
  Samsung: ["Galaxy Book", "Galaxy Book Pro"]
};

// Televizyon markaları -> seri.
export const TV_BRANDS = ["Samsung", "LG", "Vestel", "Philips", "Sony", "TCL", "Arçelik", "Beko", "Xiaomi", "Panasonic", "Grundig", "Diğer"];
export const TV_MODELS: Record<string, string[]> = {
  Samsung: ["Crystal UHD", "QLED", "Neo QLED", "OLED", "The Frame", "DU/CU Serisi"],
  LG: ["OLED", "QNED", "NanoCell", "UHD", "UR/UT Serisi"],
  Sony: ["Bravia", "OLED", "X Serisi"],
  TCL: ["QLED", "C Serisi", "P Serisi"],
  Xiaomi: ["TV A2", "TV P1", "TV Q2"],
  Vestel: ["Satellite", "Regal"]
};

// Ticari araç markaları -> model.
export const COMMERCIAL_BRANDS = ["Ford", "Mercedes-Benz", "Volkswagen", "Fiat", "Renault", "Peugeot", "Citroën", "Iveco", "Opel", "Hyundai", "Isuzu", "Diğer"];
export const COMMERCIAL_MODELS: Record<string, string[]> = {
  Ford: ["Transit", "Transit Custom", "Courier", "Ranger", "Cargo"],
  "Mercedes-Benz": ["Sprinter", "Vito", "Citan", "Atego", "Actros"],
  Volkswagen: ["Transporter", "Crafter", "Caddy Cargo", "Amarok"],
  Fiat: ["Ducato", "Doblo Cargo", "Fiorino", "Scudo"],
  Renault: ["Master", "Trafic", "Kangoo", "Express"],
  Peugeot: ["Boxer", "Partner", "Expert", "Bipper"],
  "Citroën": ["Jumper", "Berlingo", "Jumpy"],
  Iveco: ["Daily", "Eurocargo"],
  Opel: ["Movano", "Vivaro", "Combo"]
};

// Deniz motoru, saat, gözlük, kozmetik/parfüm markaları.
export const MARINE_ENGINE_BRANDS = ["Yamaha", "Mercury", "Honda", "Suzuki", "Tohatsu", "Volvo Penta", "Mercruiser", "Selva", "Parsun", "Evinrude", "Diğer"];
export const WATCH_BRANDS = ["Rolex", "Omega", "Casio", "Seiko", "Citizen", "Tissot", "Fossil", "Michael Kors", "Daniel Wellington", "Apple Watch", "Samsung Galaxy Watch", "Huawei Watch", "Garmin", "Swatch", "Guess", "Emporio Armani", "Diğer"];
export const EYEWEAR_BRANDS = ["Ray-Ban", "Oakley", "Gucci", "Prada", "Police", "Persol", "Carrera", "Tom Ford", "Versace", "Emporio Armani", "Dolce & Gabbana", "Diğer"];
export const COSMETIC_BRANDS = ["MAC", "Maybelline", "L'Oréal Paris", "Estée Lauder", "Clinique", "NYX", "Nivea", "Garnier", "The Ordinary", "Dior", "Chanel", "Flormar", "Golden Rose", "Diğer"];
export const PERFUME_BRANDS = ["Dior", "Chanel", "Tom Ford", "Versace", "Hugo Boss", "Giorgio Armani", "Yves Saint Laurent", "Bvlgari", "Lacoste", "Calvin Klein", "Paco Rabanne", "Montblanc", "Diğer"];

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
  model: { key: "model", label: "Model", type: "text", required: true } as FieldDef,
  markaSerbest: { key: "brand", label: "Marka", type: "text" } as FieldDef,
  kutu: { key: "box", label: "Kutulu mu?", type: "bool" } as FieldDef,
  depolama: { key: "storage", label: "Depolama", type: "select", options: ["16 GB", "32 GB", "64 GB", "128 GB", "256 GB", "512 GB", "1 TB", "2 TB"] } as FieldDef,
  ram: { key: "ram", label: "RAM", type: "select", options: ["2 GB", "3 GB", "4 GB", "6 GB", "8 GB", "12 GB", "16 GB", "32 GB", "64 GB"] } as FieldDef,
  islemci: { key: "cpu", label: "İşlemci", type: "text", placeholder: "ör. Intel i5-12400 / Ryzen 5" } as FieldDef,
  ekranKarti: { key: "gpu", label: "Ekran kartı", type: "text", placeholder: "ör. RTX 4060 / RX 6600" } as FieldDef,
  ekranBoyutu: { key: "screenSize", label: "Ekran boyutu", type: "text", suffix: "inç" } as FieldDef,
  cozunurluk: { key: "resolution", label: "Çözünürlük", type: "select", options: ["HD", "Full HD", "2K/QHD", "4K/UHD", "8K"] } as FieldDef,
  enerji: { key: "energy", label: "Enerji sınıfı", type: "select", options: ["A+++", "A++", "A+", "A", "B", "C", "D", "E", "F"] } as FieldDef,
  kapasite: { key: "capacity", label: "Kapasite", type: "text", placeholder: "ör. 8 kg / 500 L" } as FieldDef,
  beden: { key: "size", label: "Beden", type: "select", options: ["XS", "S", "M", "L", "XL", "XXL", "3XL", "34", "36", "38", "40", "42", "44", "46", "48", "Standart"] } as FieldDef,
  numara: { key: "shoeSize", label: "Numara (EU)", type: "select", options: ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"] } as FieldDef,
  cinsiyet: { key: "gender", label: "Cinsiyet", type: "select", options: ["Kadın", "Erkek", "Unisex", "Kız Çocuk", "Erkek Çocuk", "Bebek"] } as FieldDef,
  materyal: { key: "material", label: "Materyal", type: "text", placeholder: "ör. deri, pamuk, ahşap" } as FieldDef,
  renkSelect: { key: "color", label: "Renk", type: "select", options: ["Siyah", "Beyaz", "Gri", "Mavi", "Kırmızı", "Yeşil", "Sarı", "Turuncu", "Mor", "Pembe", "Kahverengi", "Bej", "Lacivert", "Çok Renkli", "Diğer"] } as FieldDef,
  yasGrubu: { key: "ageGroup", label: "Yaş grubu", type: "select", options: ["0-6 ay", "6-12 ay", "1-2 yaş", "2-4 yaş", "4-6 yaş", "6+ yaş"] } as FieldDef,
  boyut: { key: "dimensions", label: "Ölçüler (En×Boy×Yükseklik)", type: "text", placeholder: "ör. 200×90×85 cm" } as FieldDef
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
      { key: "siteName", label: "Site / proje adı", type: "text", placeholder: "ör. Bahçeşehir Konakları" },
      { key: "dues", label: "Aidat", type: "number", suffix: "₺" },
      { key: "deposit", label: "Depozito (kiralıkta)", type: "number", suffix: "₺" },
      { key: "facade", label: "Cephe / yön", type: "select", options: ["Kuzey", "Güney", "Doğu", "Batı", "Kuzeydoğu", "Kuzeybatı", "Güneydoğu", "Güneybatı"] },
      { key: "view", label: "Manzara", type: "select", options: ["Deniz", "Doğa", "Şehir", "Göl", "Boğaz", "Yok"] },
      { key: "parking", label: "Otopark", type: "select", options: ["Açık Otopark", "Kapalı Otopark", "Açık & Kapalı", "Yok"] },
      { key: "elevator", label: "Asansör var mı?", type: "bool" },
      { key: "creditEligible", label: "Krediye uygun mu?", type: "bool" },
      { key: "seller", label: "Kimden", type: "select", options: ["Sahibinden", "Emlak Ofisinden", "İnşaat Firmasından", "Bankadan"] },
      { key: "deed", label: "Tapu durumu", type: "select", options: ["Kat Mülkiyetli", "Kat İrtifaklı", "Hisseli", "Müstakil Tapulu", "Kooperatif Hisseli"] },
      { key: "swapReal", label: "Takas / kat karşılığı olur mu?", type: "bool" },
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
      { key: "netM2", label: "m² (net)", type: "number", suffix: "m²" },
      { key: "rooms", label: "Bölüm / oda sayısı", type: "number" },
      { key: "floor", label: "Bulunduğu kat", type: "text" },
      { key: "buildingAge", label: "Bina yaşı", type: "text" },
      { key: "heating", label: "Isıtma", type: "select", options: ["Doğalgaz", "Merkezi", "Klima", "Yerden Isıtma", "Yok"] },
      { key: "deposit", label: "Depozito (kiralıkta)", type: "number", suffix: "₺" },
      { key: "dues", label: "Aidat", type: "number", suffix: "₺" },
      { key: "usage", label: "Kullanım durumu", type: "select", options: ["Boş", "Kiracılı", "Sahibi Kullanıyor"] },
      { key: "seller", label: "Kimden", type: "select", options: ["Sahibinden", "Emlak Ofisinden"] },
      { key: "deed", label: "Tapu durumu", type: "text" },
      { key: "swapReal", label: "Takas olur mu?", type: "bool" },
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
      { key: "zoning", label: "İmar durumu", type: "select", options: ["Konut İmarlı", "Ticari İmarlı", "Sanayi İmarlı", "Turizm İmarlı", "Villa İmarlı", "Tarla", "Bağ-Bahçe", "Zeytinlik", "İmarsız"] },
      { key: "kaks", label: "KAKS (Emsal)", type: "text", placeholder: "ör. 1.50" },
      { key: "gabari", label: "Gabari (yükseklik)", type: "text", placeholder: "ör. 12.50 m / Serbest" },
      { key: "adaParsel", label: "Ada / Parsel no", type: "text" },
      { key: "roadStatus", label: "Yola cephe", type: "select", options: ["Var (Asfalt)", "Var (Stabilize)", "Yok", "İki Yola Cepheli"] },
      { key: "deed", label: "Tapu durumu", type: "select", options: ["Müstakil Tapulu", "Hisseli", "Tahsis", "Kat İrtifaklı"] },
      { key: "seller", label: "Kimden", type: "select", options: ["Sahibinden", "Emlak Ofisinden"] },
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
  elektronik: {
    key: "elektronik",
    title: "Elektronik ürün bilgileri",
    fields: [F.title, F.markaSerbest, F.model, F.durum, F.depolama, F.ram, F.renkSelect, F.garanti, F.fatura, F.kutu, F.stok, F.price, F.kargo, F.pazarlik, F.takas, F.desc]
  },
  bilgisayar: {
    key: "bilgisayar",
    title: "Bilgisayar bilgileri",
    fields: [F.title, F.markaSerbest, F.model, F.durum, F.islemci, F.ram, F.depolama, F.ekranKarti, F.ekranBoyutu, F.cozunurluk, F.garanti, F.fatura, F.price, F.kargo, F.pazarlik, F.takas, F.desc]
  },
  televizyon: {
    key: "televizyon",
    title: "Televizyon bilgileri",
    fields: [F.title, F.markaSerbest, F.model, F.durum, F.ekranBoyutu, F.cozunurluk, { key: "panel", label: "Panel tipi", type: "select", options: ["LED", "QLED", "OLED", "Neo QLED", "NanoCell"] }, { key: "smart", label: "Smart TV mi?", type: "bool" }, F.garanti, F.fatura, F.price, F.kargo, F.pazarlik, F.desc]
  },
  beyazEsya: {
    key: "beyazEsya",
    title: "Beyaz eşya bilgileri",
    fields: [F.title, { key: "brand", label: "Marka", type: "select", options: WHITE_GOODS_BRANDS }, F.model, F.durum, F.enerji, F.kapasite, F.renkSelect, F.garanti, F.fatura, F.price, F.kargo, F.pazarlik, F.takas, F.desc]
  },
  moda: {
    key: "moda",
    title: "Giyim bilgileri",
    fields: [F.title, F.markaSerbest, F.durum, F.beden, F.renkSelect, F.cinsiyet, F.materyal, F.stok, F.price, F.kargo, F.pazarlik, F.takas, F.desc]
  },
  ayakkabi: {
    key: "ayakkabi",
    title: "Ayakkabı & çanta bilgileri",
    fields: [F.title, F.markaSerbest, F.durum, F.numara, F.renkSelect, F.cinsiyet, F.materyal, F.stok, F.price, F.kargo, F.pazarlik, F.takas, F.desc]
  },
  mobilya: {
    key: "mobilya",
    title: "Mobilya & ev bilgileri",
    fields: [F.title, F.markaSerbest, F.durum, F.materyal, F.renkSelect, F.boyut, F.price, F.kargo, F.pazarlik, F.takas, F.desc]
  },
  bebek: {
    key: "bebek",
    title: "Anne & bebek ürün bilgileri",
    fields: [F.title, F.markaSerbest, F.durum, F.yasGrubu, F.cinsiyet, F.renkSelect, F.garanti, F.price, F.kargo, F.pazarlik, F.takas, F.desc]
  },
  spor: {
    key: "spor",
    title: "Spor & outdoor bilgileri",
    fields: [F.title, F.markaSerbest, F.durum, { key: "sportType", label: "Tür", type: "text", placeholder: "ör. fitness, kamp, bisiklet" }, F.renkSelect, F.price, F.kargo, F.pazarlik, F.takas, F.desc]
  },
  muzik: {
    key: "muzik",
    title: "Müzik enstrümanı bilgileri",
    fields: [F.title, F.markaSerbest, F.model, F.durum, { key: "instType", label: "Enstrüman türü", type: "text" }, F.renkSelect, F.price, F.kargo, F.pazarlik, F.takas, F.desc]
  },
  medikal: {
    key: "medikal",
    title: "Sağlık & medikal ürün bilgileri",
    fields: [F.title, F.markaSerbest, F.model, F.durum, F.garanti, F.fatura, F.price, F.kargo, F.pazarlik, F.desc]
  },
  aksesuar: {
    key: "aksesuar",
    title: "Saat, gözlük & takı bilgileri",
    fields: [F.title, F.markaSerbest, F.model, F.durum, F.renkSelect, F.cinsiyet, F.materyal, F.garanti, F.fatura, F.kutu, F.price, F.kargo, F.pazarlik, F.takas, F.desc]
  },
  kozmetik: {
    key: "kozmetik",
    title: "Kozmetik & parfüm bilgileri",
    fields: [F.title, F.markaSerbest, { key: "cosmeticType", label: "Ürün türü", type: "text", placeholder: "ör. parfüm, ruj, fondöten" }, { key: "condition", label: "Ürün durumu", type: "select", required: true, options: ["Sıfır (Ambalajlı)", "Açılmış - Az kullanılmış", "Tester"] }, { key: "volume", label: "Hacim / miktar", type: "text", placeholder: "ör. 100 ml" }, F.stok, F.price, F.kargo, F.desc]
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
  },
  // Talep/Arayan ilanı (kullanıcı bir şey arıyor)
  arayan: {
    key: "arayan",
    title: "Talep bilgileri",
    fields: [
      F.title,
      { key: "wanted", label: "Aradığın ürün/hizmet", type: "text", required: true, placeholder: "Ne arıyorsun?" },
      { key: "budgetMin", label: "Bütçe (en az)", type: "number", suffix: "₺" },
      { key: "budgetMax", label: "Bütçe (en çok)", type: "number", suffix: "₺" },
      { key: "prefs", label: "Tercih edilen özellikler", type: "textarea", placeholder: "Marka, model, durum, konum vb." },
      { key: "urgency", label: "Aciliyet", type: "select", options: ["Acil", "Bu hafta", "Bu ay", "Fark etmez"] },
      F.desc
    ]
  },
  // Dijital ürün / hizmet
  dijitalHizmet: {
    key: "dijitalHizmet",
    title: "Dijital hizmet bilgileri",
    fields: [
      F.title,
      { key: "serviceType", label: "Hizmet/ürün türü", type: "text", required: true, placeholder: "Web sitesi, logo, video kurgu…" },
      F.price,
      { key: "deliveryTime", label: "Teslim süresi", type: "select", options: ["24 saat", "2-3 gün", "1 hafta", "2 hafta+", "Görüşülür"] },
      { key: "revisions", label: "Revizyon sayısı", type: "select", options: ["1", "2", "3", "Sınırsız", "Görüşülür"] },
      { key: "portfolio", label: "Portfolyo linki", type: "text", placeholder: "Örnek çalışma bağlantısı (opsiyonel)" },
      { key: "deliveryMethod", label: "Dosya teslim şekli", type: "select", options: ["E-posta", "Bulut (link)", "Platform mesajı", "Görüşülür"] },
      F.desc
    ]
  }
};

// ---- the tree ------------------------------------------------------------
export const categoryTree: CategoryNode[] = [
  node("Emlak", [
    node("Konut", [
      node("Daire", leaves(["1+0 (Stüdyo)", "1+1", "2+1", "3+1", "4+1", "5+1 ve üzeri", "Dubleks Daire", "Bahçe Katı", "Çatı Katı (Teras)", "Ara Kat", "Giriş Katı", "Ters Dubleks"], "konut"), "konut"),
      node("Rezidans", leaves(["1+1 Rezidans", "2+1 Rezidans", "3+1 Rezidans", "Stüdyo Rezidans", "Lüks Rezidans"], "konut"), "konut"),
      node("Müstakil Ev", leaves(["Tek Katlı Müstakil", "İki Katlı Müstakil", "Bahçeli Müstakil Ev", "Köy Evi", "Taş Ev"], "konut"), "konut"),
      node("Villa", leaves(["Müstakil Villa", "İkiz Villa", "Tripleks Villa", "Deniz Manzaralı Villa", "Havuzlu Villa", "Site İçi Villa"], "konut"), "konut"),
      ...leaves(["Yazlık", "Dağ Evi", "Çiftlik Evi", "Köşk & Konak", "Yalı", "Yalı Dairesi", "Prefabrik Ev", "Loft", "Devremülk", "Kooperatif Hissesi", "Öğrenci / Apart", "Oda Kiralama"], "konut")
    ], "konut"),
    node("İş Yeri", [
      node("Dükkan & Mağaza", leaves(["Cadde Üzeri Dükkan", "AVM İçi Mağaza", "Köşe Dükkan", "Depolu Dükkan"], "isyeri"), "isyeri"),
      node("Ofis & Büro", leaves(["Plaza Katı", "İş Merkezi Ofisi", "Home Ofis", "Hazır Ofis", "Muayenehane"], "isyeri"), "isyeri"),
      node("Sanayi & Üretim", leaves(["Fabrika", "Atölye & İmalathane", "Depo & Antrepo", "Soğuk Hava Deposu"], "isyeri"), "isyeri"),
      node("Gıda & Eğlence", leaves(["Cafe & Restoran", "Bar & Gece Kulübü", "Büfe & Kiosk", "Pastane & Fırın"], "isyeri"), "isyeri"),
      node("Turizm & Konaklama", leaves(["Otel", "Apart Otel", "Butik Otel", "Pansiyon & Hostel", "Tatil Köyü"], "isyeri"), "isyeri"),
      ...leaves(["Sağlık Merkezi & Klinik", "Spor Tesisi", "Güzellik Merkezi", "Kuaför Salonu", "Kreş & Anaokulu", "Otopark", "Benzin İstasyonu", "Komple Ticari Bina", "Devren İş Yeri"], "isyeri")
    ], "isyeri"),
    node("Arsa", [
      node("İmarlı Arsa", leaves(["Konut İmarlı", "Ticari İmarlı", "Sanayi İmarlı", "Turizm İmarlı", "Villa İmarlı", "Toplu Konut İmarlı"], "arsa"), "arsa"),
      node("Tarımsal", leaves(["Tarla", "Bağ & Bahçe", "Zeytinlik", "Meyve Bahçesi", "Sera", "Çiftlik"], "arsa"), "arsa"),
      ...leaves(["Kat Karşılığı Arsa", "Hisseli Arsa", "İmarsız Arsa"], "arsa")
    ], "arsa"),
    node("Bina", leaves(["Satılık Komple Bina", "Kiralık Komple Bina", "Apartman", "İş Hanı", "Plaza", "Residence Bina"], "isyeri"), "isyeri"),
    node("Turistik Tesis", leaves(["Otel", "Apart Otel", "Butik Otel", "Tatil Köyü", "Pansiyon", "Kamp & Karavan Alanı", "Termal Tesis"], "isyeri"), "isyeri"),
    node("Günlük Kiralık", leaves(["Günlük Kiralık Daire", "Günlük Kiralık Villa", "Günlük Kiralık Yazlık", "Günlük Kiralık Apart", "Günlük Kiralık Rezidans"], "konut"), "konut"),
    node("Konut Projeleri", leaves(["Yeni / Ön Satış Projeler", "Devam Eden Projeler", "Tamamlanan Projeler", "Kentsel Dönüşüm Projeleri", "Devlet / TOKİ Projeleri"], "konut"), "konut"),
    leaf("Devremülk", "konut")
  ], "konut", IMG("1560518883-ce09059eeffa")),

  node("Vasıta", [
    node("Otomobil", brandModelNodes(CAR_BRANDS, MODELS_BY_BRAND, "otomobil"), "otomobil"),
    node("Arazi, SUV & Pickup", leaves(["Toyota", "Nissan", "Ford", "Hyundai", "Kia", "Volkswagen", "Dacia", "Suzuki", "Jeep", "Land Rover", "Mitsubishi", "Chery", "MG", "Diğer"], "otomobil"), "otomobil"),
    node("Motosiklet", brandModelNodes(MOTO_BRANDS, MOTO_MODELS, "motosiklet"), "motosiklet"),
    leaf("Minivan & Panelvan", "vasitaGenel"),
    node("Ticari Araçlar", brandModelNodes(COMMERCIAL_BRANDS, COMMERCIAL_MODELS, "vasitaGenel"), "vasitaGenel"),
    node("Elektrikli Araçlar", leaves(["Elektrikli Otomobil", "Hibrit", "Plug-in Hibrit"], "otomobil"), "otomobil"),
    leaf("Kiralık Araçlar", "vasitaGenel"),
    leaf("Hasarlı Araçlar", "otomobil"),
    leaf("Klasik Araçlar", "otomobil"),
    node("Deniz Araçları", [
      ...leaves(["Sürat Teknesi", "Yelkenli", "Şişme Bot", "Jet Ski", "Balıkçı Teknesi", "Yat", "Gulet", "Kano & Kayak", "Römork (Deniz)"], "vasitaGenel"),
      node("Tekne Motoru", brandModelNodes(MARINE_ENGINE_BRANDS, {}, "vasitaGenel"), "vasitaGenel")
    ], "vasitaGenel"),
    node("Karavan", leaves(["Motokaravan", "Çekme Karavan", "Kamp Römorku", "Karavan Aksesuarı"], "vasitaGenel"), "vasitaGenel"),
    leaf("ATV", "vasitaGenel"),
    leaf("UTV", "vasitaGenel"),
    leaf("Kamyon & Kamyonet", "vasitaGenel"),
    leaf("Otobüs & Minibüs", "vasitaGenel"),
    leaf("Çekici", "vasitaGenel"),
    leaf("Römork", "vasitaGenel")
  ], "vasitaGenel", IMG("1503376780353-7e6692767b70")),

  node("Yedek Parça, Aksesuar & Tuning", [
    node("Otomobil Yedek Parça", leaves(["Motor Parçaları", "Fren Sistemi", "Süspansiyon", "Şanzıman", "Debriyaj", "Egzoz", "Radyatör & Soğutma", "Elektrik & Aydınlatma", "Kaporta", "Tampon", "Far", "Stop", "Ayna", "Cam", "Kapı", "Airbag"], "yedekParca"), "yedekParca"),
    node("Motosiklet Yedek Parça", leaves(["Motor", "Zincir & Dişli", "Fren", "Lastik", "Far", "Ayna", "Egzoz"], "yedekParca"), "yedekParca"),
    node("Araç Aksesuarları", leaves(["İç Aksesuar", "Dış Aksesuar", "Kılıf & Paspas", "Telefon Tutucu", "Araç İçi Organizer"], "yedekParca"), "yedekParca"),
    node("Jant & Lastik", leaves(["Yaz Lastiği", "Kış Lastiği", "4 Mevsim Lastik", "Jant", "Bijon"], "yedekParca"), "yedekParca"),
    node("Ses & Görüntü Sistemleri", leaves(["Oto Teyp", "Hoparlör", "Amfi", "Subwoofer", "Multimedya Ekran"], "yedekParca"), "yedekParca"),
    node("Tuning Ürünleri", leaves(["Body Kit", "Spoiler", "Performans Filtre", "Yazılım Hizmeti"], "yedekParca"), "yedekParca"),
    node("Oto Elektronik", leaves(["Akü", "Sensör", "Araç Kamerası", "Park Sensörü", "Navigasyon"], "yedekParca"), "yedekParca"),
    leaf("Araç Bakım Ürünleri", "yedekParca")
  ], "yedekParca", IMG("1486262715619-67b85e0b08d3")),

  node("İkinci El & Sıfır Alışveriş", [
    node("Elektronik", [
      node("Cep Telefonu", brandModelNodes(["iPhone", "Samsung", "Xiaomi", "Huawei", "Oppo", "Realme", "Vivo", "Tecno", "General Mobile", "OnePlus", "Nothing", "Reeder", "Diğer Marka"], MODELS_BY_BRAND, "telefon"), "telefon"),
      node("Televizyon", brandModelNodes(TV_BRANDS, TV_MODELS, "televizyon"), "televizyon"),
      node("Tablet", leaves(["iPad", "Samsung Galaxy Tab", "Xiaomi Pad", "Huawei MatePad", "Lenovo Tab", "Reeder Tablet", "Diğer Tablet"], "elektronik"), "elektronik"),
      node("Ses & Kulaklık", leaves(["Kablosuz Kulaklık", "Kulak İçi Kulaklık", "Kulak Üstü Kulaklık", "Bluetooth Hoparlör", "Soundbar", "Ev Sinema Sistemi", "Mikrofon"], "elektronik"), "elektronik"),
      node("Foto & Kamera", leaves(["DSLR Fotoğraf Makinesi", "Aynasız Fotoğraf Makinesi", "Kompakt Kamera", "Aksiyon Kamera", "Objektif", "Tripod", "Drone", "Güvenlik Kamerası"], "elektronik"), "elektronik"),
      ...leaves(["Akıllı Saat & Bileklik", "Akıllı Ev Ürünleri", "Projeksiyon", "Yazıcı & Tarayıcı", "Elektronik Aksesuar"], "elektronik")
    ], "alisverisGenel"),
    node("Telefon & Aksesuar", leaves(["Cep Telefonu", "Kılıf", "Şarj & Kablo", "Powerbank", "Ekran Koruyucu", "Kulaklık"], "alisverisGenel"), "alisverisGenel"),
    node("Bilgisayar & Oyun", [
      node("Dizüstü Bilgisayar", brandModelNodes(COMPUTER_BRANDS, COMPUTER_MODELS, "bilgisayar"), "bilgisayar"),
      node("Masaüstü Bilgisayar", leaves(["Hazır Sistem", "Toplama Sistem", "All-in-One", "Mini PC", "İş İstasyonu"], "bilgisayar"), "bilgisayar"),
      node("Bilgisayar Bileşenleri", leaves(["Ekran Kartı", "İşlemci", "Anakart", "RAM", "SSD & HDD", "Güç Kaynağı", "Kasa", "CPU Soğutucu", "Ekran Kartı Yükseltici"], "alisverisGenel"), "alisverisGenel"),
      node("Çevre Birimleri", leaves(["Monitör", "Klavye", "Mouse", "Kulaklık", "Webcam", "Mikrofon", "Yazıcı & Tarayıcı", "Modem & Network", "Harici Disk", "USB Bellek"], "alisverisGenel"), "alisverisGenel"),
      node("Oyun & Konsol", leaves(["PlayStation 5", "PlayStation 4", "Xbox Series X/S", "Xbox One", "Nintendo Switch", "Konsol Oyunları", "Oyun Kolu", "VR Gözlük", "Oyuncu Koltuğu"], "alisverisGenel"), "alisverisGenel"),
      leaf("Yazılım & Lisans", "alisverisGenel")
    ], "alisverisGenel"),
    node("Ev & Yaşam", [
      node("Mobilya", leaves(["Koltuk Takımı", "Köşe Koltuk", "Kanepe", "Berjer", "Masa", "Sandalye", "Yatak", "Baza", "Gardırop", "Kitaplık", "TV Ünitesi", "Çalışma Masası", "Bebek Mobilyası"], "mobilya"), "mobilya"),
      ...leaves(["Dekorasyon", "Aydınlatma", "Ev Tekstili", "Banyo", "Bahçe & Balkon", "Temizlik Ürünleri", "Düzenleyiciler", "Ev Gereçleri"], "alisverisGenel")
    ], "alisverisGenel"),
    node("Beyaz Eşya", leaves(["Buzdolabı", "Çamaşır Makinesi", "Bulaşık Makinesi", "Fırın", "Ocak", "Davlumbaz", "Klima", "Derin Dondurucu", "Kurutma Makinesi", "Kombi", "Elektrikli Süpürge", "Robot Süpürge"], "beyazEsya"), "beyazEsya"),
    leaf("Mutfak", "alisverisGenel"),
    node("Moda", [
      node("Kadın Giyim", leaves(["Elbise", "Bluz", "Gömlek", "Pantolon", "Etek", "Ceket", "Mont", "Kazak", "Sweatshirt", "Takım", "Abiye", "İç Giyim"], "moda"), "moda"),
      node("Erkek Giyim", leaves(["Tişört", "Gömlek", "Pantolon", "Ceket", "Mont", "Takım Elbise", "Sweatshirt", "Kazak", "Spor Giyim", "İç Giyim"], "moda"), "moda"),
      node("Çocuk Giyim", leaves(["Kız Çocuk", "Erkek Çocuk", "Bebek Giyim", "Okul Kıyafeti"], "moda"), "moda"),
      node("Ayakkabı", leaves(["Kadın Ayakkabı", "Erkek Ayakkabı", "Spor Ayakkabı", "Bot & Çizme", "Sandalet & Terlik", "Çocuk Ayakkabı"], "ayakkabi"), "ayakkabi"),
      node("Çanta", leaves(["Kadın Çanta", "Sırt Çantası", "Cüzdan", "Valiz & Bavul", "Laptop Çantası", "El Çantası"], "ayakkabi"), "ayakkabi"),
      node("Saat", brandModelNodes(WATCH_BRANDS, {}, "aksesuar"), "aksesuar"),
      node("Gözlük", brandModelNodes(EYEWEAR_BRANDS, {}, "aksesuar"), "aksesuar"),
      node("Takı & Mücevher", leaves(["Yüzük", "Kolye", "Bilezik", "Küpe", "Altın", "Pırlanta", "Gümüş", "Saat Kordonu"], "aksesuar"), "aksesuar"),
      ...leaves(["Tesettür Giyim", "Spor Giyim"], "moda")
    ], "moda"),
    leaf("Ayakkabı & Çanta", "ayakkabi"),
    leaf("Takı & Aksesuar", "alisverisGenel"),
    node("Anne & Bebek", [
      node("Bebek Arabası & Taşıma", leaves(["Travel Sistem Bebek Arabası", "Tekli Bebek Arabası", "İkiz Bebek Arabası", "Puset", "Ana Kucağı", "Kanguru & Taşıyıcı", "Portbebe"], "bebek"), "bebek"),
      node("Oto Koltuğu", leaves(["0-13 kg", "9-36 kg", "15-36 kg", "360° Dönebilen", "Yükseltici"], "bebek"), "bebek"),
      node("Beslenme", leaves(["Mama Sandalyesi", "Biberon & Emzik", "Mama Hazırlama", "Göğüs Pompası", "Termos & Saklama"], "bebek"), "bebek"),
      node("Bebek Odası", leaves(["Beşik", "Park Yatak", "Bebek Yatağı", "Alt Açma Ünitesi", "Bebek Odası Takımı", "Uyku & Tekstil"], "bebek"), "bebek"),
      ...leaves(["Bebek Giyim", "Bebek Bakım & Bez", "Bebek Güvenliği", "Oyuncak", "Anne Ürünleri", "Hamile Giyim", "Bebek Ayakkabı"], "bebek")
    ], "bebek"),
    node("Kozmetik & Kişisel Bakım", [
      node("Parfüm", brandModelNodes(PERFUME_BRANDS, {}, "kozmetik"), "kozmetik"),
      node("Makyaj", brandModelNodes(COSMETIC_BRANDS, {}, "kozmetik"), "kozmetik"),
      ...leaves(["Cilt Bakımı", "Saç Bakımı", "Erkek Bakım", "Kişisel Bakım Cihazları", "Ağız Bakımı", "Tıraş Ürünleri", "Güneş Bakımı"], "kozmetik")
    ], "kozmetik"),
    node("Spor & Outdoor", [
      node("Fitness & Kondisyon", leaves(["Koşu Bandı", "Kondisyon Bisikleti", "Eliptik", "Ağırlık & Dambıl", "Kürek Çekme", "Fitness İstasyonu", "Direniş Bandı", "Yoga & Pilates"], "spor"), "spor"),
      node("Bisiklet", leaves(["Dağ Bisikleti", "Yol Bisikleti", "Şehir Bisikleti", "Elektrikli Bisiklet", "Çocuk Bisikleti", "Katlanır Bisiklet", "Bisiklet Parçaları"], "spor"), "spor"),
      node("Kamp & Doğa", leaves(["Çadır", "Uyku Tulumu", "Kamp Sandalyesi", "Kamp Ocağı", "Sırt Çantası", "Termos & Matara", "Outdoor Giyim & Ayakkabı"], "spor"), "spor"),
      node("Takım Sporları", leaves(["Futbol", "Basketbol", "Voleybol", "Tenis", "Masa Tenisi", "Badminton"], "spor"), "spor"),
      ...leaves(["Su Sporları", "Kış Sporları", "Avcılık & Balıkçılık", "Dövüş Sporları", "Kaykay & Paten"], "spor")
    ], "spor"),
    node("Kitap & Hobi", leaves(["Kitap", "Dergi", "Müzik Aletleri", "Plak & CD", "Hobi Malzemeleri", "El Sanatları", "Puzzle", "Maket", "Koleksiyon Ürünleri"], "alisverisGenel"), "alisverisGenel"),
    leaf("Koleksiyon", "alisverisGenel"),
    leaf("Ofis & Kırtasiye", "alisverisGenel"),
    leaf("Oyuncak", "alisverisGenel"),
    node("Dijital Ürünler", leaves(["Yazılım Lisansı", "Dijital Eğitim", "E-kitap", "Tasarım Dosyası", "Oyun Kodu", "Tema & Şablon", "Dijital Hesap", "Online Hizmet"], "alisverisGenel"), "alisverisGenel"),
    leaf("Hediyelik Ürünler", "alisverisGenel"),
    leaf("Evcil Hayvan Ürünleri", "alisverisGenel"),
    leaf("Diğer Alışveriş", "alisverisGenel")
  ], "alisverisGenel", IMG("1498049794561-7780e7231661")),

  node("İş Makineleri & Sanayi", [
    node("İş Makineleri", leaves(["Ekskavatör", "Kazıcı Yükleyici", "Loder", "Greyder", "Silindir", "Dozer", "Vinç", "Forklift", "Kompresör", "Jeneratör"], "isMakinesi"), "isMakinesi"),
    node("Tarım Makineleri", leaves(["Traktör", "Biçerdöver", "Pulluk", "Ekim Makinesi", "İlaçlama Makinesi", "Römork"], "isMakinesi"), "isMakinesi"),
    node("Sanayi Makineleri", leaves(["CNC", "Torna", "Freze", "Pres", "Kaynak Makinesi", "Matbaa Makinesi", "Paketleme Makinesi", "Gıda Üretim Makinesi", "Tekstil Makinesi"], "isMakinesi"), "isMakinesi"),
    node("Elektrik & Enerji", leaves(["Güneş Paneli", "İnvertör", "Akü", "Jeneratör", "Trafo"], "isMakinesi"), "isMakinesi"),
    node("İnşaat Malzemeleri", leaves(["İskele", "Kalıp", "Beton Mikseri", "El Aletleri", "Hırdavat"], "isMakinesi"), "isMakinesi"),
    leaf("Endüstriyel Ürünler", "isMakinesi"),
    node("Medikal & Laboratuvar", leaves(["Medikal Ekipman", "Laboratuvar Ekipmanı"], "isMakinesi"), "isMakinesi")
  ], "isMakinesi", IMG("1581094794329-c8112a89af12")),

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

  node("Hayvanlar Alemi", [
    node("Sahiplendirme", leaves(["Kedi", "Köpek", "Kuş", "Balık", "Kemirgen", "Sürüngen", "Diğer"], "hayvan"), "hayvan"),
    leaf("Kayıp Hayvan İlanı", "hayvan"),
    leaf("Bulunan Hayvan İlanı", "hayvan"),
    node("Evcil Hayvan Ürünleri", leaves(["Mama & Yem", "Kafes & Aksesuar", "Akvaryum", "Pet Bakım Ürünleri", "Oyuncak"], "alisverisGenel"), "alisverisGenel"),
    node("Veteriner & Bakım", leaves(["Veteriner Hizmetleri", "Pet Kuaför", "Pet Oteli", "Evcil Hayvan Bakıcısı"], "hizmet"), "hizmet"),
    leaf("Çiftlik Hayvanları", "hayvan")
  ], "hayvan", IMG("1450778869180-41d0601e046e")),

  node("Arayanlar / Talep İlanları", leaves([
    "Araç Arıyorum", "Ev Arıyorum", "Telefon Arıyorum", "Bilgisayar Arıyorum", "Mobilya Arıyorum", "İş Arıyorum", "Eleman Arıyorum", "Usta Arıyorum", "Ortak Satış Ortağı Arıyorum", "Yatırımcı Arıyorum", "Ürün Tedarikçisi Arıyorum", "Kiralık Ürün Arıyorum"
  ], "arayan"), "arayan", IMG("1454165804606-c3d57bc86b40")),

  node("Dijital Ürünler & Hizmetler", leaves([
    "Web Sitesi", "Mobil Uygulama", "Logo Tasarım", "Sosyal Medya Paketi", "Video Kurgu", "CV Hazırlama", "Sunum Hazırlama", "Yazılım Hizmeti", "Bot/Otomasyon", "Eğitim Dosyası", "E-kitap", "Şablon", "No-code Kurulum", "Reklam Yönetimi"
  ], "dijitalHizmet"), "dijitalHizmet", IMG("1461749280684-dccba630e2f6")),

  node("Yapı Market & Bahçe", [
    node("El Aletleri", leaves(["Matkap", "Vidalama", "Dekupaj / Testere", "Taşlama / Spiral", "Kaynak Makinesi", "Kompresör", "El Aleti Seti", "Tornavida & Anahtar"], "alisverisGenel"), "alisverisGenel"),
    node("Hırdavat", leaves(["Vida & Cıvata", "Menteşe", "Kilit & Kapı Kolu", "Yapıştırıcı & Silikon", "Zincir & Halat", "Sarf Malzeme"], "alisverisGenel"), "alisverisGenel"),
    node("Bahçe", leaves(["Çim Biçme Makinesi", "Sulama Sistemleri", "Bahçe Mobilyası", "Sera & Örtü", "Tohum & Fide", "Bahçe Aletleri", "Çit & Tel", "Barbekü & Mangal"], "alisverisGenel"), "alisverisGenel"),
    node("Yapı Malzemeleri", leaves(["Boya & Vernik", "Fayans & Seramik", "Parke & Laminat", "İzolasyon", "Çimento & Alçı", "Elektrik Malzemeleri", "Tesisat & Su", "Aydınlatma Malzemesi"], "alisverisGenel"), "alisverisGenel")
  ], "alisverisGenel", IMG("1581092160562-40aa08e78837")),

  node("Müzik Enstrümanları", leaves([
    "Akustik Gitar", "Elektro Gitar", "Bas Gitar", "Klasik Gitar", "Piyano", "Dijital Piyano & Org", "Keman", "Bateri & Davul", "Perküsyon", "Nefesli Çalgılar", "DJ Ekipmanı", "Stüdyo / Kayıt Ekipmanı", "Amfi & Efekt Pedalı", "Bağlama", "Ud & Kanun", "Ney & Kaval", "Mikrofon", "Enstrüman Aksesuarı"
  ], "muzik"), "muzik", IMG("1511671782779-c97d3d27a1d4")),

  node("Sağlık & Medikal", leaves([
    "Tekerlekli Sandalye", "Hasta Yatağı", "Tansiyon Aleti", "Şeker Ölçüm Cihazı", "Ortopedik Ürünler", "İşitme Cihazı", "Oksijen Konsantratörü", "Nebulizatör", "Medikal Sarf Malzeme", "Masaj & Terapi Cihazı", "Ateş Ölçer", "Pulse Oksimetre", "Engelli Ürünleri", "Fizik Tedavi Ekipmanı"
  ], "medikal"), "medikal", IMG("1584982751601-97dcc096659c")),

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

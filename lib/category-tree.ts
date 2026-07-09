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

export type FieldType = "text" | "textarea" | "number" | "select" | "bool" | "tags" | "multiselect";
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

// Her markayı, verilen alt-kategori (ör. parça grubu) yapraklarıyla bir node yapar.
function brandGroupNodes(brands: string[], groups: string[], formKey: string): CategoryNode[] {
  return brands.map((b) => node(b, leaves(groups, formKey), formKey));
}

// Otomobil yedek parça grupları (marka bazlı listelenir).
const CAR_PART_GROUPS = ["Motor Parçaları", "Fren Sistemi", "Süspansiyon & Rot-Balans", "Şanzıman & Debriyaj", "Egzoz Sistemi", "Soğutma & Radyatör", "Elektrik & Aydınlatma", "Kaporta & Dış Aksam", "Far & Stop", "Cam & Ayna", "İç Aksam & Döşeme", "Filtreler", "Triger & Kayış Seti", "Amortisör", "Yakıt Sistemi", "Klima & Kalorifer", "Marş & Alternatör", "Turbo & Yağlama"];

// ---- marka/değer listeleri ----------------------------------------------
export const CAR_BRANDS = ["Alfa Romeo", "Aston Martin", "Audi", "Bentley", "BMW", "BYD", "Cadillac", "Chery", "Chevrolet", "Chrysler", "Citroën", "Cupra", "Dacia", "Daihatsu", "DFSK", "Dodge", "DS Automobiles", "Ferrari", "Fiat", "Fisker", "Ford", "Geely", "Genesis", "GMC", "Honda", "Hongqi", "Hyundai", "Infiniti", "Isuzu", "Jaguar", "Jeep", "Kia", "Lada", "Lamborghini", "Lancia", "Land Rover", "Leapmotor", "Lexus", "Lotus", "Lucid", "Mahindra", "Maserati", "Maybach", "Mazda", "McLaren", "Mercedes-Benz", "MG", "Mini", "Mitsubishi", "NIO", "Nissan", "Opel", "Ora", "Peugeot", "Porsche", "Proton", "Renault", "Rolls-Royce", "Seat", "Seres", "Škoda", "Skywell", "Smart", "SsangYong", "Subaru", "Suzuki", "Tesla", "Tofaş", "Togg", "Toyota", "Volkswagen", "Volvo", "Diğer"];
export const CAR_BODY_TYPES = ["Sedan", "Hatchback (5 Kapı)", "Hatchback (3 Kapı)", "Station Wagon", "SUV & Arazi", "Crossover", "Coupe", "Cabrio & Roadster", "MPV & Minivan", "Pickup", "Panelvan", "Elektrikli", "Hibrit", "Klasik", "Modifiye"];
export const MOTO_TYPES = ["Scooter", "Maxi Scooter", "Naked", "Sport / Racing", "Touring", "Cruiser", "Chopper", "Enduro", "Motocross", "Trail / Adventure", "Café Racer", "Custom", "Trike", "ATV", "UTV", "Elektrikli Motosiklet", "Moped", "Cub / Kanatlı"];
export const MOTO_BRANDS = ["Honda", "Yamaha", "Kawasaki", "Suzuki", "KTM", "BMW", "Ducati", "Triumph", "Harley-Davidson", "Aprilia", "Vespa", "Piaggio", "Benelli", "Royal Enfield", "Moto Guzzi", "Bajaj", "TVS", "CFMoto", "SYM", "Kymco", "Mondial", "Kuba", "RKS", "Arora", "Yuki", "Motolux", "Falcon", "Zontes", "Voge", "QJ Motor", "Keeway", "Hero", "Lifan", "Husqvarna", "Indian", "MV Agusta", "Bimota", "Can-Am", "Segway Powersports", "Diğer"];
export const WHITE_GOODS_BRANDS = ["Arçelik", "Beko", "Bosch", "Siemens", "Vestel", "Samsung", "LG", "Profilo", "Altus", "Grundig", "Regal", "Silverline", "Electrolux", "Whirlpool", "Simfer", "Kumtel", "Luxell", "Sharp", "Hisense", "Midea", "Candy", "Indesit", "Ariston", "Diğer"];
// Kombi/klima markaları (beyaz eşyadan farklı).
export const HEATING_BRANDS = ["Baymak", "DemirDöküm", "Vaillant", "Buderus", "Bosch", "ECA", "Airfel", "Viessmann", "Warmhaus", "Diğer"];
export const AC_BRANDS = ["Arçelik", "Vestel", "Samsung", "LG", "Bosch", "Daikin", "Mitsubishi", "Toshiba", "Baymak", "Gree", "Midea", "Beko", "Diğer"];
const CAR_COLORS = ["Beyaz", "Siyah", "Gri", "Gümüş", "Kırmızı", "Mavi", "Lacivert", "Yeşil", "Kahverengi", "Bej", "Turuncu", "Diğer"];
// Cep telefonu markaları (telefon şeması brand seçenekleriyle BİREBİR aynı olmalı ki
// kategori yolundan seçilen marka forma otomatik dolsun). MODELS_BY_BRAND'de modeli
// olanlar (iPhone/Samsung/Xiaomi/Huawei/Oppo/Realme) marka→model ağacı olur.
export const PHONE_BRANDS = ["iPhone", "Samsung", "Xiaomi", "Huawei", "Oppo", "Realme", "Vivo", "Tecno", "Honor", "OnePlus", "General Mobile", "Reeder", "Poco", "Infinix", "Google", "Sony", "Nokia", "Casper", "TCL", "Alcatel", "Diğer"];

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
  Tesla: ["Model 3", "Model Y", "Model S", "Model X", "Cybertruck"],
  Togg: ["T10X", "T10F"],
  BYD: ["Atto 3", "Seal", "Dolphin", "Han", "Tang", "Song Plus", "Seal U"],
  // Cep telefonu
  iPhone: ["iPhone 16 Pro Max", "iPhone 16 Pro", "iPhone 16", "iPhone 15 Pro Max", "iPhone 15", "iPhone 14", "iPhone 13", "iPhone 12", "iPhone 11", "iPhone SE"],
  Samsung: ["Galaxy S24 Ultra", "Galaxy S24+", "Galaxy S24", "Galaxy S23 Ultra", "Galaxy S23", "Galaxy S22", "Galaxy A55", "Galaxy A35", "Galaxy A25", "Galaxy A15", "Galaxy A05", "Galaxy M Serisi", "Galaxy Z Fold5", "Galaxy Z Flip5", "Galaxy Note 20", "Galaxy S21 FE"],
  Xiaomi: ["14 Pro", "14", "13T Pro", "13T", "Redmi Note 13 Pro", "Redmi Note 13", "Redmi Note 12", "Redmi 13C", "Redmi 12", "Poco X6 Pro", "Poco X6", "Poco F5", "Poco C65"],
  Huawei: ["P60", "P50", "Mate 50", "Nova 12", "Nova 11"],
  Oppo: ["Reno 11", "Reno 10", "A98", "A78", "A58"],
  Realme: ["C67", "C55", "11 Pro", "GT Neo", "Number serisi"],
  // Ek otomobil markaları
  Chevrolet: ["Cruze", "Aveo", "Spark", "Captiva", "Trax", "Lacetti", "Kalos", "Epica", "Nubira", "Malibu", "Camaro"],
  Seat: ["Ibiza", "Leon", "Arona", "Ateca", "Toledo", "Cordoba", "Altea", "Alhambra", "Tarraco"],
  "Škoda": ["Octavia", "Superb", "Fabia", "Kamiq", "Karoq", "Scala", "Kodiaq", "Rapid", "Yeti", "Roomster", "Enyaq"],
  Volvo: ["XC40", "XC60", "XC90", "S60", "S90", "V40", "V60", "V90", "C40", "EX30"],
  Suzuki: ["Swift", "Vitara", "SX4", "SX4 S-Cross", "Baleno", "Jimny", "Grand Vitara", "Alto", "Splash", "Ignis", "Celerio"],
  Mitsubishi: ["Lancer", "ASX", "Outlander", "Eclipse Cross", "L200", "Space Star", "Colt", "Pajero", "Attrage"],
  Mini: ["Cooper", "Cooper S", "Countryman", "Clubman", "Cabrio", "John Cooper Works", "Paceman"],
  "Land Rover": ["Range Rover", "Range Rover Sport", "Range Rover Velar", "Evoque", "Discovery", "Discovery Sport", "Defender", "Freelander"],
  Jeep: ["Renegade", "Compass", "Cherokee", "Grand Cherokee", "Wrangler", "Avenger", "Commander"],
  Mazda: ["2", "3", "6", "CX-3", "CX-30", "CX-5", "CX-60", "MX-5", "CX-9"],
  "Alfa Romeo": ["Giulietta", "Giulia", "Stelvio", "Mito", "Tonale", "159", "147", "Brera"],
  MG: ["ZS", "HS", "MG4", "MG5", "MG3", "Marvel R", "MG7", "EHS"],
  Chery: ["Tiggo 7", "Tiggo 7 Pro", "Tiggo 8", "Tiggo 8 Pro", "Omoda 5", "Omoda E5", "Tiggo 4", "Tiggo 2"],
  Porsche: ["911", "Cayenne", "Macan", "Panamera", "Taycan", "Boxster", "Cayman"],
  Jaguar: ["XE", "XF", "XJ", "F-Pace", "E-Pace", "I-Pace", "F-Type"],
  Lexus: ["IS", "ES", "LS", "UX", "NX", "RX", "RZ", "LC", "CT"],
  Cupra: ["Formentor", "Leon", "Born", "Ateca", "Terramar", "Tavascan"],
  "DS Automobiles": ["DS3", "DS4", "DS7", "DS9"],
  SsangYong: ["Tivoli", "Korando", "Rexton", "Musso", "Actyon"],
  Subaru: ["Impreza", "XV", "Forester", "Outback", "Legacy", "BRZ"],
  Isuzu: ["D-Max", "NPR", "NLR", "Novociti"],
  Infiniti: ["Q30", "Q50", "QX30", "QX50", "QX70"],
  "Aston Martin": ["DB11", "DBX", "Vantage", "DBS"],
  Bentley: ["Continental GT", "Bentayga", "Flying Spur"],
  Ferrari: ["Roma", "Portofino", "296 GTB", "F8", "SF90", "Purosangue"],
  Lamborghini: ["Huracán", "Urus", "Aventador", "Revuelto"],
  Maserati: ["Ghibli", "Levante", "Quattroporte", "Grecale", "MC20"],
  Lada: ["Vesta", "Granta", "Niva", "Largus"],
  Smart: ["ForTwo", "ForFour", "#1", "#3"],
  Daihatsu: ["Terios", "Sirion", "Materia", "Cuore"],
  // Ek cep telefonu markaları
  Vivo: ["Y36", "Y22", "V29", "V27", "X90"],
  Tecno: ["Camon 20", "Spark 10", "Pova 5", "Phantom X2"],
  "General Mobile": ["GM 24", "GM 23", "GM 22", "GM 21"],
  OnePlus: ["12", "11", "Nord 3", "Nord CE 3"],
  Nothing: ["Phone (2)", "Phone (2a)", "Phone (1)"],
  Reeder: ["S19 Max Pro", "P13 Blue Max", "S23 Pro"],
  // Yeni eklenen otomobil markalarının modelleri
  Cadillac: ["Escalade", "CT4", "CT5", "CT6", "XT4", "XT5", "XT6", "ATS", "CTS", "SRX", "BLS", "Lyriq"],
  Chrysler: ["300C", "Voyager", "Grand Voyager", "PT Cruiser", "Sebring", "Pacifica", "Crossfire"],
  DFSK: ["Glory 580", "Glory 500", "K01", "Mini Truck", "Seres 3"],
  Dodge: ["Charger", "Challenger", "Durango", "Journey", "Nitro", "Ram", "Caliber", "Avenger"],
  Fisker: ["Ocean", "Karma"],
  Geely: ["Coolray", "Emgrand", "Tugella", "Okavango", "Atlas", "Monjaro", "Geometry C"],
  Genesis: ["G70", "G80", "G90", "GV60", "GV70", "GV80"],
  GMC: ["Sierra", "Yukon", "Acadia", "Terrain", "Canyon", "Hummer EV"],
  Hongqi: ["H5", "H9", "E-HS9", "HS5", "HS7"],
  Lancia: ["Ypsilon", "Delta", "Musa", "Thema", "Kappa", "Lybra"],
  Leapmotor: ["T03", "C10", "C11", "C01"],
  Lotus: ["Emira", "Evora", "Elise", "Exige", "Eletre"],
  Lucid: ["Air", "Gravity"],
  Mahindra: ["Scorpio", "XUV500", "XUV700", "Thar", "Pik-Up", "KUV100"],
  Maybach: ["S580", "S680", "GLS 600", "57", "62"],
  McLaren: ["720S", "570S", "650S", "GT", "Artura", "750S", "765LT"],
  NIO: ["ET5", "ET7", "ES6", "ES8", "EL7", "EC6"],
  Ora: ["Funky Cat", "03", "07", "Good Cat"],
  Proton: ["Saga", "Persona", "X50", "X70", "Gen-2", "Savvy"],
  "Rolls-Royce": ["Phantom", "Ghost", "Wraith", "Cullinan", "Dawn", "Spectre"],
  Seres: ["3", "5", "SF5"],
  Skywell: ["ET5"],
  Tofaş: ["Şahin", "Doğan", "Kartal", "Serçe", "Murat 124", "Murat 131", "Tempra", "Tipo", "Uno"]
};

// Motosiklet markaları -> model/seri (araba markalarıyla çakışmasın diye ayrı).
export const MOTO_MODELS: Record<string, string[]> = {
  Honda: ["CBR", "CB", "CBF", "PCX", "Forza", "Africa Twin", "NC", "CRF", "Rebel", "Dio", "Activa", "CG", "SH"],
  Yamaha: ["YZF-R", "MT", "NMAX", "XMAX", "Tenere", "Tracer", "Crypton", "Cygnus", "PW", "TMAX", "YBR"],
  Kawasaki: ["Ninja", "Z", "Versys", "Vulcan", "KLX", "W", "Z H2", "Eliminator"],
  Suzuki: ["GSX-R", "GSX-S", "V-Strom", "Burgman", "Address", "Hayabusa", "Katana", "DR"],
  KTM: ["Duke", "RC", "Adventure", "SX", "EXC", "Super Duke", "390"],
  BMW: ["G 310 R", "G 310 GS", "F 750 GS", "F 850 GS", "R 1250 GS", "S 1000 RR", "R nineT", "C 400"],
  Ducati: ["Panigale", "Monster", "Multistrada", "Diavel", "Scrambler", "Streetfighter", "Hypermotard"],
  Triumph: ["Street Triple", "Speed Triple", "Bonneville", "Tiger", "Trident", "Rocket 3"],
  "Harley-Davidson": ["Sportster", "Street", "Iron 883", "Fat Boy", "Road King", "Softail", "Pan America"],
  Aprilia: ["RS", "Tuono", "SR", "Shiver", "Tuareg", "SXR"],
  Vespa: ["Primavera", "Sprint", "GTS", "LX", "Elettrica"],
  Piaggio: ["Medley", "Beverly", "Liberty", "MP3", "Zip"],
  Benelli: ["TNT", "TRK", "Leoncino", "302", "502", "180S", "Imperiale"],
  "Royal Enfield": ["Classic 350", "Meteor 350", "Hunter 350", "Himalayan", "Continental GT", "Interceptor"],
  "Moto Guzzi": ["V7", "V9", "V85 TT", "California"],
  Bajaj: ["Pulsar", "Dominar", "Boxer", "Avenger", "CT"],
  TVS: ["Apache", "Ntorq", "Raider", "Jupiter"],
  CFMoto: ["150NK", "250NK", "650NK", "700CL-X", "800MT", "450SR"],
  SYM: ["Symphony", "Jet", "Fiddle", "Maxsym", "Cruisym"],
  Kymco: ["Agility", "People", "Downtown", "Xciting", "Like"],
  Mondial: ["Drift", "150 MG", "Roadster", "XCR", "SMX", "Turbo"],
  Kuba: ["Milano", "Titan", "GTS", "Fantic"],
  RKS: ["Beta", "Titanic", "Falcon", "Roadstar"],
  Arora: ["Cappella", "Titan", "Vertu", "Speedmax"],
  Yuki: ["YK", "Panter", "Sirius"],
  Motolux: ["Efsane", "Panama", "Star"],
  Falcon: ["Serdar", "Motoran", "Dark"],
  Zontes: ["310R", "310T", "310X", "350GK", "350T", "125U", "155U", "703F"],
  Voge: ["300R", "300AC", "500R", "525DSX", "650DS", "900DSX", "SR4"],
  "QJ Motor": ["SRK 250", "SRK 400", "SRT 550", "SRV 550", "SRK 600", "SRK 700"],
  Keeway: ["RKF 125", "RKS 125", "RKV 200", "Superlight 200", "Vieste 300", "K-Light"],
  Hero: ["Splendor", "HF Deluxe", "Glamour", "Xpulse 200", "Destini", "Maestro"],
  Husqvarna: ["Svartpilen", "Vitpilen", "701", "TE", "FE", "Norden 901"],
  Indian: ["Scout", "Chief", "Chieftain", "Roadmaster", "FTR", "Springfield"],
  "MV Agusta": ["Brutale", "F3", "F4", "Dragster", "Turismo Veloce", "Rush"],
  Bimota: ["Tesi", "KB4", "DB"],
  "Can-Am": ["Ryker", "Spyder", "Maverick", "Outlander"],
  Lifan: ["KP", "KPT", "KPR"],
  "Segway Powersports": ["Snarler", "Villain", "Fugleman"]
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
  Huawei: ["MateBook D", "MateBook X", "MateBook 14", "MateBook 16"],
  Samsung: ["Galaxy Book", "Galaxy Book Pro", "Galaxy Book 4"],
  Casper: ["Excalibur", "Nirvana", "Nirvana X"],
  Toshiba: ["Satellite", "Tecra", "Portégé", "Dynabook"],
  Gigabyte: ["Aorus", "Aero", "G5", "G6"]
};

// Televizyon markaları -> seri.
export const TV_BRANDS = ["Samsung", "LG", "Vestel", "Philips", "Sony", "TCL", "Arçelik", "Beko", "Xiaomi", "Panasonic", "Grundig", "Diğer"];
export const TV_MODELS: Record<string, string[]> = {
  Samsung: ["Crystal UHD", "QLED", "Neo QLED", "OLED", "The Frame", "DU/CU Serisi"],
  LG: ["OLED", "QNED", "NanoCell", "UHD", "UR/UT Serisi"],
  Sony: ["Bravia", "OLED", "X Serisi", "A Serisi"],
  TCL: ["QLED", "Mini LED", "C Serisi", "P Serisi", "S Serisi"],
  Xiaomi: ["TV A2", "TV A Pro", "TV P1", "TV Q2", "TV S Pro"],
  Vestel: ["Satellite", "Regal", "Smart"],
  Philips: ["Ambilight", "The One", "OLED", "PUS Serisi"],
  Arçelik: ["Crystal", "OLED", "QLED", "A Serisi"],
  Beko: ["Crystal", "QLED", "B Serisi"],
  Grundig: ["Vision", "OLED", "QLED"],
  Panasonic: ["OLED", "LX Serisi", "MX Serisi"]
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
  Iveco: ["Daily", "Eurocargo", "Stralis", "S-Way"],
  Opel: ["Movano", "Vivaro", "Combo"],
  Hyundai: ["H-100", "H-350", "Staria Cargo"],
  Isuzu: ["D-Max", "NPR", "NLR", "NQR", "Novociti"]
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

// ---- emlak zengin özellik listeleri (çoklu seçim) ------------------------
// Profesyonel emlak portalı seviyesi; forma "İç Özellikler / Site Özellikleri /
// Manzara / Cephe / Ulaşım / Çevre / Enerji / Yapı Güvenliği" grupları olarak gelir.
const KONUT_IC_OZELLIK = ["Ankastre Fırın", "Ankastre Ocak", "Davlumbaz", "Bulaşık Makinesi", "Çamaşır Makinesi", "Kurutma Makinesi", "Buzdolabı", "Mikrodalga", "Klima", "VRF Klima", "Fiber İnternet", "Akıllı Ev Sistemi", "Akıllı Kilit", "Görüntülü Diafon", "Alarm Sistemi", "Yangın Alarmı", "Duman Dedektörü", "Kamera Sistemi", "Elektrikli Panjur", "Otomatik Perde", "Giyinme Odası", "Kiler", "Çamaşır Odası", "Ebeveyn Banyosu", "Jakuzi", "Sauna", "Şömine", "Amerikan Mutfak", "Ankastre Mutfak", "Ada Mutfak", "Granit Tezgah", "Laminat Parke", "Masif Parke", "Seramik Zemin", "Çelik Kapı", "Spot Aydınlatma", "LED Aydınlatma", "Kartonpiyer", "Asma Tavan", "Yerden Isıtma", "Isı Pompası", "Güneş Enerjisi", "Beyaz Eşyalı", "Perde Dahil", "Avize Dahil", "Yeni Boyanmış"];
const KONUT_SITE_OZELLIK = ["Açık Otopark", "Kapalı Otopark", "Misafir Otoparkı", "Elektrikli Araç Şarjı", "Asansör", "Yük Asansörü", "Jeneratör", "Su Deposu", "Hidrofor", "7/24 Güvenlik", "Güvenlik Kamerası", "Kartlı Giriş", "Parmak İzi Giriş", "Kapıcı", "Resepsiyon", "Concierge", "Çocuk Parkı", "Kreş", "Basketbol Sahası", "Futbol Sahası", "Tenis Kortu", "Fitness Salonu", "Pilates/Yoga", "Açık Havuz", "Kapalı Havuz", "Çocuk Havuzu", "Sauna", "Hamam", "Spa", "Kafeterya", "Market", "Kuaför", "Yürüyüş Parkuru", "Bisiklet Yolu", "Peyzaj Alanı", "Süs Havuzu", "Kamelya", "Barbekü Alanı", "Ortak Bahçe", "Hobi Bahçesi", "Evcil Hayvan Alanı", "Yangın Merdiveni", "Acil Toplanma Alanı"];
const MANZARA_OPTS = ["Deniz", "Boğaz", "Göl", "Nehir", "Baraj", "Orman", "Dağ", "Doğa", "Park", "Bahçe", "Havuz", "Şehir", "Cadde", "Meydan", "Marina", "Kale", "Tarihi Yapı", "Vadi", "Tarla", "Bağ", "Zeytinlik", "Yok"];
const CEPHE_OPTS = ["Kuzey", "Güney", "Doğu", "Batı", "Kuzeydoğu", "Kuzeybatı", "Güneydoğu", "Güneybatı"];
const ULASIM_OPTS = ["Metro", "Metrobüs", "Marmaray", "Tramvay", "Banliyö", "Otobüs", "Minibüs", "Dolmuş", "Taksi Durağı", "Havalimanı", "Otoyol", "TEM", "E-5", "Köprü", "İskele", "Marina", "Teleferik"];
const CEVRE_OPTS = ["AVM", "Market", "Süpermarket", "Fırın", "Pazar", "Eczane", "Hastane", "Sağlık Ocağı", "Veteriner", "Anaokulu", "İlkokul", "Ortaokul", "Lise", "Üniversite", "Cami", "Park", "Spor Salonu", "Kütüphane", "Belediye", "Banka", "ATM", "Polis Merkezi", "İtfaiye", "Postane"];
const ENERJI_SINIF = ["A+++", "A++", "A+", "A", "B", "C", "D", "E", "F", "G", "Belirtilmemiş"];
const YAPI_GUVENLIK = ["Deprem Yönetmeliğine Uygun", "Zemin Etüdü Yapıldı", "Fore Kazık", "Radye Temel", "Perde Beton", "Çelik Konstrüksiyon", "Güçlendirme Yapıldı", "Yapı Denetimli", "İskan Alınmış", "Yapı Kullanma İzin Belgesi Var", "Kentsel Dönüşüme Uygun", "Riskli Yapı Değil"];

// ---- arsa/arazi zengin listeleri (spec 26–34) ----------------------------
const IMAR_TURU = ["Konut", "Ticaret", "Ticaret + Konut", "Sanayi", "Küçük Sanayi", "Depolama", "Akaryakıt", "Eğitim", "Sağlık", "Spor", "Turizm", "Otel", "Villa", "Tarım", "Hayvancılık", "Enerji", "Karma Kullanım"];
const ARSA_ALTYAPI = ["Elektrik", "Trafo Yakın", "Sanayi Elektriği", "Şehir Suyu", "Artezyen", "Kuyu", "Sulama Kanalı", "Doğalgaz (Kapıda)", "Doğalgaz (Sokakta)", "Kanalizasyon", "Fosseptik", "Fiber", "Telefon Hattı"];
const YOL_DURUMU = ["Asfalt", "Beton", "Stabilize", "Toprak Yol", "Kadastro Yolu", "Yol Açılacak", "Yol Yok"];
const PARSEL_SEKIL = ["Dikdörtgen", "Kare", "Üçgen", "Yamuk", "Düzensiz"];
const EGIM_DURUMU = ["Düz", "Hafif Eğimli", "Eğimli", "Çok Eğimli"];
const ARSA_DOGAL = ["Deniz Manzarası", "Göl Manzarası", "Orman Manzarası", "Dağ Manzarası", "Şehir Manzarası", "Vadi", "Nehir", "Dere", "Şelale", "Meyve Bahçesi", "Zeytinlik", "Fındıklık", "Cevizlik", "Bağ", "Lavanta Bahçesi"];
const ARSA_TARIM = ["Sulanabilir", "Kuru Tarım", "Organik Tarım", "Seraya Uygun", "Hayvancılığa Uygun", "Meyveciliğe Uygun", "Bağcılığa Uygun", "Arıcılığa Uygun", "Balık Çiftliğine Uygun", "GES Uygun", "RES Uygun"];
const ARSA_TAPU = ["Müstakil Tapulu", "Hisseli Tapu", "Tahsisli", "Kooperatif", "İntifa Hakkı", "Elbirliği Mülkiyeti", "Paylı Mülkiyet", "İpotekli", "Hacizli", "Şerhli", "Temiz Tapu"];

// ---- işyeri zengin listeleri (spec 38–47) --------------------------------
const ISYERI_RUHSAT = ["İşyeri Açma Ruhsatı", "Gıda Ruhsatı", "Turizm Belgesi", "Sağlık Bakanlığı Ruhsatı", "Tarım Bakanlığı Ruhsatı", "Üretim İzni", "İmalat Ruhsatı", "Sanayi Sicili", "ISO Belgesi", "CE Belgesi", "TSE Belgesi", "Yangın Raporu", "İtfaiye Uygunluk", "ÇED Belgesi"];
const ISYERI_DURUM = ["Boş", "Kiracılı", "Faal İşletme", "Devren", "Franchise", "Marka Hakları Dahil", "Personel Dahil", "Makineler Dahil", "Stok Dahil", "Ruhsat Dahil"];
const ISYERI_OZELLIK = ["Asansör", "Yük Asansörü", "Vinç Sistemi", "Jeneratör", "Trafo", "Yangın Sistemi", "Kamera Sistemi", "Alarm", "Fiber İnternet", "Tır Girişi", "Forklift Girişi", "Yükleme Rampası", "Soyunma Odası", "Personel Alanı", "Mutfak", "WC", "Depo Alanı", "Endüstriyel Mutfak", "Vitrin", "Otopark", "Kartlı Geçiş", "Resepsiyon"];

// ---- proje satış modülü (spec 48–60) -------------------------------------
const PROJE_TIPI = ["Konut Projesi", "Daire Projesi", "Residence Projesi", "Villa Projesi", "Müstakil Ev Projesi", "Karma Yaşam Projesi", "Sosyal Konut Projesi", "Tiny House Projesi", "Bungalov Projesi", "Ticari Proje", "Ofis Projesi", "Plaza Projesi", "İş Merkezi", "AVM Projesi", "Sanayi Sitesi", "Lojistik Merkezi", "Depo Projesi", "Konut + AVM", "Konut + Ofis", "Konut + Otel", "Yaşam Merkezi", "Akıllı Şehir Projesi"];
const PROJE_SOSYAL = ["Açık Havuz", "Kapalı Havuz", "Çocuk Havuzu", "Fitness", "Sauna", "Spa", "Hamam", "Buhar Odası", "Yoga Salonu", "Pilates", "Basketbol", "Futbol", "Tenis", "Voleybol", "Squash", "Koşu Parkuru", "Bisiklet Yolu", "Yürüyüş Alanı", "Çocuk Parkı", "Kreş", "Anaokulu", "Kütüphane", "Sinema", "Oyun Salonu", "Hobi Odası", "Misafir Odası", "Toplantı Salonu", "Çok Amaçlı Salon", "Barbekü", "Piknik Alanı", "Gölet", "Peyzaj Alanı", "Süs Havuzu", "Evcil Hayvan Parkı"];
const PROJE_GUVENLIK = ["7/24 Güvenlik", "Kamera", "Plaka Tanıma", "Kartlı Giriş", "Parmak İzi", "Yüz Tanıma", "Site Duvarı", "Güvenlik Noktası", "Yangın Alarmı", "Sprinkler", "Acil Çıkış"];
const PROJE_ENERJI = ["Güneş Paneli", "Yağmur Suyu Toplama", "Gri Su Sistemi", "Isı Pompası", "Elektrikli Araç Şarjı", "Akıllı Sayaç", "Akıllı Ev", "Merkezi Klima", "VRF"];
const ODEME_SECENEK = ["Peşin", "Taksit", "Firma Finansmanı", "Banka Kredisi", "Katılım Finansmanı", "Döviz", "Altın", "Kripto", "Senet", "Araç Takası", "Arsa Takası"];
const PROJE_KAMPANYA = ["Lansman İndirimi", "Peşin İndirimi", "Faizsiz Taksit", "Mobilya Hediyesi", "Beyaz Eşya Hediyesi", "Tapu Masrafı Dahil", "Aidat Hediyesi", "Araç Hediyesi", "Tatil Hediyesi", "Çekiliş Kampanyası"];

// ---- devremülk (spec 61–62) ----------------------------------------------
const DEVREMULK_KONAKLAMA = ["Otel Odası", "Apart Daire", "Villa", "Residence", "Bungalov", "Tiny House", "Dağ Evi"];
const DEVREMULK_SEKIL = ["Haftalık", "10 Günlük", "15 Günlük", "Aylık", "Sezonluk", "Yıllık"];
const DEVREMULK_TESIS = ["Açık Havuz", "Kapalı Havuz", "Termal Havuz", "Aqua Park", "Sauna", "Hamam", "Spa", "Fitness", "Çocuk Kulübü", "Restoran", "Kafe", "Market", "Mini Club", "Tenis Kortu", "Basketbol", "Futbol", "Animasyon", "Canlı Müzik", "Plaj", "İskele"];

// ---- turistik tesis (spec 63) --------------------------------------------
const TURISTIK_TUR = ["Otel", "Butik Otel", "Apart Otel", "Motel", "Pansiyon", "Hostel", "Kamp Alanı", "Glamping", "Karavan Parkı", "Dağ Oteli", "Yayla Tesisi", "Termal Tesis", "Tatil Köyü", "Bungalov Tesisi", "Marina Tesisi"];
const TURISTIK_ALAN = ["Açık Havuz", "Kapalı Havuz", "Çocuk Havuzu", "Spa", "Hamam", "Sauna", "Fitness", "Restoran", "A La Carte", "Lobby Bar", "Havuz Bar", "Beach Bar", "Toplantı Salonu", "Kongre Salonu", "Düğün Salonu", "Çocuk Parkı", "Oyun Salonu", "Mini Club", "Disco", "Açık Otopark", "Kapalı Otopark"];
const TURISTIK_ODA = ["Standart Oda", "Deluxe Oda", "Family Room", "Suit", "King Suit", "Presidential Suit", "Engelli Odası"];

// ---- lüks konut & akıllı ev (spec 64–65) ---------------------------------
const LUKS_OZELLIK = ["Akıllı Ev Sistemi", "Parmak İzi Giriş", "Yüz Tanıma", "Özel Asansör", "Özel Garaj", "Şarap Mahzeni", "Sinema Salonu", "Oyun Odası", "Bilardo Salonu", "Kütüphane", "Hobi Atölyesi", "Spa", "Hamam", "Sauna", "Buhar Odası", "Masaj Odası", "Kapalı Havuz", "Sonsuzluk Havuzu", "Isıtmalı Havuz", "Helikopter Pisti", "Tekne İskelesi", "Özel Plaj", "Misafir Evi", "Personel Lojmanı", "Panik Odası", "Çelik Kasa Odası"];
const AKILLI_EV = ["Apple HomeKit", "Google Home", "Amazon Alexa", "Samsung SmartThings", "KNX", "Zigbee", "Z-Wave", "Matter", "Akıllı Aydınlatma", "Akıllı Klima", "Akıllı Isıtma", "Akıllı Perde", "Akıllı Panjur", "Akıllı Kilit", "Akıllı Garaj", "Akıllı Sulama", "Enerji Takibi", "Su Kaçağı Sensörü", "Gaz Kaçağı Sensörü", "Duman Sensörü"];

// ---- ilan etiketleri (spec 72, çoklu) — tüm emlak formlarında ortak -------
const ILAN_ETIKET = ["Acil", "Yeni", "Fırsat", "Yatırımlık", "Masrafsız", "Pazarlık Payı Var", "Takasa Açık", "Krediye Uygun", "Deniz Manzaralı", "Şehir Merkezinde", "Metroya Yakın", "Sahile Yakın", "Site İçinde", "Eşyalı", "Lüks", "Sıfır", "Yapım Aşamasında", "Hemen Teslim", "İskanlı", "Tapusu Hazır", "Yüksek Kira Getirili"];
const ETIKET_FIELD: FieldDef = { key: "etiketler", label: "İlan etiketleri", type: "multiselect", options: ILAN_ETIKET };

// İş yeri ortak çekirdek alanları — hem genel işyeri hem alt-tip (restoran/fabrika/
// ofis) formları paylaşır (etiketler + açıklama alt-formda ayrıca eklenir).
const ISYERI_CORE: FieldDef[] = [
  F.title,
  { key: "listingType", label: "İlan tipi", type: "select", required: true, options: ["Satılık", "Kiralık", "Devren"] },
  F.price,
  { key: "grossM2", label: "m² (brüt)", type: "number", required: true, suffix: "m²" },
  { key: "netM2", label: "m² (net)", type: "number", suffix: "m²" },
  { key: "rooms", label: "Bölüm / oda sayısı", type: "number" },
  { key: "wc", label: "WC sayısı", type: "number" },
  { key: "floor", label: "Bulunduğu kat", type: "text" },
  { key: "floorCount", label: "Kat sayısı", type: "number" },
  { key: "ceilingHeight", label: "Tavan yüksekliği", type: "text", suffix: "m" },
  { key: "buildingAge", label: "Bina yaşı", type: "text" },
  { key: "heating", label: "Isıtma", type: "select", options: ["Doğalgaz", "Merkezi", "Klima", "Yerden Isıtma", "Yok"] },
  { key: "deposit", label: "Depozito (kiralıkta)", type: "number", suffix: "₺" },
  { key: "dues", label: "Aidat", type: "number", suffix: "₺" },
  { key: "devrenBedeli", label: "Devren bedeli", type: "number", suffix: "₺" },
  { key: "rentalIncome", label: "Aylık kira getirisi", type: "number", suffix: "₺" },
  { key: "usage", label: "İşletme durumu", type: "select", options: ["Boş", "Kiracılı", "Faal İşletme", "Sahibi Kullanıyor"] },
  { key: "isletmeIcerik", label: "Devirde dahil olanlar", type: "multiselect", options: ISYERI_DURUM },
  { key: "ruhsat", label: "Ruhsat / belgeler", type: "multiselect", options: ISYERI_RUHSAT },
  { key: "isyeriOzellik", label: "İş yeri özellikleri", type: "multiselect", options: ISYERI_OZELLIK },
  { key: "caddeUzeri", label: "Cadde üzeri mi?", type: "bool" },
  { key: "avmIcinde", label: "AVM içinde mi?", type: "bool" },
  { key: "sanayiSitesi", label: "Sanayi sitesinde mi?", type: "bool" },
  { key: "aracGirisi", label: "Araç girişine uygun mu?", type: "bool" },
  { key: "seller", label: "Kimden", type: "select", options: ["Sahibinden", "Emlak Ofisinden", "Müteahhitten", "Bankadan"] },
  { key: "deed", label: "Tapu durumu", type: "select", options: ["Kat Mülkiyetli", "Kat İrtifaklı", "Arsa Tapulu", "Hisseli Tapu", "Müstakil Tapu", "Bilinmiyor"] },
  { key: "swapReal", label: "Takas olur mu?", type: "bool" }
];
const RESTORAN_EXTRA: FieldDef[] = [
  { key: "vitrinM", label: "Vitrin metresi", type: "text", suffix: "m" },
  { key: "masaSayisi", label: "Masa sayısı", type: "number" },
  { key: "sandalyeSayisi", label: "Sandalye sayısı", type: "number" },
  { key: "kapaliKapasite", label: "Kapalı alan kapasitesi", type: "number", suffix: "kişi" },
  { key: "acikKapasite", label: "Açık alan kapasitesi", type: "number", suffix: "kişi" },
  { key: "restoranOzellik", label: "Restoran özellikleri", type: "multiselect", options: ["Bahçe", "Teras", "Çocuk Alanı", "Vale", "Paket Servis", "Motor Kurye Alanı", "Bacası Var", "Endüstriyel Mutfak", "Soğuk Oda", "Fırın", "Izgara", "Pizza Fırını", "Hamurhane", "Alkollü Ruhsat", "Canlı Müzik Ruhsatı"] }
];
const FABRIKA_EXTRA: FieldDef[] = [
  { key: "kapaliAlan", label: "Kapalı alan", type: "number", suffix: "m²" },
  { key: "acikAlan", label: "Açık alan", type: "number", suffix: "m²" },
  { key: "uretimHatti", label: "Üretim hattı sayısı", type: "number" },
  { key: "elektrikGucu", label: "Elektrik gücü", type: "text", suffix: "kVA" },
  { key: "fabrikaOzellik", label: "Fabrika teknik özellikleri", type: "multiselect", options: ["Trafo", "Vinç", "Tır Rampası", "Forklift Alanı", "Yükleme Rampası", "İdari Ofis", "Yemekhane", "Personel Soyunma", "Güvenlik Kulübesi", "Arıtma Tesisi", "Bacalı Üretim", "Gaz Hattı", "Basınçlı Hava Sistemi"] }
];
const OFIS_EXTRA: FieldDef[] = [
  { key: "meetingRooms", label: "Toplantı odası sayısı", type: "number" },
  { key: "managerRooms", label: "Yönetici odası sayısı", type: "number" },
  { key: "ofisOzellik", label: "Ofis özellikleri", type: "multiselect", options: ["Açık Ofis", "Kapalı Ofis", "Server Odası", "Klima", "Fiber İnternet", "Kartlı Geçiş", "Resepsiyon", "Bekleme Alanı", "Mutfak", "WC", "Arşiv", "Balkon", "Teras", "Otopark", "Vale", "Concierge"] }
];

// ---- vasıta donanım listeleri (arabam.com/Sahibinden seviyesi) -----------
const ARAC_GUVENLIK = ["ABS", "ESP / VSA", "ASR", "Sürücü Hava Yastığı", "Yolcu Hava Yastığı", "Yan Hava Yastığı", "Perde Hava Yastığı", "Dizel Partikül Filtresi", "Yokuş Kalkış Desteği", "Lastik Basınç Sensörü", "Çocuk Kilidi", "Isofix", "Alarm", "Immobilizer", "Merkezi Kilit", "Kör Nokta Uyarı", "Şerit Takip", "Çarpışma Önleme", "Gece Görüş", "Yaya Algılama"];
const ARAC_KONFOR = ["Hız Sabitleyici", "Adaptif Hız Sabitleyici", "Geri Görüş Kamerası", "360° Kamera", "Park Sensörü (Arka)", "Park Sensörü (Ön)", "Otomatik Park", "Deri Koltuk", "Kumaş Koltuk", "Hafızalı Koltuklar", "Isıtmalı Koltuklar", "Soğutmalı Koltuklar", "Elektrikli Koltuklar", "Klima", "Dijital / Çift Bölgeli Klima", "Start/Stop", "Anahtarsız Giriş", "Sunroof", "Panoramik Cam Tavan", "Elektrikli Ön Camlar", "Elektrikli Arka Camlar", "Katlanır Aynalar", "Isıtmalı Direksiyon", "Ambiyans Aydınlatma", "Elektrikli Bagaj"];
const ARAC_MULTIMEDYA = ["Navigasyon", "Apple CarPlay", "Android Auto", "Bluetooth", "USB / AUX", "Dokunmatik Ekran", "Dijital Gösterge", "Head-up Display", "Kablosuz Şarj", "Premium Ses Sistemi", "Arka Eğlence Sistemi"];
const ARAC_DIS = ["LED Farlar", "Xenon Farlar", "Matrix / Adaptif Far", "Sis Farları", "Far Yıkama", "Alaşım Jant", "Hardtop", "Römork / Çeki Demiri", "Yağmur Sensörü", "Otomatik Katlanır Ayna", "Krom Paket"];
const ARAC_ETIKET = ["Sıfır", "Garantili", "Değişensiz", "Boyasız", "Tramersiz", "Faturalı", "Takasa Uygun", "Acil Satılık", "Klasik / Koleksiyon", "Engelli Kullanımına Uygun", "İlk Sahibinden"];
const VASITA_ETIKET_FIELD: FieldDef = { key: "etiketler", label: "İlan etiketleri", type: "multiselect", options: ARAC_ETIKET };

// ---- genel (emlak/vasıta dışı) ürün özellik & etiket listeleri -----------
const GENEL_ETIKET = ["Sıfır", "Az Kullanılmış", "Garantili", "Faturalı", "Kutusunda", "Aksesuarları Tam", "Ücretsiz Kargo", "Pazarlık Payı Var", "Takasa Uygun", "Acil"];
const GENEL_ETIKET_FIELD: FieldDef = { key: "etiketler", label: "İlan etiketleri", type: "multiselect", options: GENEL_ETIKET };
const URUN_OZELLIK = ["Garantili", "Faturalı", "Kutusunda", "Aksesuarları Tam", "Şarj Aleti / Adaptör Dahil", "Kılıf / Kap Dahil", "Ekran Koruyucu", "Servis Bakımlı"];
const URUN_OZELLIK_FIELD: FieldDef = { key: "urunOzellik", label: "Ürün özellikleri / dahil olanlar", type: "multiselect", options: URUN_OZELLIK };
const MODA_SEZON: FieldDef = { key: "sezon", label: "Sezon", type: "select", options: ["İlkbahar / Yaz", "Sonbahar / Kış", "4 Mevsim"] };
const MODA_DESEN: FieldDef = { key: "desen", label: "Desen", type: "select", options: ["Düz", "Çizgili", "Kareli", "Çiçekli", "Desenli", "Baskılı", "Ekose"] };
const MODA_KESIM: FieldDef = { key: "kesim", label: "Kalıp / kesim", type: "select", options: ["Slim Fit", "Regular Fit", "Oversize", "Skinny", "Straight", "Bol Kesim"] };
const MOBILYA_STIL: FieldDef = { key: "stil", label: "Stil", type: "select", options: ["Modern", "Klasik", "Country", "Avangard", "Vintage", "Endüstriyel", "Rustik", "Art Deco"] };

// ---- form schemas (category-specific) ------------------------------------
export const formSchemas: Record<string, FormSchema> = {
  konut: {
    key: "konut",
    title: "Konut bilgileri",
    fields: [
      F.title,
      { key: "listingType", label: "İlan tipi", type: "select", required: true, options: ["Satılık", "Kiralık", "Günlük Kiralık", "Devren", "Kat Karşılığı", "Projeden Satılık", "Takaslı"] },
      F.price,
      { key: "grossM2", label: "m² (brüt)", type: "number", required: true, suffix: "m²" },
      { key: "netM2", label: "m² (net)", type: "number", suffix: "m²" },
      { key: "rooms", label: "Oda sayısı", type: "select", required: true, options: ["Stüdyo", "1+0", "1+1", "2+1", "3+1", "4+1", "5+1", "6+1", "7+1", "8+1 ve üzeri"] },
      { key: "salon", label: "Salon sayısı", type: "number" },
      { key: "bathrooms", label: "Banyo sayısı", type: "number" },
      { key: "wc", label: "WC sayısı", type: "number" },
      { key: "buildingAge", label: "Bina yaşı", type: "select", options: ["0 (Sıfır)", "1-5", "6-10", "11-15", "16-20", "21-30", "31+"] },
      { key: "floor", label: "Bulunduğu kat", type: "text" },
      { key: "floorCount", label: "Kat sayısı", type: "number" },
      { key: "heating", label: "Isıtma tipi", type: "select", options: ["Yok", "Soba", "Doğalgaz Sobası", "Kat Kaloriferi", "Doğalgaz (Kombi)", "Merkezi", "Merkezi (Pay Ölçer)", "Yerden Isıtma", "Klima", "Güneş Enerjisi", "Jeotermal", "Şömine"] },
      { key: "balcony", label: "Balkon var mı?", type: "bool" },
      { key: "terrace", label: "Teras var mı?", type: "bool" },
      { key: "garden", label: "Bahçe var mı?", type: "bool" },
      { key: "furnished", label: "Eşyalı mı?", type: "bool" },
      { key: "usage", label: "Kullanım durumu", type: "select", options: ["Boş", "Kiracılı", "Mülk sahibi oturuyor"] },
      { key: "inSite", label: "Site içinde mi?", type: "bool" },
      { key: "siteName", label: "Site / proje adı", type: "text", placeholder: "ör. Bahçeşehir Konakları" },
      { key: "dues", label: "Aidat", type: "number", suffix: "₺" },
      { key: "deposit", label: "Depozito (kiralıkta)", type: "number", suffix: "₺" },
      { key: "facade", label: "Cephe / yön", type: "multiselect", options: CEPHE_OPTS },
      { key: "view", label: "Manzara", type: "multiselect", options: MANZARA_OPTS },
      { key: "parking", label: "Otopark", type: "select", options: ["Açık Otopark", "Kapalı Otopark", "Açık & Kapalı", "Yok"] },
      { key: "elevator", label: "Asansör var mı?", type: "bool" },
      { key: "security", label: "Güvenlik var mı?", type: "bool" },
      { key: "pool", label: "Havuz var mı?", type: "bool" },
      { key: "gym", label: "Spor salonu var mı?", type: "bool" },
      { key: "generator", label: "Jeneratör var mı?", type: "bool" },
      { key: "disabledFriendly", label: "Engelliye uygun mu?", type: "bool" },
      { key: "creditEligible", label: "Krediye uygun mu?", type: "bool" },
      { key: "urbanTransform", label: "Kentsel dönüşüme uygun mu?", type: "bool" },
      { key: "rentalIncome", label: "Aylık kira getirisi", type: "number", suffix: "₺" },
      { key: "seller", label: "Kimden", type: "select", options: ["Sahibinden", "Emlak Ofisinden", "İnşaat Firmasından", "Bankadan", "Yetkili Kurumdan"] },
      { key: "deed", label: "Tapu durumu", type: "select", options: ["Kat Mülkiyetli", "Kat İrtifaklı", "Arsa Tapulu", "Hisseli Tapu", "Müstakil Tapu", "Kooperatif Hisseli", "İntifa Hakkı", "İpotekli", "Bilinmiyor"] },
      { key: "swapReal", label: "Takas / kat karşılığı olur mu?", type: "bool" },
      { key: "energyClass", label: "Enerji sınıfı", type: "select", options: ENERJI_SINIF },
      { key: "interiorFeatures", label: "İç özellikler", type: "multiselect", options: KONUT_IC_OZELLIK },
      { key: "siteFeatures", label: "Site & sosyal özellikler", type: "multiselect", options: KONUT_SITE_OZELLIK },
      { key: "buildingSafety", label: "Deprem & yapı güvenliği", type: "multiselect", options: YAPI_GUVENLIK },
      { key: "transport", label: "Ulaşıma yakınlık", type: "multiselect", options: ULASIM_OPTS },
      { key: "environment", label: "Çevrede olanlar", type: "multiselect", options: CEVRE_OPTS },
      { key: "smartHome", label: "Akıllı ev sistemleri", type: "multiselect", options: AKILLI_EV },
      { key: "luxuryFeatures", label: "Lüks özellikler", type: "multiselect", options: LUKS_OZELLIK },
      ETIKET_FIELD,
      F.desc
    ]
  },
  isyeri: {
    key: "isyeri",
    title: "İş yeri bilgileri",
    fields: [...ISYERI_CORE, { key: "vitrinM", label: "Vitrin metresi", type: "text", suffix: "m" }, ETIKET_FIELD, F.desc]
  },
  isyeriRestoran: {
    key: "isyeriRestoran",
    title: "Restoran / Cafe bilgileri",
    fields: [...ISYERI_CORE, ...RESTORAN_EXTRA, ETIKET_FIELD, F.desc]
  },
  isyeriFabrika: {
    key: "isyeriFabrika",
    title: "Fabrika / üretim tesisi bilgileri",
    fields: [...ISYERI_CORE, ...FABRIKA_EXTRA, ETIKET_FIELD, F.desc]
  },
  isyeriOfis: {
    key: "isyeriOfis",
    title: "Ofis / büro bilgileri",
    fields: [...ISYERI_CORE, ...OFIS_EXTRA, ETIKET_FIELD, F.desc]
  },
  arsa: {
    key: "arsa",
    title: "Arsa bilgileri",
    fields: [
      F.title,
      { key: "listingType", label: "İlan tipi", type: "select", required: true, options: ["Satılık", "Kiralık", "Kat Karşılığı"] },
      F.price,
      { key: "m2", label: "m²", type: "number", required: true, suffix: "m²" },
      { key: "zoning", label: "İmar durumu", type: "select", options: ["İmarlı", "İmarsız", "Kısmi İmarlı", "Uygulama İmar Planlı", "Nazım İmar Planlı", "Kentsel Dönüşüm Alanı", "Koruma Alanı", "Sit Alanı", "Tarım Alanı", "Orman Alanı", "Mera", "Kıyı Bandı", "Turizm Alanı", "Organize Sanayi Bölgesi", "Serbest Bölge", "Plansız"] },
      { key: "imarTuru", label: "İmar türü", type: "select", options: IMAR_TURU },
      { key: "hisseOrani", label: "Satılık hisse oranı", type: "text", placeholder: "ör. 1/2, tam" },
      { key: "taks", label: "TAKS", type: "text", placeholder: "ör. 0.30" },
      { key: "kaks", label: "KAKS (Emsal)", type: "text", placeholder: "ör. 1.50" },
      { key: "gabari", label: "Gabari (yükseklik)", type: "text", placeholder: "ör. 12.50 m / Serbest" },
      { key: "maxKat", label: "Maksimum kat", type: "text" },
      { key: "yapiNizami", label: "Yapı nizamı", type: "select", options: ["Ayrık", "Bitişik", "Blok"] },
      { key: "ada", label: "Ada", type: "text" },
      { key: "parsel", label: "Parsel", type: "text" },
      { key: "pafta", label: "Pafta", type: "text" },
      { key: "parselSekli", label: "Parsel şekli", type: "select", options: PARSEL_SEKIL },
      { key: "egim", label: "Eğim durumu", type: "select", options: EGIM_DURUMU },
      { key: "roadStatus", label: "Yol durumu", type: "select", options: YOL_DURUMU },
      { key: "kosePartsel", label: "Köşe parsel mi?", type: "bool" },
      { key: "ifraz", label: "İfraz edilebilir mi?", type: "bool" },
      { key: "tevhit", label: "Tevhit edilebilir mi?", type: "bool" },
      { key: "zeminEtut", label: "Zemin etüdü yapıldı mı?", type: "bool" },
      { key: "altyapi", label: "Altyapı", type: "multiselect", options: ARSA_ALTYAPI },
      { key: "dogalOzellik", label: "Doğal özellikler / manzara", type: "multiselect", options: ARSA_DOGAL },
      { key: "tarimOzellik", label: "Tarımsal uygunluk", type: "multiselect", options: ARSA_TARIM },
      { key: "denizMesafe", label: "Denize mesafe", type: "text", placeholder: "ör. 500 m" },
      { key: "merkezMesafe", label: "Merkeze mesafe", type: "text", placeholder: "ör. 3 km" },
      { key: "anaYolMesafe", label: "Ana yola mesafe", type: "text" },
      { key: "deed", label: "Tapu durumu", type: "select", options: ARSA_TAPU },
      { key: "creditEligible", label: "Krediye uygun mu?", type: "bool" },
      { key: "seller", label: "Kimden", type: "select", options: ["Sahibinden", "Emlak Ofisinden", "Müteahhitten", "Bankadan", "İcradan", "Belediyeden", "TOKİ'den"] },
      F.takas,
      ETIKET_FIELD,
      F.desc
    ]
  },
  bina: {
    key: "bina",
    title: "Bina bilgileri",
    fields: [
      F.title,
      { key: "listingType", label: "İlan tipi", type: "select", required: true, options: ["Satılık", "Kiralık", "Devren"] },
      F.price,
      { key: "totalGrossM2", label: "Toplam brüt m²", type: "number", required: true, suffix: "m²" },
      { key: "landM2", label: "Arsa m²", type: "number", suffix: "m²" },
      { key: "totalFloors", label: "Toplam kat sayısı", type: "number" },
      { key: "basementFloors", label: "Bodrum kat sayısı", type: "number" },
      { key: "unitCount", label: "Bağımsız bölüm sayısı", type: "number" },
      { key: "apartmentCount", label: "Daire sayısı", type: "number" },
      { key: "shopCount", label: "Dükkan sayısı", type: "number" },
      { key: "buildingAge", label: "Bina yaşı", type: "text" },
      { key: "monthlyIncome", label: "Aylık toplam kira getirisi", type: "number", suffix: "₺" },
      { key: "occupancyRate", label: "Doluluk oranı", type: "text", suffix: "%" },
      { key: "elevator", label: "Asansör var mı?", type: "bool" },
      { key: "earthquake", label: "Deprem yönetmeliğine uygun mu?", type: "bool" },
      { key: "urbanTransform", label: "Kentsel dönüşüme uygun mu?", type: "bool" },
      { key: "buildingSafety", label: "Deprem & yapı güvenliği", type: "multiselect", options: YAPI_GUVENLIK },
      { key: "deed", label: "Tapu durumu", type: "select", options: ["Kat Mülkiyetli", "Kat İrtifaklı", "Arsa Tapulu", "Hisseli Tapu", "Müstakil Tapu", "Bilinmiyor"] },
      ETIKET_FIELD,
      F.desc
    ]
  },
  proje: {
    key: "proje",
    title: "Proje bilgileri",
    fields: [
      F.title,
      { key: "projectName", label: "Proje adı", type: "text", required: true },
      { key: "projectType", label: "Proje tipi", type: "select", required: true, options: PROJE_TIPI },
      { key: "company", label: "Firma adı", type: "text", required: true },
      { key: "projectStatus", label: "Proje durumu", type: "select", required: true, options: ["Ön Talep", "Satışta", "Lansmanda", "İnşaat Devam Ediyor", "Teslime Hazır", "Tamamlandı"] },
      { key: "constructionPct", label: "İnşaat seviyesi", type: "text", suffix: "%" },
      { key: "startDate", label: "Proje başlangıç tarihi", type: "text", placeholder: "ör. 2025 Q3" },
      { key: "deliveryDate", label: "Teslim tarihi", type: "text", placeholder: "ör. 2027 Q2" },
      { key: "priceMin", label: "Fiyat (min)", type: "number", suffix: "₺" },
      { key: "priceMax", label: "Fiyat (max)", type: "number", suffix: "₺" },
      { key: "totalLandM2", label: "Toplam arsa alanı", type: "number", suffix: "m²" },
      { key: "totalUnits", label: "Toplam konut sayısı", type: "number" },
      { key: "commercialUnits", label: "Ticari ünite sayısı", type: "number" },
      { key: "blockCount", label: "Blok sayısı", type: "number" },
      { key: "floorCount", label: "Kat sayısı", type: "text" },
      { key: "unitTypes", label: "Daire tipleri", type: "text", placeholder: "ör. 1+1, 2+1, 3+1, dubleks" },
      { key: "m2Range", label: "m² aralığı", type: "text", placeholder: "ör. 65-180 m²" },
      { key: "downPayment", label: "Peşinat oranı", type: "text", suffix: "%" },
      { key: "amenities", label: "Sosyal donatılar", type: "multiselect", options: PROJE_SOSYAL },
      { key: "security", label: "Güvenlik sistemleri", type: "multiselect", options: PROJE_GUVENLIK },
      { key: "energy", label: "Enerji & altyapı", type: "multiselect", options: PROJE_ENERJI },
      { key: "payment", label: "Ödeme seçenekleri", type: "multiselect", options: ODEME_SECENEK },
      { key: "campaign", label: "Kampanyalar", type: "multiselect", options: PROJE_KAMPANYA },
      { key: "creditEligible", label: "Krediye uygun mu?", type: "bool" },
      { key: "iskanStatus", label: "İskan durumu", type: "select", options: ["İskan Alındı", "İskan Sürecinde", "Kat İrtifaklı"] },
      { key: "salesPhone", label: "Satış ofisi telefonu", type: "text" },
      { key: "website", label: "Web sitesi", type: "text" },
      ETIKET_FIELD,
      F.desc
    ]
  },
  turistik: {
    key: "turistik",
    title: "Turistik tesis bilgileri",
    fields: [
      F.title,
      { key: "listingType", label: "İlan tipi", type: "select", required: true, options: ["Satılık", "Kiralık", "Devren"] },
      F.price,
      { key: "facilityKind", label: "Tesis türü", type: "select", required: true, options: TURISTIK_TUR },
      { key: "roomCount", label: "Oda sayısı", type: "number" },
      { key: "bedCapacity", label: "Yatak kapasitesi", type: "number" },
      { key: "suiteCount", label: "Suit sayısı", type: "number" },
      { key: "starCount", label: "Yıldız sayısı", type: "select", options: ["1", "2", "3", "4", "5", "Butik", "Sertifikasız"] },
      { key: "roomTypes", label: "Oda tipleri", type: "multiselect", options: TURISTIK_ODA },
      { key: "facilityAreas", label: "Tesis alanları", type: "multiselect", options: TURISTIK_ALAN },
      { key: "tourismCert", label: "Turizm belgesi var mı?", type: "bool" },
      { key: "businessLicense", label: "İşletme ruhsatı var mı?", type: "bool" },
      { key: "alcoholLicense", label: "Alkollü ruhsat var mı?", type: "bool" },
      { key: "closedM2", label: "Kapalı alan", type: "number", suffix: "m²" },
      { key: "openM2", label: "Açık alan", type: "number", suffix: "m²" },
      { key: "seaDistance", label: "Denize mesafe", type: "text" },
      { key: "occupancyRate", label: "Doluluk oranı", type: "text", suffix: "%" },
      { key: "yearlyRevenue", label: "Yıllık ciro", type: "number", suffix: "₺" },
      { key: "staffLodging", label: "Personel lojmanı var mı?", type: "bool" },
      { key: "brandTransfer", label: "Marka / işletme devri var mı?", type: "bool" },
      { key: "equipmentIncluded", label: "Ekipman dahil mi?", type: "bool" },
      ETIKET_FIELD,
      F.desc
    ]
  },
  devremulk: {
    key: "devremulk",
    title: "Devre mülk bilgileri",
    fields: [
      F.title,
      { key: "listingType", label: "İlan tipi", type: "select", required: true, options: ["Satılık", "Kiralık", "Devren"] },
      F.price,
      { key: "facilityName", label: "Tesis adı", type: "text" },
      { key: "accommodation", label: "Konaklama türü", type: "select", options: DEVREMULK_KONAKLAMA },
      { key: "usageForm", label: "Kullanım şekli", type: "select", options: DEVREMULK_SEKIL },
      { key: "usagePeriod", label: "Kullanım dönemi", type: "select", options: ["Yaz", "Kış", "Bahar", "Sonbahar", "Yılbaşı", "Bayram", "Tüm Yıl"] },
      { key: "weekNo", label: "Hafta numarası", type: "text" },
      { key: "usageType", label: "Kullanım hakkı türü", type: "select", options: ["Tapulu", "Tapusuz (Sözleşmeli)", "Ömür Boyu", "Süreli", "Yıllık"] },
      { key: "capacity", label: "Kişi kapasitesi", type: "number" },
      { key: "rooms", label: "Oda sayısı", type: "text" },
      { key: "startDate", label: "Kullanım hakkı başlangıç", type: "text" },
      { key: "endDate", label: "Kullanım hakkı bitiş", type: "text" },
      { key: "dues", label: "Yıllık aidat", type: "number", suffix: "₺" },
      { key: "transferFee", label: "Devir ücreti / masrafı", type: "number", suffix: "₺" },
      { key: "amenities", label: "Tesis özellikleri", type: "multiselect", options: DEVREMULK_TESIS },
      { key: "rentable", label: "Kiraya verilebilir mi?", type: "bool" },
      { key: "swapRight", label: "Takas hakkı var mı?", type: "bool" },
      ETIKET_FIELD,
      F.desc
    ]
  },
  gunlukKiralik: {
    key: "gunlukKiralik",
    title: "Günlük / sezonluk kiralık bilgileri",
    fields: [
      F.title,
      { key: "nightlyPrice", label: "Gecelik fiyat", type: "number", required: true, suffix: "₺" },
      { key: "weeklyPrice", label: "Haftalık fiyat", type: "number", suffix: "₺" },
      { key: "monthlyPrice", label: "Aylık fiyat", type: "number", suffix: "₺" },
      { key: "minStay", label: "Min. konaklama (gece)", type: "number" },
      { key: "maxGuests", label: "Maksimum kişi sayısı", type: "number", required: true },
      { key: "rooms", label: "Oda sayısı", type: "text" },
      { key: "beds", label: "Yatak sayısı", type: "number" },
      { key: "furnished", label: "Eşyalı mı?", type: "bool" },
      { key: "amenities", label: "Olanaklar", type: "text", placeholder: "Wi-Fi, klima, havuz, otopark, mutfak…" },
      { key: "pets", label: "Evcil hayvan kabul", type: "bool" },
      { key: "checkin", label: "Giriş saati", type: "text" },
      { key: "checkout", label: "Çıkış saati", type: "text" },
      { key: "deposit", label: "Depozito", type: "number", suffix: "₺" },
      { key: "cancelPolicy", label: "İptal koşulu", type: "text" },
      F.desc
    ]
  },
  odaYurt: {
    key: "odaYurt",
    title: "Oda / yurt / pansiyon bilgileri",
    fields: [
      F.title,
      { key: "perPersonPrice", label: "Kişi başı fiyat", type: "number", required: true, suffix: "₺" },
      { key: "roomType", label: "Oda tipi", type: "select", options: ["Tek Kişilik", "Çift Kişilik", "Paylaşımlı", "Aile Yanı"] },
      { key: "capacity", label: "Kişi kapasitesi", type: "number" },
      { key: "furnished", label: "Eşyalı mı?", type: "bool" },
      { key: "sharedBath", label: "Banyo ortak mı?", type: "bool" },
      { key: "sharedKitchen", label: "Mutfak ortak mı?", type: "bool" },
      { key: "billsIncluded", label: "Faturalar dahil mi?", type: "bool" },
      { key: "internet", label: "İnternet dahil mi?", type: "bool" },
      { key: "gender", label: "Cinsiyet tercihi", type: "select", options: ["Kadın", "Erkek", "Karma", "Farketmez"] },
      { key: "deposit", label: "Depozito", type: "number", suffix: "₺" },
      { key: "meals", label: "Yemek / kahvaltı dahil mi?", type: "bool" },
      { key: "uniDistance", label: "Üniversiteye mesafe", type: "text" },
      F.desc
    ]
  },
  prefabrik: {
    key: "prefabrik",
    title: "Prefabrik / tiny house / konteyner bilgileri",
    fields: [
      F.title,
      { key: "structureType", label: "Yapı tipi", type: "select", required: true, options: ["Prefabrik Ev", "Tiny House", "Konteyner Ev", "Modüler Ev", "Çelik Ev", "Ahşap Ev", "Bungalov", "Yaşam Konteyneri", "Ofis Konteyneri"] },
      { key: "listingType", label: "Satılık / Kiralık", type: "select", required: true, options: ["Satılık", "Kiralık"] },
      F.price,
      { key: "m2", label: "m²", type: "number", suffix: "m²" },
      { key: "rooms", label: "Oda sayısı", type: "text" },
      { key: "material", label: "Malzeme tipi", type: "text" },
      { key: "installIncluded", label: "Kurulum dahil mi?", type: "bool" },
      { key: "transportIncluded", label: "Nakliye dahil mi?", type: "bool" },
      { key: "insulation", label: "Isı yalıtımı var mı?", type: "bool" },
      { key: "electricity", label: "Elektrik tesisatı var mı?", type: "bool" },
      { key: "water", label: "Su tesisatı var mı?", type: "bool" },
      { key: "warranty", label: "Garanti süresi", type: "text" },
      { key: "condition", label: "Durum", type: "select", options: ["Sıfır", "İkinci El", "Kurulu Halde"] },
      { key: "movable", label: "Taşınabilir mi?", type: "bool" },
      F.desc
    ]
  },
  emlakHizmet: {
    key: "emlakHizmet",
    title: "Emlak hizmeti bilgileri",
    fields: [
      F.title,
      { key: "serviceType", label: "Hizmet tipi", type: "text", required: true, placeholder: "ör. tadilat, değerleme, sanal tur" },
      { key: "serviceArea", label: "Hizmet verilen il / ilçe", type: "text" },
      { key: "startPrice", label: "Başlangıç fiyatı", type: "number", suffix: "₺" },
      { key: "pricing", label: "Fiyatlandırma", type: "select", options: ["Sabit Fiyat", "Teklif Usulü", "Görüşülür"] },
      { key: "providerType", label: "Firma / şahıs", type: "select", options: ["Firma", "Şahıs"] },
      { key: "experience", label: "Deneyim (yıl)", type: "number" },
      { key: "certificate", label: "Yetki belgesi var mı?", type: "bool" },
      { key: "portfolio", label: "Portföy / referans linki", type: "text" },
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
      { key: "traction", label: "Çekiş", type: "select", options: ["Önden Çekiş", "Arkadan İtiş", "4x4 / AWD"] },
      { key: "seats", label: "Koltuk sayısı", type: "select", options: ["2", "4", "5", "6", "7", "8", "8+"] },
      F.garanti,
      { key: "damage", label: "Ağır hasar kaydı", type: "select", options: ["Yok", "Var", "Ağır Hasar Kayıtlı"] },
      { key: "tramer", label: "Tramer tutarı", type: "text", suffix: "₺", placeholder: "ör. 0 / 15.000" },
      { key: "paint", label: "Boya / değişen özeti", type: "text", placeholder: "Örn. Tamamı orijinal / 2 parça boyalı" },
      { key: "plate", label: "Plaka / uyruk", type: "select", options: ["Türkiye Plakalı", "Yabancı Plakalı", "Mavi Plaka (Ticari)"] },
      { key: "safetyFeatures", label: "Güvenlik donanımı", type: "multiselect", options: ARAC_GUVENLIK },
      { key: "comfortFeatures", label: "İç donanım & konfor", type: "multiselect", options: ARAC_KONFOR },
      { key: "mediaFeatures", label: "Multimedya", type: "multiselect", options: ARAC_MULTIMEDYA },
      { key: "exteriorFeatures", label: "Dış donanım", type: "multiselect", options: ARAC_DIS },
      { key: "from", label: "Kimden", type: "select", options: ["Sahibinden", "Galeriden", "Yetkili Bayiden"] },
      F.price,
      F.takas,
      { key: "creditEligible", label: "Krediye uygun mu?", type: "bool" },
      VASITA_ETIKET_FIELD,
      F.desc
    ]
  },
  motosiklet: {
    key: "motosiklet",
    title: "Motosiklet bilgileri",
    fields: [
      F.title, { key: "brand", label: "Marka", type: "select", required: true, options: MOTO_BRANDS }, F.model,
      { key: "motoType", label: "Motosiklet tipi", type: "select", options: ["Naked", "Sport", "Touring", "Chopper", "Cruiser", "Enduro / Cross", "Scooter", "Cub", "ATV", "Elektrikli", "Trike"] },
      { key: "year", label: "Yıl", type: "number", required: true },
      { key: "km", label: "Kilometre", type: "number", required: true, suffix: "km" },
      { key: "engineCc", label: "Motor hacmi", type: "select", options: ["50 cc", "100 cc", "125 cc", "150 cc", "250 cc", "400 cc", "500 cc", "600 cc", "750 cc", "1000 cc", "1000 cc üzeri"] },
      { key: "gear", label: "Vites", type: "select", options: ["Manuel", "Otomatik", "Yarı Otomatik"] },
      { key: "cooling", label: "Soğutma", type: "select", options: ["Hava", "Sıvı", "Yağ"] },
      { key: "license", label: "Ehliyet sınıfı", type: "select", options: ["A1", "A2", "A", "B (ATV)"] },
      { key: "color", label: "Renk", type: "select", options: CAR_COLORS },
      { key: "damage", label: "Hasar durumu", type: "select", options: ["Orijinal / Hasarsız", "Değişen Var", "Hasar Kayıtlı"] },
      { key: "motoFeatures", label: "Donanım", type: "multiselect", options: ["ABS", "Rölanti Kontrol", "Dijital Gösterge", "LED Far", "USB Şarj", "Yol Bilgisayarı", "Kayışlı", "Zincirli", "Şaftlı", "Sele Isıtma", "Rüzgar Siperi", "Yan Çanta", "Top Case", "Alarm"] },
      { key: "from", label: "Kimden", type: "select", options: ["Sahibinden", "Galeriden", "Yetkili Bayiden"] },
      F.garanti, F.price, F.takas,
      { key: "creditEligible", label: "Krediye uygun mu?", type: "bool" },
      VASITA_ETIKET_FIELD, F.desc
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
      { key: "brand", label: "Marka", type: "select", required: true, options: PHONE_BRANDS },
      { key: "model", label: "Model", type: "text", required: true },
      { key: "storage", label: "Depolama", type: "select", required: true, options: ["16 GB", "32 GB", "64 GB", "128 GB", "256 GB", "512 GB", "1 TB"] },
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
    fields: [F.title, F.markaSerbest, F.model, F.durum, F.depolama, F.ram, F.renkSelect, F.garanti, F.fatura, F.kutu, URUN_OZELLIK_FIELD, F.stok, F.price, F.kargo, F.pazarlik, F.takas, GENEL_ETIKET_FIELD, F.desc]
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
    fields: [F.title, { key: "brand", label: "Marka", type: "select", options: WHITE_GOODS_BRANDS }, F.model, F.durum, F.enerji, F.kapasite, F.renkSelect, F.garanti, F.fatura, URUN_OZELLIK_FIELD, F.price, F.kargo, F.pazarlik, F.takas, GENEL_ETIKET_FIELD, F.desc]
  },
  moda: {
    key: "moda",
    title: "Giyim bilgileri",
    fields: [F.title, F.markaSerbest, F.durum, F.beden, F.renkSelect, F.cinsiyet, MODA_SEZON, MODA_DESEN, MODA_KESIM, F.materyal, F.stok, F.price, F.kargo, F.pazarlik, F.takas, GENEL_ETIKET_FIELD, F.desc]
  },
  ayakkabi: {
    key: "ayakkabi",
    title: "Ayakkabı & çanta bilgileri",
    fields: [F.title, F.markaSerbest, F.durum, F.numara, F.renkSelect, F.cinsiyet, F.materyal, F.stok, F.price, F.kargo, F.pazarlik, F.takas, F.desc]
  },
  mobilya: {
    key: "mobilya",
    title: "Mobilya & ev bilgileri",
    fields: [F.title, F.markaSerbest, F.durum, MOBILYA_STIL, F.materyal, F.renkSelect, F.boyut, F.price, F.kargo, F.pazarlik, F.takas, GENEL_ETIKET_FIELD, F.desc]
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
  kitap: {
    key: "kitap",
    title: "Kitap & yayın bilgileri",
    fields: [F.title, { key: "author", label: "Yazar", type: "text" }, { key: "publisher", label: "Yayınevi", type: "text" }, { key: "genre", label: "Tür", type: "text", placeholder: "ör. roman, tarih, ders kitabı" }, { key: "language", label: "Dil", type: "select", options: ["Türkçe", "İngilizce", "Almanca", "Arapça", "Diğer"] }, { key: "condition", label: "Durum", type: "select", required: true, options: ["Sıfır", "Az kullanılmış", "İkinci el", "Sahaf / eski baskı"] }, F.stok, F.price, F.kargo, F.pazarlik, F.desc]
  },
  koleksiyon: {
    key: "koleksiyon",
    title: "Koleksiyon & antika bilgileri",
    fields: [F.title, { key: "collectType", label: "Koleksiyon türü", type: "text", placeholder: "ör. para, pul, antika saat" }, { key: "year", label: "Yıl / dönem", type: "text" }, { key: "origin", label: "Menşei / ülke", type: "text" }, { key: "condition", label: "Durum", type: "select", required: true, options: ["Kusursuz", "Çok iyi", "İyi", "Orta", "Restore edilmiş"] }, { key: "authenticity", label: "Orijinallik", type: "select", options: ["Orijinal", "Replika", "Belgeli", "Bilinmiyor"] }, F.price, F.kargo, F.pazarlik, F.takas, F.desc]
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

// ---- emlak alt-tip listeleri ---------------------------------------------
const DAIRE_TYPES = ["1+0 (Stüdyo)", "1+1", "1.5+1", "2+1", "2.5+1", "3+1", "3.5+1", "4+1", "4.5+1", "5+1 ve üzeri", "Bahçe Katı", "Çatı Katı (Teras)", "Çatı Dubleksi", "Dubleks", "Ters Dubleks", "Tripleks", "Loft Daire", "Ara Kat", "Giriş Kat", "Yüksek Giriş", "Sıfır (Yeni)", "İkinci El", "Eşyalı", "Site İçinde", "Güvenlikli Site", "Havuzlu Site", "Lüks Daire", "Deniz Manzaralı", "Doğa Manzaralı", "Merkezi Konumda", "Yatırımlık", "Kiracılı", "Krediye Uygun"];
const REZIDANS_TYPES = ["1+1 Rezidans", "2+1 Rezidans", "3+1 Rezidans", "Stüdyo Rezidans", "Lüks Rezidans", "Otel Konseptli", "Eşyalı Rezidans", "Güvenlikli Rezidans", "Sosyal Tesisli", "Akıllı Ev Sistemli", "Manzaralı Rezidans"];
const MUSTAKIL_TYPES = ["Bahçeli Ev", "Tek Katlı", "İki Katlı", "Üç Katlı", "Köy Evi", "Taş Ev", "Ahşap Ev", "Kerpiç Ev", "Betonarme Ev", "Dağ Evi", "Göl Evi", "Deniz Kenarı Ev", "Doğa İçinde Ev", "Çiftlik Evi", "Hobi Bahçeli Ev", "Bağ Evi", "Yayla Evi", "Tarihi Ev", "Restorasyonluk Ev"];
const VILLA_TYPES = ["Müstakil Villa", "İkiz Villa", "Sıra Villa", "Tripleks Villa", "Dubleks Villa", "Lüks Villa", "Havuzlu Villa", "Bahçeli Villa", "Site İçinde Villa", "Güvenlikli Villa", "Deniz Manzaralı Villa", "Doğa Manzaralı Villa", "Akıllı Villa", "Ultra Lüks Villa", "Yazlık Villa", "Kışlık Villa"];
const YAZLIK_TYPES = ["Denize Sıfır", "Denize Yakın", "Site İçinde", "Havuzlu", "Bahçeli", "Dubleks", "Müstakil", "Ege Bölgesi", "Akdeniz Bölgesi"];
const KONUT_OZEL = ["Kooperatif Dairesi", "Kooperatif Hissesi", "Loft Konut", "Teraslı Konut", "Akıllı Ev", "Ekolojik Ev", "Bungalov Ev", "Tiny House", "Prefabrik Ev", "Konteyner Ev", "Modüler Ev", "Çelik Ev", "Devremülk", "Hisseli Konut", "Karşılıklı Kat", "Kat İrtifaklı", "Kat Mülkiyetli"];
const YALI_TYPES = ["Boğaz Yalısı", "Müstakil Yalı", "Yalı Dairesi", "Yalı Katı", "Yalı Bahçe Katı", "Tarihi Yalı", "Restorasyonluk Yalı", "Deniz Kenarı Yalı", "Korunması Gerekli Yalı"];
const KOSK_KONAK_TYPES = ["Tarihi Köşk", "Ahşap Köşk", "Bahçeli Köşk", "Müstakil Konak", "Tarihi Konak", "Kagir Konak", "Restorasyonluk Konak", "Butik Otel/Konak Uygun"];
const CIFTLIK_EV_TYPES = ["Çiftlik Evi", "Bağ Evi", "Hobi Bahçeli Ev", "Yayla Evi", "Dağ Evi", "Göl Evi", "Orman İçi Ev", "Zeytinlik Evi", "Tarla İçinde Ev", "Doğa İçinde Ev"];
const konutBranch = (fk: string): CategoryNode[] => [
  node("Daire", leaves(DAIRE_TYPES, fk), fk),
  node("Rezidans", leaves(REZIDANS_TYPES, fk), fk),
  node("Müstakil Ev", leaves(MUSTAKIL_TYPES, fk), fk),
  node("Villa", leaves(VILLA_TYPES, fk), fk),
  node("Yalı", leaves(YALI_TYPES, fk), fk),
  node("Köşk & Konak", leaves(KOSK_KONAK_TYPES, fk), fk),
  node("Çiftlik & Bağ Evi", leaves(CIFTLIK_EV_TYPES, fk), fk),
  node("Yazlık", leaves(YAZLIK_TYPES, fk), fk),
  node("Özel Konut Tipleri", leaves(KONUT_OZEL, fk), fk)
];
const isyeriBranch = (fk: string): CategoryNode[] => [
  node("Dükkan & Mağaza", leaves(["Cadde Üzeri Dükkan", "Ana Cadde Dükkanı", "Köşe Dükkan", "Pasaj İçi Dükkan", "AVM Mağazası", "Site Altı Dükkan", "Depolu Dükkan", "Vitrinli Dükkan", "Market", "Ruhsatlı Dükkan"], fk), fk),
  node("Ofis & Büro", leaves(["Plaza Ofisi", "Kat Ofisi", "Home Office", "Hazır Ofis", "Paylaşımlı Ofis", "Klinik Ofis", "Avukatlık Bürosu", "Muhasebe Bürosu", "Yönetim Ofisi"], "isyeriOfis"), "isyeriOfis"),
  node("Depo & Antrepo", leaves(["Lojistik Depo", "Soğuk Hava Deposu", "Antrepo", "Raf Sistemli Depo", "Tır Girişli Depo", "Sanayi Deposu", "E-Ticaret Deposu", "Gıda Deposu", "Kapalı Depo", "Açık Depo Alanı"], fk), fk),
  node("Fabrika & Üretim", leaves(["Fabrika", "Üretim Tesisi", "OSB Fabrikası", "Depolu Fabrika", "Gıda Üretim Tesisi", "Tekstil Fabrikası", "Metal İşleme", "Plastik Üretim", "Mobilya Fabrikası", "Kimya Tesisi", "Paketleme Tesisi"], "isyeriFabrika"), "isyeriFabrika"),
  node("Atölye & İmalathane", leaves(["Sanayi Atölyesi", "Küçük Sanayi Dükkanı", "Marangoz Atölyesi", "Tekstil Atölyesi", "Oto Tamir Atölyesi", "Kaynak Atölyesi", "Mobilya Atölyesi"], "isyeriFabrika"), "isyeriFabrika"),
  node("Restoran & Cafe & Eğlence", leaves(["Restoran", "Cafe", "Lokanta", "Pastane", "Fırın", "Fast Food", "Bar", "Pub", "Gece Kulübü", "Nargile Cafe", "Kahvaltı Salonu", "Yemekhane", "Alkollü Ruhsatlı İşletme"], "isyeriRestoran"), "isyeriRestoran"),
  node("Sağlık & Güzellik", leaves(["Klinik", "Muayenehane", "Diş Kliniği", "Güzellik Merkezi", "Kuaför Salonu", "Berber", "Masaj Salonu", "SPA Merkezi", "Fizik Tedavi", "Veteriner Kliniği", "Eczane Yeri"], fk), fk),
  node("Eğitim & Kurs", leaves(["Kreş", "Anaokulu", "Kurs Merkezi", "Dershane", "Etüt Merkezi", "Dil Kursu", "Sürücü Kursu", "Spor Kursu", "Okul Binası"], fk), fk),
  node("Spor & Sosyal Tesis", leaves(["Spor Salonu", "Fitness Salonu", "Pilates Salonu", "Yoga Salonu", "Halı Saha", "Yüzme Havuzu Tesisi", "Düğün Salonu", "Organizasyon Salonu", "Oyun Salonu", "Çocuk Oyun Merkezi"], fk), fk),
  node("Oto & Akaryakıt", leaves(["Oto Galeri", "Oto Yıkama", "Oto Servis", "Oto Ekspertiz", "Lastikçi", "Benzin İstasyonu", "LPG İstasyonu", "Elektrikli Şarj İstasyonu", "Otopark", "Kapalı Otopark"], fk), fk),
  node("Tarım & Hayvancılık İşletmesi", leaves(["Çiftlik", "Tavuk Çiftliği", "Büyükbaş Çiftliği", "Küçükbaş Çiftliği", "Süt Üretim Tesisi", "Sera", "Mantar Üretim", "Balık Çiftliği", "Arıcılık Tesisi"], fk), fk)
];

// ---- the tree ------------------------------------------------------------
export const categoryTree: CategoryNode[] = [
  node("Emlak", [
    node("Konut", [
      node("Satılık", konutBranch("konut"), "konut"),
      node("Kiralık", konutBranch("konut"), "konut")
    ], "konut"),
    node("İş Yeri", [
      node("Satılık", isyeriBranch("isyeri"), "isyeri"),
      node("Kiralık", isyeriBranch("isyeri"), "isyeri"),
      leaf("Devren İş Yeri", "isyeri")
    ], "isyeri"),
    node("Arsa / Arazi", [
      node("Satılık", [
        node("İmarlı Arsa", leaves(["Konut İmarlı", "Villa İmarlı", "Apartman İmarlı", "Toplu Konut İmarlı", "Ticari İmarlı", "Dükkan İmarlı", "AVM İmarlı", "Akaryakıt İmarlı", "Turizm İmarlı", "Sanayi İmarlı", "Depolama İmarlı", "Sağlık Alanı İmarlı", "Eğitim Alanı İmarlı"], "arsa"), "arsa"),
        node("Tarla", leaves(["Ekilebilir Tarla", "Sulak Tarla", "Kuru Tarla", "Yola Cepheli Tarla", "Elektriği Olan Tarla", "Suyu Olan Tarla", "GES'e Uygun Tarla", "Hobi Bahçesine Uygun"], "arsa"), "arsa"),
        node("Bahçe & Bağ & Zeytinlik", leaves(["Hobi Bahçesi", "Meyve Bahçesi", "Zeytinlik", "Fındıklık", "Ceviz Bahçesi", "Narenciye Bahçesi", "Üzüm Bağı", "Organik Tarım Alanı"], "arsa"), "arsa"),
        node("Çiftlik & Doğa Arazisi", leaves(["Çiftlik Arazisi", "Hayvancılık Arazisi", "Sera Arazisi", "Yayla Arazisi", "Orman Kenarı", "Dere Kenarı", "Göl Kenarı", "Deniz Manzaralı", "Kamp/Bungalov Alanına Uygun"], "arsa"), "arsa"),
        node("Hisseli & Özel Durumlu", leaves(["Hisseli Arsa", "Hisseli Tarla", "Müstakil Parsel", "İfrazlı Arsa", "Şuyulu Arsa", "Tapu Tahsisli", "Zilliyet Arazi", "Köy Yerleşik Alanı", "Sit Alanında Arazi"], "arsa"), "arsa"),
        node("Kat Karşılığı & Yatırım", leaves(["Kat Karşılığı Arsa", "Hasılat Paylaşımlı", "Müteahhide Uygun", "Kentsel Dönüşüme Uygun", "Yatırımlık Arsa", "Prim Potansiyelli"], "arsa"), "arsa")
      ], "arsa"),
      node("Kiralık", leaves(["Kiralık Arsa", "Kiralık Tarla", "Kiralık Bahçe", "Depolama Alanı", "Açık Otopark Alanı", "Şantiye Alanı", "Tarım Arazisi", "Sera Alanı", "Reklam Panosu Alanı", "Konteyner Alanı", "Kamp Alanı", "Etkinlik Alanı"], "arsa"), "arsa")
    ], "arsa"),
    node("Bina", [
      node("Satılık", leaves(["Komple Bina", "Apartman", "Müstakil Bina", "İş Hanı", "Plaza", "Rezidans Binası", "Otel Binası", "Yurt Binası", "Okul Binası", "Hastane Binası", "Klinik Binası", "Fabrika Binası", "Depo Binası", "Tarihi Bina", "Restorasyonluk Bina", "Kentsel Dönüşüme Uygun", "Kiracılı Bina", "Karma Kullanımlı Bina"], "bina"), "bina"),
      node("Kiralık", leaves(["Komple Bina", "Apartman", "İş Hanı", "Plaza", "Okul Binası", "Yurt Binası", "Hastane / Klinik Binası", "Depo Binası", "Fabrika Binası", "Otel Binası", "Kurumsal Kullanıma Uygun"], "bina"), "bina")
    ], "bina"),
    node("Projeler", leaves(["Yeni Konut Projesi", "Daire Projesi", "Villa Projesi", "Rezidans Projesi", "Karma Proje", "Ofis Projesi", "Ticari Alan Projesi", "AVM Projesi", "Arsa Projesi", "Kentsel Dönüşüm Projesi", "Kooperatif Projesi", "Tatil Projesi", "Tiny House Projesi", "Bungalov Projesi", "Devremülk Projesi"], "proje"), "proje"),
    node("Turistik Tesis", [
      node("Satılık", leaves(["Otel", "Butik Otel", "Apart Otel", "Pansiyon", "Motel", "Hostel", "Tatil Köyü", "Kamp Alanı", "Bungalov Tesisi", "Glamping Tesisi", "Termal Otel", "Dağ Oteli", "Sahil Oteli", "Plaj Tesisi", "Aquapark", "Karavan Parkı"], "turistik"), "turistik"),
      node("Kiralık", leaves(["Otel", "Butik Otel", "Apart Otel", "Pansiyon", "Kamp Alanı", "Bungalov Tesisi", "Tatil Köyü", "Sezonluk Otel", "Plaj Tesisi", "Restoranlı Tesis"], "turistik"), "turistik")
    ], "turistik"),
    node("Devre Mülk", leaves(["Satılık Devre Mülk", "Kiralık Devre Mülk", "Termal Devre Mülk", "Otel Devre Mülk", "Tatil Köyü Devre Mülk", "Yazlık Devre Mülk", "Kışlık Devre Mülk", "Haftalık", "Sezonluk", "Ömür Boyu Kullanımlı", "Süreli Kullanımlı"], "devremulk"), "devremulk"),
    node("Günlük / Sezonluk Kiralık", [
      node("Günlük", leaves(["Günlük Daire", "Günlük Rezidans", "Günlük Villa", "Günlük Yazlık", "Günlük Bungalov", "Günlük Tiny House", "Günlük Dağ Evi", "Günlük Göl Evi", "Havuzlu Villa", "Suit", "Oda", "Apart", "Pansiyon Odası"], "gunlukKiralik"), "gunlukKiralik"),
      node("Sezonluk", leaves(["Sezonluk Yazlık", "Sezonluk Villa", "Sezonluk Daire", "Sezonluk Bungalov", "Aylık Yazlık", "Haftalık Yazlık", "Yaz Sezonu", "Kış Sezonu"], "gunlukKiralik"), "gunlukKiralik")
    ], "gunlukKiralik"),
    node("Oda / Yurt / Pansiyon", [
      node("Kiralık Oda", leaves(["Paylaşımlı Oda", "Tek Kişilik Oda", "Çift Kişilik Oda", "Öğrenciye Oda", "Çalışana Oda", "Kadına Oda", "Erkeğe Oda", "Aile Yanı Oda", "Eşyalı Oda", "Faturalar Dahil"], "odaYurt"), "odaYurt"),
      node("Yurt", leaves(["Kız Öğrenci Yurdu", "Erkek Öğrenci Yurdu", "Karma Yurt", "Özel Yurt", "Apart Yurt", "İşçi Yurdu", "Personel Yurdu"], "odaYurt"), "odaYurt"),
      node("Pansiyon", leaves(["Aylık Pansiyon", "Günlük Pansiyon", "Öğrenci Pansiyonu", "İşçi Pansiyonu", "Aile Pansiyonu", "Turistik Pansiyon"], "odaYurt"), "odaYurt")
    ], "odaYurt"),
    node("Prefabrik / Tiny House / Konteyner", [
      node("Satılık", leaves(["Prefabrik Ev", "Tiny House", "Konteyner Ev", "Modüler Ev", "Çelik Ev", "Ahşap Ev", "Bungalov", "Mobil Ev", "Karavan Ev", "Şantiye Konteyneri", "Ofis Konteyneri", "WC / Duş Konteyneri", "Yaşam Konteyneri"], "prefabrik"), "prefabrik"),
      node("Kiralık", leaves(["Konteyner", "Tiny House", "Prefabrik Ev", "Şantiye Konteyneri", "Ofis Konteyneri", "Yaşam Konteyneri", "Bungalov"], "prefabrik"), "prefabrik")
    ], "prefabrik"),
    node("Emlak Hizmetleri", leaves(["Emlak Danışmanı", "Gayrimenkul Değerleme", "Ekspertiz Hizmeti", "Tapu Takip", "Kentsel Dönüşüm Danışmanlığı", "Mimari Proje", "İç Mimarlık", "Tadilat Hizmeti", "Boya Badana", "Nakliye / Evden Eve", "Temizlik Hizmeti", "Fotoğraf / Video Çekimi", "Drone Çekimi", "3D Sanal Tur", "Kiracı Bulma", "Mülk Yönetimi", "Site Yönetimi"], "emlakHizmet"), "emlakHizmet"),
    node("Ortak Satışa Açık Emlak", leaves(["Ortak Satışa Açık Daire", "Ortak Satışa Açık Villa", "Ortak Satışa Açık Müstakil Ev", "Ortak Satışa Açık Yazlık", "Ortak Satışa Açık Arsa", "Ortak Satışa Açık Tarla", "Ortak Satışa Açık İş Yeri", "Ortak Satışa Açık Dükkan", "Ortak Satışa Açık Ofis", "Ortak Satışa Açık Bina", "Ortak Satışa Açık Turistik Tesis", "Ortak Satışa Açık Proje", "Komisyonlu Emlak İlanı", "Emlakçı İş Birliği"], "konut"), "konut")
  ], "konut", IMG("1560518883-ce09059eeffa")),

  node("Vasıta", [
    node("Otomobil (Markaya Göre)", brandModelNodes(CAR_BRANDS, MODELS_BY_BRAND, "otomobil"), "otomobil"),
    node("Otomobil (Kasa Tipine Göre)", leaves(CAR_BODY_TYPES, "otomobil"), "otomobil"),
    node("Arazi, SUV & Pickup", leaves(["Toyota", "Nissan", "Ford", "Hyundai", "Kia", "Volkswagen", "Dacia", "Suzuki", "Jeep", "Land Rover", "Mitsubishi", "Chery", "MG", "BMW", "Mercedes-Benz", "Audi", "Volvo", "Porsche", "Range Rover", "Diğer"], "otomobil"), "otomobil"),
    node("Elektrikli & Hibrit Araçlar", leaves(["Elektrikli Otomobil", "Hibrit (HEV)", "Plug-in Hibrit (PHEV)", "Menzil Artırıcılı (EREV)", "Elektrikli SUV", "Elektrikli Ticari", "Şarj Ekipmanı"], "otomobil"), "otomobil"),
    node("Motosiklet (Markaya Göre)", brandModelNodes(MOTO_BRANDS, MOTO_MODELS, "motosiklet"), "motosiklet"),
    node("Motosiklet (Türe Göre)", leaves(MOTO_TYPES, "motosiklet"), "motosiklet"),
    node("Ticari Araçlar", brandModelNodes(COMMERCIAL_BRANDS, COMMERCIAL_MODELS, "vasitaGenel"), "vasitaGenel"),
    node("Minivan & Panelvan", leaves(["Panelvan", "Minivan", "Kombi Van", "Camlı Van", "Yük Vanı", "Yolcu Vanı"], "vasitaGenel"), "vasitaGenel"),
    node("Ağır Vasıta", leaves(["Kamyon", "Kamyonet", "Çekici (TIR)", "Otobüs", "Midibüs", "Minibüs", "Dorse", "Römork (Ticari)", "Tanker", "Frigorifik", "Damperli Kamyon", "Beton Mikseri", "Vinçli Kamyon"], "vasitaGenel"), "vasitaGenel"),
    node("Deniz Araçları", [
      node("Yat", leaves(["Motoryat", "Yelkenli Yat", "Katamaran", "Trawler", "Mega Yat", "Gulet", "Klasik Yat", "Ahşap Yat", "Süper Yat"], "vasitaGenel"), "vasitaGenel"),
      ...leaves(["Sürat Teknesi", "Yelkenli", "Şişme Bot & Zodyak", "Jet Ski", "Balıkçı Teknesi", "Fiber Tekne", "Ahşap Tekne", "Kano & Kayak", "SUP & Sörf", "Römork (Deniz)"], "vasitaGenel"),
      node("Tekne Motoru", brandModelNodes(MARINE_ENGINE_BRANDS, {}, "vasitaGenel"), "vasitaGenel")
    ], "vasitaGenel"),
    node("Karavan", leaves(["Motokaravan", "Çekme Karavan", "Van Karavan", "Off-road Karavan", "Kamp Römorku", "Karavan Aksesuarı"], "vasitaGenel"), "vasitaGenel"),
    node("ATV & UTV", leaves(["ATV", "UTV", "Buggy", "Elektrikli ATV", "Çocuk ATV"], "vasitaGenel"), "vasitaGenel"),
    node("Elektrikli Ulaşım", leaves(["Elektrikli Scooter", "Elektrikli Bisiklet", "Elektrikli Motosiklet", "Hoverboard", "Segway", "Elektrikli Golf Aracı"], "vasitaGenel"), "vasitaGenel"),
    node("Klasik & Koleksiyon Araçlar", leaves(["Klasik Otomobil", "Klasik Motosiklet", "Antika Araç", "Restorasyonluk Araç", "Amerikan Klasik", "Anadol / Murat / Şahin", "Jeep & Willys"], "otomobil"), "otomobil"),
    node("Engelli Araçları", leaves(["Engelli Otomobil (ÖTV'siz)", "Adaptasyonlu Araç", "Engelli Scooter", "Akülü Sandalye"], "vasitaGenel"), "vasitaGenel"),
    leaf("Hasarlı & Pert Araçlar", "otomobil"),
    leaf("Kiralık Araçlar", "vasitaGenel")
  ], "vasitaGenel", IMG("1503376780353-7e6692767b70")),

  node("Yedek Parça, Aksesuar & Tuning", [
    node("Otomobil Yedek Parça (Markaya Göre)", brandGroupNodes(CAR_BRANDS, CAR_PART_GROUPS, "yedekParca"), "yedekParca"),
    node("Parça Grubuna Göre", leaves(CAR_PART_GROUPS, "yedekParca"), "yedekParca"),
    node("Motosiklet Yedek Parça", leaves(["Motor", "Zincir & Dişli", "Fren", "Lastik & Jant", "Far & Sinyal", "Ayna", "Egzoz", "Gidon & Kumanda", "Şanzıman", "Elektrik"], "yedekParca"), "yedekParca"),
    node("Ağır Vasıta & Ticari Parça", leaves(["Kamyon Parçası", "Otobüs Parçası", "Traktör Parçası", "İş Makinesi Parçası", "Römork Parçası"], "yedekParca"), "yedekParca"),
    node("Jant & Lastik", leaves(["Yaz Lastiği", "Kış Lastiği", "4 Mevsim Lastik", "Çelik Jant", "Alaşım (Alüminyum) Jant", "Bijon & Somun", "Lastik Zinciri", "İç Lastik"], "yedekParca"), "yedekParca"),
    node("Araç Aksesuarları", leaves(["İç Aksesuar", "Dış Aksesuar", "Kılıf & Paspas", "Telefon Tutucu", "Araç İçi Organizer", "Bagaj & Portbagaj", "Çeki Demiri", "Branda"], "yedekParca"), "yedekParca"),
    node("Ses & Görüntü Sistemleri", leaves(["Oto Teyp", "Hoparlör", "Amfi", "Subwoofer", "Multimedya Ekran", "Anten", "Kablo & Aksesuar"], "yedekParca"), "yedekParca"),
    node("Oto Elektronik", leaves(["Akü", "Sensör", "Araç Kamerası", "Park Sensörü", "Navigasyon", "Alarm & İmmobilizer", "Xenon & LED", "Beyin (ECU)"], "yedekParca"), "yedekParca"),
    node("Tuning & Performans", leaves(["Body Kit", "Spoiler", "Performans Filtre", "Spor Egzoz", "Coilover / Süspansiyon", "Chip Tuning / Yazılım", "Direksiyon & Vites"], "yedekParca"), "yedekParca"),
    node("Bakım & Sarf", leaves(["Motor Yağı", "Antifriz", "Silecek", "Fren Balatası", "Filtre Seti", "Buji", "Cam Suyu & Katkı", "Temizlik & Bakım"], "yedekParca"), "yedekParca")
  ], "yedekParca", IMG("1486262715619-67b85e0b08d3")),

  node("İkinci El & Sıfır Alışveriş", [
    node("Elektronik", [
      node("Cep Telefonu", brandModelNodes(["iPhone", "Samsung", "Xiaomi", "Huawei", "Oppo", "Realme", "Vivo", "Tecno", "General Mobile", "OnePlus", "Nothing", "Reeder", "Diğer Marka"], MODELS_BY_BRAND, "telefon"), "telefon"),
      node("Televizyon", brandModelNodes(TV_BRANDS, TV_MODELS, "televizyon"), "televizyon"),
      node("Tablet", leaves(["iPad", "Samsung Galaxy Tab", "Xiaomi Pad", "Huawei MatePad", "Lenovo Tab", "Reeder Tablet", "Diğer Tablet"], "elektronik"), "elektronik"),
      node("Ses & Kulaklık", leaves(["Kablosuz Kulaklık", "Kulak İçi Kulaklık", "Kulak Üstü Kulaklık", "Bluetooth Hoparlör", "Soundbar", "Ev Sinema Sistemi", "Mikrofon"], "elektronik"), "elektronik"),
      node("Foto & Kamera", leaves(["DSLR Fotoğraf Makinesi", "Aynasız Fotoğraf Makinesi", "Kompakt Kamera", "Aksiyon Kamera", "Objektif", "Tripod", "Drone", "Güvenlik Kamerası"], "elektronik"), "elektronik"),
      node("Giyilebilir Teknoloji", leaves(["Akıllı Saat", "Akıllı Bileklik", "VR Gözlük", "Akıllı Yüzük", "Akıllı Gözlük"], "elektronik"), "elektronik"),
      node("Akıllı Ev", leaves(["Akıllı Ampul & Priz", "Güvenlik Kamerası", "Akıllı Kilit", "Sesli Asistan", "Akıllı Termostat", "Robot Süpürge"], "elektronik"), "elektronik"),
      node("Elektrikli Ulaşım", leaves(["Elektrikli Scooter", "Hoverboard", "Elektrikli Kaykay", "Segway", "Scooter Yedek Parça"], "elektronik"), "elektronik"),
      ...leaves(["Projeksiyon", "Yazıcı & Tarayıcı", "Network & Modem", "Elektronik Aksesuar"], "elektronik")
    ], "alisverisGenel"),
    node("Telefon & Aksesuar", [
      node("Cep Telefonu", brandModelNodes(PHONE_BRANDS, MODELS_BY_BRAND, "telefon"), "telefon"),
      leaf("Tuşlu Telefon", "telefon"),
      leaf("Akıllı Saat & Bileklik", "elektronik"),
      ...leaves(["Kılıf & Kapak", "Ekran Koruyucu", "Şarj Aleti & Kablo", "Powerbank", "Kulaklık", "Telefon Tutucu & Stand", "Hafıza Kartı", "Telefon Yedek Parça"], "alisverisGenel")
    ], "telefon"),
    node("Bilgisayar & Oyun", [
      node("Dizüstü Bilgisayar", brandModelNodes(COMPUTER_BRANDS, COMPUTER_MODELS, "bilgisayar"), "bilgisayar"),
      node("Masaüstü Bilgisayar", leaves(["Hazır Sistem", "Toplama Sistem", "All-in-One", "Mini PC", "İş İstasyonu"], "bilgisayar"), "bilgisayar"),
      node("Bilgisayar Bileşenleri", leaves(["Ekran Kartı", "İşlemci", "Anakart", "RAM", "SSD & HDD", "Güç Kaynağı", "Kasa", "CPU Soğutucu", "Ekran Kartı Yükseltici"], "elektronik"), "elektronik"),
      node("Çevre Birimleri", leaves(["Monitör", "Klavye", "Mouse", "Kulaklık", "Webcam", "Mikrofon", "Yazıcı & Tarayıcı", "Modem & Network", "Harici Disk", "USB Bellek"], "elektronik"), "elektronik"),
      node("Oyun & Konsol", leaves(["PlayStation 5", "PlayStation 4", "Xbox Series X/S", "Xbox One", "Nintendo Switch", "Konsol Oyunları", "Oyun Kolu", "VR Gözlük", "Oyuncu Koltuğu"], "elektronik"), "elektronik"),
      leaf("Yazılım & Lisans", "dijitalHizmet")
    ], "alisverisGenel"),
    node("Ev & Yaşam", [
      node("Mobilya", leaves(["Koltuk Takımı", "Köşe Koltuk", "Kanepe", "Berjer", "Masa", "Sandalye", "Yatak", "Baza", "Gardırop", "Kitaplık", "TV Ünitesi", "Çalışma Masası", "Bebek Mobilyası"], "mobilya"), "mobilya"),
      ...leaves(["Dekorasyon", "Aydınlatma", "Ev Tekstili", "Banyo", "Bahçe & Balkon", "Temizlik Ürünleri", "Düzenleyiciler", "Ev Gereçleri"], "alisverisGenel")
    ], "alisverisGenel"),
    node("Beyaz Eşya", [
      node("Buzdolabı", leaves(WHITE_GOODS_BRANDS, "beyazEsya"), "beyazEsya"),
      node("Çamaşır Makinesi", leaves(WHITE_GOODS_BRANDS, "beyazEsya"), "beyazEsya"),
      node("Kurutma Makinesi", leaves(WHITE_GOODS_BRANDS, "beyazEsya"), "beyazEsya"),
      node("Bulaşık Makinesi", leaves(WHITE_GOODS_BRANDS, "beyazEsya"), "beyazEsya"),
      node("Fırın & Ankastre", leaves(["Ankastre Fırın", "Set Üstü Fırın", "Mikrodalga", "Ankastre Ocak", "Ankastre Set", "Davlumbaz"], "beyazEsya"), "beyazEsya"),
      node("Ocak & Set Üstü", leaves(["Gazlı Ocak", "Elektrikli Ocak", "İndüksiyon Ocak", "Vitroseramik", "Set Üstü Fırın"], "beyazEsya"), "beyazEsya"),
      node("Klima", leaves(AC_BRANDS, "beyazEsya"), "beyazEsya"),
      node("Kombi & Isıtma", leaves(HEATING_BRANDS, "beyazEsya"), "beyazEsya"),
      node("Süpürge", leaves(["Robot Süpürge", "Dikey Süpürge", "Toz Torbalı", "Toz Torbasız", "Islak-Kuru", "Halı Yıkama"], "beyazEsya"), "beyazEsya"),
      ...leaves(["Derin Dondurucu", "Su Sebili", "Şofben & Termosifon", "Bulaşık Kurutma"], "beyazEsya")
    ], "beyazEsya"),
    node("Mutfak", leaves(["Tencere & Tava", "Düdüklü Tencere", "Çaydanlık & Cezve", "Bıçak & Kesim Aletleri", "Sofra Takımı", "Bardak & Kupa", "Saklama Kabı", "Pişirme Kabı", "Fırın & Pasta Malzemesi", "Kahve & Çay Ekipmanı", "Mutfak Gereçleri", "Mutfak Düzenleme"], "alisverisGenel"), "alisverisGenel"),
    node("Küçük Ev Aletleri", leaves(["Elektrikli Süpürge", "Robot Süpürge", "Dikey Süpürge", "Ütü & Ütü Sistemi", "Blender & Rondo", "El Blenderi", "Su Isıtıcı (Kettle)", "Airfryer & Fritöz", "Kahve Makinesi", "Çay Makinesi", "Tost & Izgara Makinesi", "Mikser & Çırpıcı", "Meyve/Sebze Sıkacağı", "Doğrayıcı", "Ekmek & Yoğurt Makinesi", "Semaver", "Nem Alma & Hava Temizleyici", "Saç Kurutma & Şekillendirme"], "beyazEsya"), "beyazEsya"),
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
    node("Kitap & Hobi", [
      node("Kitap", leaves(["Roman", "Öykü & Şiir", "Edebiyat & Klasikler", "Kişisel Gelişim", "Bilim & Felsefe", "Tarih & Politika", "Din & Maneviyat", "Çocuk & Gençlik", "Ders & Sınav Kitabı", "Akademik & Referans", "Sanat & Tasarım", "Çizgi Roman & Manga", "Yabancı Dil", "Sözlük & Ansiklopedi", "Sağlık & Yaşam", "Yemek & Mutfak", "Sahaf / Eski Baskı"], "kitap"), "kitap"),
      node("Dergi & Gazete", leaves(["Dergi", "Gazete", "Koleksiyon Dergi", "Fasikül"], "kitap"), "kitap"),
      node("Müzik & Film", leaves(["Plak (LP)", "CD", "Kaset", "DVD & Blu-ray", "Dijital Müzik"], "alisverisGenel"), "alisverisGenel"),
      node("Hobi & El Sanatları", leaves(["Model & Maket", "Puzzle & Yapboz", "Örgü & Dikiş", "Resim & Boyama", "Takı Tasarım", "Ahşap Boyama", "Seramik & Kil", "Astronomi & Teleskop", "RC / Drone Hobi", "Kokulu Taş & Mum"], "alisverisGenel"), "alisverisGenel"),
      node("Kırtasiye & Ofis", leaves(["Defter & Bloknot", "Kalem", "Dosya & Klasör", "Sanat Malzemesi", "Okul Malzemesi"], "alisverisGenel"), "alisverisGenel")
    ], "kitap"),
    node("Koleksiyon & Antika", [
      node("Nümizmatik (Para)", leaves(["Osmanlı Parası", "Cumhuriyet Parası", "Madeni Para", "Kağıt Para (Banknot)", "Yabancı Para", "Hatıra Para", "Altın Sikke"], "koleksiyon"), "koleksiyon"),
      node("Filateli (Pul)", leaves(["Osmanlı Pulu", "Cumhuriyet Pulu", "Yabancı Pul", "İlk Gün Zarfı", "Blok Pul"], "koleksiyon"), "koleksiyon"),
      node("Antika", leaves(["Antika Mobilya", "Antika Saat", "Gramofon & Radyo", "Porselen & Seramik", "Bakır & Pirinç", "Antika Aydınlatma", "Tablo & Yağlıboya", "El Yazması & Belge"], "koleksiyon"), "koleksiyon"),
      node("Koleksiyon Ürünleri", leaves(["Kartpostal", "Rozet & Madalya", "Telefon Kartı", "Kibrit & Etiket", "Plak Koleksiyonu", "Oyuncak Koleksiyonu", "Figür & Aksiyon Figür", "Model Araba", "Askeri Malzeme", "Taş & Mineral", "İmza & Fotoğraf", "Saat Koleksiyonu"], "koleksiyon"), "koleksiyon")
    ], "koleksiyon"),
    node("Süpermarket & Gıda", leaves(["Temel Gıda", "Kahvaltılık", "Atıştırmalık & Şekerleme", "Bakliyat & Makarna", "Konserve & Hazır Yemek", "Kahve & Çay", "İçecek", "Su & Maden Suyu", "Süt & Süt Ürünleri", "Bebek Maması & Gıdası", "Organik & Glutensiz", "Baharat & Sos", "Zeytin & Zeytinyağı", "Bal & Reçel", "Kuruyemiş & Kurutulmuş Gıda", "Deterjan & Temizlik", "Kağıt Ürünleri", "Kişisel Temizlik & Hijyen"], "alisverisGenel"), "alisverisGenel"),
    node("Ofis & Kırtasiye", leaves(["Kırtasiye Malzemesi", "Defter & Bloknot", "Kalem & Yazı Gereçleri", "Ofis Mobilyası", "Yazıcı & Sarf Malzeme", "Dosyalama & Arşiv", "Sunum & Pano", "Hesap Makinesi", "Ofis Elektroniği", "Okul Malzemesi"], "alisverisGenel"), "alisverisGenel"),
    node("Oyuncak", leaves(["Eğitici Oyuncak", "Peluş Oyuncak", "Yapı & Bloklar (Lego)", "Uzaktan Kumandalı", "Bebek & Figür", "Puzzle & Zeka Oyunları", "Kutu Oyunları", "Oyun Seti", "Araba & Araç Oyuncak", "Su & Kum Oyuncakları", "Elektronik Oyuncak", "Bebek Oyuncakları (0-3 yaş)"], "alisverisGenel"), "alisverisGenel"),
    node("Bahçe & Yaşam", leaves(["Bahçe Mobilyası", "Şemsiye & Gölgelik", "Barbekü & Mangal", "Saksı & Çiçeklik", "Yapay Çiçek & Bitki", "Bahçe Dekorasyonu", "Havuz & Şişme", "Kamp & Piknik"], "alisverisGenel"), "alisverisGenel"),
    node("Dijital Ürünler", leaves(["Yazılım Lisansı", "Dijital Eğitim", "E-kitap", "Tasarım Dosyası", "Oyun Kodu", "Tema & Şablon", "Dijital Hesap", "Online Hizmet"], "alisverisGenel"), "alisverisGenel"),
    node("Evcil Hayvan Ürünleri", leaves(["Kedi Ürünleri", "Köpek Ürünleri", "Kuş Ürünleri", "Balık & Akvaryum", "Kemirgen Ürünleri", "Mama & Yem", "Kafes & Aksesuar", "Pet Bakım & Hijyen", "Tasma & Gezdirme", "Oyuncak & Kaşıma"], "alisverisGenel"), "alisverisGenel"),
    leaf("Hediyelik Ürünler", "alisverisGenel"),
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

  node("Ustalar & Hizmetler", [
    node("Ev Tadilat & Dekorasyon", leaves(["Ev Tadilat", "Boya & Badana", "Alçı & Alçıpan", "Fayans & Seramik", "Parke & Zemin", "Cam & Alüminyum", "Mutfak & Dolap", "Duvar Kağıdı", "Asma Tavan", "İç Mimari & Dekorasyon", "Su Yalıtımı & İzolasyon", "Çatı & Oluk"], "hizmet"), "hizmet"),
    node("Tesisat & Teknik", leaves(["Elektrikçi", "Su Tesisatçısı", "Doğalgaz Tesisatı", "Kombi & Klima Servisi", "Beyaz Eşya Servisi", "Asansör Bakım", "Jeneratör Servisi", "Güneş Enerjisi Kurulumu", "Uydu & Anten"], "hizmet"), "hizmet"),
    node("Teknik Servis & Tamir", leaves(["Bilgisayar Teknik Servis", "Telefon Tamiri", "TV & Elektronik Tamiri", "Oto Servis", "Mobilya Montaj & Tamir", "Saat Tamiri", "Ayakkabı & Çanta Tamiri", "Anahtarcı & Çilingir"], "hizmet"), "hizmet"),
    node("Nakliye & Lojistik", leaves(["Evden Eve Nakliyat", "Şehirler Arası Nakliyat", "Ofis Taşıma", "Parça Eşya Taşıma", "Asansörlü Taşıma", "Depolama & Ambar", "Kurye & Kargo", "Uluslararası Taşıma"], "hizmet"), "hizmet"),
    node("Temizlik & Bakım", leaves(["Ev Temizliği", "Ofis Temizliği", "İnşaat Sonrası Temizlik", "Cam Temizliği", "Halı & Koltuk Yıkama", "Dezenfeksiyon", "İlaçlama & Haşere", "Bahçe Bakımı"], "hizmet"), "hizmet"),
    node("Dijital & Tasarım", leaves(["Web Tasarım", "Grafik Tasarım", "Logo & Kurumsal Kimlik", "Sosyal Medya Yönetimi", "SEO & Reklam", "Yazılım & Uygulama", "Video Kurgu & Animasyon", "İçerik & Metin Yazarlığı"], "hizmet"), "hizmet"),
    node("Organizasyon & Etkinlik", leaves(["Düğün Organizasyon", "Nişan & Kına", "Doğum Günü", "Catering & İkram", "Fotoğraf & Video Çekimi", "Müzik & DJ", "Süsleme & Balon", "Davetiye & Matbaa", "Sahne & Ses Sistemi"], "hizmet"), "hizmet"),
    node("Profesyonel Hizmetler", leaves(["Danışmanlık", "Muhasebe & Mali Müşavir", "Hukuki Danışmanlık", "Sigorta", "Tercüme & Çeviri", "Emlak Danışmanlığı", "İş Kurma Danışmanlığı", "Vergi Danışmanlığı"], "hizmet"), "hizmet"),
    node("Güvenlik & Sağlık", leaves(["Özel Güvenlik", "Kamera & Alarm Sistemi", "Sağlık & Hasta Bakımı", "Yaşlı Bakımı", "Fizyoterapi", "Diyetisyen", "Psikolog & Danışman", "Evde Sağlık"], "hizmet"), "hizmet")
  ], "hizmet", IMG("1581578731548-c64695cc6952")),

  node("Özel Ders & Eğitim", [
    node("Akademik Dersler", leaves(["İlkokul Dersleri", "Ortaokul Dersleri", "Lise Dersleri", "Üniversite Dersleri", "Matematik", "Fizik", "Kimya", "Biyoloji", "Türkçe & Edebiyat", "Geometri"], "ders"), "ders"),
    node("Sınav Hazırlık", leaves(["LGS", "YKS (TYT-AYT)", "KPSS", "ALES", "DGS", "YDS/YÖKDİL", "IELTS/TOEFL", "Ehliyet Teori", "Meslek Sınavları"], "ders"), "ders"),
    node("Yabancı Dil", leaves(["İngilizce", "Almanca", "Fransızca", "İspanyolca", "İtalyanca", "Arapça", "Rusça", "Çince", "Japonca", "İşaret Dili"], "ders"), "ders"),
    node("Müzik & Sanat", leaves(["Piyano", "Gitar", "Keman", "Bağlama", "Şan & Vokal", "Resim & Çizim", "Bale & Dans", "Tiyatro & Drama", "Fotoğrafçılık", "Hat & Ebru"], "ders"), "ders"),
    node("Spor Dersleri", leaves(["Yüzme", "Tenis", "Fitness & PT", "Yoga & Pilates", "Basketbol", "Futbol", "Dövüş Sanatları", "Kayak", "Binicilik"], "ders"), "ders"),
    node("Meslek & Yazılım", leaves(["Yazılım & Kodlama", "Web Tasarım", "Grafik Tasarım", "Dijital Pazarlama", "Muhasebe Eğitimi", "Bilgisayar Kullanımı", "Ofis Programları", "Yapay Zeka & Veri"], "ders"), "ders"),
    node("Kişisel Gelişim & Diğer", leaves(["Direksiyon Dersi", "Diksiyon & Sunum", "Satranç", "Kişisel Gelişim", "Koçluk", "El Sanatları", "Aşçılık", "Kariyer Danışmanlığı"], "ders"), "ders"),
    leaf("Online Eğitim", "ders")
  ], "ders", IMG("1503676260728-1c00da094a0b")),

  node("İş İlanları", [
    node("Çalışma Şekli", leaves(["Tam Zamanlı", "Yarı Zamanlı", "Freelance / Serbest", "Staj", "Uzaktan (Remote)", "Dönemsel / Sezonluk", "Gündelik / Günlük", "Vardiyalı"], "isIlani"), "isIlani"),
    node("Satış, Pazarlama & Perakende", leaves(["Satış Temsilcisi", "Saha Satış", "Mağaza Personeli", "Kasiyer", "Reyon Görevlisi", "Pazarlama Uzmanı", "Dijital Pazarlama", "Mağaza Müdürü"], "isIlani"), "isIlani"),
    node("Bilişim & Yazılım", leaves(["Yazılım Geliştirici", "Web Geliştirici", "Mobil Geliştirici", "Test Uzmanı", "DevOps & Sistem", "Veri Analisti", "Siber Güvenlik", "IT Destek"], "isIlani"), "isIlani"),
    node("Ofis & Yönetim", leaves(["Muhasebe & Finans", "İnsan Kaynakları", "Sekreter & Asistan", "Yönetici & Müdür", "Satın Alma", "Halkla İlişkiler", "Hukuk & Avukatlık", "Ofis Elemanı"], "isIlani"), "isIlani"),
    node("Üretim, Lojistik & Sanayi", leaves(["Üretim İşçisi", "Kalite Kontrol", "Depo & Sevkiyat", "Forklift Operatörü", "Şoför", "Kurye & Motokurye", "Vinç/İş Makinesi Operatörü", "Teknik Bakım"], "isIlani"), "isIlani"),
    node("Hizmet & Turizm", leaves(["Garson & Komi", "Aşçı & Mutfak", "Barista", "Resepsiyon", "Kat Görevlisi", "Animasyon", "Temizlik Personeli", "Güvenlik Görevlisi", "Çağrı Merkezi"], "isIlani"), "isIlani"),
    node("Sağlık & Eğitim", leaves(["Doktor", "Hemşire", "Sağlık Teknikeri", "Fizyoterapist", "Öğretmen", "Öğretim Görevlisi", "Bakıcı & Refakatçi", "Eczane Personeli"], "isIlani"), "isIlani"),
    node("İnşaat & Mühendislik", leaves(["İnşaat Mühendisi", "Mimar", "Makine Mühendisi", "Elektrik Mühendisi", "Usta & Kalfa", "Şantiye Şefi", "Teknik Ressam", "İş Güvenliği Uzmanı"], "isIlani"), "isIlani")
  ], "isIlani", IMG("1521737604893-d14cc237f11d")),

  node("Yardımcı Arayanlar", [
    node("Çocuk & Bebek Bakımı", leaves(["Bebek Bakıcısı", "Çocuk Bakıcısı", "Yatılı Bakıcı", "Saatlik Bakıcı", "Kreş Öncesi Bakım"], "yardimci"), "yardimci"),
    node("Yaşlı & Hasta Bakımı", leaves(["Yaşlı Bakıcısı", "Hasta Bakıcısı", "Refakatçi", "Yatılı Hasta Bakımı", "Engelli Bakımı"], "yardimci"), "yardimci"),
    node("Ev İşleri & Temizlik", leaves(["Ev Yardımcısı", "Temizlikçi", "Gündelik Yardımcı", "Ütücü", "Yemek Yapan", "Yatılı Ev Yardımcısı"], "yardimci"), "yardimci"),
    node("Dış Hizmetler", leaves(["Bahçıvan", "Şoför", "Özel Ders Yardımcısı", "Evcil Hayvan Bakıcısı", "Alışveriş Yardımcısı"], "yardimci"), "yardimci")
  ], "yardimci", IMG("1576091160550-2173dba999ef")),

  node("Hayvanlar Alemi", [
    node("Sahiplendirme", [
      node("Kedi", leaves(["Tekir & Sokak Kedisi", "British Shorthair", "Scottish Fold", "Van Kedisi", "Ankara Kedisi", "Sphynx", "Maine Coon", "Persian (İran)", "Ragdoll", "Bengal", "Yavru Kedi", "Melez Kedi"], "hayvan"), "hayvan"),
      node("Köpek", leaves(["Golden Retriever", "Labrador", "Alman Kurdu (Kurt)", "Pomeranian", "Chihuahua", "Poodle", "Rottweiler", "Kangal & Çoban", "Terrier", "Husky", "Bulldog", "Yavru Köpek", "Melez Köpek"], "hayvan"), "hayvan"),
      node("Kuş", leaves(["Muhabbet Kuşu", "Kanarya", "Papağan", "Sultan Papağanı", "Cennet Papağanı", "Güvercin", "Bülbül & Ötücü", "Diğer Kuş"], "hayvan"), "hayvan"),
      ...leaves(["Balık & Akvaryum", "Kemirgen (Hamster/Tavşan)", "Sürüngen", "Çiftlik & Kümes Hayvanı", "At & Binek", "Diğer"], "hayvan")
    ], "hayvan"),
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

  node("Müzik Enstrümanları", [
    node("Gitar & Telli Çalgılar", leaves(["Akustik Gitar", "Elektro Gitar", "Bas Gitar", "Klasik Gitar", "Ukulele", "Mandolin", "Enstrüman Teli & Aksesuarı"], "muzik"), "muzik"),
    node("Yaylı & Halk Çalgıları", leaves(["Keman", "Viyola", "Çello", "Kontrbas", "Bağlama & Saz", "Ud", "Kanun", "Cümbüş", "Kabak Kemane"], "muzik"), "muzik"),
    node("Tuşlu Çalgılar", leaves(["Akustik Piyano", "Dijital Piyano", "Org & Synthesizer", "Melodika", "Akordeon"], "muzik"), "muzik"),
    node("Vurmalı Çalgılar", leaves(["Akustik Bateri", "Elektronik Bateri", "Darbuka & Def", "Cajon", "Perküsyon Seti", "Bendir & Davul"], "muzik"), "muzik"),
    node("Nefesli Çalgılar", leaves(["Ney", "Kaval", "Flüt", "Klarnet", "Saksofon", "Trompet", "Mızıka"], "muzik"), "muzik"),
    node("DJ & Stüdyo Ekipmanı", leaves(["DJ Setup & Controller", "Mikser", "Ses Kartı", "Stüdyo Monitörü", "Kayıt Mikrofonu", "Amfi & Kabin", "Efekt Pedalı", "Kulaklık & Aksesuar"], "muzik"), "muzik")
  ], "muzik", IMG("1511671782779-c97d3d27a1d4")),

  node("Sağlık & Medikal", [
    node("Hareket & Ortopedi", leaves(["Tekerlekli Sandalye", "Akülü Sandalye", "Walker & Yürüteç", "Baston & Koltuk Değneği", "Ortopedik Ürünler", "Korse & Bandaj", "Engelli Ürünleri"], "medikal"), "medikal"),
    node("Hasta Bakım Ürünleri", leaves(["Hasta Yatağı", "Havalı Yatak", "Hasta Karyolası", "Medikal Sarf Malzeme", "Hasta Bezi & Altlık", "Serum Askısı"], "medikal"), "medikal"),
    node("Ölçüm & Teşhis Cihazları", leaves(["Tansiyon Aleti", "Şeker Ölçüm Cihazı", "Ateş Ölçer", "Pulse Oksimetre", "Steteskop", "Vücut Analiz Tartısı"], "medikal"), "medikal"),
    node("Solunum & İşitme", leaves(["Oksijen Konsantratörü", "Nebulizatör", "Aspiratör", "CPAP / Uyku Cihazı", "İşitme Cihazı"], "medikal"), "medikal"),
    node("Terapi & Fizik Tedavi", leaves(["Masaj & Terapi Cihazı", "Fizik Tedavi Ekipmanı", "TENS Cihazı", "Sıcak-Soğuk Terapi", "Egzersiz & Rehabilitasyon"], "medikal"), "medikal")
  ], "medikal", IMG("1584982751601-97dcc096659c")),

  node("Diğer", [leaf("Kategori öner", "alisverisGenel")], "alisverisGenel", IMG("1441986300917-64674bd600d8"))
];

// ---- lookups & helpers ---------------------------------------------------
// Admin panelden gizlenen kategoriler (üst veya alt, key ile). Store DB'den yükleyip
// setHiddenCategories ile günceller; SSG/ilk render'da boş → sonra client filtreler
// (dil-toggle deseniyle aynı). Gizleme yalnız GEZİNME yüzeylerini (menü/keşfet/
// kategoriler) etkiler; ilan verme picker'ı tam ağacı gösterir.
let _hiddenCats = new Set<string>();
export function setHiddenCategories(keys: string[]): void {
  _hiddenCats = new Set(keys);
}
export function isCategoryHidden(key: string): boolean {
  return _hiddenCats.has(key);
}
// Gizli düğümleri (her seviyede) çıkararak görünür ağacı döndürür.
export function visibleCategoryTree(): CategoryNode[] {
  if (_hiddenCats.size === 0) return categoryTree;
  const prune = (nodes: CategoryNode[]): CategoryNode[] =>
    nodes
      .filter((n) => !_hiddenCats.has(n.key))
      .map((n) => (n.children ? { ...n, children: prune(n.children) } : n));
  return prune(categoryTree);
}

export function topCategories(): CategoryNode[] {
  return visibleCategoryTree();
}

/** Bir kategori etiketinin (ör. bir ilanın category alanı) landing slug'ını bulur.
 *  Ağaçta etikete göre DFS; bulunamazsa undefined (çağıran genel sayfaya düşer). */
// Serbest metinden (CSV/toplu yükleme) kategori adını ağaçtaki bir düğüme eşler.
// Önce tam (normalize) eşleşme, sonra "içeren" eşleşme. path + node döner (formKey
// çözümü ve kapak görseli için). Bulamazsa undefined.
export function matchCategoryByName(name: string): { node: CategoryNode; path: CategoryNode[] } | undefined {
  const norm = (s: string) => s.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
  const target = norm(name);
  if (!target) return undefined;
  const flat: Array<{ node: CategoryNode; path: CategoryNode[] }> = [];
  const walk2 = (nodes: CategoryNode[], path: CategoryNode[]) => {
    for (const n of nodes) {
      const p = [...path, n];
      flat.push({ node: n, path: p });
      if (n.children) walk2(n.children, p);
    }
  };
  walk2(categoryTree, []);
  // 1) Birebir etiket eşleşmesi.
  const exact = flat.find((f) => norm(f.node.label) === target);
  if (exact) return exact;
  if (target.length < 2) return undefined;
  // 2) TAM-KELİME örtüşmesi (alt-string değil): "ev" artık "Televizyon"a eşleşmez;
  //    "Ev & Yaşam"a eşleşir. Ortak anlamlı-kelime sayısına göre puanla, sonra
  //    yaprak düğümü ve daha kısa (daha özgül) etiketi öne al.
  const words = (s: string) => s.split(/[\s&/,]+/).map((w) => w.trim()).filter(Boolean);
  const tWords = words(target);
  const scored = flat
    .map((f) => {
      const lWords = words(norm(f.node.label));
      const common = tWords.filter((w) => lWords.includes(w)).length;
      return { f, common, leaf: !(f.node.children && f.node.children.length), len: norm(f.node.label).length };
    })
    .filter((x) => x.common > 0)
    .sort((a, b) => b.common - a.common || (a.leaf === b.leaf ? a.len - b.len : a.leaf ? -1 : 1));
  return scored[0]?.f;
}

export function findCategorySlug(label: string): string | undefined {
  const walk = (nodes: CategoryNode[]): string | undefined => {
    for (const n of nodes) {
      if (n.label === label) return n.slug;
      if (n.children) {
        const found = walk(n.children);
        if (found) return found;
      }
    }
    return undefined;
  };
  return walk(categoryTree);
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

// Tüm şemalardaki alanların anahtar → { etiket, suffix } haritası. Yapısal ilan
// özelliklerini (attributes jsonb) insan-okur biçimde göstermek için kullanılır.
export const FIELD_LABELS: Record<string, { label: string; suffix?: string }> = (() => {
  const map: Record<string, { label: string; suffix?: string }> = {};
  for (const schema of Object.values(formSchemas)) {
    for (const f of schema.fields) {
      if (!map[f.key]) map[f.key] = { label: f.label, suffix: f.suffix };
    }
  }
  return map;
})();

/** attributes jsonb'sini özellik tablosu için [{label, value}] listesine çevirir. */
export function describeAttributes(attributes?: Record<string, string | number | boolean | string[]> | null): Array<{ label: string; value: string }> {
  if (!attributes) return [];
  const rows: Array<{ label: string; value: string }> = [];
  for (const [key, val] of Object.entries(attributes)) {
    if (key.startsWith("_")) continue; // _leaf/_root iç kullanım
    if (val === undefined || val === null || val === "") continue;
    if (Array.isArray(val) && val.length === 0) continue;
    if (["title", "description", "price"].includes(key)) continue;
    const def = FIELD_LABELS[key];
    const value = Array.isArray(val)
      ? val.join(", ")
      : typeof val === "boolean"
        ? (val ? "Evet" : "Hayır")
        : `${val}${def?.suffix ? " " + def.suffix : ""}`;
    rows.push({ label: def?.label ?? key, value });
  }
  return rows;
}

// Kategori seçiminden (marka/model/ilan-tipi node'ları) form alanlarını türetir —
// böylece ağaçta "BMW > 3.20i" seçince İlan Bilgileri formu boş gelmez, marka/model
// otomatik dolar ve başlık önerilir (Sahibinden mantığı).
const _ALL_BRANDS = new Set<string>(
  [
    ...CAR_BRANDS, ...MOTO_BRANDS, ...COMPUTER_BRANDS, ...TV_BRANDS,
    ...WHITE_GOODS_BRANDS, ...COMMERCIAL_BRANDS, ...MARINE_ENGINE_BRANDS,
    ...HEATING_BRANDS, ...AC_BRANDS, ...PHONE_BRANDS
  ].filter((b) => b && b !== "Diğer")
);
// Marka aynı anda birden çok haritada olabilir (Mercedes/Ford: oto+ticari, Honda:
// oto+moto, Samsung: telefon+TV). Spread ile SON harita önceki modelleri EZİYORDU
// → oto marka model listesi ticari/moto'yla değişiyor, "C Serisi" bulunamıyor,
// model oto-doldurma sessizce başarısız oluyordu. Ezmek yerine BİRLEŞTİR (union).
const _ALL_MODELS: Record<string, string[]> = (() => {
  const merged: Record<string, string[]> = {};
  for (const map of [MODELS_BY_BRAND, MOTO_MODELS, COMPUTER_MODELS, TV_MODELS, COMMERCIAL_MODELS]) {
    for (const [brand, models] of Object.entries(map)) {
      merged[brand] = Array.from(new Set([...(merged[brand] ?? []), ...models]));
    }
  }
  return merged;
})();
const _LISTING_TYPES = ["Satılık", "Kiralık", "Devren", "Günlük", "Kat Karşılığı"];

export function deriveFieldsFromPath(path: CategoryNode[], schema: FormSchema): Record<string, string> {
  const out: Record<string, string> = {};
  if (!path.length) return out;
  const labels = path.map((p) => p.label);
  const keys = new Set(schema.fields.map((f) => f.key));

  const brand = labels.find((l) => _ALL_BRANDS.has(l));
  let model: string | undefined;
  if (brand) {
    const ms = _ALL_MODELS[brand];
    model = labels.find((l) => l !== brand && l !== "Diğer Model" && (ms ? ms.includes(l) : false));
  }
  const listingRaw = labels.find((l) => _LISTING_TYPES.some((t) => l.includes(t)));

  if (brand) {
    if (keys.has("brand")) out.brand = brand;
    if (keys.has("compatBrand")) out.compatBrand = brand;
  }
  if (model) {
    if (keys.has("model")) out.model = model;
    if (keys.has("compatModel")) out.compatModel = model;
  }
  if (listingRaw && keys.has("listingType")) {
    const opts = schema.fields.find((f) => f.key === "listingType")?.options ?? [];
    const match = opts.find((o) => listingRaw.includes(o)) ?? _LISTING_TYPES.find((t) => listingRaw.includes(t));
    if (match) out.listingType = match;
  }

  // Başlık önerisi: marka + model + yaprak kategori (yalnızca boşsa uygulanır).
  // Tekrarı GİDER: bir parça diğerini içeriyorsa (marka "iPhone" ⊂ model "iPhone 15
  // Pro Max") yalnızca kapsayan kalsın → "iPhone iPhone 15 Pro Max" bug'ı düzelir.
  const rawParts = Array.from(new Set([brand, model, leaf].filter((p): p is string => Boolean(p))));
  const titleParts = rawParts.filter((p, i) => !rawParts.some((o, j) => j !== i && o !== p && key(o).includes(key(p))));
  const titleSeed = titleParts.join(" ").trim();
  if (titleSeed.length >= 3) out.title = titleSeed.slice(0, 70);

  return out;
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
  { words: ["arsa", "tarla", "arazi"], path: ["Emlak", "Arsa / Arazi"] },
  { words: ["motosiklet", "motor"], path: ["Vasıta", "Motosiklet"] },
  { words: ["bisiklet"], path: ["İkinci El & Sıfır Alışveriş", "Spor & Outdoor", "Bisiklet"] },
  { words: ["scooter", "elektrikli scooter", "hoverboard"], path: ["İkinci El & Sıfır Alışveriş", "Elektronik", "Elektrikli Ulaşım"] },
  { words: ["laptop", "bilgisayar", "notebook"], path: ["İkinci El & Sıfır Alışveriş", "Bilgisayar & Oyun", "Dizüstü Bilgisayar"] },
  { words: ["buzdolabi", "camasir makinesi", "beyaz esya"], path: ["İkinci El & Sıfır Alışveriş", "Beyaz Eşya"] },
  { words: ["ayakkabi", "spor ayakkabi", "sneaker"], path: ["İkinci El & Sıfır Alışveriş", "Moda", "Ayakkabı"] },
  { words: ["kopek", "kedi", "yavru", "sahiplen"], path: ["Hayvanlar Alemi", "Sahiplendirme"] }
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
    const formKey = resolveFormKey(path);
    // Tekrarı GİDER: aynı yaprak etiketi + aynı form (aynı "şey") birden çok dalda
    // olsa da tek öneri göster (iPhone hem Elektronik hem Telefon & Aksesuar altında
    // görünüyordu). Farklı form → farklı anlam (Basketbol ekipman vs. ders) → korunur.
    const leaf = path[path.length - 1];
    const id = `${key(leaf.label)}|${formKey}`;
    if (seen.has(id)) return;
    seen.add(id);
    hits.push({ path, labels: path.map((p) => p.label), formKey, image: path.find((p) => p.image)?.image });
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

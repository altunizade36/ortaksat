// 100+ örnek/vitrin ilanı (demo=true). Her ürüne KENDI ürün tipine göre görsel:
// LoremFlickr'dan anahtar kelimeyle eşleşen görsel çözülür (302 -> stabil cache
// URL'i), HTTP 200 doğrulanır, benzersiz saklanır (lock ile). Böylece başlık ve
// görsel uyuşur, bir foto bir kez kullanılır. Sahibi "OrtakSat Vitrin" (demo/vitrin satıcısı).
import pg from "pg";
import crypto from "node:crypto";

const OWNER = "f3ed367b-bf42-46c8-95a6-ac8bc284dcd3";
const CONN = process.env.SUPABASE_DB_URL;
const CITIES = ["İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Adana", "Konya", "Gaziantep", "Kocaeli", "Mersin", "Eskişehir", "Samsun"];

// [kategori, başlık, fiyat, görsel anahtar kelimesi (İngilizce), ortaklıkModu]
const PRODUCTS = [
  ["Otomobil", "BMW 3.20i Premium Line", 1850000, "bmw car", "approval"],
  ["Otomobil", "Mercedes-Benz C180 AMG", 2100000, "mercedes car", "approval"],
  ["Otomobil", "Audi A4 40 TDI", 1950000, "audi car", "approval"],
  ["Otomobil", "Volkswagen Passat 1.5 TSI", 1650000, "volkswagen car", "approval"],
  ["Otomobil", "Ford Focus 1.5 Titanium", 1150000, "ford car", "approval"],
  ["Otomobil", "Renault Megane Sedan", 980000, "renault car", "approval"],
  ["Otomobil", "Fiat Egea 1.4 Fire", 720000, "fiat car", "approval"],
  ["Otomobil", "Toyota Corolla Hybrid", 1450000, "toyota car", "approval"],
  ["Otomobil", "Honda Civic 1.5 VTEC", 1520000, "honda car", "approval"],
  ["Otomobil", "Hyundai i20 Elite", 890000, "hyundai car", "approval"],
  ["Motosiklet", "Honda CBR 650R", 385000, "sport motorcycle", "approval"],
  ["Motosiklet", "Yamaha MT-07", 340000, "yamaha motorcycle", "approval"],
  ["Motosiklet", "Kawasaki Z900", 520000, "kawasaki motorcycle", "approval"],
  ["Motosiklet", "KTM Duke 390", 295000, "ktm motorcycle", "approval"],
  ["Motosiklet", "Vespa Primavera 150", 210000, "vespa scooter", "open"],
  ["Cep Telefonu", "iPhone 15 Pro 256GB", 62000, "iphone", "open"],
  ["Cep Telefonu", "iPhone 14 128GB", 44000, "iphone smartphone", "open"],
  ["Cep Telefonu", "Samsung Galaxy S24 Ultra", 58000, "samsung galaxy", "open"],
  ["Cep Telefonu", "Xiaomi 14 512GB", 34000, "android smartphone", "open"],
  ["Cep Telefonu", "Google Pixel 8 Pro", 39000, "smartphone phone", "open"],
  ["Dizüstü Bilgisayar", "MacBook Air M3 13\"", 52000, "macbook laptop", "open"],
  ["Dizüstü Bilgisayar", "MacBook Pro 14\" M3", 78000, "apple laptop", "open"],
  ["Dizüstü Bilgisayar", "Asus ROG Strix G16", 65000, "gaming laptop", "open"],
  ["Dizüstü Bilgisayar", "Lenovo ThinkPad X1 Carbon", 58000, "business laptop", "open"],
  ["Dizüstü Bilgisayar", "HP Pavilion 15", 28000, "laptop computer", "open"],
  ["Televizyon", "Samsung 55\" QLED 4K", 42000, "television tv", "open"],
  ["Televizyon", "LG 65\" OLED evo", 68000, "oled television", "open"],
  ["Televizyon", "Sony 55\" Bravia XR", 55000, "smart tv", "open"],
  ["Televizyon", "TCL 50\" 4K Google TV", 24000, "flat screen tv", "open"],
  ["Tablet", "iPad Air 11\" M2", 34000, "ipad tablet", "open"],
  ["Tablet", "iPad Pro 12.9\" M4", 62000, "tablet device", "open"],
  ["Tablet", "Samsung Galaxy Tab S9", 38000, "android tablet", "open"],
  ["Tablet", "Amazon Kindle Paperwhite", 6500, "ereader kindle", "open"],
  ["Kulaklık", "Apple AirPods Pro 2", 8900, "wireless earbuds", "open"],
  ["Kulaklık", "Sony WH-1000XM5", 14500, "headphones", "open"],
  ["Kulaklık", "JBL Charge 5 Hoparlör", 4200, "bluetooth speaker", "open"],
  ["Kulaklık", "Bose QuietComfort Ultra", 16500, "over ear headphones", "open"],
  ["Beyaz Eşya", "Bosch No-Frost Buzdolabı", 38000, "refrigerator", "approval"],
  ["Beyaz Eşya", "Arçelik 9 kg Çamaşır Makinesi", 22000, "washing machine", "approval"],
  ["Beyaz Eşya", "Siemens Bulaşık Makinesi", 26000, "dishwasher", "approval"],
  ["Beyaz Eşya", "Samsung Kurutma Makinesi", 28000, "clothes dryer", "approval"],
  ["Küçük Ev Aleti", "Dyson V15 Detect", 28000, "dyson vacuum", "open"],
  ["Küçük Ev Aleti", "Robot Süpürge Xiaomi", 12000, "robot vacuum", "open"],
  ["Küçük Ev Aleti", "Philips Espresso Makinesi", 9500, "espresso machine", "open"],
  ["Küçük Ev Aleti", "Tefal Airfryer XL", 4800, "air fryer", "open"],
  ["Koltuk Takımı", "Köşe Koltuk Takımı", 32000, "sofa couch", "approval"],
  ["Koltuk Takımı", "3+2+1 Modern Koltuk", 27000, "living room sofa", "approval"],
  ["Koltuk Takımı", "Chester Tekli Berjer", 8500, "armchair", "open"],
  ["Yemek Odası", "6 Kişilik Yemek Masası", 15000, "dining table", "approval"],
  ["Yemek Odası", "Ahşap Yemek Masası Takımı", 21000, "wooden dining table", "approval"],
  ["Yatak Odası", "Bazalı Yatak Odası Takımı", 34000, "bedroom bed", "approval"],
  ["Yatak Odası", "Gardırop 6 Kapaklı", 18000, "wardrobe closet", "approval"],
  ["Ev Dekorasyon", "El Dokuma Halı 200x300", 9500, "carpet rug", "open"],
  ["Ev Dekorasyon", "Modern Avize 8 Kollu", 3200, "chandelier", "open"],
  ["Ev Dekorasyon", "Kitaplık Raf Sistemi", 5400, "bookshelf", "open"],
  ["Kadın Giyim", "Kadın Trençkot", 2400, "trench coat", "open"],
  ["Kadın Giyim", "Abiye Elbise", 3200, "evening dress", "open"],
  ["Kadın Giyim", "Kadın Kaşe Palto", 2900, "womens coat", "open"],
  ["Erkek Giyim", "Erkek Takım Elbise", 4200, "mens suit", "open"],
  ["Erkek Giyim", "Deri Ceket", 3800, "leather jacket", "open"],
  ["Erkek Giyim", "Slim Fit Gömlek", 850, "dress shirt", "open"],
  ["Ayakkabı", "Erkek Spor Ayakkabı", 4200, "running shoes", "open"],
  ["Ayakkabı", "Koşu Ayakkabısı", 4800, "sneakers", "open"],
  ["Ayakkabı", "Klasik Deri Ayakkabı", 2600, "leather shoes", "open"],
  ["Çanta", "Hakiki Deri Kadın Çanta", 3400, "handbag", "open"],
  ["Çanta", "Laptop Sırt Çantası", 1200, "backpack", "open"],
  ["Saat", "Klasik Otomatik Kol Saati", 480000, "luxury watch", "approval"],
  ["Saat", "Çelik Kordon Kol Saati", 320000, "wristwatch", "approval"],
  ["Saat", "Apple Watch Series 9", 18000, "smartwatch", "open"],
  ["Saat", "Dijital Spor Saat", 3500, "digital watch", "open"],
  ["Güneş Gözlüğü", "Aviator Güneş Gözlüğü", 5200, "sunglasses", "open"],
  ["Güneş Gözlüğü", "Spor Güneş Gözlüğü", 4600, "sport sunglasses", "open"],
  ["Parfüm", "Erkek Parfüm 100ml", 4200, "perfume bottle", "open"],
  ["Parfüm", "Kadın Parfüm EDP", 5800, "perfume", "open"],
  ["Kozmetik", "Profesyonel Makyaj Seti", 2400, "makeup cosmetics", "open"],
  ["Kozmetik", "Cilt Bakım Seti", 1800, "skincare products", "open"],
  ["Bebek", "Travel Sistem Bebek Arabası", 12000, "baby stroller", "approval"],
  ["Bebek", "Mama Sandalyesi", 3200, "baby high chair", "open"],
  ["Bebek", "Oto Bebek Koltuğu", 4500, "baby car seat", "open"],
  ["Oyuncak", "LEGO Technic Set", 4800, "lego bricks", "open"],
  ["Oyuncak", "Uzaktan Kumandalı Araba", 1600, "remote control car toy", "open"],
  ["Spor & Outdoor", "Katlanır Koşu Bandı", 18000, "treadmill", "open"],
  ["Spor & Outdoor", "Dumbbell Ağırlık Seti 40kg", 4200, "dumbbell weights", "open"],
  ["Spor & Outdoor", "28 Jant Şehir Bisikleti", 14000, "bicycle", "open"],
  ["Spor & Outdoor", "4 Mevsim Kamp Çadırı", 3800, "camping tent", "open"],
  ["Müzik Aleti", "Akustik Gitar", 3400, "acoustic guitar", "open"],
  ["Müzik Aleti", "Elektro Gitar + Amfi", 8500, "electric guitar", "open"],
  ["Müzik Aleti", "Dijital Piyano 88 Tuş", 16000, "piano keyboard", "open"],
  ["Kitap & Hobi", "Klasik Roman Seti 10 Kitap", 1200, "books stack", "open"],
  ["Kitap & Hobi", "Üniversite Ders Kitapları", 900, "textbooks", "open"],
  ["Oyun & Konsol", "PlayStation 5 Slim", 24000, "playstation5", "open"],
  ["Oyun & Konsol", "Xbox Series X", 22000, "xbox", "open"],
  ["Oyun & Konsol", "Nintendo Switch OLED", 15000, "nintendo switch", "open"],
  ["Fotoğraf & Kamera", "Canon EOS R6 Body", 78000, "canon camera", "open"],
  ["Fotoğraf & Kamera", "Sony Alpha A7 IV", 92000, "sony camera", "open"],
  ["Fotoğraf & Kamera", "DJI Mini 4 Pro Drone", 42000, "dji drone", "open"],
  ["Konut - Satılık", "3+1 Satılık Daire", 4200000, "apartment building", "approval"],
  ["Konut - Satılık", "2+1 Bahçe Katı Daire", 3100000, "modern apartment", "approval"],
  ["Konut - Satılık", "Müstakil Villa Havuzlu", 12500000, "villa house", "approval"],
  ["Konut - Satılık", "Deniz Manzaralı 4+1", 8900000, "luxury house", "approval"],
  ["Konut - Kiralık", "1+1 Kiralık Daire", 18000, "apartment interior", "approval"],
  ["Konut - Kiralık", "2+1 Eşyalı Kiralık", 26000, "living room interior", "approval"],
  ["Arsa & İşyeri", "İmarlı Arsa 500m²", 2800000, "empty land field", "approval"],
  ["Arsa & İşyeri", "Cadde Üstü Dükkan", 5400000, "storefront shop", "approval"],
  ["Arsa & İşyeri", "Plaza Kat Ofis", 6200000, "office space", "approval"],
  ["Yapı Market & Bahçe", "Benzinli Çim Biçme Makinesi", 8500, "lawn mower", "open"],
  ["Yapı Market & Bahçe", "Profesyonel Matkap Seti", 3200, "power drill", "open"],
  ["Deniz Araçları", "Şişme Bot 4 Kişilik", 42000, "inflatable boat", "approval"],
  ["Deniz Araçları", "Jet Ski Yamaha", 480000, "jetski", "approval"],
  // --- Katalog genişletme (kolaj planı 86-196): sona eklendi, 1-109 dokunulmadı ---
  ["Bilgisayar & Donanım", "Samsung Odyssey G5 Monitör", 14000, "gaming monitor", "open"],
  ["Bilgisayar & Donanım", "Oyuncu Koltuğu", 6500, "gaming chair", "open"],
  ["Bilgisayar & Donanım", "Masaüstü Gaming PC", 55000, "desktop gaming pc", "open"],
  ["Bilgisayar & Donanım", "24\" Full HD Monitör", 6800, "computer monitor", "open"],
  ["Bilgisayar & Donanım", "Mekanik Klavye RGB", 2400, "mechanical keyboard", "open"],
  ["Bilgisayar & Donanım", "Gaming Mouse", 1800, "gaming mouse", "open"],
  ["Bilgisayar & Donanım", "Gaming Kulaklık", 2600, "gaming headset", "open"],
  ["Bilgisayar & Donanım", "Powerbank 20000 mAh", 1600, "power bank", "open"],
  ["Bilgisayar & Donanım", "USB Bellek 128GB", 450, "usb flash drive", "open"],
  ["Bilgisayar & Donanım", "Harici Harddisk 1TB", 2200, "external hard drive", "open"],
  ["Bilgisayar & Donanım", "Modem / Router", 1900, "wifi router", "open"],
  ["Fotoğraf & Kamera", "GoPro Hero 12", 24000, "gopro action camera", "open"],
  ["Fotoğraf & Kamera", "Aksiyon Kamera 4K", 3800, "action camera", "open"],
  ["Fotoğraf & Kamera", "Projeksiyon Cihazı", 18000, "projector", "open"],
  ["Fotoğraf & Kamera", "Projeksiyon Perdesi", 2400, "projector screen", "open"],
  ["Fotoğraf & Kamera", "Telefon Tripod", 800, "phone tripod", "open"],
  ["Fotoğraf & Kamera", "Ring Light", 1200, "ring light", "open"],
  ["Fotoğraf & Kamera", "Fotoğraf Stüdyo Seti", 5400, "photo studio", "open"],
  ["Fotoğraf & Kamera", "Grafik Tablet", 4200, "graphics tablet", "open"],
  ["Akıllı Ev", "Akıllı Kapı Zili", 2400, "smart doorbell", "open"],
  ["Akıllı Ev", "Akıllı Ampul", 350, "smart bulb", "open"],
  ["Akıllı Ev", "Cam Temizleme Robotu", 5800, "window cleaning robot", "open"],
  ["Akıllı Ev", "Güvenlik Kamerası", 2200, "security camera", "open"],
  ["Akıllı Ev", "Güneş Paneli Seti", 24000, "solar panel", "open"],
  ["Akıllı Ev", "Uydu Alıcı Seti", 1400, "satellite receiver", "open"],
  ["Oto Aksesuar", "4 Mevsim Lastik Seti 4 Adet", 18000, "car tires", "open"],
  ["Oto Aksesuar", "Port Bagaj", 6500, "car roof box", "open"],
  ["Spor & Outdoor", "Dağ Bisikleti", 16000, "mountain bike", "open"],
  ["Spor & Outdoor", "Kamp Masa Sandalye Seti", 2800, "camping table chairs", "open"],
  ["Spor & Outdoor", "Kamp ve Trekking Çantası", 3400, "hiking backpack", "open"],
  ["Spor & Outdoor", "Uyku Tulumu", 1600, "sleeping bag", "open"],
  ["Spor & Outdoor", "Kamp Ocağı", 1200, "camping stove", "open"],
  ["Spor & Outdoor", "Buzluk 45L", 2400, "cooler box", "open"],
  ["Spor & Outdoor", "Olta Takım Seti", 3200, "fishing rod", "open"],
  ["Yapı Market & Bahçe", "Bahçe Mangal Seti", 8500, "barbecue grill", "open"],
  ["Yapı Market & Bahçe", "Basınçlı Yıkama Makinesi", 4800, "pressure washer", "open"],
  ["Yapı Market & Bahçe", "Intex Metal Frame Havuz", 6800, "frame swimming pool", "open"],
  ["Bebek", "Park Yatak", 3800, "baby travel cot", "open"],
  ["Ev Dekorasyon", "Boy Aynası", 1800, "standing mirror", "open"],
  ["Ev Dekorasyon", "Portmanto Askılık", 900, "coat rack stand", "open"],
  ["Ev Dekorasyon", "Ayakkabılık Dolabı", 2200, "shoe rack cabinet", "open"],
  ["Ev Dekorasyon", "Bonsai Ağacı", 1400, "bonsai tree", "open"],
  ["Ev Dekorasyon", "Salon Bitkisi", 800, "houseplant", "open"],
  ["Mobilya", "Çalışma Masası", 4200, "office desk", "open"],
  ["Mobilya", "Ofis Sandalyesi", 3200, "office chair", "open"],
  ["Ofis & Kırtasiye", "Yazı Tahtası", 1600, "whiteboard", "open"],
  ["Çanta", "Valiz Seti 3'lü", 4800, "luggage suitcase set", "open"],
  ["Küçük Ev Aleti", "Çelik Tencere Seti", 3800, "cookware pots set", "open"],
  ["Küçük Ev Aleti", "Yemek Takımı 24 Parça", 2400, "dinnerware set", "open"],
  ["Küçük Ev Aleti", "Çatal Kaşık Bıçak Seti", 1800, "cutlery set", "open"],
  ["Küçük Ev Aleti", "Blender Seti", 1600, "kitchen blender", "open"],
  ["Küçük Ev Aleti", "Stand Mikser", 4200, "stand mixer", "open"],
  ["Küçük Ev Aleti", "Waffle Makinesi", 1200, "waffle maker", "open"],
  ["Küçük Ev Aleti", "Ekmek Kızartma Makinesi", 900, "toaster", "open"],
  ["Küçük Ev Aleti", "Su Sebili", 2800, "water dispenser", "open"],
  ["Küçük Ev Aleti", "Mutfak Robotu", 6500, "food processor", "open"],
  ["Küçük Ev Aleti", "Buharlı Ütü (Dikey)", 2200, "garment steamer", "open"],
  ["Küçük Ev Aleti", "Buhar Ütü", 1800, "steam iron", "open"],
  ["Küçük Ev Aleti", "Şarjlı Dikey Süpürge", 5800, "cordless stick vacuum", "open"],
  ["Küçük Ev Aleti", "Elektrikli Süpürge", 3200, "vacuum cleaner", "open"],
  ["Küçük Ev Aleti", "Isıtıcı (Infrared)", 1400, "space heater", "open"],
  ["Küçük Ev Aleti", "Ayaklı Vantilatör", 900, "standing fan", "open"],
  ["Küçük Ev Aleti", "Nem Alma Cihazı", 3800, "dehumidifier", "open"],
  ["Küçük Ev Aleti", "Hava Nemlendirici", 1400, "air humidifier", "open"],
  ["Küçük Ev Aleti", "Hava Temizleyici", 5400, "air purifier", "open"],
  ["Küçük Ev Aleti", "Kıyma Makinesi", 2200, "meat grinder", "open"],
  ["Küçük Ev Aleti", "Katı Meyve Sıkacağı", 1600, "citrus juicer", "open"],
  ["Küçük Ev Aleti", "Su Isıtıcı (Kettle)", 900, "electric kettle", "open"],
  ["Küçük Ev Aleti", "Kahve Öğütücü", 1400, "coffee grinder", "open"],
  ["Küçük Ev Aleti", "Türk Kahvesi Makinesi", 1800, "turkish coffee maker", "open"],
  ["Küçük Ev Aleti", "Filtre Kahve Makinesi", 2400, "drip coffee maker", "open"],
  ["Küçük Ev Aleti", "5'i 1 Arada Tost Makinesi", 2200, "sandwich toaster grill", "open"],
  ["Küçük Ev Aleti", "Dikiş Makinesi", 4800, "sewing machine", "open"],
  ["Beyaz Eşya", "İndüksiyon Ocak", 8500, "induction cooktop", "approval"],
  ["Beyaz Eşya", "Ankastre Fırın", 12000, "built-in oven", "approval"],
  ["Beyaz Eşya", "Ankastre Ocak", 6500, "gas cooktop", "approval"],
  ["Beyaz Eşya", "Davlumbaz", 4800, "kitchen range hood", "approval"],
  ["Beyaz Eşya", "Ankastre Bulaşık Makinesi", 22000, "built-in dishwasher", "approval"],
  ["Beyaz Eşya", "Mikrodalga Fırın", 4200, "microwave oven", "open"],
  ["Beyaz Eşya", "Ankastre Buzdolabı", 42000, "built-in refrigerator", "approval"],
  ["Beyaz Eşya", "Sandık Tipi Derin Dondurucu", 18000, "chest freezer", "approval"],
  ["Beyaz Eşya", "Dikey Derin Dondurucu", 16000, "upright freezer", "approval"],
  ["Beyaz Eşya", "Klima 12000 BTU", 18000, "air conditioner", "approval"],
  ["Beyaz Eşya", "Yağlı Radyatör", 2400, "oil heater radiator", "open"],
  ["Kitap & Hobi", "Overlok Makinesi", 8500, "overlock machine", "open"],
  ["Kitap & Hobi", "Transfer Baskı Makinesi", 12000, "heat press machine", "open"]
];

const money = (n) => new Intl.NumberFormat("tr-TR").format(n);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function slugify(s) {
  const map = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", Ç: "c", Ğ: "g", İ: "i", Ö: "o", Ş: "s", Ü: "u" };
  return s.replace(/[çğıöşüÇĞİÖŞÜ]/g, (m) => map[m] ?? m).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

import fs from "node:fs";
import path from "node:path";

const BASE_URL = "https://www.ortaksat.com/demo"; // repo public/demo/ -> canlıda bu adres
const DEMO_PRODUCTS_BASE_URL = "https://www.ortaksat.com/demo-products"; // curated category assets in public/demo-products/
const OUT_DIR = path.join(process.cwd(), "public", "demo");
const DEMO_PRODUCT_IMAGE_BY_FILE = {
  "092-xbox-series-x.jpg": "games/xbox-series-x.jpg",
  "093-nintendo-switch-oled.jpg": "games/nintendo-switch-oled.jpg",
  "094-canon-eos-r6-body.jpg": "camera/canon-eos-r6-body.jpg",
  "095-sony-alpha-a7-iv.jpg": "camera/sony-alpha-a7-iv.jpg",
  "096-dji-mini-4-pro-drone.jpg": "camera/dji-mini-4-pro-drone.jpg",
  "099-mustakil-villa-havuzlu.jpg": "real-estate/mustakil-villa-havuzlu.jpg",
  "101-1-1-kiralik-daire.jpg": "real-estate/1-1-kiralik-daire.jpg",
  "102-2-1-esyali-kiralik.jpg": "real-estate/2-1-esyali-kiralik.jpg",
  "103-imarli-arsa-500m.jpg": "real-estate/imarli-arsa-500m.jpg",
  "104-cadde-ustu-dukkan.jpg": "real-estate/cadde-ustu-dukkan.jpg",
  "105-plaza-kat-ofis.jpg": "real-estate/plaza-kat-ofis.jpg",
  "106-benzinli-cim-bicme-makinesi.jpg": "garden/benzinli-cim-bicme-makinesi.jpg",
  "107-profesyonel-matkap-seti.jpg": "garden/profesyonel-matkap-seti.jpg",
  "108-sisme-bot-4-kisilik.jpg": "vehicles/sisme-bot-4-kisilik.jpg",
  "109-jet-ski-yamaha.jpg": "vehicles/jet-ski-yamaha.jpg"
};

// LoremFlickr'dan anahtar kelimeyle eşleşen görselin BYTE'larını indirir (kalıcı
// olarak public/demo'ya kaydedilecek). HTML hata sayfalarını eler (>10KB & image/*).
const UA = { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36", Accept: "image/*" } };
async function fetchImageBytes(keyword, lock) {
  const q = keyword.trim().replace(/\s+/g, ",");
  const url = `https://loremflickr.com/800/800/${encodeURIComponent(q)}?lock=${lock}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const r = await fetch(url, UA);
      const ct = r.headers.get("content-type") || "";
      if (r.ok && ct.startsWith("image/")) {
        const b = Buffer.from(await r.arrayBuffer());
        if (b.length > 10000) return b;
      }
      await sleep(500 * (attempt + 1));
    } catch { await sleep(500 * (attempt + 1)); }
  }
  return null;
}

async function main() {
  if (!CONN) { console.error("SUPABASE_DB_URL yok"); process.exit(1); }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  // ÖNEMLİ: mevcut görselleri SİLME. Gerçek/curated ürün görselleri korunur; aşağıda
  // yalnızca dosyası olmayan (yeni) ürünler için keyword ile placeholder indirilir.

  const c = new pg.Client(CONN);
  await c.connect();
  const del = await c.query("delete from listings where demo = true returning id");
  console.log("Silinen eski demo ilan:", del.rowCount);

  let n = 0, failed = 0;
  for (let i = 0; i < PRODUCTS.length; i++) {
    const [cat, title, price, keyword, mode] = PRODUCTS[i];
    const file = `${String(i + 1).padStart(3, "0")}-${slugify(title)}.jpg`;
    const outPath = path.join(OUT_DIR, file);
    const curatedImage = DEMO_PRODUCT_IMAGE_BY_FILE[file];
    // Görsel zaten varsa (gerçek/curated ürün görseli) DOKUNMA; yalnızca eksikse indir.
    if (!curatedImage && !fs.existsSync(outPath)) {
      // Farklı lock -> farklı görsel (benzersiz). Başarısızsa lock değiştir, sonra kategori anahtarına düş.
      let bytes = null;
      for (let lock = 1000 + i; lock < 1000 + i + 60 && !bytes; lock += 13) bytes = await fetchImageBytes(keyword, lock);
      if (!bytes) { bytes = await fetchImageBytes(cat.split(" ")[0] || "product", 8000 + i); if (!bytes) failed++; }
      if (!bytes) { console.warn("Görsel indirilemedi:", title); continue; }
      fs.writeFileSync(outPath, bytes);
    }
    const image = curatedImage ? `${DEMO_PRODUCTS_BASE_URL}/${curatedImage}` : `${BASE_URL}/${file}`;

    const id = crypto.randomUUID();
    const city = CITIES[n % CITIES.length];
    const commission = 10 + (n % 6) * 2;
    const stock = 1 + (n % 12);
    const desc = `${title} — ${cat} kategorisinde örnek ilandır. ${city} konumunda gösterim amacıyla listelenmiştir. Fiyat: ${money(price)} ₺. Bu örnek ilanda mesajlaşma/iletişim/ortaklık kapalıdır; yalnızca platformun nasıl göründüğünü gösterir.`;
    await c.query(
      `insert into listings (id, owner_id, title, slug, description, price, currency, commission_type, commission_value, category, location, status, partnership_mode, stock_count, min_partner_rating, commission_due_days, return_window_days, partner_rules, delivery_note, contact_method, sales_pitch, ad_assets, tags, demo)
       values ($1,$2,$3,$4,$5,$6,'TRY','rate',$7,$8,$9,'active',$10,$11,4,3,7,$12,$13,'message',$14,'{}',$15,true)`,
      [id, OWNER, title, `${slugify(title)}-${id.slice(0, 6)}`, desc, price, commission, cat, city, mode, stock,
       ["Komisyon yalnızca örnek gösterimdir."], "Bu bir örnek ilandır; teslimat/ödeme yoktur.",
       [`${title} — örnek ürün gösterimi.`, `${cat} kategorisinde vitrin ilanı.`], [cat, title.split(" ")[0], "örnek"]]
    );
    await c.query("insert into listing_images (listing_id, url, sort_order) values ($1,$2,0)", [id, image]);
    n++;
    if (n % 20 === 0) console.log(`... ${n}/${PRODUCTS.length} indirildi`);
    await sleep(150);
  }
  console.log(`Eklenen demo ilan: ${n} · public/demo'ya kaydedildi · fallback: ${failed}`);
  await c.end();
}
main().catch((e) => { console.error("HATA:", e.message); process.exit(1); });

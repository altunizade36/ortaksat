// 100+ örnek/vitrin ilanı (demo=true). Her ürüne KENDI ürün tipine göre görsel:
// LoremFlickr'dan anahtar kelimeyle eşleşen görsel çözülür (302 -> stabil cache
// URL'i), HTTP 200 doğrulanır, benzersiz saklanır (lock ile). Böylece başlık ve
// görsel uyuşur, bir foto bir kez kullanılır. Sahibi "Canlı Test Satıcı".
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
  ["Deniz Araçları", "Jet Ski Yamaha", 480000, "jetski", "approval"]
];

const money = (n) => new Intl.NumberFormat("tr-TR").format(n);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function slugify(s) {
  const map = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", Ç: "c", Ğ: "g", İ: "i", Ö: "o", Ş: "s", Ü: "u" };
  return s.replace(/[çğıöşüÇĞİÖŞÜ]/g, (m) => map[m] ?? m).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

import fs from "node:fs";
import path from "node:path";

const BASE_URL = "https://ortaksat.com/demo"; // repo public/demo/ -> canlıda bu adres
const OUT_DIR = path.join(process.cwd(), "public", "demo");

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
  for (const f of fs.readdirSync(OUT_DIR)) { try { fs.unlinkSync(path.join(OUT_DIR, f)); } catch {} }

  const c = new pg.Client(CONN);
  await c.connect();
  const del = await c.query("delete from listings where demo = true returning id");
  console.log("Silinen eski demo ilan:", del.rowCount);

  let n = 0, failed = 0;
  for (let i = 0; i < PRODUCTS.length; i++) {
    const [cat, title, price, keyword, mode] = PRODUCTS[i];
    // Farklı lock -> farklı görsel (benzersiz). Başarısızsa lock değiştir, sonra kategori anahtarına düş.
    let bytes = null;
    for (let lock = 1000 + i; lock < 1000 + i + 60 && !bytes; lock += 13) bytes = await fetchImageBytes(keyword, lock);
    if (!bytes) { bytes = await fetchImageBytes(cat.split(" ")[0] || "product", 8000 + i); if (!bytes) failed++; }
    if (!bytes) { console.warn("Görsel indirilemedi:", title); continue; }

    const file = `${String(i + 1).padStart(3, "0")}-${slugify(title)}.jpg`;
    fs.writeFileSync(path.join(OUT_DIR, file), bytes);
    const image = `${BASE_URL}/${file}`;

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

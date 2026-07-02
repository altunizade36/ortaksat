// 100+ örnek/vitrin ilanı ekler (demo=true). Her ürüne BENZERSIZ + doğru tip
// görseli atanır (bir foto bir kez). Görseller HTTP 200 doğrulanır; kırık/tekrar
// olan yedek havuzdan benzersiz doldurulur. Sahibi "Canlı Test Satıcı".
import pg from "pg";
import crypto from "node:crypto";

const OWNER = "f3ed367b-bf42-46c8-95a6-ac8bc284dcd3"; // Canlı Test Satıcı
const CONN = process.env.SUPABASE_DB_URL;
const img = (id) => `https://images.unsplash.com/photo-${id}?w=1200&q=80`;
const CITIES = ["İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Adana", "Konya", "Gaziantep", "Kocaeli", "Mersin", "Eskişehir", "Samsun"];

// Her ürün: [kategori, başlık, fiyat, görselId, ortaklıkModu]
const PRODUCTS = [
  // Otomobil (her araca farklı foto)
  ["Otomobil", "BMW 3.20i Premium Line", 1850000, "1555215695-3004980ad54e", "approval"],
  ["Otomobil", "Mercedes-Benz C180 AMG", 2100000, "1618843479313-40f8afb4b4d8", "approval"],
  ["Otomobil", "Audi A4 40 TDI", 1950000, "1606664515524-ed2f786a0bd6", "approval"],
  ["Otomobil", "Volkswagen Passat 1.5 TSI", 1650000, "1541899481282-d53bffe3c35d", "approval"],
  ["Otomobil", "Ford Focus 1.5 Titanium", 1150000, "1551830820-330a71b99659", "approval"],
  ["Otomobil", "Renault Megane Sedan", 980000, "1549317661-bd32c8ce0db2", "approval"],
  ["Otomobil", "Fiat Egea 1.4 Fire", 720000, "1502877338535-766e1452684a", "approval"],
  ["Otomobil", "Toyota Corolla Hybrid", 1450000, "1621007947382-bb3c3994e3fb", "approval"],
  ["Otomobil", "Honda Civic 1.5 VTEC", 1520000, "1590362891991-f776e747a588", "approval"],
  ["Otomobil", "Hyundai i20 Elite", 890000, "1619767886558-efdc259cde1a", "approval"],
  // Motosiklet
  ["Motosiklet", "Honda CBR 650R", 385000, "1568772585407-9361f9bf3a87", "approval"],
  ["Motosiklet", "Yamaha MT-07", 340000, "1558981806-ec527fa84c39", "approval"],
  ["Motosiklet", "Kawasaki Z900", 520000, "1609630875171-b1321377ee65", "approval"],
  ["Motosiklet", "KTM Duke 390", 295000, "1583121274602-3e2820c69888", "approval"],
  ["Motosiklet", "Vespa Primavera 150", 210000, "1571068316344-75bc76f77890", "open"],
  // Cep Telefonu
  ["Cep Telefonu", "iPhone 15 Pro 256GB", 62000, "1695048133142-1a20484d2569", "open"],
  ["Cep Telefonu", "iPhone 14 128GB", 44000, "1580910051074-3eb694886505", "open"],
  ["Cep Telefonu", "Samsung Galaxy S24 Ultra", 58000, "1610945265064-0e34e5519bbf", "open"],
  ["Cep Telefonu", "Xiaomi 14 512GB", 34000, "1598327105666-5b89351aff97", "open"],
  ["Cep Telefonu", "Google Pixel 8 Pro", 39000, "1598965402089-897ce52e8355", "open"],
  // Dizüstü Bilgisayar
  ["Dizüstü Bilgisayar", "MacBook Air M3 13\"", 52000, "1517336714731-489689fd1ca8", "open"],
  ["Dizüstü Bilgisayar", "MacBook Pro 14\" M3", 78000, "1541807084-5c52b6b3adef", "open"],
  ["Dizüstü Bilgisayar", "Asus ROG Strix G16", 65000, "1603302576837-37561b2e2302", "open"],
  ["Dizüstü Bilgisayar", "Lenovo ThinkPad X1 Carbon", 58000, "1588872657578-7efd1f1555ed", "open"],
  ["Dizüstü Bilgisayar", "HP Pavilion 15", 28000, "1496181133206-80ce9b88a853", "open"],
  // Televizyon
  ["Televizyon", "Samsung 55\" QLED 4K", 42000, "1593359677879-a4bb92f829d1", "open"],
  ["Televizyon", "LG 65\" OLED evo", 68000, "1461151304267-38535e780c79", "open"],
  ["Televizyon", "Sony 55\" Bravia XR", 55000, "1509281373149-e957c6296406", "open"],
  ["Televizyon", "TCL 50\" 4K Google TV", 24000, "1467293622093-9f15c96be70f", "open"],
  // Tablet
  ["Tablet", "iPad Air 11\" M2", 34000, "1544244015-0df4b3ffc6b0", "open"],
  ["Tablet", "iPad Pro 12.9\" M4", 62000, "1561154464-82e9adf32764", "open"],
  ["Tablet", "Samsung Galaxy Tab S9", 38000, "1585790050230-5dd28404ccb9", "open"],
  ["Tablet", "Amazon Kindle Paperwhite", 6500, "1592434134753-a70baf7979d5", "open"],
  // Kulaklık / Ses
  ["Kulaklık", "Apple AirPods Pro 2", 8900, "1600294037681-c80b4cb5b434", "open"],
  ["Kulaklık", "Sony WH-1000XM5", 14500, "1505740420928-5e560c06d30e", "open"],
  ["Kulaklık", "JBL Charge 5 Hoparlör", 4200, "1608043152269-423dbba4e7e1", "open"],
  ["Kulaklık", "Bose QuietComfort Ultra", 16500, "1546435770-a3e426bf472b", "open"],
  // Beyaz Eşya
  ["Beyaz Eşya", "Bosch No-Frost Buzdolabı", 38000, "1571175443880-49e1d25b2bc5", "approval"],
  ["Beyaz Eşya", "Arçelik 9 kg Çamaşır Makinesi", 22000, "1626806787461-102c1bfaaea1", "approval"],
  ["Beyaz Eşya", "Siemens Bulaşık Makinesi", 26000, "1584622650111-993a426fbf0a", "approval"],
  ["Beyaz Eşya", "Samsung Kurutma Makinesi", 28000, "1610557892470-55d9e80c0bce", "approval"],
  // Küçük Ev Aleti
  ["Küçük Ev Aleti", "Dyson V15 Detect", 28000, "1558317374-067fb5f30001", "open"],
  ["Küçük Ev Aleti", "Robot Süpürge Xiaomi", 12000, "1567690187548-f07b1d7bf5a9", "open"],
  ["Küçük Ev Aleti", "Philips Espresso Makinesi", 9500, "1517668808822-9ebb02f2a0e6", "open"],
  ["Küçük Ev Aleti", "Tefal Airfryer XL", 4800, "1626074353765-517a681e40be", "open"],
  // Mobilya
  ["Koltuk Takımı", "Köşe Koltuk Takımı", 32000, "1555041469-a586c61ea9bc", "approval"],
  ["Koltuk Takımı", "3+2+1 Modern Koltuk", 27000, "1493663284031-b7e3aefcae8e", "approval"],
  ["Koltuk Takımı", "Chester Tekli Berjer", 8500, "1567016432779-094069958ea5", "open"],
  ["Yemek Odası", "6 Kişilik Yemek Masası", 15000, "1615874959474-d609969a20ed", "approval"],
  ["Yemek Odası", "Ahşap Yemek Masası Takımı", 21000, "1617806118233-18e1de247200", "approval"],
  ["Yatak Odası", "Bazalı Yatak Odası Takımı", 34000, "1505693416388-ac5ce068fe85", "approval"],
  ["Yatak Odası", "Gardırop 6 Kapaklı", 18000, "1595428774223-ef52624120d2", "approval"],
  ["Ev Dekorasyon", "El Dokuma Halı 200x300", 9500, "1600166898405-da9535204843", "open"],
  ["Ev Dekorasyon", "Modern Avize 8 Kollu", 3200, "1524634126442-357e0eac3c14", "open"],
  ["Ev Dekorasyon", "Kitaplık Raf Sistemi", 5400, "1594620302200-9a762244a156", "open"],
  // Moda
  ["Kadın Giyim", "Kadın Trençkot", 2400, "1591047139829-d91aecb6caea", "open"],
  ["Kadın Giyim", "Abiye Elbise", 3200, "1566174053879-31528523f8ae", "open"],
  ["Kadın Giyim", "Kadın Kaşe Palto", 2900, "1539533018447-63fcce2678e3", "open"],
  ["Erkek Giyim", "Erkek Takım Elbise", 4200, "1594938298603-c8148c4dae35", "open"],
  ["Erkek Giyim", "Deri Ceket", 3800, "1551028719-00167b16eac5", "open"],
  ["Erkek Giyim", "Slim Fit Gömlek", 850, "1602810318383-e386cc2a3ccf", "open"],
  ["Ayakkabı", "Nike Air Max 270", 4200, "1542291026-7eec264c27ff", "open"],
  ["Ayakkabı", "Adidas Ultraboost", 4800, "1608231387042-66d1773070a5", "open"],
  ["Ayakkabı", "Klasik Deri Ayakkabı", 2600, "1614252369475-531eba835eb1", "open"],
  ["Çanta", "Hakiki Deri Kadın Çanta", 3400, "1584917865442-de89df76afd3", "open"],
  ["Çanta", "Laptop Sırt Çantası", 1200, "1553062407-98eeb64c6a62", "open"],
  // Saat / Aksesuar
  ["Saat", "Rolex Datejust (2.el)", 480000, "1523275335684-37898b6baf30", "approval"],
  ["Saat", "Omega Seamaster", 320000, "1548171915-e79a380a2a4b", "approval"],
  ["Saat", "Apple Watch Series 9", 18000, "1434493789847-2f02dc6ca35d", "open"],
  ["Saat", "Casio G-Shock", 3500, "1508057198894-247b23fe5ade", "open"],
  ["Güneş Gözlüğü", "Ray-Ban Aviator", 5200, "1572635196237-14b3f281503f", "open"],
  ["Güneş Gözlüğü", "Oakley Holbrook", 4600, "1577803645773-f96470509666", "open"],
  ["Parfüm", "Dior Sauvage EDP 100ml", 4200, "1541643600914-78b084683601", "open"],
  ["Parfüm", "Chanel No.5 EDP", 5800, "1592945403244-b3fbafd7f539", "open"],
  ["Kozmetik", "Profesyonel Makyaj Seti", 2400, "1596462502278-27bfdc403348", "open"],
  ["Kozmetik", "Cilt Bakım Seti", 1800, "1570172619644-dfd03ed5d881", "open"],
  // Bebek / Oyuncak
  ["Bebek", "Travel Sistem Bebek Arabası", 12000, "1515488042361-ee00e0ddd4e4", "approval"],
  ["Bebek", "Mama Sandalyesi", 3200, "1533674689012-136b487b7736", "open"],
  ["Bebek", "Oto Bebek Koltuğu", 4500, "1544126592-807ade215a0b", "open"],
  ["Oyuncak", "LEGO Technic Set", 4800, "1587654780291-39c9404d746b", "open"],
  ["Oyuncak", "Uzaktan Kumandalı Araba", 1600, "1594787318286-3d835c1d207f", "open"],
  // Spor / Outdoor
  ["Spor & Outdoor", "Katlanır Koşu Bandı", 18000, "1576678927484-cc907957088c", "open"],
  ["Spor & Outdoor", "Dumbbell Ağırlık Seti 40kg", 4200, "1638536532686-d610adfc8e5c", "open"],
  ["Spor & Outdoor", "28 Jant Şehir Bisikleti", 14000, "1485965120184-e220f721d03e", "open"],
  ["Spor & Outdoor", "4 Mevsim Kamp Çadırı", 3800, "1504280390367-361c6d9f38f4", "open"],
  // Müzik
  ["Müzik Aleti", "Akustik Gitar", 3400, "1510915361894-db8b60106cb1", "open"],
  ["Müzik Aleti", "Elektro Gitar + Amfi", 8500, "1550985616-10810253b84d", "open"],
  ["Müzik Aleti", "Dijital Piyano 88 Tuş", 16000, "1520523839897-bd0b52f945a0", "open"],
  // Kitap
  ["Kitap & Hobi", "Klasik Roman Seti 10 Kitap", 1200, "1512820790803-83ca734da794", "open"],
  ["Kitap & Hobi", "Üniversite Ders Kitapları", 900, "1497633762265-9d179a990aa6", "open"],
  // Oyun / Konsol
  ["Oyun & Konsol", "PlayStation 5 Slim", 24000, "1606813907291-d86efa9b94db", "open"],
  ["Oyun & Konsol", "Xbox Series X", 22000, "1621259182978-fbf93132d53d", "open"],
  ["Oyun & Konsol", "Nintendo Switch OLED", 15000, "1578303512597-81e6cc155b3e", "open"],
  // Fotoğraf
  ["Fotoğraf & Kamera", "Canon EOS R6 Body", 78000, "1516035069371-29a1b244cc32", "open"],
  ["Fotoğraf & Kamera", "Sony Alpha A7 IV", 92000, "1502920917128-1aa500764cbd", "open"],
  ["Fotoğraf & Kamera", "DJI Mini 4 Pro Drone", 42000, "1473968512647-3e447244af8f", "open"],
  // Emlak
  ["Konut - Satılık", "3+1 Satılık Daire", 4200000, "1568605114967-8130f3a36994", "approval"],
  ["Konut - Satılık", "2+1 Bahçe Katı Daire", 3100000, "1512917774080-9991f1c4c750", "approval"],
  ["Konut - Satılık", "Müstakil Villa Havuzlu", 12500000, "1613490493576-7fde63acd811", "approval"],
  ["Konut - Satılık", "Deniz Manzaralı 4+1", 8900000, "1600585154340-be6161a56a0c", "approval"],
  ["Konut - Kiralık", "1+1 Kiralık Daire", 18000, "1522708323590-d24dbb6b0267", "approval"],
  ["Konut - Kiralık", "2+1 Eşyalı Kiralık", 26000, "1502672260266-1c1ef2d93688", "approval"],
  ["Arsa & İşyeri", "İmarlı Arsa 500m²", 2800000, "1500382017468-9049fed747ef", "approval"],
  ["Arsa & İşyeri", "Cadde Üstü Dükkan", 5400000, "1441986300917-64674bd600d8", "approval"],
  ["Arsa & İşyeri", "Plaza Kat Ofis", 6200000, "1497366216548-37526070297c", "approval"],
  // Bahçe / Deniz
  ["Yapı Market & Bahçe", "Benzinli Çim Biçme Makinesi", 8500, "1590682680695-43b964a3ae17", "open"],
  ["Yapı Market & Bahçe", "Profesyonel Matkap Seti", 3200, "1504148455328-c376907d081c", "open"],
  ["Deniz Araçları", "Şişme Bot 4 Kişilik", 42000, "1544551763-46a013bb70d5", "approval"],
  ["Deniz Araçları", "Jet Ski Yamaha", 480000, "1600965962361-9035dbfd1c50", "approval"]
];

// Doğrulama başarısız/tekrar olursa buradan benzersiz doldurulur.
const SPARE = [
  "1523275335684-37898b6baf30", "1441986300917-64674bd600d8", "1560343090-f0409e92791a",
  "1505740420928-5e560c06d30e", "1526170375885-4d8ecf77b99f", "1560769629-975ec94e6a86",
  "1542291026-7eec264c27ff", "1556909114-f6e7ad7d3136", "1524805444758-089113d48a6d",
  "1523381210434-271e8be1f52b", "1560472354-b33ff0c44a43", "1553062407-98eeb64c6a62",
  "1571781926291-c477ebfd024b", "1487222477894-8943e31ef7b2", "1600185365483-26d7a4cc7519"
];
const FINAL_FALLBACK = "1441986300917-64674bd600d8";

const money = (n) => new Intl.NumberFormat("tr-TR").format(n);
function slugify(s) {
  const map = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", Ç: "c", Ğ: "g", İ: "i", Ö: "o", Ş: "s", Ü: "u" };
  return s.replace(/[çğıöşüÇĞİÖŞÜ]/g, (m) => map[m] ?? m).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}
async function ok(id) {
  try { const r = await fetch(img(id), { method: "HEAD" }); return r.ok; } catch { return false; }
}

async function main() {
  if (!CONN) { console.error("SUPABASE_DB_URL yok"); process.exit(1); }
  // Tüm benzersiz görsel adaylarını doğrula.
  const candidates = new Set([...PRODUCTS.map((p) => p[3]), ...SPARE, FINAL_FALLBACK]);
  const valid = new Map();
  await Promise.all([...candidates].map(async (id) => valid.set(id, await ok(id))));
  const spareOk = SPARE.filter((id) => valid.get(id));
  let spareIdx = 0;
  const used = new Set();
  let broken = 0, deduped = 0;

  function pickImage(preferred) {
    if (valid.get(preferred) && !used.has(preferred)) { used.add(preferred); return preferred; }
    if (!valid.get(preferred)) broken++; else deduped++;
    while (spareIdx < spareOk.length) { const s = spareOk[spareIdx++]; if (!used.has(s)) { used.add(s); return s; } }
    return FINAL_FALLBACK; // en kötü ihtimalde
  }

  const c = new pg.Client(CONN);
  await c.connect();
  const del = await c.query("delete from listings where demo = true returning id");
  console.log("Silinen eski demo ilan:", del.rowCount);

  let n = 0;
  for (const [cat, title, price, imageId, mode] of PRODUCTS) {
    const id = crypto.randomUUID();
    const image = img(pickImage(imageId));
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
  }
  console.log(`Eklenen demo ilan: ${n} · benzersiz görsel: ${used.size} · kırık(atlanan): ${broken} · tekrar(atlanan): ${deduped}`);
  await c.end();
}
main().catch((e) => { console.error("HATA:", e.message); process.exit(1); });

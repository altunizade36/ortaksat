// 100 örnek/vitrin ilanı ekler (demo=true). Sarı "ÖRNEK" şeridiyle görünür;
// mesaj/ortaklık kapalı. Sahibi "Canlı Test Satıcı". Görseller eklemeden önce
// HTTP 200 doğrulanır; kırık görsel kategori-varsayılanıyla değiştirilir.
import pg from "pg";
import crypto from "node:crypto";

const OWNER = "f3ed367b-bf42-46c8-95a6-ac8bc284dcd3"; // Canlı Test Satıcı
const CONN = process.env.SUPABASE_DB_URL;
const img = (id) => `https://images.unsplash.com/photo-${id}?w=1200&q=80`;
const CITIES = ["İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Adana", "Konya", "Gaziantep", "Kocaeli", "Mersin", "Eskişehir", "Samsun"];
const FALLBACK = img("1441986300917-64674bd600d8"); // genel ürün/mağaza

// Kategori grupları: her grubun doğru bir görseli + ürün listesi (başlık, fiyat).
const GROUPS = [
  { cat: "Otomobil", image: img("1503376780353-7e6692767b70"), mode: "approval", items: [
    ["BMW 3.20i Premium Line", 1850000], ["Mercedes-Benz C180 AMG", 2100000], ["Audi A4 40 TDI", 1950000],
    ["Volkswagen Passat 1.5 TSI", 1650000], ["Ford Focus 1.5 Titanium", 1150000], ["Renault Megane Sedan", 980000],
    ["Fiat Egea 1.4 Fire", 720000], ["Toyota Corolla Hybrid", 1450000], ["Honda Civic 1.5 VTEC", 1520000],
    ["Hyundai i20 Elite", 890000] ] },
  { cat: "Motosiklet", image: img("1568772585407-9361f9bf3a87"), mode: "approval", items: [
    ["Honda CBR 650R", 385000], ["Yamaha MT-07", 340000], ["Kawasaki Z900", 520000],
    ["KTM Duke 390", 295000], ["Vespa Primavera 150", 210000] ] },
  { cat: "Cep Telefonu", image: img("1511707171634-5f897ff02aa9"), mode: "open", items: [
    ["iPhone 15 Pro 256GB", 62000], ["iPhone 14 128GB", 44000], ["Samsung Galaxy S24 Ultra", 58000],
    ["Xiaomi 14 512GB", 34000], ["Google Pixel 8 Pro", 39000] ] },
  { cat: "Dizüstü Bilgisayar", image: img("1517336714731-489689fd1ca8"), mode: "open", items: [
    ["MacBook Air M3 13\"", 52000], ["MacBook Pro 14\" M3", 78000], ["Asus ROG Strix G16", 65000],
    ["Lenovo ThinkPad X1 Carbon", 58000], ["HP Pavilion 15", 28000] ] },
  { cat: "Televizyon", image: img("1593359677879-a4bb92f829d1"), mode: "open", items: [
    ["Samsung 55\" QLED 4K", 42000], ["LG 65\" OLED evo", 68000], ["Sony 55\" Bravia XR", 55000],
    ["TCL 50\" 4K Google TV", 24000] ] },
  { cat: "Tablet", image: img("1544244015-0df4b3ffc6b0"), mode: "open", items: [
    ["iPad Air 11\" M2", 34000], ["iPad Pro 12.9\" M4", 62000], ["Samsung Galaxy Tab S9", 38000],
    ["Amazon Kindle Paperwhite", 6500] ] },
  { cat: "Kulaklık", image: img("1505740420928-5e560c06d30e"), mode: "open", items: [
    ["Apple AirPods Pro 2", 8900], ["Sony WH-1000XM5", 14500], ["JBL Charge 5 Hoparlör", 4200],
    ["Bose QuietComfort Ultra", 16500] ] },
  { cat: "Beyaz Eşya", image: img("1571175443880-49e1d25b2bc5"), mode: "approval", items: [
    ["Bosch No-Frost Buzdolabı", 38000], ["Arçelik 9 kg Çamaşır Makinesi", 22000],
    ["Siemens Bulaşık Makinesi", 26000], ["Samsung Kurutma Makinesi", 28000] ] },
  { cat: "Küçük Ev Aleti", image: img("1585515320310-259814833e62"), mode: "open", items: [
    ["Dyson V15 Detect", 28000], ["Robot Süpürge Xiaomi", 12000], ["Philips Espresso Makinesi", 9500],
    ["Tefal Airfryer XL", 4800] ] },
  { cat: "Koltuk Takımı", image: img("1555041469-a586c61ea9bc"), mode: "approval", items: [
    ["Köşe Koltuk Takımı", 32000], ["3+2+1 Modern Koltuk", 27000], ["Chester Tekli Berjer", 8500] ] },
  { cat: "Yemek Odası", image: img("1615874959474-d609969a20ed"), mode: "approval", items: [
    ["6 Kişilik Yemek Masası", 15000], ["Ahşap Yemek Masası Takımı", 21000] ] },
  { cat: "Yatak Odası", image: img("1505693416388-ac5ce068fe85"), mode: "approval", items: [
    ["Bazalı Yatak Odası Takımı", 34000], ["Gardırop 6 Kapaklı", 18000] ] },
  { cat: "Ev Dekorasyon", image: img("1600166898405-da9535204843"), mode: "open", items: [
    ["El Dokuma Halı 200x300", 9500], ["Modern Avize 8 Kollu", 3200], ["Kitaplık Raf Sistemi", 5400] ] },
  { cat: "Kadın Giyim", image: img("1595777457583-95e059d581b8"), mode: "open", items: [
    ["Kadın Trençkot", 2400], ["Abiye Elbise", 3200], ["Kadın Kaşe Palto", 2900] ] },
  { cat: "Erkek Giyim", image: img("1594938298603-c8148c4dae35"), mode: "open", items: [
    ["Erkek Takım Elbise", 4200], ["Deri Ceket", 3800], ["Slim Fit Gömlek", 850] ] },
  { cat: "Ayakkabı", image: img("1542291026-7eec264c27ff"), mode: "open", items: [
    ["Nike Air Max 270", 4200], ["Adidas Ultraboost", 4800], ["Klasik Deri Ayakkabı", 2600] ] },
  { cat: "Çanta", image: img("1584917865442-de89df76afd3"), mode: "open", items: [
    ["Hakiki Deri Kadın Çanta", 3400], ["Laptop Sırt Çantası", 1200] ] },
  { cat: "Saat", image: img("1523275335684-37898b6baf30"), mode: "open", items: [
    ["Rolex Datejust (2.el)", 480000], ["Omega Seamaster", 320000], ["Apple Watch Series 9", 18000],
    ["Casio G-Shock", 3500] ] },
  { cat: "Güneş Gözlüğü", image: img("1572635196237-14b3f281503f"), mode: "open", items: [
    ["Ray-Ban Aviator", 5200], ["Oakley Holbrook", 4600] ] },
  { cat: "Parfüm", image: img("1541643600914-78b084683601"), mode: "open", items: [
    ["Dior Sauvage EDP 100ml", 4200], ["Chanel No.5 EDP", 5800] ] },
  { cat: "Kozmetik", image: img("1596462502278-27bfdc403348"), mode: "open", items: [
    ["Profesyonel Makyaj Seti", 2400], ["Cilt Bakım Seti", 1800] ] },
  { cat: "Bebek", image: img("1515488042361-ee00e0ddd4e4"), mode: "approval", items: [
    ["Travel Sistem Bebek Arabası", 12000], ["Mama Sandalyesi", 3200], ["Oto Bebek Koltuğu", 4500] ] },
  { cat: "Oyuncak", image: img("1587654780291-39c9404d746b"), mode: "open", items: [
    ["LEGO Technic Set", 4800], ["Uzaktan Kumandalı Araba", 1600] ] },
  { cat: "Spor & Outdoor", image: img("1571019613454-1cb2f99b2d8b"), mode: "open", items: [
    ["Katlanır Koşu Bandı", 18000], ["Dumbbell Ağırlık Seti 40kg", 4200], ["28 Jant Şehir Bisikleti", 14000],
    ["4 Mevsim Kamp Çadırı", 3800] ] },
  { cat: "Müzik Aleti", image: img("1510915361894-db8b60106cb1"), mode: "open", items: [
    ["Akustik Gitar", 3400], ["Elektro Gitar + Amfi", 8500], ["Dijital Piyano 88 Tuş", 16000] ] },
  { cat: "Kitap & Hobi", image: img("1512820790803-83ca734da794"), mode: "open", items: [
    ["Klasik Roman Seti 10 Kitap", 1200], ["Üniversite Ders Kitapları", 900] ] },
  { cat: "Oyun & Konsol", image: img("1606813907291-d86efa9b94db"), mode: "open", items: [
    ["PlayStation 5 Slim", 24000], ["Xbox Series X", 22000], ["Nintendo Switch OLED", 15000] ] },
  { cat: "Fotoğraf & Kamera", image: img("1516035069371-29a1b244cc32"), mode: "open", items: [
    ["Canon EOS R6 Body", 78000], ["Sony Alpha A7 IV", 92000], ["DJI Mini 4 Pro Drone", 42000] ] },
  { cat: "Konut - Satılık", image: img("1568605114967-8130f3a36994"), mode: "approval", items: [
    ["3+1 Satılık Daire", 4200000], ["2+1 Bahçe Katı Daire", 3100000], ["Müstakil Villa Havuzlu", 12500000],
    ["Deniz Manzaralı 4+1", 8900000] ] },
  { cat: "Konut - Kiralık", image: img("1522708323590-d24dbb6b0267"), mode: "approval", items: [
    ["1+1 Kiralık Daire", 18000], ["2+1 Eşyalı Kiralık", 26000] ] },
  { cat: "Arsa & İşyeri", image: img("1500382017468-9049fed747ef"), mode: "approval", items: [
    ["İmarlı Arsa 500m²", 2800000], ["Cadde Üstü Dükkan", 5400000], ["Plaza Kat Ofis", 6200000] ] },
  { cat: "Yapı Market & Bahçe", image: img("1416879595882-3373a0480b5b"), mode: "open", items: [
    ["Benzinli Çim Biçme Makinesi", 8500], ["Profesyonel Matkap Seti", 3200] ] },
  { cat: "Deniz Araçları", image: img("1544551763-46a013bb70d5"), mode: "approval", items: [
    ["Şişme Bot 4 Kişilik", 42000], ["Jet Ski Yamaha", 480000] ] }
];

const money = (n) => new Intl.NumberFormat("tr-TR").format(n);

function slugify(s) {
  const map = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", Ç: "c", Ğ: "g", İ: "i", Ö: "o", Ş: "s", Ü: "u" };
  return s.replace(/[çğıöşüÇĞİÖŞÜ]/g, (m) => map[m] ?? m).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

async function verifyImage(url) {
  try {
    const r = await fetch(url, { method: "HEAD" });
    return r.ok;
  } catch { return false; }
}

async function main() {
  if (!CONN) { console.error("SUPABASE_DB_URL yok"); process.exit(1); }
  // Görselleri doğrula (grup başına tek istek).
  const imageCache = new Map();
  for (const g of GROUPS) {
    if (!imageCache.has(g.image)) imageCache.set(g.image, await verifyImage(g.image));
  }
  const badGroups = GROUPS.filter((g) => !imageCache.get(g.image)).map((g) => g.cat);
  if (badGroups.length) console.log("Kırık görsel (fallback kullanılacak):", badGroups.join(", "));

  const c = new pg.Client(CONN);
  await c.connect();
  // Önce eski demo ilanları temizle (tekrar çalıştırılabilir olsun).
  const del = await c.query("delete from listings where demo = true returning id");
  console.log("Silinen eski demo ilan:", del.rowCount);

  let n = 0;
  for (const g of GROUPS) {
    const image = imageCache.get(g.image) ? g.image : FALLBACK;
    for (const [title, price] of g.items) {
      const id = crypto.randomUUID();
      const city = CITIES[n % CITIES.length];
      const commission = 10 + (n % 6) * 2; // %10-20
      const stock = 1 + (n % 12);
      const desc = `${title} — ${g.cat} kategorisinde örnek ilandır. Ürün ${city} konumunda gösterim amacıyla listelenmiştir. Fiyat: ${money(price)} ₺. Gerçek satın alma/iletişim bu örnek ilanda kapalıdır; platformun nasıl göründüğünü göstermek içindir.`;
      await c.query(
        `insert into listings (id, owner_id, title, slug, description, price, currency, commission_type, commission_value, category, location, status, partnership_mode, stock_count, min_partner_rating, commission_due_days, return_window_days, partner_rules, delivery_note, contact_method, sales_pitch, ad_assets, tags, demo)
         values ($1,$2,$3,$4,$5,$6,'TRY','rate',$7,$8,$9,'active',$10,$11,4,3,7,$12,$13,'message',$14,'{}',$15,true)`,
        [id, OWNER, title, `${slugify(title)}-${id.slice(0, 6)}`, desc, price, commission, g.cat, city, g.mode, stock,
         ["Komisyon yalnızca örnek gösterimdir."], "Bu bir örnek ilandır; teslimat/ödeme yoktur.",
         [`${title} — örnek ürün gösterimi.`, `${g.cat} kategorisinde vitrin ilanı.`],
         [g.cat, title.split(" ")[0], "örnek"]]
      );
      await c.query("insert into listing_images (listing_id, url, sort_order) values ($1,$2,0)", [id, image]);
      n++;
    }
  }
  console.log("Eklenen demo ilan:", n);
  await c.end();
}

main().catch((e) => { console.error("HATA:", e.message); process.exit(1); });

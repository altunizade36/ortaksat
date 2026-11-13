import { mkdir, writeFile } from "node:fs/promises";

// DİKKAT: Bu betik dış kaynaktan (Wikimedia) görsel bağlantısı toplar. İl kapakları artık
// yalnız kendi ürettiğimiz çizimlerden gelir (scripts/city-covers/generate.py); telif riski
// nedeniyle dış kaynak kullanılmaz. Yanlışlıkla çalıştırılıp manifesti ezmesin diye durdurulur.
if (!process.argv.includes("--dis-kaynak-kullan")) {
  console.error("Durduruldu: il kapakları dış kaynaktan çekilmez. Özgün görseller için: python scripts/city-covers/generate.py");
  process.exit(1);
}

const landmarks = {
  Adana: "Adana Taşköprü Seyhan river panorama",
  Adıyaman: "Mount Nemrut Adıyaman Turkey",
  Afyonkarahisar: "Afyonkarahisar castle city panorama",
  Ağrı: "Mount Ararat Ağrı Turkey landscape",
  Amasya: "Amasya Yalıboyu houses Yeşilırmak panorama",
  Ankara: "Ankara Anıtkabir city panorama",
  Antalya: "Antalya Kaleiçi marina panorama",
  Artvin: "Borçka Karagöl Artvin landscape",
  Aydın: "Aydın Kuşadası coastline panorama",
  Balıkesir: "Ayvalık Cunda Balıkesir panorama",
  Bilecik: "Bilecik Turkey city panorama",
  Bingöl: "Bingöl Turkey mountain landscape",
  Bitlis: "Bitlis Turkey city panorama",
  Bolu: "Lake Abant Bolu Turkey landscape",
  Burdur: "Lake Salda Burdur Turkey panorama",
  Bursa: "Bursa Ulu Cami city panorama",
  Çanakkale: "Çanakkale Dardanelles panorama Turkey",
  Çankırı: "Çankırı Turkey city panorama",
  Çorum: "Hattusa Çorum Turkey landscape",
  Denizli: "Pamukkale Denizli Turkey panorama",
  Diyarbakır: "Diyarbakır city walls panorama",
  Edirne: "Selimiye Mosque Edirne panorama",
  Elazığ: "Harput castle Elazığ panorama",
  Erzincan: "Kemaliye Erzincan Turkey landscape",
  Erzurum: "Erzurum Çifte Minareli Medrese panorama",
  Eskişehir: "Eskişehir Porsuk river Odunpazarı panorama",
  Gaziantep: "Gaziantep castle city panorama",
  Giresun: "Giresun city Black Sea panorama",
  Gümüşhane: "Gümüşhane Turkey mountain panorama",
  Hakkari: "Cilo mountains Hakkari Turkey landscape",
  Hatay: "Hatay Antakya Turkey panorama",
  Isparta: "Lake Eğirdir Isparta Turkey panorama",
  Mersin: "Kızkalesi Mersin Turkey panorama",
  İstanbul: "Istanbul Galata Tower Bosphorus panorama",
  İzmir: "Izmir Clock Tower Kordon panorama",
  Kars: "Ani ruins Kars Turkey panorama",
  Kastamonu: "Kastamonu castle city panorama",
  Kayseri: "Mount Erciyes Kayseri city panorama",
  Kırklareli: "Kırklareli Turkey landscape panorama",
  Kırşehir: "Kırşehir Turkey city panorama",
  Kocaeli: "İzmit Kocaeli coast city panorama",
  Konya: "Mevlana Museum Konya city panorama",
  Kütahya: "Kütahya castle city panorama",
  Malatya: "Malatya Turkey city panorama",
  Manisa: "Mount Spil Manisa city panorama",
  Kahramanmaraş: "Kahramanmaraş castle city panorama",
  Mardin: "Mardin old city Mesopotamia panorama",
  Muğla: "Ölüdeniz Muğla Turkey panorama",
  Muş: "Muş plain Turkey landscape panorama",
  Nevşehir: "Cappadocia Göreme Nevşehir panorama",
  Niğde: "Aladağlar Niğde Turkey mountain landscape",
  Ordu: "Ordu Boztepe Black Sea panorama",
  Rize: "Rize tea fields Black Sea panorama",
  Sakarya: "Lake Sapanca Sakarya panorama",
  Samsun: "Samsun coast city panorama Turkey",
  Siirt: "Botan valley Siirt Turkey landscape",
  Sinop: "Sinop harbor Black Sea panorama",
  Sivas: "Sivas Gök Medrese city panorama",
  Tekirdağ: "Tekirdağ coast Marmara panorama",
  Tokat: "Tokat castle city panorama Turkey",
  Trabzon: "Sümela Monastery Trabzon landscape",
  Tunceli: "Munzur valley Tunceli Turkey landscape",
  Şanlıurfa: "Balıklıgöl Şanlıurfa panorama",
  Uşak: "Ulubey Canyon Uşak Turkey panorama",
  Van: "Lake Van Akdamar Island panorama",
  Yozgat: "Yozgat Turkey city landscape panorama",
  Zonguldak: "Zonguldak Black Sea coast panorama",
  Aksaray: "Ihlara Valley Aksaray Turkey panorama",
  Bayburt: "Bayburt castle city panorama",
  Karaman: "Karaman castle city panorama Turkey",
  Kırıkkale: "Kırıkkale Turkey city panorama",
  Batman: "Hasankeyf Batman Turkey panorama",
  Şırnak: "Şırnak Cudi mountains Turkey landscape",
  Bartın: "Amasra Bartın Turkey panorama",
  Ardahan: "Lake Çıldır Ardahan Turkey landscape",
  Iğdır: "Iğdır Mount Ararat panorama Turkey",
  Yalova: "Yalova coast Marmara panorama",
  Karabük: "Safranbolu Karabük Turkey panorama",
  Kilis: "Kilis Turkey city panorama",
  Osmaniye: "Karatepe Aslantaş Osmaniye Turkey landscape",
  Düzce: "Akçakoca Düzce Black Sea panorama",
};

const searchOverrides = {
  Ankara: "Anıtkabir Ankara exterior",
  Antalya: "Antalya marina harbor",
  Bitlis: "Bitlis city view",
  Bursa: "Bursa panorama",
  Çorum: "Hattusa gate Çorum",
  Erzurum: "Erzurum city view",
  Hakkari: "Hakkari Cilo mountains",
  Hatay: "Antakya city view",
  Isparta: "Eğirdir lake Isparta",
  Kastamonu: "Kastamonu city view",
  Kırklareli: "Kırklareli city view",
  Kilis: "Kilis city view",
  Samsun: "Samsun panorama",
  Sivas: "Sivas city view",
  Tekirdağ: "Tekirdağ coast city",
  Yalova: "Yalova coast city",
  Karabük: "Safranbolu panorama",
  Düzce: "Akçakoca coast Düzce",
};

const rejected =
  /\b(map|flag|logo|coat|emblem|diagram|locator|districts|province|svg|icon|seal|blank|montage|museum|interior|courtyard|entrance|treasure|cat|poster|cannon|tile|relief|toilet|stadium|station|school|university|ship|navire|detail|fountain|grave)\b/i;
const endpoint = "https://commons.wikimedia.org/w/api.php";

async function findCover(city, query) {
  const generic = new Set([
    "turkey",
    "türkiye",
    "city",
    "panorama",
    "landscape",
    "river",
    "coast",
    "mountain",
    "mountains",
    "black",
    "sea",
    "marmara",
    "old",
    "mount",
    "lake",
  ]);
  const cityKey = city.toLocaleLowerCase("tr-TR");
  const landmark = query
    .split(/\s+/)
    .find(
      (word) =>
        word.toLocaleLowerCase("tr-TR") !== cityKey &&
        !generic.has(word.toLocaleLowerCase("tr-TR")),
    );
  const search =
    searchOverrides[city] ?? (landmark ? `${city} ${landmark}` : city);
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrnamespace: "6",
    gsrsearch: search,
    gsrlimit: "20",
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiurlwidth: "1600",
    format: "json",
    origin: "*",
  });
  let response;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    response = await fetch(`${endpoint}?${params}`, {
      headers: { "User-Agent": "OrtakSat/1.0 (support@ortaksat.com)" },
    });
    if (response.status !== 429) break;
    await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
  }
  if (!response.ok) throw new Error(`${city}: Commons ${response.status}`);
  const payload = await response.json();
  const candidates = Object.values(payload.query?.pages ?? {})
    .map((page) => ({ page, info: page.imageinfo?.[0] }))
    .filter(
      ({ page, info }) =>
        info?.thumburl &&
        info.width >= 1000 &&
        info.height >= 500 &&
        !rejected.test(page.title),
    );
  const ranked = candidates
    .map(({ page, info }) => {
      const ratio = info.width / info.height;
      const landscape =
        ratio >= 1.45 && ratio <= 3.4 ? 5 : ratio > 1.15 ? 2 : -5;
      const titleHit = page.title
        .toLocaleLowerCase("tr-TR")
        .includes(city.toLocaleLowerCase("tr-TR"))
        ? 3
        : 0;
      const mime =
        info.mime === "image/jpeg" ? 2 : info.mime === "image/webp" ? 1 : 0;
      const scenic =
        /panoram|skyline|view|landscape|şehir|city|göl|lake|coast|sahil|mountain|dağ/i.test(
          page.title,
        )
          ? 3
          : 0;
      return {
        page,
        info,
        score:
          landscape + titleHit + scenic + mime + Math.min(info.width / 2000, 2),
      };
    })
    .sort((a, b) => b.score - a.score);
  const picked = ranked[0];
  if (!picked) throw new Error(`${city}: uygun yatay fotoğraf bulunamadı`);
  const metadata = picked.info.extmetadata ?? {};
  return {
    city,
    query,
    title: picked.page.title.replace(/^File:/, ""),
    url: picked.info.thumburl,
    sourceUrl: picked.info.descriptionurl,
    width: picked.info.thumbwidth,
    height: picked.info.thumbheight,
    artist:
      metadata.Artist?.value
        ?.replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim() || null,
    license: metadata.LicenseShortName?.value || null,
  };
}

const entries = [];
for (const [city, query] of Object.entries(landmarks)) {
  entries.push(
    await findCover(city, query).catch((error) => ({
      city,
      query,
      error: error.message,
    })),
  );
  await new Promise((resolve) => setTimeout(resolve, 160));
}
const failed = entries.filter((entry) => entry.error);
if (Object.keys(landmarks).length !== 81)
  throw new Error(`İl sayısı 81 değil: ${Object.keys(landmarks).length}`);
if (failed.length)
  throw new Error(
    `Kapak bulunamayan iller: ${failed.map((entry) => `${entry.city} (${entry.error})`).join(", ")}`,
  );

await mkdir("data", { recursive: true });
await writeFile(
  "data/city-cover-manifest.json",
  `${JSON.stringify({ generatedAt: new Date().toISOString(), source: "Wikimedia Commons", entries }, null, 2)}\n`,
  "utf8",
);
console.log(`81 il için gerçek fotoğraf manifesti oluşturuldu.`);

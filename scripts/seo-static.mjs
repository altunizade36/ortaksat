// Statik export SEO düzeltmesi.
//
// SORUN: expo-router/head (`<Head>`/`<Seo>`) statik export'ta HTML'e YAZILMIYOR
// — her sayfa +html.tsx'teki varsayılan başlıkla çıkıyor. Bu, JS çalıştırmayan
// crawler'lar (WhatsApp/Twitter/Facebook/LinkedIn/Slack + Bing ilk tarama) için
// TÜM sayfaların aynı başlık/açıklamayı göstermesi demek. Referans linki paylaşımı
// bu platformun büyüme motoru olduğundan bu kritik.
//
// ÇÖZÜM: export'tan sonra her bilinen statik rotanın HTML'indeki <title>, meta
// description, canonical ve OG/Twitter etiketlerini gerçek/benzersiz değerlerle
// güncelleriz. Dinamik /listing/:id zaten middleware.ts ile crawler'lara özel
// meta veriyor; burası statik landing/bilgi/blog sayfalarını kapsar.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "..", "dist-web");
const BASE = "https://www.ortaksat.com";
const OG_IMG = `${BASE}/og-cover.png`;

// Her rota: dosya adı → { title, description, canonical, noindex?, jsonld? }
// Başlıklar benzersiz + anahtar-kelime odaklı; açıklamalar 150-165 karakter.
const ROUTES = {
  "index.html": {
    title: "OrtakSat — Ortak satışla kazan: ilan ver, paylaş, komisyon al",
    description:
      "İlanını ücretsiz aç, ortaklar kendi yöntemiyle tanıtsın, satış gerçekleşince komisyon kazan. Emlak, vasıta, elektronik, moda ve daha fazlası tek platformda.",
    canonical: "/"
  },
  "explore.html": {
    title: "İlanları keşfet — Emlak, vasıta, elektronik, moda | OrtakSat",
    description:
      "Binlerce ilan arasında ara ve filtrele; beğendiğin ürüne ortak ol, kendi yönteminle tanıt, satışta komisyon kazan. OrtakSat'ta keşfet.",
    canonical: "/explore"
  },
  "kategoriler.html": {
    title: "Tüm kategoriler — Emlak, vasıta, elektronik, ev & yaşam | OrtakSat",
    description:
      "OrtakSat'taki tüm kategorileri keşfet: emlak, vasıta, elektronik, moda, ev & yaşam, anne & bebek, spor ve daha fazlası. İlan ver ya da ortak ol, kazan.",
    canonical: "/kategoriler"
  },
  "create.html": {
    title: "Ücretsiz ilan ver — Komisyonunu belirle, ortakların sattırsın | OrtakSat",
    description:
      "İlanını dakikalar içinde oluştur, ortaklara vereceğin komisyonu belirle. Ortaklar ürününü paylaşsın, sen sadece satış gerçekleştiğinde komisyon öde.",
    canonical: "/create"
  },
  "partner.html": {
    title: "Ortak ol — Ürün paylaş, satışta komisyon kazan | OrtakSat",
    description:
      "Sermaye yok, stok yok, risk yok. Beğendiğin ürüne ortak ol, kendi yönteminle tanıt, sattığında komisyonunu kazan. Ücretsiz, zorunlu link/takip yok.",
    canonical: "/partner"
  },
  "ortak-kazanc.html": {
    title: "Ortak kazancı nasıl işler? Referansla komisyon rehberi | OrtakSat",
    description:
      "Ortak olarak nasıl para kazanırsın? Referans linki, komisyon oranı, ödeme takibi ve ipuçları. Takipçilerin veya çevrenle satış yaptır, komisyon al.",
    canonical: "/ortak-kazanc"
  },
  "satici-ol.html": {
    title: "Satıcı ol — Ürününü ortaklarla daha çok kişiye sattır | OrtakSat",
    description:
      "İlanını aç, komisyonunu belirle, yüzlerce ortak ürününü paylaşsın. Reklam bütçesi yakmadan, yalnız satış olduğunda komisyon ödeyerek büyü.",
    canonical: "/satici-ol"
  },
  "influencer-kazanc.html": {
    title: "Influencer kazancı — Takipçilerinle komisyon kazan | OrtakSat",
    description:
      "Instagram, TikTok, YouTube veya WhatsApp gruplarındaki kitleni gelire dönüştür. Ürün seç, kendi yönteminle tanıt, satışta komisyon kazan.",
    canonical: "/influencer-kazanc"
  },
  "alici.html": {
    title: "Alıcılar için — Güvenli, şeffaf ve avantajlı alışveriş | OrtakSat",
    description:
      "OrtakSat'ta ürünleri keşfet, satıcı ve ortaklarla güvenle iletişim kur. Şeffaf komisyon, doğrulanmış satıcılar ve güven odaklı bir pazar.",
    canonical: "/alici"
  },
  "trust.html": {
    title: "Güven Merkezi — Doğrulama, şeffaflık ve şikayet | OrtakSat",
    description:
      "Satıcı/ortak doğrulama, güven puanı, şikayet yönetimi ve şeffaf süreçler. OrtakSat'ı güvenli bir ortak satış ortamı yapan ilkeler ve araçlar.",
    canonical: "/trust"
  },
  "guvenli-alisveris.html": {
    title: "Güvenli alışveriş rehberi — Dolandırıcılıktan korun | OrtakSat",
    description:
      "Ödeme, teslimat ve iletişimde nelere dikkat etmelisin? OrtakSat'ta güvenli alışveriş için pratik ipuçları ve kırmızı bayraklar.",
    canonical: "/guvenli-alisveris"
  },
  "nasil-calisir.html": {
    title: "OrtakSat nasıl çalışır? Satıcı, ortak ve alıcı için | OrtakSat",
    description:
      "İlan aç, ortaklar paylaşsın, satışta komisyon dağılsın. OrtakSat'ın ortak satış modelini adım adım anlatan basit rehber.",
    canonical: "/nasil-calisir"
  },
  "hakkimizda.html": {
    title: "Hakkımızda — OrtakSat ortak satış pazaryeri",
    description:
      "OrtakSat; satıcıyı, ortağı ve alıcıyı buluşturan bir ortak satış pazaryeridir. Misyonumuz, şeffaf komisyonla herkese kazandıran güvenli bir pazar kurmak.",
    canonical: "/hakkimizda"
  },
  "iletisim.html": {
    title: "İletişim ve destek — destek@ortaksat.com | OrtakSat",
    description:
      "OrtakSat ile iletişime geç: destek, şikayet, dolandırıcılık bildirimi ve KVKK talepleri için destek@ortaksat.com. Sorularını yanıtlıyoruz.",
    canonical: "/iletisim"
  },
  "sss.html": {
    title: "Sıkça Sorulan Sorular — Komisyon, ortaklık, ödeme | OrtakSat",
    description:
      "OrtakSat hakkında merak edilenler: komisyon kim belirler, ortaklık ücretli mi, ödemeni nasıl alırsın, hangi ürünler satılabilir? Cevaplar burada.",
    canonical: "/sss",
    jsonld: faqJsonLd()
  },
  "blog.html": {
    title: "Blog — Ortak satış, komisyon ve e-ticaret rehberleri | OrtakSat",
    description:
      "Ortak satış, komisyonla kazanç, influencer pazarlaması ve güvenli e-ticaret üzerine pratik rehberler ve gerçek ipuçları. OrtakSat blog.",
    canonical: "/blog"
  },
  "legal.html": {
    title: "Yasal & Destek — Sözleşmeler, KVKK, gizlilik | OrtakSat",
    description:
      "OrtakSat kullanıcı sözleşmesi, gizlilik politikası, KVKK aydınlatma metni ve mesafeli hizmet koşulları. Tüm yasal belgeler tek sayfada.",
    canonical: "/legal"
  },
  "kvkk.html": {
    title: "KVKK ve Veri Talepleri — Kişisel veri hakların | OrtakSat",
    description:
      "Kişisel verilerinin işlenmesi, saklanması ve haklarının kullanımı. KVKK kapsamında veri talebi için destek@ortaksat.com üzerinden başvurabilirsin.",
    canonical: "/kvkk"
  }
};

// Arama sonuçlarına girmemesi gereken hesap/aksiyon sayfaları → noindex.
const NOINDEX = [
  "auth.html", "admin.html", "profile.html", "profile-edit.html", "favorites.html",
  "notifications.html", "notifications-tab.html", "earnings.html", "messages.html",
  "menu.html", "hosgeldin.html", "seller.html", "create-action.html", "trust-action.html"
];

function faqJsonLd() {
  const faq = [
    ["ortaksat ürünü kendisi mi satıyor?", "Hayır. ortaksat alıcıyı satıcıya ve ortağa bağlayan bir pazardır. Satış ve teslimat satıcı ile alıcı arasında gerçekleşir; platform süreci ve komisyonu takip eder."],
    ["Ortak olmak için ücret ödüyor muyum?", "Hayır. Ortaklık ücretsizdir. Sadece satış gerçekleştiğinde, satıcının ilanında belirttiği komisyonu kazanırsın."],
    ["Komisyonu kim belirler?", "Komisyon oranını veya sabit tutarını ilanı açan satıcı belirler. Ortak, bağlantıyı paylaşmadan önce kazancını ilan detayında görür."],
    ["Hangi ürünler satılabilir?", "Yasal her ürün ve hizmet: emlak, elektronik, moda, ev & yaşam, anne & bebek, spor, hediye ve daha fazlası. Yasak veya sahte ürünler moderasyon tarafından kaldırılır."],
    ["Ödememi nasıl alırım?", "Kazandığın komisyonlar ortak panelinde bekliyor/onaylandı/ödendi olarak listelenir. Ödeme akışı ilk sürümde manuel takip edilir; ödeme sağlayıcı entegrasyonu yol haritasındadır."]
  ];
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } }))
  });
}

const escText = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => escText(s).replace(/"/g, "&quot;");

// property="og:title" veya name="description" içeren <meta> etiketinin content'ini değiştir.
function setMeta(html, attr, key, content) {
  const re = new RegExp(`<meta\\b[^>]*\\b${attr}="${key}"[^>]*>`, "i");
  return html.replace(re, (tag) => {
    if (/content="/i.test(tag)) return tag.replace(/content="[^"]*"/i, `content="${escAttr(content)}"`);
    return tag.replace(/\s*\/?>\s*$/, ` content="${escAttr(content)}">`);
  });
}

function patch(file, meta) {
  const fp = path.join(DIST, file);
  if (!fs.existsSync(fp)) return false;
  let html = fs.readFileSync(fp, "utf8");
  const { title, description, canonical, noindex, jsonld } = meta;

  if (title) {
    html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escText(title)}</title>`);
    html = setMeta(html, "property", "og:title", title);
    html = setMeta(html, "name", "twitter:title", title);
  }
  if (description) {
    html = setMeta(html, "name", "description", description);
    html = setMeta(html, "property", "og:description", description);
    html = setMeta(html, "name", "twitter:description", description);
  }

  const inject = [];
  if (canonical) {
    const url = canonical === "/" ? BASE : `${BASE}${canonical}`;
    html = setMeta(html, "property", "og:url", url);
    if (!/rel="canonical"/i.test(html)) inject.push(`<link rel="canonical" href="${escAttr(url)}"/>`);
  }
  if (noindex && !/name="robots"/i.test(html)) inject.push('<meta name="robots" content="noindex, follow"/>');
  if (jsonld) inject.push(`<script type="application/ld+json">${jsonld}</script>`);

  if (inject.length) html = html.replace(/<\/head>/i, `${inject.join("")}</head>`);

  fs.writeFileSync(fp, html, "utf8");
  return true;
}

// lib/blog.ts'ten slug + title + excerpt + author + date + image çıkar (statik blog SEO'su).
// Blok-tabanlı: her `slug:` ile bir sonrakine kadarki metinden alanları tek tek çeker
// (bazı alanlar eksik olsa da yazı atlanmaz).
const TR_MONTHS = { ocak: "01", "şubat": "02", subat: "02", mart: "03", nisan: "04", "mayıs": "05", mayis: "05", haziran: "06", temmuz: "07", "ağustos": "08", agustos: "08", "eylül": "09", eylul: "09", "ekim": "10", "kasım": "11", kasim: "11", "aralık": "12", aralik: "12" };
function trDateToIso(s) {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{1,2})\s+([A-Za-zçÇğĞıİöÖşŞüÜ]+)\s+(\d{4})$/);
  if (!m) return null;
  const mo = TR_MONTHS[m[2].toLocaleLowerCase("tr-TR")];
  if (!mo) return null;
  return `${m[3]}-${mo}-${String(m[1]).padStart(2, "0")}`;
}
const unesc = (s) => (s == null ? s : s.replace(/\\"/g, '"'));
function field(block, key, re) {
  const m = block.match(re);
  return m ? unesc(m[1]) : null;
}
function blogPosts() {
  try {
    const src = fs.readFileSync(path.join(__dirname, "..", "lib", "blog.ts"), "utf8");
    const posts = [];
    const slugRe = /slug:\s*"([^"]+)"/g;
    const marks = [];
    let sm;
    while ((sm = slugRe.exec(src))) marks.push({ slug: sm[1], idx: sm.index });
    for (let i = 0; i < marks.length; i++) {
      const block = src.slice(marks[i].idx, i + 1 < marks.length ? marks[i + 1].idx : marks[i].idx + 4000);
      const title = field(block, "title", /title:\s*"((?:[^"\\]|\\.)*)"/);
      const excerpt = field(block, "excerpt", /excerpt:\s*"((?:[^"\\]|\\.)*)"/);
      if (!title || !excerpt) continue;
      posts.push({
        slug: marks[i].slug,
        title,
        excerpt,
        author: field(block, "author", /author:\s*"((?:[^"\\]|\\.)*)"/) || "OrtakSat Editör Ekibi",
        date: field(block, "date", /date:\s*"([^"]+)"/),
        imageId: field(block, "image", /image:\s*img\("([^"]+)"\)/)
      });
    }
    return posts;
  } catch {
    return [];
  }
}

// Blog yazısı için BlogPosting + BreadcrumbList JSON-LD (tek <script>'te dizi olarak).
function blogArticleLd(p) {
  const url = `${BASE}/blog/${p.slug}`;
  const iso = trDateToIso(p.date);
  const image = p.imageId ? `https://images.unsplash.com/photo-${p.imageId}?w=1200&q=80&auto=format&fit=crop` : OG_IMG;
  const article = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: p.title,
    description: p.excerpt,
    image,
    author: { "@type": "Organization", name: p.author, url: BASE },
    publisher: { "@type": "Organization", name: "OrtakSat", logo: { "@type": "ImageObject", url: `${BASE}/icon.png` } },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: "tr-TR",
    ...(iso ? { datePublished: iso, dateModified: iso } : {})
  };
  const crumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Ana Sayfa", item: `${BASE}/` },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${BASE}/blog` },
      { "@type": "ListItem", position: 3, name: p.title, item: url }
    ]
  };
  return JSON.stringify([article, crumbs]);
}

// --- Dinamik landing sayfaları (kategori + şehir): expo-router/head data-rh
// etiketlerini TEK VE TEMİZ hale getir + yapısal veri (Breadcrumb/CollectionPage/FAQ)
// enjekte et. Bu ~176 sayfa (56 kategori + ~120 şehir) SEO'nun en büyük fırsatı:
// önceden generic dublike <title>/description ile çıkıyorlardı. ---

// HTML entity'lerini düz metne çöz — data-rh değerleri zaten HTML-escaped'dir;
// escText/escAttr yeniden encode edeceği için önce çözmezsek çift-encode olur
// (ör. "İstanbul&#x27;da" → "İstanbul&amp;#x27;da").
function decodeEntities(s) {
  return s == null ? s : s
    .replace(/&#x27;/gi, "'").replace(/&#39;/g, "'").replace(/&apos;/gi, "'")
    .replace(/&quot;/gi, '"').replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&"); // &amp; EN SON (aksi halde &amp;#x27; yanlış çözülür)
}

// react-helmet (expo-router/head) data-rh etiketinden gerçek/hesaplanmış değeri çek (entity çözülmüş).
function extractRh(html, re) {
  const m = html.match(re);
  return m ? decodeEntities(m[1]) : null;
}

// Bir dinamik sayfanın TÜM SEO head'ini yeniden yaz: dublike title/desc/og temizle,
// tek temiz set + canonical + robots(index) + JSON-LD dizisi enjekte et.
function rewriteSeoHead(fp, { title, description, canonicalUrl, jsonld, noindex }) {
  if (!fs.existsSync(fp)) return false;
  let html = fs.readFileSync(fp, "utf8");

  // 1) Tüm <title>…</title> (generic + data-rh) ve ilgili meta/canonical/robots'ları SİL.
  html = html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, "");
  html = html.replace(/<meta\b[^>]*\bname="description"[^>]*>/gi, "");
  html = html.replace(/<meta\b[^>]*\bname="robots"[^>]*>/gi, "");
  html = html.replace(/<meta\b[^>]*\bproperty="og:(?:title|description|url)"[^>]*>/gi, "");
  html = html.replace(/<meta\b[^>]*\bname="twitter:(?:title|description|image|card)"[^>]*>/gi, "");
  html = html.replace(/<link\b[^>]*\brel="canonical"[^>]*>/gi, "");

  // 2) Tek temiz SEO bloğu kur.
  const block = [
    `<title>${escText(title)}</title>`,
    `<meta name="description" content="${escAttr(description)}"/>`,
    `<link rel="canonical" href="${escAttr(canonicalUrl)}"/>`,
    `<meta name="robots" content="${noindex ? "noindex, follow" : "index, follow"}"/>`,
    `<meta property="og:title" content="${escAttr(title)}"/>`,
    `<meta property="og:description" content="${escAttr(description)}"/>`,
    `<meta property="og:url" content="${escAttr(canonicalUrl)}"/>`,
    `<meta name="twitter:card" content="summary_large_image"/>`,
    `<meta name="twitter:title" content="${escAttr(title)}"/>`,
    `<meta name="twitter:description" content="${escAttr(description)}"/>`,
    `<meta name="twitter:image" content="${escAttr(OG_IMG)}"/>`,
    ...jsonld.map((j) => `<script type="application/ld+json">${j}</script>`)
  ].join("");

  html = html.replace(/<\/head>/i, `${block}</head>`);
  fs.writeFileSync(fp, html, "utf8");
  return true;
}

const RH_TITLE = /<title data-rh="true">([^<]*)<\/title>/i;
const RH_DESC = /<meta data-rh="true" name="description" content="([^"]*)"/i;

function breadcrumbLd(items) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: it.url }))
  });
}
function collectionLd(name, description, url, crumbs) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description,
    url,
    isPartOf: { "@type": "WebSite", name: "OrtakSat", url: BASE },
    breadcrumb: { "@type": "BreadcrumbList", itemListElement: crumbs.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: it.url })) }
  });
}
function catFaqLd(label) {
  const faq = [
    [`${label} ilanları OrtakSat'ta nasıl satılır?`, "İlanını ücretsiz eklersin ve komisyon oranını kendin belirlersin. Ortaklar ürününü kendi takipçisiyle paylaşır; satış olursa komisyonu anlaştığın kanaldan doğrudan ortağa ödersin. Ödeme ve teslimat alıcı ile satıcı arasında yapılır."],
    [`${label} kategorisinde komisyon oranını kim belirler?`, "İlanı açan satıcı belirler — yüzde (%) veya sabit tutar (₺) olarak. Ortak, paylaşmadan önce kazancını ilanda net görür."],
    [`OrtakSat ${label.toLocaleLowerCase("tr-TR")} alım satımında ödeme veya kargo yapar mı?`, "Hayır. OrtakSat aracı bir ilan ve eşleşme platformudur; para tutmaz, kargo yapmaz. Ödeme ve teslimatı alıcı ile satıcı kendi arasında yapar."],
    [`${label} ürününü ortak olarak nasıl paylaşırım?`, "Ürüne ortak olursun; satıcı onaylayınca ürünü Instagram, TikTok veya WhatsApp'ta KENDİ yönteminle tanıtırsın. Sattığında anlaştığın komisyonu satıcıdan alırsın. Zorunlu link veya takip yoktur."]
  ];
  return JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) });
}

// slug → okunur etiket (data-rh yoksa yedek). Örn "cep-telefonu" → "Cep Telefonu".
function slugToLabel(slug) {
  return slug.split("-").map((w) => (w ? w[0].toLocaleUpperCase("tr-TR") + w.slice(1) : w)).join(" ");
}

function patchCategoryHub(fp, slug) {
  const html = fs.readFileSync(fp, "utf8");
  const rhTitle = extractRh(html, RH_TITLE);
  const label = rhTitle ? rhTitle.replace(/ ilanları — Ortak satış \| OrtakSat$/, "").trim() : slugToLabel(slug);
  const title = rhTitle || `${label} ilanları — Ortak satış | OrtakSat`;
  const description = extractRh(html, RH_DESC) || `${label} kategorisindeki ortak satış ilanlarını keşfet. Komisyonlu ürünleri incele, ortak ol ve kazan. OrtakSat aracıdır; ödeme ve teslimat taraflar arasındadır.`;
  const url = `${BASE}/kategori/${slug}`;
  const crumbs = [
    { name: "Ana Sayfa", url: `${BASE}/` },
    { name: "Kategoriler", url: `${BASE}/kategoriler` },
    { name: label, url }
  ];
  return rewriteSeoHead(fp, { title, description, canonicalUrl: url, jsonld: [breadcrumbLd(crumbs), collectionLd(title, description, url, crumbs), catFaqLd(label)] });
}

function patchCityPage(fp, slug, citySlug) {
  const html = fs.readFileSync(fp, "utf8");
  const rhTitle = extractRh(html, RH_TITLE);
  let city = slugToLabel(citySlug), label = slugToLabel(slug);
  const m = rhTitle && rhTitle.match(/^(.*?)['’]da Komisyonla (.*?) İlanları \| OrtakSat$/);
  if (m) { city = m[1]; label = m[2]; }
  const title = rhTitle || `${city}'da Komisyonla ${label} İlanları | OrtakSat`;
  const description = extractRh(html, RH_DESC) || `${city}'da komisyonlu ${label.toLocaleLowerCase("tr-TR")} ürünlerini keşfet. ${city} için ${label} kategorisindeki ortak satış ilanlarını incele, ortak ol ve kazan. OrtakSat aracıdır; ödeme ve teslimat taraflar arasındadır.`;
  const url = `${BASE}/kategori/${slug}/${citySlug}`;
  const crumbs = [
    { name: "Ana Sayfa", url: `${BASE}/` },
    { name: "Kategoriler", url: `${BASE}/kategoriler` },
    { name: label, url: `${BASE}/kategori/${slug}` },
    { name: `${city} ${label}`, url }
  ];
  // Şehir×kategori sayfaları gerçek ilan olmadan ince/yinelenen içerik → noindex
  // (yine de follow: kategori hub'ına link akışı korunur). İlan geldikçe kaldırılacak.
  return rewriteSeoHead(fp, { title, description, canonicalUrl: url, jsonld: [breadcrumbLd(crumbs), collectionLd(title, description, url, crumbs)], noindex: true });
}

// Export yapısı: kategori/<slug>/index.html = HUB, kategori/<slug>/<sehir>.html = şehir.
// (kategori/[slug] ve kategori/[slug].html dinamik fallback şablonlarıdır → atla.)
function patchDynamicSeo() {
  const katDir = path.join(DIST, "kategori");
  if (!fs.existsSync(katDir)) return { hubs: 0, cities: 0 };
  let hubs = 0, cities = 0;

  for (const slug of fs.readdirSync(katDir)) {
    if (slug.startsWith("[")) continue; // [slug] / [slug].html fallback şablonları
    const sub = path.join(katDir, slug);
    if (!fs.statSync(sub).isDirectory()) continue;
    for (const f of fs.readdirSync(sub)) {
      if (!f.endsWith(".html")) continue;
      const fp = path.join(sub, f);
      if (f === "index.html") {
        if (patchCategoryHub(fp, slug)) hubs++;
      } else {
        if (patchCityPage(fp, slug, f.replace(/\.html$/, ""))) cities++;
      }
    }
  }
  return { hubs, cities };
}

export function patchSeo() {
  let n = 0;
  for (const [file, meta] of Object.entries(ROUTES)) if (patch(file, meta)) n++;
  for (const file of NOINDEX) if (patch(file, { noindex: true })) n++;

  let blogN = 0;
  for (const p of blogPosts()) {
    const title = `${p.title} | OrtakSat Blog`;
    if (patch(path.join("blog", `${p.slug}.html`), { title, description: p.excerpt, canonical: `/blog/${p.slug}`, jsonld: blogArticleLd(p) })) blogN++;
  }

  const dyn = patchDynamicSeo();

  console.log(`post-export: SEO meta yazıldı — ${n} statik rota + ${blogN} blog yazısı + ${dyn.hubs} kategori + ${dyn.cities} şehir sayfası`);
}

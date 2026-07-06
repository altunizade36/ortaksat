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
const BASE = "https://ortaksat.com";
const OG_IMG = `${BASE}/og-cover.png`;

// Her rota: dosya adı → { title, description, canonical, noindex?, jsonld? }
// Başlıklar benzersiz + anahtar-kelime odaklı; açıklamalar 150-165 karakter.
const ROUTES = {
  "index.html": {
    title: "OrtakSat — Ortak satışla kazan: ilan ver, paylaş, komisyon al",
    description:
      "İlanını ücretsiz aç, ortakların referans linkiyle paylaşsın, satış gerçekleşince komisyon kazan. Emlak, vasıta, elektronik, moda ve daha fazlası tek platformda.",
    canonical: "/"
  },
  "explore.html": {
    title: "İlanları keşfet — Emlak, vasıta, elektronik, moda | OrtakSat",
    description:
      "Binlerce ilan arasında ara ve filtrele; beğendiğin ürüne ortak ol, referans linkinle paylaş, satışta komisyon kazan. OrtakSat'ta keşfet.",
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
      "Sermaye yok, stok yok, risk yok. Beğendiğin ürünün referans linkini paylaş, alıcı senin linkinle alışveriş yapınca komisyonunu kazan. Ücretsiz ortak ol.",
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
      "Instagram, TikTok, YouTube veya WhatsApp gruplarındaki kitleni gelire dönüştür. Ürün seç, referans linkini paylaş, satışta komisyon kazan.",
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

// lib/blog.ts'ten slug + title + excerpt çıkar (statik blog SEO'su).
function blogPosts() {
  try {
    const src = fs.readFileSync(path.join(__dirname, "..", "lib", "blog.ts"), "utf8");
    const posts = [];
    const re = /slug:\s*"([^"]+)"[\s\S]{0,400}?title:\s*"((?:[^"\\]|\\.)*)"[\s\S]{0,600}?excerpt:\s*"((?:[^"\\]|\\.)*)"/g;
    let m;
    while ((m = re.exec(src))) {
      posts.push({ slug: m[1], title: m[2].replace(/\\"/g, '"'), excerpt: m[3].replace(/\\"/g, '"') });
    }
    return posts;
  } catch {
    return [];
  }
}

export function patchSeo() {
  let n = 0;
  for (const [file, meta] of Object.entries(ROUTES)) if (patch(file, meta)) n++;
  for (const file of NOINDEX) if (patch(file, { noindex: true })) n++;

  let blogN = 0;
  for (const p of blogPosts()) {
    const title = `${p.title} | OrtakSat Blog`;
    if (patch(path.join("blog", `${p.slug}.html`), { title, description: p.excerpt, canonical: `/blog/${p.slug}` })) blogN++;
  }

  console.log(`post-export: SEO meta yazıldı — ${n} statik rota + ${blogN} blog yazısı`);
}

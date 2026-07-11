// Vercel Edge Middleware — sosyal medya crawler'ları için per-sayfa OG meta enjekte eder.
// WhatsApp/Facebook/Twitter/LinkedIn JS çalıştırmaz; bu yüzden /listing/:id ve
// /kategori/:slug(/:sehir) için gerçek başlık/görsel/açıklama içeren HTML döneriz.
// GERÇEK KULLANICI ETKİLENMEZ (crawler değilse veya herhangi bir hata olursa istek
// aynen uygulamaya geçer). Kategori/şehir başlıkları slug→ad haritalarından (DB'siz)
// deterministik üretilir; ilan başlığı Supabase'ten çekilir.

import categoryMap from "./data/category-og-map.json";

// NOT: /kategori/* MATCHER'DAN ÇIKARILDI (2026-07-12). Kategori/şehir sayfaları artık
// statik export'ta TAM SEO'ya sahip (benzersiz title + canonical + BreadcrumbList +
// CollectionPage + FAQPage JSON-LD; bkz scripts/seo-static.mjs). Middleware Googlebot'a
// bunları ZAYIF/minimal HTML ile eziyordu → statik zengin HTML'i görsün diye kaldırıldı.
// İlan (/listing) ve mağaza (/store) DİNAMİKTİR (statik içerik yok) → middleware şart.
export const config = { matcher: ["/listing/:id*", "/store/:id*"] };

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://akyzzdwbzgsnhdircuce.supabase.co";
const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "";

const CRAWLER = /facebookexternalhit|Facebot|Twitterbot|WhatsApp|Slackbot|TelegramBot|LinkedInBot|Discordbot|Pinterest|redditbot|Googlebot|bingbot|Applebot|vkShare|SkypeUriPreview/i;

const CATEGORY_MAP = categoryMap as Record<string, string>;
// Kategori adı → slug (breadcrumb linki için). categoryMap slug→ad; tersini kur.
const CAT_NAME_TO_SLUG: Record<string, string> = {};
for (const [slug, name] of Object.entries(CATEGORY_MAP)) if (!(name in CAT_NAME_TO_SLUG)) CAT_NAME_TO_SLUG[name] = slug;
const OG_COVER = "https://www.ortaksat.com/og-cover.png";

function esc(s: string): string {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

// JSON-LD'yi <script> içinde güvenli göm (</script> enjeksiyonunu engelle).
function ld(obj: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/<\/(script)/gi, "<\\/$1")}</script>`;
}

function page(title: string, desc: string, image: string, pageUrl: string, ogType: string, extraHead = "", bodyHtml = ""): Response {
  const t = esc(title), d = esc(desc), img = esc(image), u = esc(pageUrl);
  const body = bodyHtml || `<a href="${u}">${t}</a>`;
  const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8" />
<title>${t}</title>
<meta name="description" content="${d}" />
<link rel="canonical" href="${u}" />
<meta property="og:type" content="${ogType}" />
<meta property="og:site_name" content="OrtakSat" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:image" content="${img}" />
<meta property="og:url" content="${u}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${img}" />
${extraHead}</head><body>${body}</body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=600" } });
}

async function listingResponse(id: string): Promise<Response | undefined> {
  if (!id || !SUPABASE_KEY) return;
  const api = `${SUPABASE_URL}/rest/v1/listing_public_cards?id=eq.${encodeURIComponent(id)}&select=title,description,price,image_url,category,stock_count,currency,commission_tl,review_count&limit=1`;
  const res = await fetch(api, { headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!res.ok) return;
  const rows = (await res.json()) as Array<{ title: string; description: string; price: number; image_url: string | null; category: string | null; stock_count: number | null; currency: string | null; commission_tl: number | null; review_count: number | null }>;
  const l = rows && rows[0];
  if (!l) return;
  const url = `https://www.ortaksat.com/listing/${id}`;
  const image = l.image_url || OG_COVER;
  const currency = l.currency || "TRY";
  const priceStr = Number(l.price || 0).toLocaleString("tr-TR");
  const commTl = Number(l.commission_tl || 0);
  const commissionHint = commTl > 0 ? ` Ortak ol, ₺${commTl.toLocaleString("tr-TR")} komisyon kazan.` : "";
  const title = `${l.title} — ₺${priceStr} | OrtakSat`;
  const desc = `₺${priceStr}.${commissionHint} ${(l.description || "").replace(/\s+/g, " ")}`.trim().slice(0, 185);
  const inStock = (l.stock_count ?? 1) > 0;

  // Product + Offer JSON-LD (Google fiyat/stok zengin sonucu) + BreadcrumbList.
  const product: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: l.title,
    description: (l.description || "").replace(/\s+/g, " ").slice(0, 500),
    image,
    ...(l.category ? { category: l.category } : {}),
    offers: {
      "@type": "Offer",
      price: Number(l.price || 0),
      priceCurrency: currency,
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url,
      seller: { "@type": "Organization", name: "OrtakSat" }
    }
  };
  const catSlug = l.category ? CAT_NAME_TO_SLUG[l.category] : undefined;
  const crumbEls: Array<Record<string, unknown>> = [{ "@type": "ListItem", position: 1, name: "Ana Sayfa", item: "https://www.ortaksat.com/" }];
  if (catSlug && l.category) crumbEls.push({ "@type": "ListItem", position: 2, name: l.category, item: `https://www.ortaksat.com/kategori/${catSlug}` });
  crumbEls.push({ "@type": "ListItem", position: crumbEls.length + 1, name: l.title, item: url });
  const breadcrumb = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: crumbEls };

  // Facebook/Pinterest ürün kartı fiyat etiketleri.
  const priceOg = `<meta property="product:price:amount" content="${Number(l.price || 0)}" /><meta property="product:price:currency" content="${esc(currency)}" /><meta property="og:price:amount" content="${Number(l.price || 0)}" /><meta property="og:price:currency" content="${esc(currency)}" /><meta property="product:availability" content="${inStock ? "in stock" : "out of stock"}" />`;

  // Gerçek indekslenebilir gövde (JS render'a bağlı kalmadan içerik). Crawler bunu okur.
  const crumbHtml = catSlug && l.category
    ? `<nav><a href="https://www.ortaksat.com/">Ana Sayfa</a> › <a href="https://www.ortaksat.com/kategori/${esc(catSlug)}">${esc(l.category)}</a> › ${esc(l.title)}</nav>`
    : `<nav><a href="https://www.ortaksat.com/">Ana Sayfa</a> › ${esc(l.title)}</nav>`;
  const body = `${crumbHtml}<h1>${esc(l.title)}</h1><p><strong>₺${esc(priceStr)}</strong>${commTl > 0 ? ` · Ortak ol, ₺${esc(commTl.toLocaleString("tr-TR"))} komisyon kazan` : ""}${inStock ? "" : " · Stokta yok"}</p><p>${esc((l.description || "").replace(/\s+/g, " ").slice(0, 400))}</p>${image !== OG_COVER ? `<img src="${esc(image)}" alt="${esc(l.title)}" width="600" />` : ""}<p><a href="${esc(url)}">İlanı OrtakSat'ta görüntüle →</a></p>`;

  return page(title, desc, image, url, "product", `${priceOg}${ld(product)}${ld(breadcrumb)}`, body);
}

async function storeResponse(id: string): Promise<Response | undefined> {
  if (!id || !SUPABASE_KEY) return;
  const api = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=full_name&limit=1`;
  const res = await fetch(api, { headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!res.ok) return;
  const rows = (await res.json()) as Array<{ full_name: string | null }>;
  const name = rows && rows[0] && rows[0].full_name;
  if (!name) return;
  return page(
    `${name} — OrtakSat mağazası`,
    `${name} satıcısının OrtakSat mağazası. Komisyonlu ürünlerini keşfet, ortak ol ve birlikte kazan. OrtakSat aracıdır; ödeme ve teslimat taraflar arasındadır.`,
    OG_COVER,
    `https://www.ortaksat.com/store/${id}`,
    "profile"
  );
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  try {
    const ua = request.headers.get("user-agent") || "";
    if (!CRAWLER.test(ua)) return; // gerçek kullanıcı: uygulamaya geç

    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);

    if (parts[0] === "listing") {
      return await listingResponse(parts[parts.length - 1] || "");
    }
    if (parts[0] === "store" && parts[1]) {
      return await storeResponse(parts[1]);
    }
    return;
  } catch {
    return; // her hata: uygulamaya geç
  }
}

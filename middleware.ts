// Vercel Edge Middleware — sosyal medya crawler'ları için per-sayfa OG meta enjekte eder.
// WhatsApp/Facebook/Twitter/LinkedIn JS çalıştırmaz; bu yüzden /listing/:id ve
// /kategori/:slug(/:sehir) için gerçek başlık/görsel/açıklama içeren HTML döneriz.
// GERÇEK KULLANICI ETKİLENMEZ (crawler değilse veya herhangi bir hata olursa istek
// aynen uygulamaya geçer). Kategori/şehir başlıkları slug→ad haritalarından (DB'siz)
// deterministik üretilir; ilan başlığı Supabase'ten çekilir.

import categoryMap from "./data/category-og-map.json";
import cityMap from "./data/city-og-map.json";

export const config = { matcher: ["/listing/:id*", "/kategori/:path*"] };

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://akyzzdwbzgsnhdircuce.supabase.co";
const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "";

const CRAWLER = /facebookexternalhit|Facebot|Twitterbot|WhatsApp|Slackbot|TelegramBot|LinkedInBot|Discordbot|Pinterest|redditbot|Googlebot|bingbot|Applebot|vkShare|SkypeUriPreview/i;

const CATEGORY_MAP = categoryMap as Record<string, string>;
const CITY_MAP = cityMap as Record<string, string>;
const OG_COVER = "https://www.ortaksat.com/og-cover.png";

function esc(s: string): string {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function page(title: string, desc: string, image: string, pageUrl: string, ogType: string): Response {
  const t = esc(title), d = esc(desc), img = esc(image), u = esc(pageUrl);
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
</head><body><a href="${u}">${t}</a></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=600" } });
}

async function listingResponse(id: string): Promise<Response | undefined> {
  if (!id || !SUPABASE_KEY) return;
  const api = `${SUPABASE_URL}/rest/v1/listing_public_cards?id=eq.${encodeURIComponent(id)}&select=title,description,price,image_url&limit=1`;
  const res = await fetch(api, { headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!res.ok) return;
  const rows = (await res.json()) as Array<{ title: string; description: string; price: number; image_url: string | null }>;
  const l = rows && rows[0];
  if (!l) return;
  const price = Number(l.price || 0).toLocaleString("tr-TR");
  return page(
    `${l.title} — OrtakSat`,
    `₺${price}. ${(l.description || "").replace(/\s+/g, " ")}`.slice(0, 180),
    l.image_url || OG_COVER,
    `https://www.ortaksat.com/listing/${id}`,
    "product"
  );
}

function categoryResponse(catSlug: string, citySlugRaw: string | undefined): Response | undefined {
  const cat = CATEGORY_MAP[catSlug];
  if (!cat) return; // bilinmeyen kategori → uygulamaya geç
  const city = citySlugRaw ? CITY_MAP[citySlugRaw] : undefined;
  if (city) {
    return page(
      `${city}'da Komisyonla ${cat} İlanları | OrtakSat`,
      `${city} için ${cat} kategorisinde ortak satış ilanları. Komisyonlu ${cat.toLocaleLowerCase("tr-TR")} fırsatlarını keşfet, ortak ol ve kazan. OrtakSat aracıdır; ödeme ve teslimat taraflar arasındadır.`,
      OG_COVER,
      `https://www.ortaksat.com/kategori/${catSlug}/${citySlugRaw}`,
      "website"
    );
  }
  return page(
    `${cat} ilanları — Ortak satış | OrtakSat`,
    `${cat} kategorisinde komisyonlu ortak satış ilanları. Ürününü paylaş, ortakların kendi kitlesine satsın, birlikte kazanın. OrtakSat aracıdır; ödeme ve teslimat taraflar arasındadır.`,
    OG_COVER,
    `https://www.ortaksat.com/kategori/${catSlug}`,
    "website"
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
    if (parts[0] === "kategori" && parts[1]) {
      return categoryResponse(parts[1], parts[2]);
    }
    return;
  } catch {
    return; // her hata: uygulamaya geç
  }
}

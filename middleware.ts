// Vercel Edge Middleware — sosyal medya crawler'ları için per-ilan OG meta enjekte eder.
// WhatsApp/Facebook/Twitter JS çalıştırmaz; bu yüzden /listing/:id için ürünün
// gerçek başlık/görsel/fiyatını içeren HTML döneriz. GERÇEK KULLANICI ETKİLENMEZ
// (crawler değilse veya herhangi bir hata olursa istek aynen uygulamaya geçer).

export const config = { matcher: "/listing/:id*" };

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://akyzzdwbzgsnhdircuce.supabase.co";
const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "";

const CRAWLER = /facebookexternalhit|Facebot|Twitterbot|WhatsApp|Slackbot|TelegramBot|LinkedInBot|Discordbot|Pinterest|redditbot|Googlebot|bingbot|Applebot|vkShare|SkypeUriPreview/i;

function esc(s: string): string {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  try {
    const ua = request.headers.get("user-agent") || "";
    if (!CRAWLER.test(ua)) return; // gerçek kullanıcı: uygulamaya geç

    const url = new URL(request.url);
    const id = url.pathname.split("/").filter(Boolean).pop() || "";
    if (!id || !SUPABASE_KEY) return;

    const api = `${SUPABASE_URL}/rest/v1/listing_public_cards?id=eq.${encodeURIComponent(id)}&select=title,description,price,image_url&limit=1`;
    const res = await fetch(api, { headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` } });
    if (!res.ok) return;
    const rows = (await res.json()) as Array<{ title: string; description: string; price: number; image_url: string | null }>;
    const l = rows && rows[0];
    if (!l) return;

    const title = esc(`${l.title} — OrtakSat`);
    const price = Number(l.price || 0).toLocaleString("tr-TR");
    const desc = esc(`₺${price}. ${(l.description || "").replace(/\s+/g, " ")}`.slice(0, 180));
    const image = esc(l.image_url || "https://ortaksat.com/og-cover.png");
    const pageUrl = esc(`https://ortaksat.com/listing/${id}`);

    const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8" />
<title>${title}</title>
<meta name="description" content="${desc}" />
<link rel="canonical" href="${pageUrl}" />
<meta property="og:type" content="product" />
<meta property="og:site_name" content="OrtakSat" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${desc}" />
<meta property="og:image" content="${image}" />
<meta property="og:url" content="${pageUrl}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${desc}" />
<meta name="twitter:image" content="${image}" />
</head><body><a href="${pageUrl}">${title}</a></body></html>`;

    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
  } catch {
    return; // her hata: uygulamaya geç
  }
}

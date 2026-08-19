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
export const config = { matcher: ["/listing/:id*", "/store/:id*", "/ortak/:id*"] };

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
  const api = `${SUPABASE_URL}/rest/v1/listing_public_cards?id=eq.${encodeURIComponent(id)}&select=title,description,price,image_url,category,stock_count,currency,commission_tl,review_count,attributes,created_at&limit=1`;
  const res = await fetch(api, { headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!res.ok) return;
  const rows = (await res.json()) as Array<{ title: string; description: string; price: number; image_url: string | null; category: string | null; stock_count: number | null; currency: string | null; commission_tl: number | null; review_count: number | null; attributes?: Record<string, unknown> | null; created_at?: string | null }>;
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
  // Google merchant-listing önerileri: sku (ilan id), brand (attributes'tan), offers.priceValidUntil.
  const brand = typeof l.attributes?.brand === "string" && l.attributes.brand.trim() ? l.attributes.brand.trim() : "";
  // Ürün durumu (Sıfır/İkinci El/Yenilenmiş) → schema.org itemCondition. Google Ürün/Shopping'in
  // 'ikinci el'/'sıfır' filtresini besler (Sahibinden-tarzı pazarda dominant sorgu). GERÇEK veri:
  // yalnız bilinen değerler eşlenir, yoksa hiç eklenmez (sahte-veri yasağı).
  const condRaw = typeof l.attributes?.condition === "string" ? l.attributes.condition.trim() : "";
  const CONDITION_MAP: Record<string, string> = { "Sıfır": "NewCondition", "İkinci El": "UsedCondition", "Yenilenmiş": "RefurbishedCondition" };
  const itemCondition = CONDITION_MAP[condRaw] ? `https://schema.org/${CONDITION_MAP[condRaw]}` : "";
  const priceValidUntil = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  // validFrom = ilanın yayın tarihi (fiyat o tarihten geçerli). GSC "validFrom eksik" uyarısını karşılar.
  const validFrom = (typeof l.created_at === "string" && l.created_at ? l.created_at : new Date().toISOString()).slice(0, 10);
  const product: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: l.title,
    description: (l.description || "").replace(/\s+/g, " ").slice(0, 500),
    image,
    sku: id,
    ...(brand ? { brand: { "@type": "Brand", name: brand } } : {}),
    ...(l.category ? { category: l.category } : {}),
    offers: {
      "@type": "Offer",
      price: Number(l.price || 0),
      priceCurrency: currency,
      priceValidUntil,
      validFrom,
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      ...(itemCondition ? { itemCondition } : {}),
      url,
      // OrtakSat SATICI/ödeme tarafı DEĞİL (aracı platform) — Offer yalnız ilan FİYATINI belirtir,
      // platform işlem/ödeme İDDİA ETMEZ. shippingDetails/gtin bilinçli EKLENMEZ (kargo/ödeme yapmıyoruz;
      // sahte merchant verisi = sahte-veri yasağı). GSC'de bunlar HATA değil "optimize edilebilir" öneri.
      seller: { "@type": "Organization", name: "OrtakSat" }
    }
  };
  // AGGREGATE RATING + REVIEW — Google "review snippet" (yıldız) için. Sahte veri YASAK:
  // yalnız GERÇEK yorum varsa eklenir. review_count 0 ise hiç sorgu atılmaz (verim).
  // Gerçek yorum geldiğinde otomatik yıldızlı zengin sonuç çıkar.
  if ((l.review_count ?? 0) > 0) {
    try {
      const rvApi = `${SUPABASE_URL}/rest/v1/reviews?listing_id=eq.${encodeURIComponent(id)}&deleted_at=is.null&select=rating,comment,reviewer:profiles!reviews_reviewer_id_fkey(full_name)&order=created_at.desc&limit=20`;
      const rvRes = await fetch(rvApi, { headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` } });
      let rvRows: Array<{ rating: number; comment: string | null; reviewer?: { full_name?: string | null } | null }> = [];
      if (rvRes.ok) {
        rvRows = await rvRes.json();
      } else {
        // Embed (isim) başarısızsa: puan/yorumu isimsiz çek — aggregateRating yine GERÇEK kalır.
        const r2 = await fetch(`${SUPABASE_URL}/rest/v1/reviews?listing_id=eq.${encodeURIComponent(id)}&deleted_at=is.null&select=rating,comment&order=created_at.desc&limit=20`, { headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` } });
        if (r2.ok) rvRows = await r2.json();
      }
      const ratings = (rvRows || []).map((r) => Number(r.rating)).filter((n) => n >= 1 && n <= 5);
      if (ratings.length > 0) {
        const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
        product.aggregateRating = {
          "@type": "AggregateRating",
          ratingValue: Number(avg.toFixed(1)),
          reviewCount: ratings.length,
          bestRating: 5,
          worstRating: 1
        };
        const withText = (rvRows || []).filter((r) => r.comment && String(r.comment).trim()).slice(0, 3);
        if (withText.length > 0) {
          product.review = withText.map((r) => ({
            "@type": "Review",
            reviewRating: { "@type": "Rating", ratingValue: Number(r.rating), bestRating: 5, worstRating: 1 },
            author: { "@type": "Person", name: (r.reviewer?.full_name || "OrtakSat kullanıcısı") },
            reviewBody: String(r.comment).replace(/\s+/g, " ").slice(0, 300)
          }));
        }
      }
    } catch {
      // Yorum çekilemezse Product yine geçerli (offers ile fiyat zengin sonucu korunur).
    }
  }

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

// --- Ortak vitrini + mağaza için paylaşılan yardımcılar (gerçek indekslenebilir içerik) ---
type CrawlCard = { id: string; title: string; price: number; image_url: string | null; currency?: string | null };

async function fetchCards(query: string): Promise<CrawlCard[]> {
  const res = await fetch(query, { headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!res.ok) return [];
  const j = await res.json();
  return Array.isArray(j) ? (j as CrawlCard[]) : [];
}
// SECURITY DEFINER RPC'yi REST üzerinden çağır (anon-key ile; showcase RPC'leri herkese açık).
async function rpcJson(fn: string, args: Record<string, unknown>): Promise<Array<Record<string, unknown>>> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`, "content-type": "application/json" },
    body: JSON.stringify(args)
  });
  if (!res.ok) return [];
  const j = await res.json();
  return Array.isArray(j) ? (j as Array<Record<string, unknown>>) : [];
}
function cardsItemList(cards: CrawlCard[], name: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: cards.length,
    itemListElement: cards.slice(0, 24).map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://www.ortaksat.com/listing/${c.id}`,
      name: c.title,
      image: c.image_url || OG_COVER
    }))
  };
}
function cardsBody(cards: CrawlCard[]): string {
  if (!cards.length) return "";
  return `<ul>${cards.slice(0, 24).map((c) => `<li><a href="https://www.ortaksat.com/listing/${esc(c.id)}">${esc(c.title)} — ₺${esc(Number(c.price || 0).toLocaleString("tr-TR"))}</a></li>`).join("")}</ul>`;
}

async function storeResponse(id: string): Promise<Response | undefined> {
  if (!id || !SUPABASE_KEY) return;
  const api = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=full_name&limit=1`;
  const res = await fetch(api, { headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!res.ok) return;
  const rows = (await res.json()) as Array<{ full_name: string | null }>;
  const name = rows && rows[0] && rows[0].full_name;
  if (!name) return;
  // Satıcının aktif ilanları → gerçek indekslenebilir gövde + ItemList (eskiden yalnız ad vardı).
  const cards = await fetchCards(`${SUPABASE_URL}/rest/v1/listing_public_cards?owner_id=eq.${encodeURIComponent(id)}&status=eq.active&select=id,title,price,image_url,currency&order=created_at.desc&limit=24`);
  const url = `https://www.ortaksat.com/store/${id}`;
  const title = `${name} — OrtakSat mağazası`;
  const desc = `${name} satıcısının OrtakSat mağazası — ${cards.length ? `${cards.length} aktif ilan. ` : ""}Komisyonlu ürünlerini keşfet, ortak ol ve birlikte kazan. OrtakSat aracıdır; ödeme ve teslimat taraflar arasındadır.`;
  const org = { "@context": "https://schema.org", "@type": "OnlineStore", name, url, image: OG_COVER };
  const body = `<nav><a href="https://www.ortaksat.com/">Ana Sayfa</a> › ${esc(name)} mağazası</nav><h1>${esc(name)} — OrtakSat Mağazası</h1><p>${esc(desc)}</p>${cardsBody(cards)}<p><a href="${esc(url)}">Mağazayı OrtakSat'ta görüntüle →</a></p>`;
  return page(title, desc, OG_COVER, url, "profile", `${ld(org)}${cards.length ? ld(cardsItemList(cards, `${name} ürünleri`)) : ""}`, body);
}

async function ortakResponse(id: string): Promise<Response | undefined> {
  if (!id || !SUPABASE_KEY) return;
  // Ortak vitrini herkese-açık SECURITY DEFINER RPC'lerden (partner_public_profile/shop). Eskiden
  // /ortak/[id] yalnız iskelet + generic meta ile render oluyordu (crawler'da boş + jenerik önizleme).
  const profRows = await rpcJson("partner_public_profile", { p_id: id });
  const prof = profRows[0];
  const name = prof && typeof prof.full_name === "string" ? prof.full_name : "";
  if (!name) return;
  const shopRows = await rpcJson("partner_public_shop", { p_id: id });
  const ids = shopRows.map((r) => r.listing_id).filter((x): x is string => typeof x === "string" && !!x).slice(0, 24);
  const cards = ids.length
    ? await fetchCards(`${SUPABASE_URL}/rest/v1/listing_public_cards?id=in.(${ids.map(encodeURIComponent).join(",")})&select=id,title,price,image_url,currency&limit=24`)
    : [];
  const url = `https://www.ortaksat.com/ortak/${id}`;
  const avatar = typeof prof.avatar_url === "string" && prof.avatar_url.startsWith("http") ? prof.avatar_url : OG_COVER;
  const title = `${name} — OrtakSat ortak vitrini`;
  const desc = `${name} adlı ortağın önerdiği ${cards.length ? `${cards.length} ` : ""}komisyonlu ürün. Beğen, ortak ol, birlikte kazanın. OrtakSat aracıdır; ödeme ve teslimat taraflar arasındadır.`;
  const profileLd = { "@context": "https://schema.org", "@type": "ProfilePage", mainEntity: { "@type": "Person", name, url, ...(avatar !== OG_COVER ? { image: avatar } : {}) } };
  const body = `<nav><a href="https://www.ortaksat.com/">Ana Sayfa</a> › <a href="https://www.ortaksat.com/ortaklar">Ortaklar</a> › ${esc(name)}</nav><h1>${esc(name)} — Ortak Vitrini</h1><p>${esc(desc)}</p>${cardsBody(cards)}<p><a href="${esc(url)}">Vitrini OrtakSat'ta görüntüle →</a></p>`;
  return page(title, desc, avatar, url, "profile", `${ld(profileLd)}${cards.length ? ld(cardsItemList(cards, `${name} önerileri`)) : ""}`, body);
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
    if (parts[0] === "ortak" && parts[1]) {
      return await ortakResponse(parts[1]);
    }
    return;
  } catch {
    return; // her hata: uygulamaya geç
  }
}

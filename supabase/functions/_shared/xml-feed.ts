// OTOMATİK KOPYA — kaynak: lib/xml-feed.ts. Burada düzenleme; scripts/deploy-feed-functions.py yeniden yazar.
/**
 * Ürün XML akışı → toplu ilan tablosu.
 *
 * E-ticaret altyapılarının verdiği ürün XML'leri tek bir standarda uymaz; etiket adları
 * (UrunAdi / title / name), fiyat biçimi (1299.90 / 1.299,90 TL) ve görsel yapısı
 * (Resim1, <Resimler><Resim>, g:image_link) değişir. Bu modül biçimi TAHMİN ETMEZ,
 * etiket adlarını bilinen eş anlamlılarla eşler; tanımadığı alanı boş bırakır.
 *
 * Bağımlılık yok ve DOMParser kullanılmaz: aynı kod web, Android ve iOS'ta çalışır.
 * Çıktı, CSV şablonuyla AYNI sütunları taşır → önizleme, doğrulama ve SKU eşleştirme
 * tek yoldan geçer (app/toplu-ilan.tsx).
 */

export const FEED_HEADERS = ["harici_kod", "baslik", "aciklama", "fiyat", "kategori", "il", "ilce", "komisyon", "stok", "gorsel_url", "Marka"] as const;

export type FeedTable = {
  headers: string[];
  rows: string[][];
  /** Akışta bulunan ürün sayısı (atlananlar dahil). */
  total: number;
  /** Tekrarlayan ürün etiketi (ör. "Urun", "item", "product"). */
  itemTag: string;
  /** Stokta olmadığı için alınmayan ürün sayısı. */
  outOfStock: number;
  /** Fiyatı TL olmadığı için fiyatı boş bırakılan ürün sayısı. */
  foreignCurrency: number;
  /** Akışın tamamındaki ürün kodları (stokta olmayanlar HARİÇ) — tam katalog eşitlemesi için. */
  skus: string[];
  /** Stokta olmadığı için alınmayan ürünlerin kodları — otomatik eşitleme bu ilanları pasife alır. */
  outOfStockSkus: string[];
};

const MAX_FEED_CHARS = 25_000_000;
const MAX_FEED_ITEMS = 20_000;
const MAX_FEED_IMAGES = 5;

type XNode = { name: string; attrs: Record<string, string>; children: XNode[]; text: string };

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  uuml: "ü", Uuml: "Ü", ouml: "ö", Ouml: "Ö", ccedil: "ç", Ccedil: "Ç",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "-", mdash: "-",
  hellip: "…", bull: "•", middot: "·", deg: "°", times: "x", reg: "", copy: "", trade: "",
  // Unicode kaçışlarıyla yazıldı: bu harfler kaynakta yan yana durunca kodlama denetimi bozuk metin sanıyor.
  laquo: "\u00ab", raquo: "\u00bb", euro: "\u20ac", frac12: "\u00bd", acirc: "\u00e2", Acirc: "\u00c2", icirc: "\u00ee", Icirc: "\u00ce", ucirc: "\u00fb", Ucirc: "\u00db"
};

export function decodeEntities(value: string): string {
  if (value.indexOf("&") < 0) return value;
  return value.replace(/&(#x[0-9a-fA-F]{1,6}|#\d{1,7}|[A-Za-z][A-Za-z0-9]{1,10});/g, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return "";
      try { return String.fromCodePoint(code); } catch { return ""; }
    }
    return body in NAMED_ENTITIES ? NAMED_ENTITIES[body] : whole;
  });
}

/** Etiket sonunu bulur; öznitelik değerindeki ">" karakterine takılmaz. */
function tagEnd(src: string, from: number): number {
  let quote = "";
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (quote) { if (c === quote) quote = ""; }
    else if (c === '"' || c === "'") quote = c;
    else if (c === ">") return i;
  }
  return -1;
}

function parseAttrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (raw.indexOf("=") < 0) return out;
  const re = /([^\s=/]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) out[m[1]] = decodeEntities(m[2] ?? m[3] ?? "");
  return out;
}

function parseXml(src: string): XNode {
  const root: XNode = { name: "#root", attrs: {}, children: [], text: "" };
  const stack: XNode[] = [root];
  const n = src.length;
  let i = 0;
  while (i < n) {
    const top = stack[stack.length - 1];
    const lt = src.indexOf("<", i);
    if (lt < 0) break;
    if (lt > i && top !== root) {
      const chunk = src.slice(i, lt);
      if (chunk.trim()) top.text += decodeEntities(chunk);
    }
    if (src.startsWith("<![CDATA[", lt)) {
      const end = src.indexOf("]]>", lt + 9);
      if (end < 0) break;
      if (top !== root) top.text += src.slice(lt + 9, end);
      i = end + 3;
      continue;
    }
    if (src.startsWith("<!--", lt)) {
      const end = src.indexOf("-->", lt + 4);
      if (end < 0) break;
      i = end + 3;
      continue;
    }
    if (src[lt + 1] === "?") {
      const end = src.indexOf("?>", lt + 2);
      if (end < 0) break;
      i = end + 2;
      continue;
    }
    const gt = tagEnd(src, lt + 1);
    if (gt < 0) break;
    if (src[lt + 1] === "!") { i = gt + 1; continue; } // DOCTYPE vb.
    const tag = src.slice(lt + 1, gt);
    if (tag[0] === "/") {
      const name = tag.slice(1).trim();
      // Hoşgörülü kapatma: eşleşen açık etikete kadar in (bozuk iç içe yapıda tüm ağacı kaybetme).
      for (let s = stack.length - 1; s > 0; s--) {
        if (stack[s].name === name) { stack.length = s; break; }
      }
    } else {
      const selfClosing = tag[tag.length - 1] === "/";
      const body = selfClosing ? tag.slice(0, -1) : tag;
      const space = body.search(/\s/);
      const name = (space < 0 ? body : body.slice(0, space)).trim();
      if (name) {
        const node: XNode = { name, attrs: space < 0 ? {} : parseAttrs(body.slice(space)), children: [], text: "" };
        top.children.push(node);
        if (!selfClosing) stack.push(node);
      }
    }
    i = gt + 1;
  }
  return root;
}

/** Etiket adı → karşılaştırma anahtarı: ad alanı öneki atılır, Türkçe harfler sadeleşir, ayraçlar silinir. */
export function feedKey(name: string): string {
  const local = name.indexOf(":") >= 0 ? name.slice(name.lastIndexOf(":") + 1) : name;
  let out = "";
  for (const ch of local) {
    const c = ch === "İ" || ch === "I" || ch === "ı" ? "i"
      : ch === "Ş" || ch === "ş" ? "s"
      : ch === "Ğ" || ch === "ğ" ? "g"
      : ch === "Ü" || ch === "ü" ? "u"
      : ch === "Ö" || ch === "ö" ? "o"
      : ch === "Ç" || ch === "ç" ? "c"
      : ch.toLowerCase();
    if ((c >= "a" && c <= "z") || (c >= "0" && c <= "9")) out += c;
  }
  return out;
}

type Entry = { chain: string[]; value: string };

const VARIANT_KEY = /^(varyant|variant|secenek|option|kombinasyon|combination|altur|subproduct|stoklar)/;

function flattenItem(item: XNode): Entry[] {
  const out: Entry[] = [];
  for (const [k, v] of Object.entries(item.attrs)) {
    const value = v.trim();
    if (value) out.push({ chain: [feedKey(k)], value });
  }
  const walk = (node: XNode, chain: string[], depth: number) => {
    const here = [...chain, feedKey(node.name)];
    if (!node.children.length) {
      const value = node.text.trim();
      if (value) out.push({ chain: here, value });
      // <image url="…"/> gibi değeri öznitelikte taşıyan yapraklar
      for (const [k, v] of Object.entries(node.attrs)) {
        const av = v.trim();
        if (av && /^https?:\/\//i.test(av)) out.push({ chain: [...here, feedKey(k)], value: av });
      }
      return;
    }
    if (depth >= 5) return;
    for (const child of node.children) walk(child, here, depth + 1);
  };
  for (const child of item.children) walk(child, [], 1);
  return out;
}

const inVariant = (e: Entry) => e.chain.slice(0, -1).some((k) => VARIANT_KEY.test(k));

/** Eş anlamlı sırasına göre ilk dolu değer. Önce ürünün doğrudan alanları, sonra iç içe (varyant dışı) alanlar. */
function pick(entries: Entry[], aliases: string[], accept?: (value: string) => boolean): string {
  for (const alias of aliases) {
    for (const e of entries) {
      if (e.chain.length === 1 && e.chain[0] === alias && (!accept || accept(e.value))) return e.value;
    }
  }
  for (const alias of aliases) {
    for (const e of entries) {
      if (e.chain.length > 1 && e.chain[e.chain.length - 1] === alias && !inVariant(e) && (!accept || accept(e.value))) return e.value;
    }
  }
  return "";
}

const SKU_KEYS = ["stokkodu", "stockcode", "urunkodu", "productcode", "urunkod", "code", "kod", "sku", "modelkodu", "modelcode", "barkod", "barcode", "gtin", "mpn", "urunid", "productid", "id"];
const TITLE_KEYS = ["urunadi", "baslik", "title", "name", "productname", "urunismi", "urunad", "isim", "label", "adi", "ad"];
const DESC_KEYS = ["aciklama", "description", "detay", "details", "detail", "urunaciklama", "urunaciklamasi", "uzunaciklama", "longdescription", "fulldescription", "onyazi", "kisaaciklama", "shortdescription", "ozet", "summary"];
// İndirimli/KDV dahil satış fiyatı önce; liste (üstü çizili) fiyat en sonda.
const PRICE_KEYS = ["indirimlifiyat", "indirimlifiyati", "saleprice", "specialprice", "pricespecial", "discountedprice", "kdvdahilfiyat", "kdvdahilsatisfiyati", "pricewithtax", "pricetaxincluded", "vergidahilfiyat", "satisfiyati", "satisfiyat", "sonkullanicifiyati", "fiyat", "price", "price1", "sellingprice", "listefiyati", "listprice", "piyasafiyati", "marketprice"];
const CURRENCY_KEYS = ["parabirimi", "currency", "currencyabbr", "currencycode", "doviz", "dovizcinsi", "kur"];
const STOCK_KEYS = ["stokadedi", "stokmiktari", "stokadet", "stok", "stock", "stockamount", "stockquantity", "quantity", "miktar", "adet", "qty"];
const BRAND_KEYS = ["marka", "brand", "manufacturer", "uretici", "markaadi", "brandname"];
const CATEGORY_KEYS = ["kategoriyolu", "categorypath", "categorytree", "kategoriagaci", "kategori", "category", "kategoriadi", "categoryname", "producttype", "kategoriler", "categories"];
const CATEGORY_MAIN = ["anakategori", "maincategory", "topcategory", "ustkategori", "anakategoriadi"];
const CATEGORY_SUB = ["altkategori", "subcategory", "altkategoriadi", "altkategori1", "subcategory1"];
const IMAGE_KEY = /^(resim|image|img|picture|gorsel|foto|photo|additionalimagelink|imagelink|medya|media|thumbnail|kapak)/;

const URL_RE = /^https?:\/\/\S+$/i;

export function parseFeedNumber(raw: string): number {
  const cleaned = raw.replace(/[^\d.,]/g, "");
  if (!cleaned || !/\d/.test(cleaned)) return NaN;
  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  let normalized: string;
  if (lastDot >= 0 && lastComma >= 0) {
    // İkisi de var: sonda olan ondalık ayraçtır ("1.299,90" / "1,299.90").
    normalized = lastComma > lastDot ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const tail = cleaned.length - lastComma - 1;
    const many = cleaned.indexOf(",") !== lastComma;
    normalized = many || tail === 3 ? cleaned.replace(/,/g, "") : cleaned.replace(",", ".");
  } else if (lastDot >= 0) {
    const tail = cleaned.length - lastDot - 1;
    const many = cleaned.indexOf(".") !== lastDot;
    // "1.500" Türkçe binliktir; "1299.90" ve "1299.9000" ondalıktır.
    normalized = many || tail === 3 ? cleaned.replace(/\./g, "") : cleaned;
  } else normalized = cleaned;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : NaN;
}

const FOREIGN_RE = /\b(usd|eur|gbp|dolar|euro|sterlin)\b|[$€£]/i;
const TRY_RE = /^(tl|try|trl|₺|turk lirasi|türk lirası|lira)?$/i;

/** HTML açıklamayı düz metne çevirir; paragraf ve madde sonları satır sonu olur. */
export function htmlToText(value: string): string {
  let text = value;
  if (text.indexOf("<") >= 0) {
    text = text
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6]|ul|ol|table)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, " ");
  }
  text = decodeEntities(decodeEntities(text));
  return text
    .replace(/\r/g, "")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Başlıkta izin verilmeyen ama anlamı değiştirmeden karşılığı olan karakterleri çevirir
 * (uzun tire, dikey çizgi, köşeli parantez, marka simgeleri). Kısaltma YAPMAZ: 70 karakteri
 * aşan başlık önizlemede hata olarak görünür, satıcı düzeltir.
 */
function tidyTitle(value: string): string {
  return decodeEntities(decodeEntities(value.replace(/<[^>]+>/g, " ")))
    .replace(/[–—−|]/g, "-")
    .replace(/[\[{]/g, "(")
    .replace(/[\]}]/g, ")")
    .replace(/[®™©]/g, "")
    .replace(/[×]/g, "x")
    .replace(/[_*#!?;=~^`]/g, " ")
    .replace(/[“”«»]/g, '"')
    .replace(/[‘`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function categoryText(entries: Entry[]): string {
  const split = (raw: string) => {
    const value = decodeEntities(raw).trim();
    if (!value || /^\d+$/.test(value)) return [] as string[]; // sayısal kategori kimliği işe yaramaz
    const parts = value.indexOf(">") >= 0 ? value.split(/>+/)
      : /[›»]/.test(value) ? value.split(/[›»]/)
      : value.indexOf("|") >= 0 ? value.split("|")
      : value.indexOf("///") >= 0 ? value.split("///")
      : value.indexOf(" / ") >= 0 ? value.split(" / ")
      : [value];
    return parts.map((p) => p.trim()).filter(Boolean);
  };
  const main = split(pick(entries, CATEGORY_MAIN));
  const sub = split(pick(entries, CATEGORY_SUB));
  let body: string[] = [];
  for (const alias of CATEGORY_KEYS) {
    const direct = entries.find((e) => e.chain.length === 1 && e.chain[0] === alias);
    if (direct) { body = split(direct.value); if (body.length) break; }
    // <Kategori><Ana>…</Ana><Alt>…</Alt></Kategori> gibi iç içe yapı: yaprakları sırayla birleştir.
    const nested = entries.filter((e) => e.chain.length > 1 && e.chain[0] === alias && !inVariant(e) && !URL_RE.test(e.value) && !/^\d+$/.test(e.value));
    if (nested.length) { body = nested.flatMap((e) => split(e.value)); if (body.length) break; }
  }
  const all: string[] = [];
  for (const part of [...main, ...body, ...sub]) {
    if (!all.some((p) => p.toLocaleLowerCase("tr-TR") === part.toLocaleLowerCase("tr-TR"))) all.push(part);
  }
  return all.join(" > ");
}

function imagesOf(entries: Entry[]): string[] {
  const out: string[] = [];
  const add = (value: string) => {
    for (const piece of value.split(/[\s,;|]+/)) {
      const url = piece.trim();
      if (URL_RE.test(url) && !out.includes(url)) out.push(url);
    }
  };
  // Ana görsel etiketleri önce (kapak olur), sonra ek görseller belge sırasıyla.
  for (const e of entries) if (!inVariant(e) && e.chain.some((k) => k === "imagelink" || k === "anaresim" || k === "mainimage" || k === "kapak")) add(e.value);
  for (const e of entries) if (!inVariant(e) && e.chain.some((k) => IMAGE_KEY.test(k))) add(e.value);
  return out.slice(0, MAX_FEED_IMAGES);
}

function stockOf(entries: Entry[]): number | null {
  const direct = pick(entries, STOCK_KEYS, (v) => Number.isFinite(parseFeedNumber(v)));
  if (direct) return Math.max(0, Math.floor(parseFeedNumber(direct)));
  // Stok yalnız varyantlarda yazıyorsa topla.
  let sum = 0;
  let seen = false;
  for (const e of entries) {
    if (inVariant(e) && STOCK_KEYS.includes(e.chain[e.chain.length - 1])) {
      const v = parseFeedNumber(e.value);
      if (Number.isFinite(v)) { sum += Math.max(0, Math.floor(v)); seen = true; }
    }
  }
  if (seen) return sum;
  const availability = pick(entries, ["availability", "stokdurumu", "stockstatus"]).toLowerCase();
  if (availability) {
    if (/out|yok|tukendi|tükendi|false|^0$/.test(availability)) return 0;
    if (/in|var|true|^1$/.test(availability)) return 1;
  }
  return null;
}

function trNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(".", ",");
}

/** Ürün gibi görünen düğüm: başlık ve fiyat benzeri iki alanı da taşır. */
function looksLikeItem(node: XNode): boolean {
  const keys = new Set(node.children.map((c) => feedKey(c.name)));
  for (const k of Object.keys(node.attrs)) keys.add(feedKey(k));
  return TITLE_KEYS.some((k) => keys.has(k)) && PRICE_KEYS.some((k) => keys.has(k));
}

function findItems(root: XNode): { tag: string; items: XNode[] } | null {
  let level: XNode[] = root.children;
  for (let depth = 0; depth < 6 && level.length; depth++) {
    // Bu seviyedeki tüm düğümlerin çocuklarını ada göre grupla; en kalabalık ürün-benzeri grup akıştır.
    const groups = new Map<string, XNode[]>();
    for (const node of level) {
      const list = groups.get(node.name);
      if (list) list.push(node); else groups.set(node.name, [node]);
    }
    let best: XNode[] | null = null;
    for (const list of groups.values()) {
      if (looksLikeItem(list[0]) && (!best || list.length > best.length)) best = list;
    }
    if (best) return { tag: best[0].name, items: best };
    level = level.flatMap((node) => node.children);
  }
  return null;
}

export function looksLikeXml(text: string): boolean {
  const head = text.replace(/^﻿/, "").trimStart().slice(0, 200);
  return head.startsWith("<?xml") || /^<[A-Za-z_][\w:.-]*[\s>]/.test(head);
}

/**
 * XML metnini toplu ilan tablosuna çevirir. Ürün bulunamazsa Türkçe açıklamalı hata fırlatır.
 * il / ilçe / komisyon sütunları BOŞ gelir (akışlarda yoktur) — ekrandaki varsayılanlarla dolar.
 */
export function parseXmlFeed(text: string): FeedTable {
  const src = text.replace(/^﻿/, "");
  if (src.length > MAX_FEED_CHARS) throw new Error("XML dosyası çok büyük (en fazla yaklaşık 25 MB). Akışı bölerek yükle.");
  if (/<html[\s>]/i.test(src.slice(0, 2000))) throw new Error("Bu bir XML ürün akışı değil, web sayfası (HTML). XML dosyasının kendisini indirip yükle.");
  const found = findItems(parseXml(src));
  if (!found) throw new Error("XML içinde ürün bulunamadı. Her üründe bir ad (ör. UrunAdi, title, name) ve bir fiyat (ör. Fiyat, price) etiketi olmalı.");
  if (found.items.length > MAX_FEED_ITEMS) throw new Error(`XML akışında ${found.items.length} ürün var; tek dosyada en fazla ${MAX_FEED_ITEMS} ürün işlenir. Akışı bölerek yükle.`);

  const rows: string[][] = [];
  const skus: string[] = [];
  const outOfStockSkus: string[] = [];
  let outOfStock = 0;
  let foreignCurrency = 0;
  for (const item of found.items) {
    const entries = flattenItem(item);
    const stock = stockOf(entries);
    const sku = pick(entries, SKU_KEYS).slice(0, 120);
    if (stock === 0) { outOfStock++; if (sku) outOfStockSkus.push(sku); continue; }
    const priceRaw = pick(entries, PRICE_KEYS, (v) => parseFeedNumber(v) > 0);
    const currency = pick(entries, CURRENCY_KEYS).trim();
    const foreign = FOREIGN_RE.test(priceRaw) || (currency !== "" && !TRY_RE.test(currency) && FOREIGN_RE.test(currency));
    let price = "";
    if (foreign) foreignCurrency++;
    else if (priceRaw) price = trNumber(parseFeedNumber(priceRaw));
    if (sku) skus.push(sku);
    rows.push([
      sku,
      tidyTitle(pick(entries, TITLE_KEYS)),
      htmlToText(pick(entries, DESC_KEYS)).slice(0, 4000),
      price,
      categoryText(entries),
      "",
      "",
      "",
      stock === null ? "" : String(stock),
      imagesOf(entries).join("|"),
      decodeEntities(pick(entries, BRAND_KEYS)).trim()
    ]);
  }
  return { headers: [...FEED_HEADERS], rows, total: found.items.length, itemTag: found.tag, outOfStock, foreignCurrency, skus, outOfStockSkus };
}

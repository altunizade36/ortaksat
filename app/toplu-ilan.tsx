import { MaterialCommunityIcons } from "@/components/icons";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import Head from "expo-router/head";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { AuthRequired } from "@/components/auth-gate";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import { useMounted } from "@/lib/layout";
import { colors } from "@/components/colors";
import { Alert } from "@/lib/alert";
import { WebContainer } from "@/components/web-container";
import { WebFooter } from "@/components/web-landing";
import { listingCategoryPath } from "@/lib/category-match";
import { categoryPathAttributes, isLeafCategoryPath, matchCategoryLabelPath } from "@/lib/category-path";
import { matchCategoryByName, resolveFormKey, getFormSchema, type CategoryNode, type FieldDef } from "@/lib/category-tree";
import { searchKey } from "@/lib/locale";
import type { Listing, PartnershipMode } from "@/lib/types";
import { autoFillListing } from "@/lib/listing-autofill";
import { formatLocation, getProvince, resolveProvinceByName, districtsOfProvince } from "@/lib/locations";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { downloadCsv } from "@/lib/csv-export";
import { uploadListingImage, fetchMyListingSkus, updateListingFieldsLive, fetchMyListingsForExport } from "@/lib/live-service";
import { isListingVideoUrl } from "@/lib/listing-video";
import { useStore } from "@/lib/use-store";
import { parseTrPrice, validateListing } from "@/lib/validation";
import { parseListingRate } from "@/lib/listing-numbers";
import { LISTING_TITLE_LIMITS, listingTitleLength } from "@/lib/listing-title";
import { looksLikeXml, parseXmlFeed, type FeedTable } from "@/lib/xml-feed";
import { FEED_INTERVALS, deleteMyFeed, describeFeedSummary, fetchFeedFromUrl, getMyFeed, saveMyFeed, syncMyFeedNow, type ListingFeed } from "@/lib/listing-feeds";

const TEMPLATE = `harici_kod,baslik,aciklama,fiyat,kategori,il,ilce,komisyon,stok,gorsel_url
URUN-1001,Örnek Ürün Adı,Ürünün kısa açıklaması burada,1500,Elektronik,İstanbul,Kadıköy,15,3,https://...jpg
URUN-1002,İkinci Ürün,Açıklama metni,899,Moda & Giyim,Ankara,Çankaya,20,10,`;

type ParsedRow = {
  raw: Record<string, string>;
  sku: string;
  existingId?: string;
  mode: "new" | "update";
  title: string;
  description: string;
  price: number;
  category?: { node: CategoryNode; path: CategoryNode[] };
  categoryRaw: string;
  // GÜNCELLEME modunda kategori YALNIZ burası doluysa yazılır (tam + tek + yaprak yol, mevcuttan farklı).
  categoryChange?: { path: CategoryNode[]; from: string; to: string; formKeyChanged: boolean };
  // Güncellemede yol yazılmış ama güvenli değil (kısmi / yaprak değil / eş-etiketli kardeş) → kategoriye dokunulmaz.
  categoryPathIgnored?: boolean;
  provinceId?: number;
  districtId?: number;
  provinceName?: string;
  commission: number;
  partnershipMode: PartnershipMode; // ortak satış modu (none/open/approval)
  stock: number;
  image: string; // kapak (galerinin ilki)
  images: string[]; // tüm görseller: kapak + ek galeri (gorsel_url'de | ile ayrılmış)
  attrs: Record<string, string | number | boolean | string[]>; // kategori-özel alanlar (attributes)
  recognizedAttrs: string[]; // tanınan özellik etiketleri (önizleme göstergesi)
  originalTitle?: string; // satıcı "uzun başlıkları kısalt" seçtiyse kısaltılmadan önceki başlık
  // GÜNCELLEMEDE yalnız dosyada YAZAN komisyon/stok gönderilir. Eskiden boş hücre varsayılana (%10 / 1 adet)
  // dönüp mevcut ilanın komisyonunu ve stoğunu eziyordu ("boş alan mevcut değeri korur" kuralına aykırı).
  commissionGiven: boolean;
  stockGiven: boolean;
  errors: string[];
};

const MAX_IMAGES = 5; // ilan başına kapak dahil en fazla 5 görsel (create/edit akışıyla aynı sınır)
// Spam/hız koruması: tek partide üst sınır. XML akışı daha büyükse partilere bölünür.
const MAX_BULK = 200;

/**
 * Uzun başlığı kelime sınırında, sınırı aşmayacak biçimde kısaltır. YALNIZ satıcı açıkça seçerse çalışır
 * (başlık politikası girdiyi kendiliğinden kısaltmaz); önizlemede özgün başlık da gösterilir.
 */
function shortenTitle(title: string, max: number): string {
  const chars = Array.from(title.trim());
  if (chars.length <= max) return title.trim();
  const cut = chars.slice(0, max).join("");
  const space = cut.lastIndexOf(" ");
  const base = space >= Math.floor(max * 0.6) ? cut.slice(0, space) : cut;
  return base.replace(/[\s.,'’"()/:+&%\-]+$/u, "").trim();
}

/** "13.11.2026 21:40" — yerel saatle kısa tarih (Intl kullanmadan). */
function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(d.getDate())}.${two(d.getMonth() + 1)}.${d.getFullYear()} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** Sunucunun saatlik ilan sınırı hatası (throttle_listing_inserts). */
function isRateLimitError(message: string): boolean {
  return /çok fazla işlem|sınırına \(?\d*\)? ?ulaş|saatlik toplu ilan/i.test(message);
}

/** Dosya baytlarını, XML bildirimindeki kodlamaya göre metne çevirir (eski akışlar windows-1254 / iso-8859-9 olabilir). */
function decodeFileBytes(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let head = "";
  for (let i = 0; i < Math.min(bytes.length, 200); i++) head += String.fromCharCode(bytes[i]);
  const declared = /<\?xml[^>]*encoding=["']([\w-]+)["']/i.exec(head)?.[1]?.toLowerCase();
  if (declared && declared !== "utf-8" && declared !== "utf8") {
    try { return new TextDecoder(declared).decode(bytes); } catch { /* tanınmayan kodlama → UTF-8 dene */ }
  }
  return new TextDecoder("utf-8").decode(bytes);
}

// Basit ama tırnak-farkında CSV satır ayrıştırıcı (alan içinde ayraç destekler).
function splitCsvLine(line: string, delim: string = ","): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (c === delim && !inQ) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

// TÜRKÇE EXCEL TUZAĞI: TR yerelinde Excel "CSV" dosyasını NOKTALI VİRGÜL (;) ayraçla
// kaydeder (virgül ondalık ayracı olduğu için). Başlık satırındaki ; ve , sayısını
// karşılaştırıp ayracı otomatik seç — yoksa tüm satır tek hücreye düşer.
function detectDelimiter(headerLine: string): string {
  const semis = (headerLine.match(/;/g) || []).length;
  const commas = (headerLine.match(/,/g) || []).length;
  const tabs = (headerLine.match(/\t/g) || []).length;
  if (tabs > commas && tabs > semis) return "\t";
  return semis > commas ? ";" : ",";
}

const COL_ALIASES: Record<string, string[]> = {
  sku: ["harici_kod", "harici kod", "sku", "stok_kodu", "stok kodu", "urun_kodu", "ürün kodu", "kod", "external_id", "externalid", "barkod", "barcode"],
  title: ["baslik", "başlık", "title", "urun", "ürün", "ad"],
  description: ["aciklama", "açıklama", "description", "aciklamasi"],
  price: ["fiyat", "price", "tutar"],
  category: ["kategori", "category", "kat"],
  province: ["il", "sehir", "şehir", "province", "city"],
  district: ["ilce", "ilçe", "district"],
  commission: ["komisyon", "commission", "oran"],
  stock: ["stok", "stock", "adet"],
  image: ["gorsel_url", "görsel", "gorsel", "foto", "image", "url", "resim"],
  partnership: ["ortak_satis", "ortak satış", "ortaksatis", "ortaklık", "ortaklik", "partnership", "partner_mode", "ortak"]
};

// ORTAK SATIŞ modu (opsiyonel sütun). Boş/tanınmaz → "approval" (güvenli varsayılan:
// satıcı ortakları onaylar). "none" = normal ilan, ortaksız (komisyon yok).
function resolvePartnershipMode(raw: string): PartnershipMode {
  const t = normKey(raw);
  if (!t) return "approval";
  if (["yok", "kapali", "kapalı", "none", "normal", "hayır", "hayir", "ortaksatisyok"].includes(t)) return "none";
  if (["acik", "açık", "herkeseacik", "herkeseaçık", "open", "serbest", "herkes"].includes(t)) return "open";
  if (["onayli", "onaylı", "onay", "approval", "onayla"].includes(t)) return "approval";
  return "approval";
}

// Başlık/etiket normalize (tr-TR küçült, boşluk/altçizgi at) — sütun eşleştirmesinde ortak.
function normKey(s: string): string {
  return s.toLocaleLowerCase("tr-TR").replace(/[\s_]+/g, "").trim();
}

// KATEGORİ-ÖZEL ALAN değeri, alanın tipine göre attributes'a yazılacak biçime çevrilir.
// undefined → bu değeri yazma (boş/tanınmaz). Büyük pazaryeri şablonları marka/model/
// yıl/renk/durum gibi sütunlar taşır; başlık şema alanının etiketi (Marka) veya
// anahtarıyla (brand) eşleşirse otomatik doldurulur.
function coerceAttr(field: FieldDef, raw: string): string | number | boolean | string[] | undefined {
  const v = raw.trim();
  if (!v) return undefined;
  switch (field.type) {
    case "number": {
      const n = parseTrPrice(v);
      return n > 0 ? n : v === "0" ? 0 : undefined;
    }
    case "bool": {
      const t = v.toLocaleLowerCase("tr-TR");
      if (["evet", "var", "1", "true", "e", "x", "✓", "yes"].includes(t)) return true;
      if (["hayır", "hayir", "yok", "0", "false", "h", "no"].includes(t)) return false;
      return undefined;
    }
    case "select": {
      const opt = (field.options ?? []).find((o) => normKey(o) === normKey(v));
      return opt ?? v; // eşleşmese de ham değeri sakla (özellik tablosunda yine görünür)
    }
    case "multiselect":
    case "tags": {
      const parts = v.split(/[|;/]/).map((s) => s.trim()).filter(Boolean);
      if (!parts.length) return undefined;
      if (field.type === "multiselect" && field.options) {
        return parts.map((p) => field.options!.find((o) => normKey(o) === normKey(p)) ?? p);
      }
      return parts;
    }
    default: // text, textarea
      return v;
  }
}

const PATH_SEP = /[>›»]/;
const pathText = (path: CategoryNode[]) => path.map((n) => n.label).join(" > ");

/**
 * GÜNCELLEME modunda kategori değişikliğine izin veren TEK biçim: KÖKTEN YAPRAĞA tam yol.
 * Yeni ilanlarla aynı eşleyici (matchCategoryLabelPath) kullanılır, sonra sonucu sıkılaştırırız:
 *   • yazılan parça sayısı = çözülen yol uzunluğu (kısmi "Konut > Satılık" kabul edilmez — eşleyici
 *     sondan eşleyip birden çok daldan birini SEÇEBİLİYOR),
 *   • yol bir yaprakta biter,
 *   • hiçbir seviyede aynı etiketli kardeş yok (aksi halde hangi düğüm olduğu etiketten bilinemez).
 * Tutmazsa undefined → kategoriye dokunulmaz.
 */
function exactLeafPath(tree: CategoryNode[], raw: string, hit: { path: CategoryNode[] } | undefined): CategoryNode[] | undefined {
  // `hit` = matchCategoryLabelPath(tree, raw) sonucu (çağıran zaten hesapladı; ağaç yürüyüşü pahalı, tekrarlanmaz).
  const parts = raw.split(/\s*[>›»]\s*/).map((p) => searchKey(p)).filter(Boolean);
  if (!hit || hit.path.length !== parts.length || !isLeafCategoryPath(hit.path)) return undefined;
  let level = tree;
  for (let i = 0; i < hit.path.length; i++) {
    if (!level.includes(hit.path[i])) return undefined; // kökten başlamıyor
    if (level.filter((n) => searchKey(n.label) === parts[i]).length !== 1) return undefined;
    level = hit.path[i].children ?? [];
  }
  return hit.path;
}

type SkuEntry = { id: string; title: string; status: string; category: string | null; attributes: Record<string, unknown> | null };

/** Mevcut ilanın ağaçtaki yolu (kayıtlı _path, yoksa etiket-tabanlı çözücü). Çözülemezse []. */
function currentPathOf(entry: SkuEntry): CategoryNode[] {
  return listingCategoryPath({ category: entry.category ?? "", attributes: (entry.attributes ?? undefined) as Listing["attributes"] });
}

function resolveHeader(headers: string[]): Record<string, number> {
  const norm = normKey;
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    const hn = norm(h);
    for (const [key, aliases] of Object.entries(COL_ALIASES)) {
      if (aliases.some((a) => norm(a) === hn)) { if (!(key in map)) map[key] = i; }
    }
  });
  return map;
}

function BulkUploadInner() {
  const { language } = useLanguage();
  const router = useRouter();
  const { createListing, currentUser, categoryTree } = useStore();
  const [csv, setCsv] = useState("");
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [commissionAll, setCommissionAll] = useState(""); // toplu komisyon override (%)
  const [publishing, setPublishing] = useState(false);
  const [bulkImages, setBulkImages] = useState<string[]>([]); // sıralı toplu foto
  const [notice, setNotice] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failedRows, setFailedRows] = useState<Array<{ row: number; title: string; reason: string }>>([]);
  // SKU SENKRONİZASYONU: satıcının mevcut ilanlarının harici-kod → {id,başlık,durum} haritası.
  // Aynı SKU tekrar gelirse yeni oluşturmaz, MEVCUDU günceller (Trendyol/Sahibinden modeli).
  const [existingSkus, setExistingSkus] = useState<Map<string, SkuEntry>>(new Map());
  const [deactivateMissing, setDeactivateMissing] = useState(false);
  const [exporting, setExporting] = useState(false);
  // XML ÜRÜN AKIŞI: ayrıştırılmış tablo bellekte durur; MAX_BULK'luk partilerle önizlenir/yüklenir.
  const [feed, setFeed] = useState<FeedTable | null>(null);
  const [feedStart, setFeedStart] = useState(0);
  // VARSAYILANLAR: satırda kategori / il yoksa (XML akışlarında il hiç yoktur) YENİ ilanlara uygulanır.
  const [defCategory, setDefCategory] = useState("");
  const [defProvince, setDefProvince] = useState("");
  const [defDistrict, setDefDistrict] = useState("");
  const [shortenTitles, setShortenTitles] = useState(false); // 70 karakteri aşan başlıkları kelime sınırında kısalt
  // Satırında ortak_satis yazmayan (XML akışlarında hiç yoktur) ilanlara uygulanacak ortaklık türü.
  const [defPartnership, setDefPartnership] = useState<PartnershipMode>("approval");
  // XML BAĞLANTISI + otomatik eşitleme (kayıtlı bağlantı sunucuda belirli aralıklarla fiyat/stok günceller).
  const [feedUrl, setFeedUrl] = useState("");
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [savedFeed, setSavedFeed] = useState<ListingFeed | null>(null);
  const [feedBusy, setFeedBusy] = useState(false);
  const [syncInterval, setSyncInterval] = useState<number>(6);
  const [syncPauseMissing, setSyncPauseMissing] = useState(false);
  const defCatMatch = useMemo(() => {
    const raw = defCategory.trim();
    if (!raw) return undefined;
    return PATH_SEP.test(raw) ? matchCategoryLabelPath(categoryTree, raw) : matchCategoryByName(raw);
  }, [defCategory, categoryTree]);
  const defProvMatch = useMemo(() => (defProvince.trim() ? resolveProvinceByName(defProvince) : undefined), [defProvince]);
  const defDistMatch = useMemo(() => {
    const name = defDistrict.toLocaleLowerCase("tr-TR").trim();
    if (!defProvMatch || !name) return undefined;
    return districtsOfProvince(defProvMatch.id).find((x) => x.name.toLocaleLowerCase("tr-TR").trim() === name);
  }, [defDistrict, defProvMatch]);
  const alive = useRef(true);
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; if (navTimer.current) clearTimeout(navTimer.current); };
  }, []);
  // Kategori + attributes de gelir: güncellemede "mevcut yol ↔ yazılan yol" karşılaştırması için.
  const loadSkus = useCallback(async () => {
    try {
      const list = await fetchMyListingSkus(currentUser.id);
      if (alive.current) setExistingSkus(new Map(list.map((r) => [r.externalId, { id: r.id, title: r.title, status: r.status, category: r.category, attributes: r.attributes }])));
    } catch { /* eşleşme haritası yüklenemedi → satırlar "yeni" görünür; DB tekil index mükerreri engeller */ }
  }, [currentUser.id]);
  useEffect(() => { void loadSkus(); }, [loadSkus]);
  useEffect(() => {
    let active = true;
    void getMyFeed(currentUser.id).then((saved) => {
      if (!active || !saved) return;
      setSavedFeed(saved);
      setFeedUrl(saved.url);
      setSyncInterval(saved.intervalHours);
      setSyncPauseMissing(saved.pauseMissing);
    }).catch(() => {});
    return () => { active = false; };
  }, [currentUser.id]);

  const parse = (override?: { feed: FeedTable; start: number; keepNotice?: boolean }) => {
    if (!override?.keepNotice) setNotice(null);
    let activeFeed = override ? override.feed : feed;
    const start = override ? override.start : feedStart;
    let headers: string[];
    let dataRows: string[][];
    // BOM'u at (Excel UTF-8 CSV başına \uFEFF ekler → ilk sütun adı bozulur).
    const clean = csv.replace(/^\uFEFF/, "");
    let batchStart = start;
    if (!activeFeed && clean.trim() && looksLikeXml(clean)) {
      // Yapıştırılan metin XML: tabloya çevir, metin alanını boşalt (akış kartı gösterilir).
      try {
        activeFeed = parseXmlFeed(clean);
      } catch (e) {
        Alert.alert(translateCopy("XML okunamadı", language), translateCopy(e instanceof Error ? e.message : "XML dosyası ayrıştırılamadı.", language));
        return;
      }
      batchStart = 0;
      setFeed(activeFeed);
      setFeedStart(0);
      setCsv("");
    }
    if (activeFeed) {
      if (!activeFeed.rows.length) {
        Alert.alert(translateCopy("Yüklenecek ürün yok", language), translateCopy("XML akışındaki ürünlerin tamamı stokta yok görünüyor.", language));
        return;
      }
      headers = activeFeed.headers;
      dataRows = activeFeed.rows.slice(batchStart, batchStart + MAX_BULK);
    } else {
      const lines = clean.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) { Alert.alert(translateCopy("Boş veri", language), translateCopy("Başlık satırı + en az 1 ürün satırı gerekli.", language)); return; }
      if (lines.length - 1 > MAX_BULK) {
        Alert.alert(translateCopy("Çok fazla satır", language), `${translateCopy("Tek seferde en fazla", language)} ${MAX_BULK} ${translateCopy("ürün yükleyebilirsin. Partiyi böl.", language)}`);
        return;
      }
      const delim = detectDelimiter(lines[0]); // TR Excel ; ayracını otomatik yakala
      headers = splitCsvLine(lines[0], delim);
      dataRows = lines.slice(1).map((line) => splitCsvLine(line, delim));
    }
    const fromFeed = !!activeFeed;
    const col = resolveHeader(headers);
    // Base olmayan (harici_kod/baslik/... dışındaki) başlık sütunları = kategori-özel
    // ADAY alanlar. Satırın kategorisine göre şema alanıyla eşleşirse attributes'a yazılır.
    const consumed = new Set<number>(Object.values(col));
    const attrCols = headers.map((h, i) => ({ i, h })).filter((x) => !consumed.has(x.i) && x.h.trim() !== "");
    if (col.title === undefined || col.price === undefined) {
      Alert.alert(translateCopy("Sütun bulunamadı", language), translateCopy("En az 'baslik' ve 'fiyat' sütunları gerekli. Şablonu kullan.", language));
      return;
    }
    // Mükerrer başlık/SKU uyarısı (aynı partide) — kullanıcı fark etsin.
    // Komisyon Türkçe ondalıkla da yazılabilir ("12,5"). Eskiden Number("12,5") = NaN olduğu için değer
    // SESSİZCE %10'a dönüyordu; artık geçersiz yazım hata verir.
    const overrideRaw = commissionAll.trim().replace(/^%\s*|\s*%$/g, "");
    const overrideParsed = overrideRaw ? parseListingRate(overrideRaw) : NaN;
    if (overrideRaw && !(overrideParsed > 0 && overrideParsed <= 90)) {
      Alert.alert(translateCopy("Komisyon geçersiz", language), translateCopy("Toplu komisyon 1 ile 90 arasında bir sayı olmalı (örn. 15 ya da 12,5).", language));
      return;
    }
    const overrideComm = overrideRaw ? overrideParsed : undefined;
    const seenTitles = new Set<string>();
    const seenSkus = new Set<string>();
    const bos = translateCopy("(boş)", language);
    const parsed: ParsedRow[] = dataRows.map((cells, idx) => {
      const get = (k: string) => (col[k] !== undefined ? (cells[col[k]] ?? "") : "");
      const sku = get("sku").trim();
      // SKU EŞLEŞMESİ: bu satırın SKU'su satıcının mevcut bir ilanına denk geliyorsa GÜNCELLEME modu.
      const existing = sku ? existingSkus.get(sku) : undefined;
      const mode: "new" | "update" = existing ? "update" : "new";
      const rawTitle = get("title");
      const tooLong = listingTitleLength(rawTitle) > LISTING_TITLE_LIMITS.max;
      const title = shortenTitles && tooLong ? shortenTitle(rawTitle, LISTING_TITLE_LIMITS.max) : rawTitle;
      const originalTitle = title !== rawTitle ? rawTitle : undefined;
      const description = get("description");
      const price = parseTrPrice(get("price"));
      const categoryRaw = get("category");
      // TAM YOL ("Emlak > Konut > Satılık > Daire") kesin eşleşir. Tek ad birçok dalda geçebildiği
      // için (Satılık, Diğer, marka/model adları) ada göre eşleme en sığ/dallı düğümü TAHMİN eder.
      // Yol yazılmış ama ağaçta yoksa kelime-benzerliğine DÜŞÜLMEZ (yanlış kategoriye gitmesin) → satır hatası.
      const isPathText = PATH_SEP.test(categoryRaw);
      let category = !categoryRaw ? undefined : isPathText ? matchCategoryLabelPath(categoryTree, categoryRaw) : matchCategoryByName(categoryRaw);
      // VARSAYILAN KATEGORİ (yalnız YENİ ilan): satırın kategorisi boş ya da ağaçta yoksa satıcının seçtiği
      // kategori kullanılır. XML akışında varsayılan da yoksa yolun SON adına göre eşleme denenir
      // (mağazanın kendi kategori ağacı bizimkiyle birebir örtüşmez); sonuç önizlemede tam yol olarak görünür.
      if (!category && mode === "new") {
        if (defCatMatch) category = defCatMatch;
        else if (fromFeed && isPathText) {
          const last = categoryRaw.split(PATH_SEP).map((p) => p.trim()).filter(Boolean).pop();
          if (last) category = matchCategoryByName(last);
        }
      }
      // GÜNCELLEMEDE KATEGORİ: tek ad / bulanık eşleşme HER ZAMAN yok sayılır (dışa aktarılıp geri yüklenen
      // ilanın etiketi sessizce değişmesin). Yalnız kökten yaprağa TAM ve TEK yol, mevcut yoldan FARKLIYSA yazılır.
      let categoryChange: ParsedRow["categoryChange"];
      let categoryPathIgnored = false;
      if (existing && isPathText && category) {
        const exact = exactLeafPath(categoryTree, categoryRaw, category);
        if (!exact) categoryPathIgnored = true;
        else {
          const nextSlugs = exact.map((n) => n.slug).join("/");
          const savedPath = existing.attributes?._path;
          const current = currentPathOf(existing);
          const same = (Array.isArray(savedPath) && savedPath.join("/") === nextSlugs && searchKey(String(existing.attributes?._leaf ?? existing.category ?? "")) === searchKey(exact[exact.length - 1].label))
            || (current.length > 0 && current.map((n) => n.slug).join("/") === nextSlugs);
          if (!same) {
            const nextFormKey = resolveFormKey(exact);
            const prevFormKey = typeof existing.attributes?._formKey === "string" && existing.attributes._formKey ? existing.attributes._formKey : current.length ? resolveFormKey(current) : "";
            categoryChange = { path: exact, from: current.length ? pathText(current) : (existing.category || "—"), to: pathText(exact), formKeyChanged: prevFormKey !== nextFormKey };
          }
        }
      }
      // VARSAYILAN İL / İLÇE (yalnız YENİ ilan, satırda il yazmıyorsa).
      const useDefaultProvince = mode === "new" && !get("province").trim() && !!defProvMatch;
      const prov = useDefaultProvince ? defProvMatch : resolveProvinceByName(get("province"));
      let districtId: number | undefined;
      if (prov) {
        const dName = (useDefaultProvince && !get("district").trim() ? defDistrict : get("district")).toLocaleLowerCase("tr-TR").trim();
        const d = districtsOfProvince(prov.id).find((x) => x.name.toLocaleLowerCase("tr-TR").trim() === dName);
        districtId = d?.id;
      }
      const commissionRaw = get("commission").trim().replace(/^%\s*|\s*%$/g, "");
      // Boş komisyon → %10 (önizlemede görünür). Dolu ama sayı değilse NaN kalır ve satır hata verir.
      const commission = overrideComm ?? (commissionRaw ? parseListingRate(commissionRaw) : 10);
      const commissionGiven = overrideComm !== undefined || commissionRaw !== "";
      const stockGiven = get("stock").trim() !== "";
      const partnershipRaw = get("partnership");
      const partnershipMode = partnershipRaw.trim() ? resolvePartnershipMode(partnershipRaw) : defPartnership;
      const stock = Math.max(1, Math.floor(parseTrPrice(get("stock")) || 1)); // TR-binlik ("1.500"→1500, Number 1.5 yapardı)
      // ÇOKLU GÖRSEL: gorsel_url'de | (veya boşlukla ayrılmış birden çok http) → galeri.
      // İlki kapak, kalanı ek görsel (adAssets). CSV'de görsel yoksa sıralı toplu-foto.
      const rawImage = get("image");
      const rawImageItems = rawImage.split(/[|\n]/).map((s) => s.trim()).filter(Boolean);
      const imageList = rawImageItems.slice(0, MAX_IMAGES);
      const images = imageList.length ? imageList : (bulkImages[idx] ? [bulkImages[idx]] : []);
      const image = images[0] || "";
      // KATEGORİ-ÖZEL ALANLAR: satırın kategorisinin şemasına göre aday sütunları eşle.
      const attrs: Record<string, string | number | boolean | string[]> = {};
      const recognizedAttrs: string[] = [];
      if (attrCols.length && category) {
        const schema = getFormSchema(resolveFormKey(category.path));
        for (const ac of attrCols) {
          const rawVal = (cells[ac.i] ?? "").trim();
          if (!rawVal) continue;
          const hn = normKey(ac.h);
          const field = schema.fields.find((f) => normKey(f.label) === hn || normKey(f.key) === hn);
          if (!field) continue;
          const coerced = coerceAttr(field, rawVal);
          if (coerced === undefined || (Array.isArray(coerced) && coerced.length === 0)) continue;
          attrs[field.key] = coerced;
          if (!recognizedAttrs.includes(field.label)) recognizedAttrs.push(field.label);
        }
      }
      const errors: string[] = [];
      // Fiyat her iki modda da zorunlu ve geçerli olmalı.
      if (!(price > 0)) errors.push(translateCopy("Fiyat geçersiz (0'dan büyük olmalı)", language));
      // Başlık: YENİ ilanda zorunlu; GÜNCELLEMEDE boşsa mevcut korunur (kısmi güncelleme).
      if (mode === "new" || title) {
        const v = validateListing({ title, description: description || "Toplu yükleme ürünü.", price });
        v.errors.forEach((e) => { if (e.field !== "description" && e.field !== "price") errors.push(translateCopy(e.message, language)); });
      }
      // Kategori/İl: YENİ ilanda zorunlu; GÜNCELLEMEDE yalnız dolu ama eşleşmezse hatadır.
      if (mode === "new") {
        if (!category) errors.push(`${translateCopy("Kategori eşleşmedi", language)}: "${categoryRaw || bos}"`);
        if (!prov) errors.push(`${translateCopy("İl eşleşmedi", language)}: "${get("province") || bos}"`);
      } else {
        if (categoryRaw && !category) errors.push(`${translateCopy("Kategori eşleşmedi", language)}: "${categoryRaw}"`);
        if (get("province") && !prov) errors.push(`${translateCopy("İl eşleşmedi", language)}: "${get("province")}"`);
      }
      // Komisyon yalnız ortak satış AÇIK/ONAYLI iken anlamlı; normal ilanda (none) atlanır.
      if (partnershipMode !== "none" && !(commission > 0 && commission <= 90)) errors.push(translateCopy("Komisyon 1–90 arası bir sayı olmalı (örn. 15 ya da 12,5)", language));
      // Görsel sütunu tam bağlantı ister; "resim.jpg" gibi dosya adı yayın sırasında değil ÖNİZLEMEDE hata versin.
      if (rawImageItems.some((item) => !/^https?:\/\//i.test(item))) errors.push(translateCopy("gorsel_url tam bağlantı olmalı (https:// ile başlamalı).", language));
      if (rawImageItems.length > MAX_IMAGES) errors.push(translateCopy(`İlan başına en fazla ${MAX_IMAGES} görsel eklenebilir. Fazla görselleri kaldır.`, language));
      // Görsel sütunu YALNIZ fotoğraf kabul eder. Video bağlantısı ilk sıradaysa KAPAK oluyor (kartlarda kırık
      // görsel), sonraki sıralarda ise 30 sn / 25 MB sınırı ve video kovası dışından "ilan videosu" sayılıyordu.
      if (rawImageItems.some((item) => isListingVideoUrl(item))) errors.push(translateCopy("gorsel_url sütununda video bağlantısı var. Bu sütuna yalnızca fotoğraf bağlantısı (JPG, PNG, WebP) yaz; videoyu ilan oluştuktan sonra ilanı düzenleyerek ekleyebilirsin.", language));
      // Mükerrer SKU (aynı partide iki kez) → upsert çakışması; reddet.
      if (sku && seenSkus.has(sku)) errors.push(translateCopy("Bu harici kod (SKU) partide zaten var (mükerrer)", language));
      else if (sku) seenSkus.add(sku);
      // Mükerrer başlık uyarısı yalnız SKU'suz yeni ilanlarda anlamlı (SKU'lu satırlar zaten tekil).
      const titleKey = title.toLocaleLowerCase("tr-TR").trim();
      if (!sku && titleKey && seenTitles.has(titleKey)) errors.push(translateCopy("Bu başlık partide zaten var (mükerrer)", language));
      else if (!sku && titleKey) seenTitles.add(titleKey);
      return { raw: {}, commissionGiven, stockGiven, sku, existingId: existing?.id, mode, title, originalTitle, description, price, category, categoryRaw, categoryChange, categoryPathIgnored, provinceId: prov?.id, districtId, provinceName: prov?.name, commission, partnershipMode, stock, image, images, attrs, recognizedAttrs, errors };
    });
    setRows(parsed);
  };

  const validRows = useMemo(() => (rows ?? []).filter((r) => r.errors.length === 0), [rows]);
  const newCount = useMemo(() => validRows.filter((r) => r.mode === "new").length, [validRows]);
  const updateCount = useMemo(() => validRows.filter((r) => r.mode === "update").length, [validRows]);
  const categoryChangeCount = useMemo(() => validRows.filter((r) => r.mode === "update" && r.categoryChange).length, [validRows]);

  async function pickBulkImages() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, mediaTypes: ["images"], quality: 0.85, selectionLimit: 60 });
    if (result.canceled) return;
    const uris = result.assets.map((a) => a.uri).filter(Boolean);
    setBulkImages(uris);
    // Sayı çevrilmez; sabit kısım sözlükten geçer (sayı metnin içindeyken anahtar hiç eşleşmiyordu).
    setNotice(`${uris.length} ${translateCopy("fotoğraf seçildi — satırlara sırayla atanacak (görsel_url boş olanlara). \"Ayrıştır\"a tekrar bas.", language)}`);
  }

  // DOSYADAN YÜKLE (web) — .csv ya da .xml seç. CSV metni yapıştırma alanına dolar; XML tabloya çevrilip
  // akış kartı olarak gösterilir. Excel için: "Farklı Kaydet → CSV UTF-8" (xlsx kütüphanesi bundle'ı şişirmesin diye taşımıyoruz).
  function pickCsvFile() {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.xml,text/csv,text/xml,application/xml,text/plain";
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const name = file.name.toLowerCase();
      if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        setNotice(translateCopy("Excel dosyasını doğrudan yükleyemiyoruz. Excel'de 'Farklı Kaydet → CSV UTF-8' seçip .csv olarak yükle.", language));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        let text = "";
        try { text = decodeFileBytes(reader.result as ArrayBuffer).replace(/^\uFEFF/, ""); } catch { text = ""; }
        if (name.endsWith(".xml") || looksLikeXml(text)) {
          try {
            const table = parseXmlFeed(text);
            setFeed(table);
            setFeedStart(0);
            setCsv("");
            setRows(null);
            setFailedRows([]);
            setNotice(`${file.name} — ${table.total} ${translateCopy("ürün bulundu. Varsayılan il ve komisyonu belirleyip 'Ayrıştır ve önizle'ye bas.", language)}`);
          } catch (e) {
            setNotice(translateCopy(e instanceof Error ? e.message : "XML dosyası ayrıştırılamadı.", language));
          }
          return;
        }
        setFeed(null);
        setFeedStart(0);
        setCsv(text);
        setNotice(`${file.name} — ${translateCopy("yüklendi. 'Ayrıştır ve önizle'ye bas.", language)}`);
      };
      reader.onerror = () => setNotice(translateCopy("Dosya okunamadı. Tekrar dene.", language));
      reader.readAsArrayBuffer(file);
    };
    input.click();
  }

  // XML BAĞLANTISI: adresi sunucu indirir (tarayıcı başka sitenin XML'ini okuyamaz), ayrıştırma dosyayla aynı yoldan.
  async function loadFromUrl() {
    if (fetchingUrl) return;
    setFetchingUrl(true);
    setNotice(null);
    try {
      const result = await fetchFeedFromUrl(feedUrl);
      if (!result.ok) { setNotice(translateCopy(result.error, language)); return; }
      try {
        const table = parseXmlFeed(result.text);
        setFeed(table);
        setFeedStart(0);
        setCsv("");
        setRows(null);
        setFailedRows([]);
        setNotice(`${table.total} ${translateCopy("ürün bulundu. Varsayılan il ve komisyonu belirleyip 'Ayrıştır ve önizle'ye bas.", language)}`);
      } catch (e) {
        setNotice(translateCopy(e instanceof Error ? e.message : "XML dosyası ayrıştırılamadı.", language));
      }
    } finally {
      if (alive.current) setFetchingUrl(false);
    }
  }

  async function saveFeedSettings(enabled: boolean) {
    if (feedBusy) return;
    setFeedBusy(true);
    try {
      const saved = await saveMyFeed(currentUser.id, { url: feedUrl, enabled, intervalHours: syncInterval, pauseMissing: syncPauseMissing });
      if (!alive.current) return;
      if (!saved) { setNotice(translateCopy("Bağlantı kaydedilemedi. Adresin http:// ya da https:// ile başladığını kontrol et.", language)); return; }
      setSavedFeed(saved);
      setNotice(translateCopy("Bağlantı kaydedildi. Fiyat ve stoklar seçtiğin aralıkla kendiliğinden eşitlenecek.", language));
    } finally {
      if (alive.current) setFeedBusy(false);
    }
  }

  async function syncNow() {
    if (!savedFeed || feedBusy) return;
    setFeedBusy(true);
    try {
      const result = await syncMyFeedNow(savedFeed.id);
      if (!alive.current) return;
      setNotice(result.ok ? `${translateCopy("Eşitlendi", language)}: ${translateCopy(describeFeedSummary(result.summary), language)}` : translateCopy(result.error, language));
      const fresh = await getMyFeed(currentUser.id);
      if (alive.current && fresh) setSavedFeed(fresh);
      if (result.ok) void loadSkus();
    } finally {
      if (alive.current) setFeedBusy(false);
    }
  }

  async function removeFeed() {
    if (feedBusy) return;
    setFeedBusy(true);
    try {
      const ok = await deleteMyFeed(currentUser.id);
      if (!alive.current) return;
      if (ok) { setSavedFeed(null); setNotice(translateCopy("Otomatik eşitleme kaldırıldı. İlanların olduğu gibi kalır.", language)); }
      else setNotice(translateCopy("Kaldırılamadı. Tekrar dene.", language));
    } finally {
      if (alive.current) setFeedBusy(false);
    }
  }

  function clearFeed() {
    setFeed(null);
    setFeedStart(0);
    setRows(null);
    setNotice(null);
  }

  // XML akışında parti değiştir: önceki/sonraki MAX_BULK ürün.
  function goToBatch(start: number) {
    if (!feed) return;
    const next = Math.max(0, Math.min(start, Math.max(0, feed.rows.length - 1)));
    setFeedStart(next);
    parse({ feed, start: next });
  }

  // HATALI SATIRLARI İNDİR (web) — XML akışında satır düzenlenemez; hatalılar Excel'de düzeltilip CSV olarak yüklenir.
  function downloadErrorRows() {
    const bad = (rows ?? []).filter((r) => r.errors.length > 0);
    if (!bad.length) return;
    downloadCsv(
      "toplu-ilan-hatali-satirlar.csv",
      ["harici_kod", "baslik", "aciklama", "fiyat", "kategori", "il", "ilce", "komisyon", "stok", "gorsel_url", "hata"],
      bad.map((r) => [r.sku, r.title, r.description, r.price ? String(r.price).replace(".", ",") : "", r.categoryRaw, r.provinceName ?? "", "", String(r.commission), String(r.stock), r.images.join("|"), r.errors.join(" · ")])
    );
  }

  // MEVCUT KATALOĞU DIŞA AKTAR (web) — satıcının ilanlarını şablon sütunlarında CSV'ye döker.
  // "Excel'de düzenle → tekrar yükle" (SKU upsert) döngüsünü tamamlar.
  async function exportMyCatalog() {
    if (Platform.OS !== "web") return;
    setExporting(true);
    setNotice(null);
    try {
      const list = await fetchMyListingsForExport(currentUser.id);
      if (!list.length) { setNotice(translateCopy("Dışa aktarılacak ilan bulunamadı.", language)); return; }
      const body = list.map((r) => {
        const prov = getProvince(r.provinceId);
        const dist = r.districtId ? districtsOfProvince(r.provinceId).find((d) => d.id === r.districtId) : undefined;
        // KATEGORİ = TAM YOL (kök > … > yaprak): tek etiket birçok dalda geçtiği için kayıpsız değil.
        // Geri yüklemede bu yol mevcut yolla AYNI çözülür → kategori değişikliği tetiklenmez.
        // Yol çözülemiyorsa (ağaçta olmayan eski etiket) kayıtlı etiket olduğu gibi yazılır.
        const catPath = listingCategoryPath({ category: r.category ?? "", attributes: (r.attributes ?? undefined) as Listing["attributes"] });
        const categoryCell = catPath.length ? pathText(catPath) : (r.category ?? "");
        return [r.externalId ?? "", r.title, r.description ?? "", String(r.price), categoryCell, prov?.name ?? "", dist?.name ?? "", String(r.commissionValue), String(r.stockCount), ""];
      });
      downloadCsv("ortaksat-ilanlarim.csv", ["harici_kod", "baslik", "aciklama", "fiyat", "kategori", "il", "ilce", "komisyon", "stok", "gorsel_url"], body);
      const noSku = list.filter((r) => !r.externalId).length;
      setNotice(`${list.length} ${translateCopy("ilan CSV olarak indirildi. Excel'de düzenleyip tekrar yükle — harici_kod'u koru, eşleşenler güncellenir.", language)}${noSku ? ` ${translateCopy("Not:", language)} ${noSku} ${translateCopy("ilanın harici kodu yok; kod ekleyip yüklersen upsert eşleşir.", language)}` : ""}`);
    } finally {
      setExporting(false);
    }
  }

  async function publish() {
    if (!validRows.length) return;
    setPublishing(true);
    setNotice(null);
    setFailedRows([]);
    setProgress({ done: 0, total: validRows.length });
    let created = 0;
    let updated = 0;
    let recategorized = 0;
    let pausedCount = 0;
    const failures: Array<{ row: number; title: string; reason: string }> = [];
    const touchedIds = new Set<string>(); // dosyada geçen mevcut ilan id'leri (pasife-al senkronu için)
    const doneRows = new Set<ParsedRow>(); // başarıyla yazılan satırlar (yeniden denemede tekrar gönderilmesin)
    let rateLimited = false;
    let attempted = 0;
    for (let i = 0; i < validRows.length; i++) {
      const r = validRows[i];
      try {
        if (r.mode === "update" && r.existingId) {
          // MEVCUT İLANI GÜNCELLE (SKU eşleşti) — yalnız DOLU alanlar yazılır (kısmi upsert).
          // KATEGORİ yalnız r.categoryChange varsa yazılır (kökten yaprağa TAM + TEK yol, mevcuttan farklı).
          // Tek ad / bulanık eşleşme güncellemede yok sayılır: dışa aktarılıp geri yüklenen ilanın etiketi
          // sessizce değişmesin. Yazılırken `category` kolonu ile attributes'taki _root/_leaf/_formKey/_path
          // BİRLİKTE ve TEK update'te değişir (yalnız kolon değişirse ilan — çözücü _leaf/_path'e baktığı için —
          // eski kategoride listelenmeye devam eder). Diğer attributes değerleri KORUNUR (sığ birleştirme);
          // mevcut attributes okunamazsa uç HİÇBİR ŞEY yazmaz → satır başarısız sayılır.
          const location = r.provinceId ? (formatLocation({ provinceId: r.provinceId, districtId: r.districtId }, "neighborhood") || getProvince(r.provinceId)?.name || undefined) : undefined;
          const change = r.categoryChange;
          const okUpd = await updateListingFieldsLive(r.existingId, {
            title: r.title || undefined,
            description: r.description || undefined,
            price: r.price,
            commissionValue: r.commissionGiven ? r.commission : undefined,
            stockCount: r.stockGiven ? r.stock : undefined,
            location,
            provinceId: r.provinceId,
            districtId: r.districtId,
            ...(change ? { category: change.path[change.path.length - 1].label, attributesPatch: categoryPathAttributes(change.path) } : null)
          });
          if (!okUpd) throw new Error(translateCopy(change ? "güncelleme kaydedilemedi (kategori değişikliği dahil hiçbir alan yazılmadı)" : "güncelleme kaydedilemedi", language));
          touchedIds.add(r.existingId);
          updated++;
          if (change) recategorized++;
        } else {
          // YENİ İLAN — SKU'yu externalId olarak yaz (sonraki yüklemede eşleşsin).
          const leaf = r.category!.node;
          const rootLabel = r.category!.path[0]?.label ?? leaf.label;
          // ÇOKLU GÖRSEL: tüm URL'leri yükle (uzak URL'ler zaten geçer) → kapak + ek galeri (adAssets).
          const uploaded = r.images.length
            ? (await Promise.all(r.images.map((u) => uploadListingImage(u, currentUser.id)))).filter(Boolean)
            : [];
          const cover = uploaded[0] || (leaf.image || r.category!.path.find((p) => p.image)?.image || "");
          const extraAssets = uploaded.slice(1);
          const auto = autoFillListing({ title: r.title, category: leaf.label, price: r.price, commission: r.commission, currency: "TRY" });
          const location = formatLocation({ provinceId: r.provinceId, districtId: r.districtId }, "neighborhood") || getProvince(r.provinceId)?.name || "Türkiye";
          await createListing({
            externalId: r.sku || undefined,
            title: r.title,
            description: r.description || auto.description,
            salesPitch: auto.salesPitch,
            shareTemplates: auto.shareTemplates,
            adAssets: extraAssets,
            tags: [rootLabel, leaf.label].filter(Boolean),
            price: r.price,
            currency: "TRY",
            commissionType: "rate",
            commissionValue: r.commission,
            bonusAmount: undefined,
            bonusQuota: undefined,
            category: leaf.label,
            location,
            provinceId: r.provinceId,
            districtId: r.districtId,
            neighborhoodId: undefined,
            addressVisibility: "neighborhood",
            locationNote: undefined,
            image: cover,
            stockCount: r.stock,
            minPartnerRating: 0,
            commissionDueDays: 3,
            returnWindowDays: 7,
            attributionWindowDays: 30,
            partnerRules: ["Komisyon sadece onaylı satış kaydında oluşur."],
            deliveryNote: "Teslimat ve ödeme satıcıyla alıcı arasında netleştirilir; OrtakSat para tutmaz.",
            contactMethod: "message",
            partnershipMode: r.partnershipMode,
            // Meta alanları ÖZELLİKLERDEN SONRA yazılır (özellik sütunu ezemesin) + benzersiz _path:
            // eş-etiketli dallarda _root/_leaf/_formKey ilanın dalını tek başına belirleyemiyor.
            attributes: { ...r.attrs, ...categoryPathAttributes(r.category!.path) }
          }, "pending_review"); // TOPLU: yayından önce admin onayı
          created++;
        }
        doneRows.add(r);
      } catch (e) {
        // TEK bir hatalı satır tüm partiyi durdurmasın: hatayı topla, devam et.
        const reason = e instanceof Error ? e.message : translateCopy("bilinmeyen hata", language);
        // SAATLİK SINIR: kalan her satır da aynı nedenle reddedilir → istek yağdırma, burada dur.
        if (isRateLimitError(reason)) { rateLimited = true; attempted = i; break; }
        failures.push({ row: i + 1, title: r.title, reason });
      } finally {
        setProgress({ done: i + 1, total: validRows.length });
      }
    }
    // TAM-KATALOG SENKRONU (opsiyonel): dosyada OLMAYAN, SKU'lu AKTİF ilanları pasife al.
    // Yalnız hatasız partide çalışır (yarım dosyayla yanlışlıkla ilan gizlenmesin).
    if (deactivateMissing && failures.length === 0 && !rateLimited) {
      const toPause: string[] = [];
      // XML akışı partilere bölündüğü için "dosyada yok" kararı PARTİYE değil AKIŞIN TAMAMINA göre verilir
      // (yoksa sonraki partilerdeki ilanlar pasife alınırdı). Stokta olmayan ürünler akış kodlarında yoktur → pasife alınır.
      const fullSkus = feed ? new Set(feed.skus) : null;
      existingSkus.forEach((v, sku) => { if (!touchedIds.has(v.id) && v.status === "active" && !(fullSkus && fullSkus.has(sku))) toPause.push(v.id); });
      for (const id of toPause) {
        try { if (await updateListingFieldsLive(id, { status: "paused" })) pausedCount++; } catch { /* yut — tek ilan takılmasın */ }
      }
    }
    if (!alive.current) return; // ekran kapandı: durum yazma / yönlendirme yok
    setProgress(null);
    setPublishing(false);
    setFailedRows(failures);
    // Eşleşme haritasını tazele: yazılan kategori/SKU'lar sonraki önizlemede "mevcut" olarak görünsün
    // (yoksa aynı dosya yeniden ayrıştırılınca tamamlanmış kategori değişiklikleri tekrar "değişecek" görünür).
    if (created || updated) void loadSkus();
    // YENİDEN DENEME GÜVENLİĞİ: başarıyla yazılan satırlar önizlemeden çıkar. Eskiden kısmi başarıdan sonra
    // düğmeye yeniden basmak harici kodu olmayan ilanları İKİNCİ KEZ açıyordu.
    if (rateLimited || failures.length > 0) setRows((prev) => (prev ? prev.filter((row) => !doneRows.has(row)) : prev));
    if (rateLimited) {
      const remaining = validRows.length - attempted;
      setNotice(`${created + updated} ${translateCopy("ilan yüklendi. Saatlik ilan sınırına ulaşıldı;", language)} ${remaining} ${translateCopy("satır yüklenmedi ve önizlemede bekliyor. Yaklaşık bir saat sonra aynı düğmeye yeniden bas; yüklenenler tekrar gönderilmez.", language)}`);
      return;
    }
    if (failures.length === 0) {
      const parts: string[] = [];
      if (created) parts.push(`${created} ${translateCopy("yeni ilan onaya gönderildi", language)}`);
      if (updated) parts.push(`${updated} ${translateCopy("mevcut ilan güncellendi", language)}`);
      if (recategorized) parts.push(`${recategorized} ${translateCopy("ilanın kategorisi değişti", language)}`);
      if (pausedCount) parts.push(`${pausedCount} ${translateCopy("ilan pasife alındı", language)}`);
      const nextStart = feed ? feedStart + MAX_BULK : 0;
      if (feed && nextStart < feed.rows.length) {
        // XML akışında sıradaki parti: ekranda kal, sonraki MAX_BULK ürünü önizlemeye getir.
        setNotice(`${parts.join(" · ")}. ${translateCopy("Sıradaki parti önizlemede:", language)} ${nextStart + 1}–${Math.min(nextStart + MAX_BULK, feed.rows.length)} / ${feed.rows.length}.`);
        setFeedStart(nextStart);
        parse({ feed, start: nextStart, keepNotice: true });
        return;
      }
      setNotice(`${parts.join(" · ")}.`);
      setRows(null);
      setCsv("");
      setFeed(null);
      setFeedStart(0);
      setBulkImages([]);
      if (navTimer.current) clearTimeout(navTimer.current);
      navTimer.current = setTimeout(() => router.replace("/(tabs)/seller"), 2400);
    } else {
      // Kısmi başarı: başarısızlar listelenir + CSV indirilebilir; kullanıcı düzeltip tekrar dener.
      setNotice(`${created + updated} ${translateCopy("başarılı", language)} · ${failures.length} ${translateCopy("başarısız", language)}. ${translateCopy("Başarısız satırları aşağıda görüp CSV olarak indirebilirsin.", language)}`);
    }
  }

  function downloadFailedCsv() {
    downloadCsv(
      "toplu-ilan-basarisiz.csv",
      ["satir", "baslik", "sebep"],
      failedRows.map((f) => [String(f.row), f.title, f.reason])
    );
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ backgroundColor: colors.background, flexGrow: 1, paddingBottom: 0 }} style={{ backgroundColor: colors.background }}>
      <Head>
        <title>{translateCopy("Toplu İlan Yükle — OrtakSat", language)}</title>
        <meta name="description" content={translateCopy("CSV veya XML ürün akışıyla toplu ürün yükle, kategori/il eşle, komisyonu toplu belirle. İlanlar admin onayından sonra yayına alınır.", language)} />
      </Head>
      <WebContainer max={1100} padding={16} style={{ gap: 16, paddingTop: 16 }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/seller"))} accessibilityRole="button" style={({ pressed }) => ({ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, opacity: pressed ? 0.7 : 1, paddingHorizontal: 14, paddingVertical: 8 })}>
          <MaterialCommunityIcons name="arrow-left" size={17} color={colors.primaryDark} />
          <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>{translateCopy("Geri", language)}</Text>
        </Pressable>

        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.ink, fontSize: 26, fontWeight: "900" }}>{translateCopy("Toplu ilan yükleme", language)}</Text>
          <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>{translateCopy("Yüzlerce ürünü tek tek girmek yerine CSV dosyasıyla ya da e-ticaret sitenin ürün XML'iyle yükle. Kategori ve il otomatik eşlenir, komisyonu toplu belirlersin. İlanlar admin onayından sonra yayına alınır.", language)}</Text>
        </View>

        {/* Adım 1: şablon */}
        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 10, padding: 16 }}>
          <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>1) {translateCopy("Şablonu kullan", language)}</Text>
          <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{translateCopy(`Sütunlar: harici_kod, baslik, aciklama, fiyat, kategori, il, ilce, komisyon, stok, gorsel_url. Birden çok görsel için gorsel_url'e URL'leri | ile ayır; ilan başına en fazla ${MAX_IMAGES} görsel eklenir, ilki kapak olur. Excel'de düzenleyip CSV olarak kaydet, sonra buraya yapıştır.`, language)}</Text>
          <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{translateCopy("Kategori: aynı ad birçok dalda geçebilir (Satılık, Diğer, marka adları). İlanın tam istediğin yerde görünmesi için yolu > ile yaz: Emlak > Konut > Satılık > Daire.", language)}</Text>
          <View style={{ alignItems: "flex-start", backgroundColor: colors.infoSoft, borderRadius: 10, flexDirection: "row", gap: 8, padding: 11 }}>
            <MaterialCommunityIcons name="barcode-scan" size={16} color={colors.info} style={{ marginTop: 1 }} />
            <Text style={{ color: colors.muted, flex: 1, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>
              <Text style={{ color: colors.ink, fontWeight: "800" }}>{translateCopy("harici_kod (SKU)", language)}</Text>
              {" "}
              {translateCopy("kendi ürün kodun/barkodun. Aynı kodla tekrar yükleyince sistem yeni ilan AÇMAZ, mevcut ilanı GÜNCELLER (fiyat/stok senkronu). Boş bırakırsan her zaman yeni ilan açılır.", language)}
            </Text>
          </View>
          <View style={{ alignItems: "flex-start", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, padding: 11 }}>
            <MaterialCommunityIcons name="tune-variant" size={16} color={colors.primaryDark} style={{ marginTop: 1 }} />
            <Text style={{ color: colors.muted, flex: 1, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>
              <Text style={{ color: colors.ink, fontWeight: "800" }}>{translateCopy("Kategoriye özel sütunlar (opsiyonel):", language)}</Text>
              {" "}
              {translateCopy("Marka, Model, Yıl, Renk, Durum gibi sütunlar ekleyebilirsin. Sütun başlığı o kategorinin özelliğiyle eşleşirse otomatik doldurulur (özellik tablosunda + filtrelerde görünür). Eşleşmeyen sütunlar yok sayılır.", language)}
            </Text>
          </View>
          <View style={{ alignItems: "flex-start", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, padding: 11 }}>
            <MaterialCommunityIcons name="handshake-outline" size={16} color={colors.primaryDark} style={{ marginTop: 1 }} />
            <Text style={{ color: colors.muted, flex: 1, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>
              <Text style={{ color: colors.ink, fontWeight: "800" }}>{translateCopy("ortak_satis (opsiyonel):", language)}</Text>
              {" "}
              {translateCopy("Ortaklık modunu satır bazında seç — onaylı (varsayılan: ortakları onaylarsın), açık (herkes ortak olabilir) veya kapalı (normal ilan, ortaksız/komisyonsuz). Boş bırakırsan onaylı.", language)}
            </Text>
          </View>
          <View style={{ alignItems: "flex-start", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, padding: 11 }}>
            <MaterialCommunityIcons name="xml" size={16} color={colors.primaryDark} style={{ marginTop: 1 }} />
            <Text style={{ color: colors.muted, flex: 1, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>
              <Text style={{ color: colors.ink, fontWeight: "800" }}>{translateCopy("XML ürün akışı:", language)}</Text>
              {" "}
              {translateCopy("E-ticaret siten ürün XML'i veriyorsa şablona gerek yok; XML dosyasını 2. adımda yükle. Ürün adı, kodu, fiyatı, stoğu, kategorisi, markası ve görselleri otomatik tanınır (Google Merchant ürün akışı dahil).", language)}
            </Text>
          </View>
          <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, padding: 10 }}>
            <Text selectable style={{ color: colors.ink, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontSize: 11.5 }}>{TEMPLATE}</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Pressable onPress={() => void Clipboard.setStringAsync(TEMPLATE).then(() => setNotice(translateCopy("Şablon panoya kopyalandı.", language))).catch(() => {})} style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 9, flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 9 }}>
              <MaterialCommunityIcons name="content-copy" size={15} color={colors.primaryDark} />
              <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Şablonu kopyala", language)}</Text>
            </Pressable>
            {Platform.OS === "web" ? (
              <Pressable onPress={() => downloadCsv("ortaksat-toplu-ilan-sablon.csv", ["harici_kod", "baslik", "aciklama", "fiyat", "kategori", "il", "ilce", "komisyon", "stok", "gorsel_url"], [["URUN-1001", "Örnek Ürün Adı", "Ürünün kısa açıklaması", "1500", "Elektronik", "İstanbul", "Kadıköy", "15", "3", "https://...jpg"], ["URUN-1002", "İkinci Ürün", "Açıklama metni", "899", "Moda & Giyim", "Ankara", "Çankaya", "20", "10", ""]])} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 9, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 9 }}>
                <MaterialCommunityIcons name="download" size={15} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Şablonu indir (.csv)", language)}</Text>
              </Pressable>
            ) : null}
            {Platform.OS === "web" ? (
              <Pressable disabled={exporting} onPress={() => void exportMyCatalog()} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 9, borderWidth: 1, flexDirection: "row", gap: 6, opacity: exporting ? 0.6 : 1, paddingHorizontal: 14, paddingVertical: 9 }}>
                <MaterialCommunityIcons name={exporting ? "loading" : "database-export-outline"} size={15} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{exporting ? translateCopy("Hazırlanıyor…", language) : translateCopy("Mevcut ilanlarımı dışa aktar", language)}</Text>
              </Pressable>
            ) : null}
          </View>
          {Platform.OS === "web" ? (
            <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "600", lineHeight: 15 }}>{translateCopy("İpucu: Mevcut ilanlarını dışa aktar, Excel'de fiyat/stok güncelle, tekrar yükle — harici_kod eşleşenler otomatik güncellenir (yeni ilan açılmaz).", language)}</Text>
          ) : null}
          <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "600", lineHeight: 15 }}>{translateCopy("Mevcut ilanın kategorisini değiştirmek için kategori sütununa kökten yaprağa TAM yolu yaz (Emlak > Konut > Satılık > Daire). Tek ad yazarsan güncellemede kategoriye dokunulmaz. Dışa aktarım tam yolu yazar; dokunmadığın satırların kategorisi değişmez.", language)}</Text>
        </View>

        {/* Adım 2: yapıştır + toplu ayarlar */}
        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 12, padding: 16 }}>
          <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Text style={{ color: colors.ink, flex: 1, fontSize: 15, fontWeight: "900" }}>2) {translateCopy("CSV veya XML yükle ya da yapıştır", language)}</Text>
            {Platform.OS === "web" ? (
              <Pressable onPress={pickCsvFile} style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 9, flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 9 }}>
                <MaterialCommunityIcons name="file-upload-outline" size={15} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Dosyadan yükle (.csv / .xml)", language)}</Text>
              </Pressable>
            ) : null}
          </View>
          {/* XML BAĞLANTISI — dosya indirmeden, e-ticaret sitesinin ürün XML adresinden getir (indirme sunucuda yapılır). */}
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{translateCopy("XML bağlantısı — e-ticaret sitenin ürün XML adresi (opsiyonel)", language)}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <TextInput value={feedUrl} onChangeText={setFeedUrl} accessibilityLabel={translateCopy("XML bağlantısı", language)} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://siten.com/urunler.xml" placeholderTextColor={colors.subtle} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, flexGrow: 1, fontSize: 13.5, minHeight: 44, minWidth: 220, paddingHorizontal: 12 }} />
              <Pressable disabled={fetchingUrl || !feedUrl.trim()} onPress={() => void loadFromUrl()} accessibilityRole="button" style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 10, flexDirection: "row", gap: 6, minHeight: 44, opacity: fetchingUrl || !feedUrl.trim() ? 0.6 : 1, paddingHorizontal: 14 }}>
                <MaterialCommunityIcons name={fetchingUrl ? "loading" : "link-variant"} size={16} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{fetchingUrl ? translateCopy("Getiriliyor…", language) : translateCopy("Bağlantıdan getir", language)}</Text>
              </Pressable>
            </View>
          </View>
          {/* OTOMATİK EŞİTLEME — bağlantı kaydedilirse fiyat/stok sunucuda belirli aralıklarla güncellenir. */}
          {feedUrl.trim() || savedFeed ? (
            <View testID="auto-sync-card" style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 12, borderWidth: 1, gap: 9, padding: 14 }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                <MaterialCommunityIcons name="sync" size={18} color={colors.primaryDark} />
                <Text style={{ color: colors.ink, flex: 1, fontSize: 13.5, fontWeight: "900" }}>{translateCopy("Otomatik fiyat ve stok eşitleme", language)}</Text>
                {savedFeed ? <Text style={{ color: savedFeed.enabled ? colors.primaryDark : colors.muted, fontSize: 11.5, fontWeight: "800" }}>{translateCopy(savedFeed.enabled ? "Açık" : "Kapalı", language)}</Text> : null}
              </View>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 17 }}>{translateCopy("Bağlantını kaydedersen, ürün kodu eşleşen ilanlarının fiyatı ve stoğu seçtiğin aralıkla kendiliğinden güncellenir. Stokta kalmayan ürünün yayındaki ilanı pasife alınır, yeniden stoğa girince geri açılır. Yeni ürünler için ilan açılmaz; onları bu ekrandan içe aktarırsın.", language)}</Text>
              <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{translateCopy("Aralık:", language)}</Text>
                {FEED_INTERVALS.map((h) => (
                  <Pressable key={h} onPress={() => setSyncInterval(h)} accessibilityRole="radio" accessibilityState={{ checked: syncInterval === h }} accessibilityLabel={`${h} ${translateCopy("saatte bir", language)}`} style={{ backgroundColor: syncInterval === h ? colors.primary : colors.surface, borderColor: syncInterval === h ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, justifyContent: "center", minHeight: 34, paddingHorizontal: 12 }}>
                    <Text style={{ color: syncInterval === h ? "#FFFFFF" : colors.ink, fontSize: 12, fontWeight: "800" }}>{h} {translateCopy("saat", language)}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable onPress={() => setSyncPauseMissing((v) => !v)} accessibilityRole="switch" accessibilityState={{ checked: syncPauseMissing }} accessibilityLabel={translateCopy("Akıştan çıkarılan ürünleri pasife al", language)} style={{ alignItems: "flex-start", flexDirection: "row", gap: 9 }}>
                <MaterialCommunityIcons name={syncPauseMissing ? "checkbox-marked" : "checkbox-blank-outline"} size={20} color={syncPauseMissing ? colors.primaryDark : colors.muted} />
                <Text style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "700", lineHeight: 18 }}>{translateCopy("Akıştan tamamen çıkarılan ürünlerin ilanlarını da pasife al", language)}</Text>
              </Pressable>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Pressable disabled={feedBusy || !feedUrl.trim()} onPress={() => void saveFeedSettings(true)} accessibilityRole="button" style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, justifyContent: "center", minHeight: 42, opacity: feedBusy || !feedUrl.trim() ? 0.6 : 1, paddingHorizontal: 14 }}>
                  <Text style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: "900" }}>{translateCopy(savedFeed ? "Ayarları kaydet" : "Bağlantıyı kaydet ve otomatik eşitle", language)}</Text>
                </Pressable>
                {savedFeed ? (
                  <Pressable disabled={feedBusy} onPress={() => void syncNow()} accessibilityRole="button" style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 6, minHeight: 42, opacity: feedBusy ? 0.6 : 1, paddingHorizontal: 14 }}>
                    <MaterialCommunityIcons name={feedBusy ? "loading" : "refresh"} size={15} color={colors.primaryDark} />
                    <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Şimdi eşitle", language)}</Text>
                  </Pressable>
                ) : null}
                {savedFeed ? (
                  <Pressable disabled={feedBusy} onPress={() => void removeFeed()} accessibilityRole="button" style={{ alignItems: "center", justifyContent: "center", minHeight: 42, opacity: feedBusy ? 0.6 : 1, paddingHorizontal: 10 }}>
                    <Text style={{ color: colors.accent, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Otomatik eşitlemeyi kaldır", language)}</Text>
                  </Pressable>
                ) : null}
              </View>
              {savedFeed ? (
                <Text testID="auto-sync-status" style={{ color: savedFeed.lastStatus === "error" ? colors.accent : colors.muted, fontSize: 11.5, fontWeight: "700", lineHeight: 16 }}>
                  {savedFeed.lastRunAt
                    ? `${translateCopy("Son eşitleme", language)}: ${shortDate(savedFeed.lastRunAt)} — ${savedFeed.lastStatus === "error" ? translateCopy(savedFeed.lastError ?? "Eşitleme tamamlanamadı.", language) : translateCopy(describeFeedSummary(savedFeed.lastSummary), language)}`
                    : translateCopy("Henüz eşitlenmedi; ilk eşitleme yarım saat içinde yapılır ya da 'Şimdi eşitle'ye basabilirsin.", language)}
                </Text>
              ) : null}
            </View>
          ) : null}
          {feed ? (
            <View testID="feed-card" style={{ backgroundColor: colors.infoSoft, borderRadius: 12, gap: 8, padding: 14 }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                <MaterialCommunityIcons name="xml" size={18} color={colors.info} />
                <Text style={{ color: colors.ink, flex: 1, fontSize: 13.5, fontWeight: "900" }}>{translateCopy("XML ürün akışı yüklendi", language)} · {feed.total} {translateCopy("ürün", language)}</Text>
                <Pressable onPress={clearFeed} accessibilityRole="button" accessibilityLabel={translateCopy("XML akışını kaldır", language)} style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 5, minHeight: 36, paddingHorizontal: 10 }}>
                  <MaterialCommunityIcons name="close" size={14} color={colors.muted} />
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{translateCopy("Kaldır", language)}</Text>
                </Pressable>
              </View>
              <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "700", lineHeight: 18 }}>
                {feed.rows.length} {translateCopy("ürün yüklenebilir", language)}
                {feed.outOfStock ? ` · ${feed.outOfStock} ${translateCopy("ürün stokta olmadığı için alınmadı", language)}` : ""}
                {feed.foreignCurrency ? ` · ${feed.foreignCurrency} ${translateCopy("ürünün fiyatı TL değil, fiyatı boş bırakıldı", language)}` : ""}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 17 }}>{translateCopy("XML akışlarında il ve komisyon bulunmaz: aşağıdan varsayılan ili ve komisyonu belirle. Mağazanın kategorileri OrtakSat kategorileriyle eşleşmezse varsayılan kategori kullanılır. Aynı ürün koduyla tekrar yüklediğinde ilanlar güncellenir, yenisi açılmaz.", language)}</Text>
              {feed.rows.length > MAX_BULK ? (
                <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Parti", language)}: {feedStart + 1}–{Math.min(feedStart + MAX_BULK, feed.rows.length)} / {feed.rows.length}</Text>
                  <Pressable disabled={feedStart === 0 || publishing} onPress={() => goToBatch(feedStart - MAX_BULK)} accessibilityRole="button" style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, justifyContent: "center", minHeight: 36, opacity: feedStart === 0 || publishing ? 0.5 : 1, paddingHorizontal: 12 }}>
                    <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>{translateCopy("Önceki parti", language)}</Text>
                  </Pressable>
                  <Pressable disabled={feedStart + MAX_BULK >= feed.rows.length || publishing} onPress={() => goToBatch(feedStart + MAX_BULK)} accessibilityRole="button" style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, justifyContent: "center", minHeight: 36, opacity: feedStart + MAX_BULK >= feed.rows.length || publishing ? 0.5 : 1, paddingHorizontal: 12 }}>
                    <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>{translateCopy("Sonraki parti", language)}</Text>
                  </Pressable>
                  <Text style={{ color: colors.muted, flex: 1, fontSize: 11.5, fontWeight: "600", minWidth: 180 }}>{translateCopy("Ürünler 200'lük partilerle yüklenir; bir parti bitince sıradaki önizlemeye gelir.", language)}</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <TextInput value={csv} onChangeText={setCsv} multiline placeholder={translateCopy("CSV veya XML içeriğini buraya yapıştır…", language)} placeholderTextColor={colors.subtle} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 11, borderWidth: 1, color: colors.ink, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontSize: 12.5, minHeight: 150, paddingHorizontal: 12, paddingVertical: 10, textAlignVertical: "top" }} />
          )}
          {/* VARSAYILANLAR — satırında il / kategori yazmayan YENİ ilanlara uygulanır (XML akışlarında il hiç yoktur). */}
          <View style={{ gap: 7 }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{translateCopy("Varsayılanlar — satırda yazmıyorsa yeni ilanlara uygulanır (opsiyonel)", language)}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              <View style={{ gap: 4 }}>
                <TextInput value={defProvince} onChangeText={setDefProvince} accessibilityLabel={translateCopy("Varsayılan il", language)} placeholder={translateCopy("Varsayılan il, örn. İstanbul", language)} placeholderTextColor={colors.subtle} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 13.5, minHeight: 44, paddingHorizontal: 12, width: 220 }} />
                {defProvince.trim() ? <Text style={{ color: defProvMatch ? colors.primaryDark : colors.accent, fontSize: 11.5, fontWeight: "700" }}>{defProvMatch ? defProvMatch.name : translateCopy("İl bulunamadı", language)}</Text> : null}
              </View>
              <View style={{ gap: 4 }}>
                <TextInput value={defDistrict} onChangeText={setDefDistrict} accessibilityLabel={translateCopy("Varsayılan ilçe", language)} placeholder={translateCopy("Varsayılan ilçe, örn. Kadıköy", language)} placeholderTextColor={colors.subtle} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 13.5, minHeight: 44, paddingHorizontal: 12, width: 220 }} />
                {defDistrict.trim() ? <Text style={{ color: defDistMatch ? colors.primaryDark : colors.accent, fontSize: 11.5, fontWeight: "700" }}>{defDistMatch ? defDistMatch.name : translateCopy(defProvMatch ? "Bu ilde böyle bir ilçe yok" : "Önce ili yaz", language)}</Text> : null}
              </View>
              <View style={{ flexGrow: 1, gap: 4, minWidth: 240 }}>
                <TextInput value={defCategory} onChangeText={setDefCategory} accessibilityLabel={translateCopy("Varsayılan kategori", language)} placeholder={translateCopy("Varsayılan kategori, örn. Elektronik", language)} placeholderTextColor={colors.subtle} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 13.5, minHeight: 44, paddingHorizontal: 12 }} />
                {defCategory.trim() ? <Text style={{ color: defCatMatch ? colors.primaryDark : colors.accent, fontSize: 11.5, fontWeight: "700" }}>{defCatMatch ? defCatMatch.path.map((n) => translateCopy(n.label, language)).join(" › ") : translateCopy("Kategori bulunamadı — adı ya da yolu (Üst > Alt) yaz", language)}</Text> : null}
              </View>
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <View style={{ gap: 5, minWidth: 200 }}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{translateCopy("Komisyonu toplu belirle (%) — opsiyonel", language)}</Text>
              <TextInput value={commissionAll} onChangeText={setCommissionAll} keyboardType="numeric" placeholder={translateCopy("Tüm satırlara uygula, örn. 15", language)} placeholderTextColor={colors.subtle} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 13.5, minHeight: 44, paddingHorizontal: 12, width: 240 }} />
            </View>
            <View style={{ gap: 5 }}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{translateCopy("Toplu fotoğraf (sıralı) — opsiyonel", language)}</Text>
              <Pressable onPress={() => void pickBulkImages()} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 7, paddingHorizontal: 14, paddingVertical: 11 }}>
                <MaterialCommunityIcons name="image-multiple-outline" size={16} color={colors.primaryDark} />
                <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{bulkImages.length ? `${bulkImages.length} ${translateCopy("foto seçildi", language)}` : translateCopy("Galeriden seç", language)}</Text>
              </Pressable>
            </View>
          </View>
            <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{translateCopy("Varsayılan ortaklık türü:", language)}</Text>
              {([["approval", "Onayıma bağlı"], ["open", "Herkese açık"], ["none", "Ortaksız (normal ilan)"]] as const).map(([mode, label]) => (
                <Pressable key={mode} onPress={() => setDefPartnership(mode)} accessibilityRole="radio" accessibilityState={{ checked: defPartnership === mode }} accessibilityLabel={`${translateCopy("Varsayılan ortaklık türü", language)}: ${translateCopy(label, language)}`} style={{ backgroundColor: defPartnership === mode ? colors.primary : colors.surface, borderColor: defPartnership === mode ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, justifyContent: "center", minHeight: 34, paddingHorizontal: 12 }}>
                  <Text style={{ color: defPartnership === mode ? "#FFFFFF" : colors.ink, fontSize: 12, fontWeight: "800" }}>{translateCopy(label, language)}</Text>
                </Pressable>
              ))}
            </View>
          <Pressable onPress={() => setShortenTitles((v) => !v)} accessibilityRole="switch" accessibilityState={{ checked: shortenTitles }} accessibilityLabel={translateCopy("Uzun başlıkları kısalt", language)} style={{ alignItems: "flex-start", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 10, padding: 12 }}>
            <MaterialCommunityIcons name={shortenTitles ? "checkbox-marked" : "checkbox-blank-outline"} size={20} color={shortenTitles ? colors.primaryDark : colors.muted} style={{ marginTop: 1 }} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("70 karakterden uzun başlıkları kelime sınırında kısalt", language)}</Text>
              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600", lineHeight: 15 }}>{translateCopy("İşaretlemezsen uzun başlıklı satırlar hata verir ve yüklenmez. İşaretlersen başlık son tam kelimede kesilir; önizlemede özgün başlığı da görürsün.", language)}</Text>
            </View>
          </Pressable>
          <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "600", lineHeight: 15 }}>{translateCopy("Komisyon sütunu boş olan satırlara %10 uygulanır. Bir saatte en çok 2.000 yeni ilan yüklenebilir; sınıra ulaşılırsa kalan satırlar önizlemede bekler.", language)}</Text>
          <Pressable onPress={() => parse()} style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 11, flexDirection: "row", gap: 7, paddingHorizontal: 20, paddingVertical: 12 }}>
            <MaterialCommunityIcons name="table-check" size={17} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" }}>{translateCopy("Ayrıştır ve önizle", language)}</Text>
          </Pressable>
        </View>

        {notice ? (
          <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 12, flexDirection: "row", gap: 9, padding: 13 }}>
            <MaterialCommunityIcons name="information-outline" size={18} color={colors.primaryDark} />
            <Text style={{ color: colors.primaryDark, flex: 1, fontSize: 12.5, fontWeight: "700" }}>{notice}</Text>
          </View>
        ) : null}

        {/* İlerleme çubuğu — uzun partilerde nerede olduğunu göster. */}
        {progress ? (
          <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 12, borderWidth: 1, gap: 7, padding: 13 }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
              <MaterialCommunityIcons name="cloud-upload-outline" size={16} color={colors.primaryDark} />
              <Text style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Yükleniyor", language)}… {progress.done}/{progress.total}</Text>
            </View>
            <View style={{ backgroundColor: colors.line, borderRadius: 999, height: 7, overflow: "hidden" }}>
              <View style={{ backgroundColor: colors.primary, height: 7, width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }} />
            </View>
          </View>
        ) : null}

        {/* Başarısız satır raporu — parti tümden iptal olmaz; düzelt-ve-tekrar. */}
        {failedRows.length > 0 ? (
          <View style={{ backgroundColor: colors.accentSoft, borderColor: colors.accent, borderRadius: 12, borderWidth: 1, gap: 7, padding: 13 }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
              <MaterialCommunityIcons name="alert-circle-outline" size={17} color={colors.accent} />
              <Text style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "900" }}>{failedRows.length} {translateCopy("satır yüklenemedi", language)}</Text>
              {Platform.OS === "web" ? (
                <Pressable onPress={downloadFailedCsv} accessibilityRole="button" style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.accent, borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 10, paddingVertical: 6 }}>
                  <MaterialCommunityIcons name="download" size={13} color={colors.accent} />
                  <Text style={{ color: colors.accent, fontSize: 11.5, fontWeight: "800" }}>CSV</Text>
                </Pressable>
              ) : null}
            </View>
            {failedRows.slice(0, 10).map((f) => (
              <Text key={f.row} numberOfLines={1} style={{ color: colors.ink, fontSize: 11.5, fontWeight: "600" }}>#{f.row} {f.title} — {f.reason}</Text>
            ))}
            {failedRows.length > 10 ? <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>+{failedRows.length - 10} {translateCopy("daha", language)}</Text> : null}
          </View>
        ) : null}

        {/* Adım 3: önizleme */}
        {rows ? (
          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 10, padding: 16 }}>
            <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Text style={{ color: colors.ink, flex: 1, fontSize: 15, fontWeight: "900" }}>3) {translateCopy("Önizleme", language)} · {validRows.length}/{rows.length} {translateCopy("geçerli", language)}</Text>
              {newCount > 0 ? (
                <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, flexDirection: "row", gap: 4, paddingHorizontal: 9, paddingVertical: 4 }}>
                  <MaterialCommunityIcons name="plus-circle" size={12} color={colors.primaryDark} />
                  <Text style={{ color: colors.primaryDark, fontSize: 11, fontWeight: "800" }}>{newCount} {translateCopy("yeni", language)}</Text>
                </View>
              ) : null}
              {updateCount > 0 ? (
                <View style={{ alignItems: "center", backgroundColor: colors.infoSoft, borderRadius: 999, flexDirection: "row", gap: 4, paddingHorizontal: 9, paddingVertical: 4 }}>
                  <MaterialCommunityIcons name="sync" size={12} color={colors.info} />
                  <Text style={{ color: colors.info, fontSize: 11, fontWeight: "800" }}>{updateCount} {translateCopy("güncelle", language)}</Text>
                </View>
              ) : null}
              {categoryChangeCount > 0 ? (
                <View style={{ alignItems: "center", backgroundColor: colors.goldSoft, borderRadius: 999, flexDirection: "row", gap: 4, paddingHorizontal: 9, paddingVertical: 4 }}>
                  <MaterialCommunityIcons name="swap-horizontal" size={12} color={colors.goldInk} />
                  <Text style={{ color: colors.goldInk, fontSize: 11, fontWeight: "800" }}>{categoryChangeCount} {translateCopy("kategori değişecek", language)}</Text>
                </View>
              ) : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator style={{ maxWidth: "100%" }}>
              <View style={{ gap: 6, minWidth: 812 }}>
                <View style={{ flexDirection: "row", gap: 8, paddingBottom: 6 }}>
                  {[["#", 26], [translateCopy("Durum", language), 58], [translateCopy("İşlem", language), 78], [translateCopy("SKU", language), 96], [translateCopy("Başlık", language), 190], [translateCopy("Fiyat", language), 84], [translateCopy("Kategori", language), 130], [translateCopy("İl", language), 78], ["%", 40]].map(([h, w], i) => (
                    <Text key={i} style={{ color: colors.muted, fontSize: 11, fontWeight: "900", width: w as number }}>{h as string}</Text>
                  ))}
                </View>
                {rows.map((r, i) => {
                  const okRow = r.errors.length === 0;
                  const isUpdate = r.mode === "update";
                  return (
                    <View key={i} style={{ borderTopColor: colors.line, borderTopWidth: 1, gap: 3, paddingVertical: 7 }}>
                      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                        <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700", width: 26 }}>{i + 1}</Text>
                        <View style={{ alignItems: "center", flexDirection: "row", gap: 3, width: 58 }}>
                          <MaterialCommunityIcons name={okRow ? "check-circle" : "alert-circle"} size={14} color={okRow ? colors.success : colors.accent} />
                          <Text style={{ color: okRow ? colors.success : colors.accent, fontSize: 11, fontWeight: "800" }}>{okRow ? "OK" : translateCopy("Hata", language)}</Text>
                        </View>
                        <View style={{ width: 78 }}>
                          <View style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: isUpdate ? colors.infoSoft : colors.primarySoft, borderRadius: 6, flexDirection: "row", gap: 3, paddingHorizontal: 7, paddingVertical: 3 }}>
                            <MaterialCommunityIcons name={isUpdate ? "sync" : "plus"} size={11} color={isUpdate ? colors.info : colors.primaryDark} />
                            <Text style={{ color: isUpdate ? colors.info : colors.primaryDark, fontSize: 10.5, fontWeight: "800" }}>{isUpdate ? translateCopy("Güncelle", language) : translateCopy("Yeni", language)}</Text>
                          </View>
                        </View>
                        <Text numberOfLines={1} style={{ color: r.sku ? colors.ink : colors.subtle, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontSize: 11, fontWeight: "700", width: 96 }}>{r.sku || "—"}</Text>
                        <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12, fontWeight: "700", width: 190 }}>{r.title || (isUpdate ? existingSkus.get(r.sku)?.title ?? "—" : "—")}</Text>
                        <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "700", width: 84 }}>{r.price ? `₺${r.price.toLocaleString("tr-TR")}` : "—"}</Text>
                        <Text numberOfLines={1} style={{ color: r.category ? colors.ink : (isUpdate ? colors.muted : colors.accent), fontSize: 12, fontWeight: "700", width: 130 }}>{r.category?.node.label ?? (r.categoryRaw || "—")}</Text>
                        <Text numberOfLines={1} style={{ color: r.provinceName ? colors.ink : (isUpdate ? colors.muted : colors.accent), fontSize: 12, fontWeight: "700", width: 78 }}>{r.provinceName ?? "—"}</Text>
                        <Text style={{ color: Number.isFinite(r.commission) ? colors.ink : colors.accent, fontSize: 12, fontWeight: "700", width: 40 }}>{isUpdate && !r.commissionGiven ? translateCopy("aynı", language) : Number.isFinite(r.commission) ? `%${String(r.commission).replace(".", ",")}` : "—"}</Text>
                      </View>
                      {!okRow ? <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "700", marginLeft: 34 }}>{r.errors.join(" · ")}</Text> : null}
                      {r.originalTitle ? <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600", lineHeight: 15, marginLeft: 34 }}>{translateCopy("Başlık kısaltıldı. Özgün başlık", language)}: {r.originalTitle}</Text> : null}
                      {/* EŞLEŞEN TAM YOL: sütunda yalnız yaprak adı vardı ("Satılık", "Diğer") → satıcı ilanın
                          hangi dala gideceğini yayından önce göremiyordu. */}
                      {r.category && r.mode === "new" ? (
                        <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600", lineHeight: 15, marginLeft: 34 }}>
                          {translateCopy("Kategori", language)}: {r.category.path.map((n) => translateCopy(n.label, language)).join(" › ")}
                          {r.category.node.children && r.category.node.children.length ? ` — ${translateCopy("genel kategori; daha doğru yer için tam yol yaz (ör. Emlak > Konut > Satılık > Daire)", language)}` : ""}
                        </Text>
                      ) : null}
                      {/* GÜNCELLEMEDE KATEGORİ DEĞİŞİKLİĞİ: yayından önce eski → yeni tam yol görünür. */}
                      {isUpdate && r.categoryChange ? (
                        <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 5, marginLeft: 34 }}>
                          <MaterialCommunityIcons name="swap-horizontal" size={13} color={colors.goldInk} style={{ marginTop: 1 }} />
                          <Text style={{ color: colors.goldInk, flex: 1, fontSize: 11, fontWeight: "700", lineHeight: 15 }}>
                            {translateCopy("Kategori değişecek", language)}: {r.categoryChange.from} → {r.categoryChange.to}
                            {r.categoryChange.formKeyChanged ? ` — ${translateCopy("özellik formu da değişiyor; ilandaki mevcut özellik değerleri SİLİNMEZ, olduğu gibi kalır (yeni forma uymayanları ilanı düzenleyerek güncelle)", language)}` : ""}
                          </Text>
                        </View>
                      ) : null}
                      {isUpdate && r.categoryPathIgnored ? (
                        <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600", lineHeight: 15, marginLeft: 34 }}>
                          {translateCopy("Kategori değiştirilmeyecek: güncellemede yalnız kökten yaprağa TAM ve tek anlamlı yol kabul edilir (ör. Emlak > Konut > Satılık > Daire). Diğer alanlar güncellenir.", language)}
                        </Text>
                      ) : null}
                      {okRow && (r.images.length > 1 || r.recognizedAttrs.length > 0 || (r.mode === "new" && r.partnershipMode !== "approval")) ? (
                        <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 10, marginLeft: 34 }}>
                          {r.images.length > 1 ? (
                            <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                              <MaterialCommunityIcons name="image-multiple-outline" size={12} color={colors.muted} />
                              <Text style={{ color: colors.muted, fontSize: 10.5, fontWeight: "700" }}>{r.images.length} {translateCopy("görsel (galeri)", language)}</Text>
                            </View>
                          ) : null}
                          {r.recognizedAttrs.length > 0 ? (
                            <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                              <MaterialCommunityIcons name="tag-check-outline" size={12} color={colors.primaryDark} />
                              <Text numberOfLines={1} style={{ color: colors.primaryDark, fontSize: 10.5, fontWeight: "700" }}>{r.recognizedAttrs.length} {translateCopy("özellik", language)}: {r.recognizedAttrs.slice(0, 4).join(", ")}{r.recognizedAttrs.length > 4 ? "…" : ""}</Text>
                            </View>
                          ) : null}
                          {r.mode === "new" && r.partnershipMode !== "approval" ? (
                            <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                              <MaterialCommunityIcons name={r.partnershipMode === "none" ? "account-off-outline" : "account-group-outline"} size={12} color={colors.muted} />
                              <Text style={{ color: colors.muted, fontSize: 10.5, fontWeight: "700" }}>{r.partnershipMode === "none" ? translateCopy("ortak satış kapalı", language) : translateCopy("ortaklık herkese açık", language)}</Text>
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            {Platform.OS === "web" && rows.length > validRows.length ? (
              <View style={{ alignItems: "center", backgroundColor: colors.accentSoft, borderRadius: 10, flexDirection: "row", flexWrap: "wrap", gap: 10, padding: 11 }}>
                <MaterialCommunityIcons name="alert-circle-outline" size={16} color={colors.accent} />
                <Text style={{ color: colors.ink, flex: 1, fontSize: 12, fontWeight: "700", lineHeight: 17, minWidth: 200 }}>{rows.length - validRows.length} {translateCopy("satır hatalı; bunlar yüklenmez. Dosyayı indirip Excel'de düzelt, sonra CSV olarak yükle.", language)}</Text>
                <Pressable onPress={downloadErrorRows} accessibilityRole="button" style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.accent, borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 5, minHeight: 36, paddingHorizontal: 12 }}>
                  <MaterialCommunityIcons name="download" size={14} color={colors.accent} />
                  <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "800" }}>{translateCopy("Hatalı satırları indir (.csv)", language)}</Text>
                </Pressable>
              </View>
            ) : null}

            {/* TAM-KATALOG SENKRONU — yalnız satıcının SKU'lu aktif ilanı varsa göster (yoksa anlamsız). */}
            {existingSkus.size > 0 ? (
              <Pressable onPress={() => setDeactivateMissing((v) => !v)} accessibilityRole="switch" accessibilityState={{ checked: deactivateMissing }} style={{ alignItems: "flex-start", backgroundColor: deactivateMissing ? colors.accentSoft : colors.surfaceAlt, borderColor: deactivateMissing ? colors.accent : colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 10, padding: 12 }}>
                <MaterialCommunityIcons name={deactivateMissing ? "checkbox-marked" : "checkbox-blank-outline"} size={20} color={deactivateMissing ? colors.accent : colors.muted} style={{ marginTop: 1 }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Bu dosyada olmayan ilanlarımı pasife al", language)}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600", lineHeight: 15 }}>{translateCopy("Tam katalog senkronu: SKU'su bu dosyada geçmeyen AKTİF ilanların yayından kaldırılır (silinmez, pasife alınır). Yalnız tüm kataloğunu yüklüyorsan işaretle.", language)}</Text>
                </View>
              </Pressable>
            ) : null}

            <View style={{ alignItems: "flex-start", backgroundColor: colors.infoSoft, borderRadius: 10, flexDirection: "row", gap: 8, padding: 11 }}>
              <MaterialCommunityIcons name="shield-check-outline" size={16} color={colors.info} style={{ marginTop: 1 }} />
              <Text style={{ color: colors.muted, flex: 1, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>{translateCopy("Yeni toplu ilanlar YAYINA ALINMADAN önce admin onayına düşer; güncellenen mevcut ilanlar anında değişir.", language)}</Text>
            </View>

            <Pressable disabled={!validRows.length || publishing} onPress={() => void publish()} style={({ pressed }) => ({ alignItems: "center", backgroundColor: !validRows.length || publishing ? colors.line : colors.primary, borderRadius: 12, flexDirection: "row", gap: 8, justifyContent: "center", opacity: pressed ? 0.85 : 1, paddingVertical: 14 })}>
              <MaterialCommunityIcons name={publishing ? "loading" : "cloud-upload-outline"} size={18} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>{publishing ? translateCopy("Yükleniyor…", language) : updateCount > 0 ? `${newCount} ${translateCopy("yeni", language)} · ${updateCount} ${translateCopy("güncelle", language)}` : `${validRows.length} ${translateCopy("ilanı onaya gönder", language)}`}</Text>
            </Pressable>
          </View>
        ) : null}

        {Platform.OS === "web" ? <WebFooter /> : null}
      </WebContainer>
    </ScrollView>
  );
}

export default function BulkUploadScreen() {
  const { language } = useLanguage();
  const { isAuthenticated, authReady } = useStore();
  const mounted = useMounted();
  if (!mounted) return <ScreenSkeleton />; // hidrasyon-gate (#418)
  if (!authReady) return <ScreenSkeleton />; // oturum geri-yüklenene kadar bekle (auth-flash önle)
  if (!isAuthenticated) return <AuthRequired title={translateCopy("Toplu ilan için giriş yapın", language)} />;
  return <BulkUploadInner />;
}

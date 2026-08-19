import { MaterialCommunityIcons } from "@/components/icons";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import Head from "expo-router/head";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { AuthRequired } from "@/components/auth-gate";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import { useMounted } from "@/lib/layout";
import { colors } from "@/components/colors";
import { Alert } from "@/lib/alert";
import { WebContainer } from "@/components/web-container";
import { WebFooter } from "@/components/web-landing";
import { matchCategoryByName, resolveFormKey, getFormSchema, type CategoryNode, type FieldDef } from "@/lib/category-tree";
import type { PartnershipMode } from "@/lib/types";
import { autoFillListing } from "@/lib/listing-autofill";
import { formatLocation, getProvince, resolveProvinceByName, districtsOfProvince } from "@/lib/locations";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { downloadCsv } from "@/lib/csv-export";
import { uploadListingImage, fetchMyListingSkus, updateListingFieldsLive, fetchMyListingsForExport } from "@/lib/live-service";
import { useStore } from "@/lib/use-store";
import { parseTrPrice, validateListing } from "@/lib/validation";

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
  errors: string[];
};

const MAX_IMAGES = 10; // ilan başına kapak + 9 ek görsel (create akışıyla uyumlu üst sınır)

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
  const { createListing, currentUser } = useStore();
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
  const [existingSkus, setExistingSkus] = useState<Map<string, { id: string; title: string; status: string }>>(new Map());
  const [deactivateMissing, setDeactivateMissing] = useState(false);
  const [exporting, setExporting] = useState(false);
  useEffect(() => {
    void fetchMyListingSkus(currentUser.id).then((list) => {
      setExistingSkus(new Map(list.map((r) => [r.externalId, { id: r.id, title: r.title, status: r.status }])));
    }).catch(() => {});
  }, [currentUser.id]);

  const parse = () => {
    setNotice(null);
    // BOM'u at (Excel UTF-8 CSV başına ﻿ ekler → ilk sütun adı bozulur).
    const clean = csv.replace(/^﻿/, "");
    const lines = clean.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) { Alert.alert(translateCopy("Boş veri", language), translateCopy("Başlık satırı + en az 1 ürün satırı gerekli.", language)); return; }
    // Spam/hız koruması: tek partide üst sınır (Trendyol'da da parti tavanı vardır).
    const MAX_BULK = 200;
    if (lines.length - 1 > MAX_BULK) {
      Alert.alert(translateCopy("Çok fazla satır", language), `${translateCopy("Tek seferde en fazla", language)} ${MAX_BULK} ${translateCopy("ürün yükleyebilirsin. Partiyi böl.", language)}`);
      return;
    }
    const delim = detectDelimiter(lines[0]); // TR Excel ; ayracını otomatik yakala
    const headers = splitCsvLine(lines[0], delim);
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
    const overrideComm = Number(commissionAll) > 0 ? Number(commissionAll) : undefined;
    const seenTitles = new Set<string>();
    const seenSkus = new Set<string>();
    const bos = translateCopy("(boş)", language);
    const parsed: ParsedRow[] = lines.slice(1).map((line, idx) => {
      const cells = splitCsvLine(line, delim);
      const get = (k: string) => (col[k] !== undefined ? (cells[col[k]] ?? "") : "");
      const sku = get("sku").trim();
      // SKU EŞLEŞMESİ: bu satırın SKU'su satıcının mevcut bir ilanına denk geliyorsa GÜNCELLEME modu.
      const existing = sku ? existingSkus.get(sku) : undefined;
      const mode: "new" | "update" = existing ? "update" : "new";
      const title = get("title");
      const description = get("description");
      const price = parseTrPrice(get("price"));
      const categoryRaw = get("category");
      const category = categoryRaw ? matchCategoryByName(categoryRaw) : undefined;
      const prov = resolveProvinceByName(get("province"));
      let districtId: number | undefined;
      if (prov) {
        const dName = get("district").toLocaleLowerCase("tr-TR").trim();
        const d = districtsOfProvince(prov.id).find((x) => x.name.toLocaleLowerCase("tr-TR").trim() === dName);
        districtId = d?.id;
      }
      const commission = overrideComm ?? (Number(get("commission")) || 10);
      const partnershipMode = resolvePartnershipMode(get("partnership"));
      const stock = Math.max(1, Math.floor(parseTrPrice(get("stock")) || 1)); // TR-binlik ("1.500"→1500, Number 1.5 yapardı)
      // ÇOKLU GÖRSEL: gorsel_url'de | (veya boşlukla ayrılmış birden çok http) → galeri.
      // İlki kapak, kalanı ek görsel (adAssets). CSV'de görsel yoksa sıralı toplu-foto.
      const rawImage = get("image");
      const imageList = rawImage.split(/[|\n]/).map((s) => s.trim()).filter(Boolean).slice(0, MAX_IMAGES);
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
        v.errors.forEach((e) => { if (e.field !== "description" && e.field !== "price") errors.push(e.message); });
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
      if (partnershipMode !== "none" && (commission <= 0 || commission > 90)) errors.push(translateCopy("Komisyon 1–90 arası olmalı", language));
      // Mükerrer SKU (aynı partide iki kez) → upsert çakışması; reddet.
      if (sku && seenSkus.has(sku)) errors.push(translateCopy("Bu harici kod (SKU) partide zaten var (mükerrer)", language));
      else if (sku) seenSkus.add(sku);
      // Mükerrer başlık uyarısı yalnız SKU'suz yeni ilanlarda anlamlı (SKU'lu satırlar zaten tekil).
      const titleKey = title.toLocaleLowerCase("tr-TR").trim();
      if (!sku && titleKey && seenTitles.has(titleKey)) errors.push(translateCopy("Bu başlık partide zaten var (mükerrer)", language));
      else if (!sku && titleKey) seenTitles.add(titleKey);
      return { raw: {}, sku, existingId: existing?.id, mode, title, description, price, category, categoryRaw, provinceId: prov?.id, districtId, provinceName: prov?.name, commission, partnershipMode, stock, image, images, attrs, recognizedAttrs, errors };
    });
    setRows(parsed);
  };

  const validRows = useMemo(() => (rows ?? []).filter((r) => r.errors.length === 0), [rows]);
  const newCount = useMemo(() => validRows.filter((r) => r.mode === "new").length, [validRows]);
  const updateCount = useMemo(() => validRows.filter((r) => r.mode === "update").length, [validRows]);

  async function pickBulkImages() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, mediaTypes: ["images"], quality: 0.85, selectionLimit: 60 });
    if (result.canceled) return;
    const uris = result.assets.map((a) => a.uri).filter(Boolean);
    setBulkImages(uris);
    setNotice(translateCopy(`${uris.length} fotoğraf seçildi — satırlara sırayla atanacak (görsel_url boş olanlara). "Ayrıştır"a tekrar bas.`, language));
  }

  // DOSYADAN YÜKLE (web) — .csv seç → metni oku → yapıştırma alanına doldur.
  // Excel için: "Farklı Kaydet → CSV UTF-8" (xlsx kütüphanesi bundle'ı şişirmesin diye taşımıyoruz).
  function pickCsvFile() {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv,text/plain";
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
        setCsv(String(reader.result || "").replace(/^﻿/, ""));
        setNotice(`${file.name} — ${translateCopy("yüklendi. 'Ayrıştır ve önizle'ye bas.", language)}`);
      };
      reader.readAsText(file, "utf-8");
    };
    input.click();
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
        return [r.externalId ?? "", r.title, r.description ?? "", String(r.price), r.category ?? "", prov?.name ?? "", dist?.name ?? "", String(r.commissionValue), String(r.stockCount), ""];
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
    let pausedCount = 0;
    const failures: Array<{ row: number; title: string; reason: string }> = [];
    const touchedIds = new Set<string>(); // dosyada geçen mevcut ilan id'leri (pasife-al senkronu için)
    for (let i = 0; i < validRows.length; i++) {
      const r = validRows[i];
      try {
        if (r.mode === "update" && r.existingId) {
          // MEVCUT İLANI GÜNCELLE (SKU eşleşti) — yalnız DOLU alanlar yazılır (kısmi upsert).
          const leaf = r.category?.node;
          const location = r.provinceId ? (formatLocation({ provinceId: r.provinceId, districtId: r.districtId }, "neighborhood") || getProvince(r.provinceId)?.name || undefined) : undefined;
          const okUpd = await updateListingFieldsLive(r.existingId, {
            title: r.title || undefined,
            description: r.description || undefined,
            price: r.price,
            commissionValue: r.commission,
            stockCount: r.stock,
            category: leaf?.label,
            location,
            provinceId: r.provinceId,
            districtId: r.districtId
          });
          if (!okUpd) throw new Error(translateCopy("güncelleme kaydedilemedi", language));
          touchedIds.add(r.existingId);
          updated++;
        } else {
          // YENİ İLAN — SKU'yu externalId olarak yaz (sonraki yüklemede eşleşsin).
          const leaf = r.category!.node;
          const rootLabel = r.category!.path[0]?.label ?? leaf.label;
          const formKey = resolveFormKey(r.category!.path);
          // ÇOKLU GÖRSEL: tüm URL'leri yükle (uzak URL'ler zaten geçer) → kapak + ek galeri (adAssets).
          const uploaded = r.images.length
            ? (await Promise.all(r.images.map((u) => uploadListingImage(u, currentUser.id)))).filter(Boolean)
            : [];
          const cover = uploaded[0] || (leaf.image || r.category!.path.find((p) => p.image)?.image || "");
          const extraAssets = uploaded.slice(1);
          const auto = autoFillListing({ title: r.title, category: leaf.label, price: r.price, commission: r.commission, currency: "TRY" });
          const location = formatLocation({ provinceId: r.provinceId, districtId: r.districtId }, "neighborhood") || getProvince(r.provinceId)?.name || "Türkiye";
          createListing({
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
            attributes: { _root: rootLabel, _leaf: leaf.label, _formKey: formKey, ...r.attrs }
          }, "pending_review"); // TOPLU: yayından önce admin onayı
          created++;
        }
      } catch (e) {
        // TEK bir hatalı satır tüm partiyi durdurmasın: hatayı topla, devam et.
        failures.push({ row: i + 1, title: r.title, reason: e instanceof Error ? e.message : translateCopy("bilinmeyen hata", language) });
      } finally {
        setProgress({ done: i + 1, total: validRows.length });
      }
    }
    // TAM-KATALOG SENKRONU (opsiyonel): dosyada OLMAYAN, SKU'lu AKTİF ilanları pasife al.
    // Yalnız hatasız partide çalışır (yarım dosyayla yanlışlıkla ilan gizlenmesin).
    if (deactivateMissing && failures.length === 0) {
      const toPause: string[] = [];
      existingSkus.forEach((v) => { if (!touchedIds.has(v.id) && v.status === "active") toPause.push(v.id); });
      for (const id of toPause) {
        try { if (await updateListingFieldsLive(id, { status: "paused" })) pausedCount++; } catch { /* yut — tek ilan takılmasın */ }
      }
    }
    setProgress(null);
    setPublishing(false);
    setFailedRows(failures);
    if (failures.length === 0) {
      const parts: string[] = [];
      if (created) parts.push(`${created} ${translateCopy("yeni ilan onaya gönderildi", language)}`);
      if (updated) parts.push(`${updated} ${translateCopy("mevcut ilan güncellendi", language)}`);
      if (pausedCount) parts.push(`${pausedCount} ${translateCopy("ilan pasife alındı", language)}`);
      setNotice(`${parts.join(" · ")}.`);
      setRows(null);
      setCsv("");
      setBulkImages([]);
      setTimeout(() => router.replace("/(tabs)/seller"), 2400);
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
        <meta name="description" content={translateCopy("CSV ile toplu ürün yükle, kategori/il eşle, komisyonu toplu belirle. İlanlar admin onayından sonra yayına alınır.", language)} />
      </Head>
      <WebContainer max={1100} padding={16} style={{ gap: 16, paddingTop: 16 }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/seller"))} accessibilityRole="button" style={({ pressed }) => ({ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, opacity: pressed ? 0.7 : 1, paddingHorizontal: 14, paddingVertical: 8 })}>
          <MaterialCommunityIcons name="arrow-left" size={17} color={colors.primaryDark} />
          <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>{translateCopy("Geri", language)}</Text>
        </Pressable>

        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.ink, fontSize: 26, fontWeight: "900" }}>{translateCopy("Toplu ilan yükleme", language)}</Text>
          <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>{translateCopy("Yüzlerce ürünü tek tek girmek yerine CSV ile yükle. Kategori ve il otomatik eşlenir, komisyonu toplu belirlersin. İlanlar admin onayından sonra yayına alınır.", language)}</Text>
        </View>

        {/* Adım 1: şablon */}
        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 10, padding: 16 }}>
          <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>1) {translateCopy("Şablonu kullan", language)}</Text>
          <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{translateCopy("Sütunlar: harici_kod, baslik, aciklama, fiyat, kategori, il, ilce, komisyon, stok, gorsel_url. Birden çok görsel için gorsel_url'e URL'leri | ile ayır (ilki kapak olur). Excel'de düzenleyip CSV olarak kaydet, sonra buraya yapıştır.", language)}</Text>
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
        </View>

        {/* Adım 2: yapıştır + toplu ayarlar */}
        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 12, padding: 16 }}>
          <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Text style={{ color: colors.ink, flex: 1, fontSize: 15, fontWeight: "900" }}>2) {translateCopy("CSV yükle veya yapıştır", language)}</Text>
            {Platform.OS === "web" ? (
              <Pressable onPress={pickCsvFile} style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 9, flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 9 }}>
                <MaterialCommunityIcons name="file-upload-outline" size={15} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Dosyadan yükle (.csv)", language)}</Text>
              </Pressable>
            ) : null}
          </View>
          <TextInput value={csv} onChangeText={setCsv} multiline placeholder={translateCopy("CSV içeriğini buraya yapıştır…", language)} placeholderTextColor={colors.subtle} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 11, borderWidth: 1, color: colors.ink, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontSize: 12.5, minHeight: 150, paddingHorizontal: 12, paddingVertical: 10, textAlignVertical: "top" }} />
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
          <Pressable onPress={parse} style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 11, flexDirection: "row", gap: 7, paddingHorizontal: 20, paddingVertical: 12 }}>
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
                        <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "700", width: 40 }}>%{r.commission}</Text>
                      </View>
                      {!okRow ? <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "700", marginLeft: 34 }}>{r.errors.join(" · ")}</Text> : null}
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

import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import Head from "expo-router/head";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { AuthRequired } from "@/components/auth-gate";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import { useMounted } from "@/lib/layout";
import { colors } from "@/components/colors";
import { Alert } from "@/lib/alert";
import { WebContainer } from "@/components/web-container";
import { WebFooter } from "@/components/web-landing";
import { matchCategoryByName, resolveFormKey, type CategoryNode } from "@/lib/category-tree";
import { autoFillListing } from "@/lib/listing-autofill";
import { formatLocation, getProvince, resolveProvinceByName, districtsOfProvince } from "@/lib/locations";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { downloadCsv } from "@/lib/csv-export";
import { uploadListingImage } from "@/lib/live-service";
import { useStore } from "@/lib/use-store";
import { parseTrPrice, validateListing } from "@/lib/validation";

const TEMPLATE = `baslik,aciklama,fiyat,kategori,il,ilce,komisyon,stok,gorsel_url
Örnek Ürün Adı,Ürünün kısa açıklaması burada,1500,Elektronik,İstanbul,Kadıköy,15,3,https://...jpg
İkinci Ürün,Açıklama metni,899,Moda & Giyim,Ankara,Çankaya,20,10,`;

type ParsedRow = {
  raw: Record<string, string>;
  title: string;
  description: string;
  price: number;
  category?: { node: CategoryNode; path: CategoryNode[] };
  categoryRaw: string;
  provinceId?: number;
  districtId?: number;
  provinceName?: string;
  commission: number;
  stock: number;
  image: string;
  errors: string[];
};

// Basit ama tırnak-farkında CSV satır ayrıştırıcı (alan içinde virgül destekler).
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (c === "," && !inQ) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const COL_ALIASES: Record<string, string[]> = {
  title: ["baslik", "başlık", "title", "urun", "ürün", "ad"],
  description: ["aciklama", "açıklama", "description", "aciklamasi"],
  price: ["fiyat", "price", "tutar"],
  category: ["kategori", "category", "kat"],
  province: ["il", "sehir", "şehir", "province", "city"],
  district: ["ilce", "ilçe", "district"],
  commission: ["komisyon", "commission", "oran"],
  stock: ["stok", "stock", "adet"],
  image: ["gorsel_url", "görsel", "gorsel", "foto", "image", "url", "resim"]
};

function resolveHeader(headers: string[]): Record<string, number> {
  const norm = (s: string) => s.toLocaleLowerCase("tr-TR").replace(/[\s_]+/g, "").trim();
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

  const parse = () => {
    setNotice(null);
    const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) { Alert.alert(translateCopy("Boş veri", language), translateCopy("Başlık satırı + en az 1 ürün satırı gerekli.", language)); return; }
    // Spam/hız koruması: tek partide üst sınır (Trendyol'da da parti tavanı vardır).
    const MAX_BULK = 200;
    if (lines.length - 1 > MAX_BULK) {
      Alert.alert(translateCopy("Çok fazla satır", language), `${translateCopy("Tek seferde en fazla", language)} ${MAX_BULK} ${translateCopy("ürün yükleyebilirsin. Partiyi böl.", language)}`);
      return;
    }
    const headers = splitCsvLine(lines[0]);
    const col = resolveHeader(headers);
    if (col.title === undefined || col.price === undefined) {
      Alert.alert(translateCopy("Sütun bulunamadı", language), translateCopy("En az 'baslik' ve 'fiyat' sütunları gerekli. Şablonu kullan.", language));
      return;
    }
    // Mükerrer başlık uyarısı (aynı partide aynı ürün adı) — kullanıcı fark etsin.
    const overrideComm = Number(commissionAll) > 0 ? Number(commissionAll) : undefined;
    const seenTitles = new Set<string>();
    const parsed: ParsedRow[] = lines.slice(1).map((line, idx) => {
      const cells = splitCsvLine(line);
      const get = (k: string) => (col[k] !== undefined ? (cells[col[k]] ?? "") : "");
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
      const stock = Math.max(1, Number(get("stock")) || 1);
      const image = get("image") || bulkImages[idx] || "";
      const errors: string[] = [];
      const v = validateListing({ title, description: description || "Toplu yükleme ürünü.", price });
      v.errors.forEach((e) => { if (e.field !== "description") errors.push(e.message); });
      const bos = translateCopy("(boş)", language);
      if (!category) errors.push(`${translateCopy("Kategori eşleşmedi", language)}: "${categoryRaw || bos}"`);
      if (!prov) errors.push(`${translateCopy("İl eşleşmedi", language)}: "${get("province") || bos}"`);
      if (commission <= 0 || commission > 90) errors.push(translateCopy("Komisyon 1–90 arası olmalı", language));
      const titleKey = title.toLocaleLowerCase("tr-TR").trim();
      if (titleKey && seenTitles.has(titleKey)) errors.push(translateCopy("Bu başlık partide zaten var (mükerrer)", language));
      else if (titleKey) seenTitles.add(titleKey);
      return { raw: {}, title, description, price, category, categoryRaw, provinceId: prov?.id, districtId, provinceName: prov?.name, commission, stock, image, errors };
    });
    setRows(parsed);
  };

  const validRows = useMemo(() => (rows ?? []).filter((r) => r.errors.length === 0), [rows]);

  async function pickBulkImages() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, mediaTypes: ["images"], quality: 0.85, selectionLimit: 60 });
    if (result.canceled) return;
    const uris = result.assets.map((a) => a.uri).filter(Boolean);
    setBulkImages(uris);
    setNotice(translateCopy(`${uris.length} fotoğraf seçildi — satırlara sırayla atanacak (görsel_url boş olanlara). "Ayrıştır"a tekrar bas.`, language));
  }

  async function publish() {
    if (!validRows.length) return;
    setPublishing(true);
    setNotice(null);
    setFailedRows([]);
    setProgress({ done: 0, total: validRows.length });
    let ok = 0;
    const failures: Array<{ row: number; title: string; reason: string }> = [];
    for (let i = 0; i < validRows.length; i++) {
      const r = validRows[i];
      try {
        const leaf = r.category!.node;
        const rootLabel = r.category!.path[0]?.label ?? leaf.label;
        const formKey = resolveFormKey(r.category!.path);
        const cover = r.image ? await uploadListingImage(r.image, currentUser.id) : (leaf.image || r.category!.path.find((p) => p.image)?.image || "");
        const auto = autoFillListing({ title: r.title, category: leaf.label, price: r.price, commission: r.commission, currency: "TRY" });
        const location = formatLocation({ provinceId: r.provinceId, districtId: r.districtId }, "neighborhood") || getProvince(r.provinceId)?.name || "Türkiye";
        createListing({
          title: r.title,
          description: r.description || auto.description,
          salesPitch: auto.salesPitch,
          shareTemplates: auto.shareTemplates,
          adAssets: [],
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
          deliveryNote: "Teslimat ve ödeme satıcıyla alıcı arasında netleştirilir; Ortaksat para tutmaz.",
          contactMethod: "message",
          partnershipMode: "approval",
          attributes: { _root: rootLabel, _leaf: leaf.label, _formKey: formKey }
        }, "pending_review"); // TOPLU: yayından önce admin onayı
        ok++;
      } catch (e) {
        // TEK bir hatalı satır tüm partiyi durdurmasın: hatayı topla, devam et.
        failures.push({ row: i + 1, title: r.title, reason: e instanceof Error ? e.message : translateCopy("bilinmeyen hata", language) });
      } finally {
        setProgress({ done: i + 1, total: validRows.length });
      }
    }
    setProgress(null);
    setPublishing(false);
    setFailedRows(failures);
    if (failures.length === 0) {
      setNotice(translateCopy(`${ok} ilan admin onayına gönderildi. Onaylandıkça yayına alınır.`, language));
      setRows(null);
      setCsv("");
      setBulkImages([]);
      setTimeout(() => router.replace("/(tabs)/seller"), 2200);
    } else {
      // Kısmi başarı: başarısızlar listelenir + CSV indirilebilir; kullanıcı düzeltip tekrar dener.
      setNotice(`${ok} ${translateCopy("başarılı", language)} · ${failures.length} ${translateCopy("başarısız", language)}. ${translateCopy("Başarısız satırları aşağıda görüp CSV olarak indirebilirsin.", language)}`);
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
          <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{translateCopy("Sütunlar: baslik, aciklama, fiyat, kategori, il, ilce, komisyon, stok, gorsel_url. Excel'de düzenleyip CSV olarak kaydet, sonra buraya yapıştır.", language)}</Text>
          <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, padding: 10 }}>
            <Text selectable style={{ color: colors.ink, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontSize: 11.5 }}>{TEMPLATE}</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Pressable onPress={() => void Clipboard.setStringAsync(TEMPLATE).then(() => setNotice(translateCopy("Şablon panoya kopyalandı.", language))).catch(() => {})} style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 9, flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 9 }}>
              <MaterialCommunityIcons name="content-copy" size={15} color={colors.primaryDark} />
              <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Şablonu kopyala", language)}</Text>
            </Pressable>
            {Platform.OS === "web" ? (
              <Pressable onPress={() => downloadCsv("ortaksat-toplu-ilan-sablon.csv", ["baslik", "aciklama", "fiyat", "kategori", "il", "ilce", "komisyon", "stok", "gorsel_url"], [["Örnek Ürün Adı", "Ürünün kısa açıklaması", "1500", "Elektronik", "İstanbul", "Kadıköy", "15", "3", "https://...jpg"], ["İkinci Ürün", "Açıklama metni", "899", "Moda & Giyim", "Ankara", "Çankaya", "20", "10", ""]])} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 9, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 9 }}>
                <MaterialCommunityIcons name="download" size={15} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Şablonu indir (.csv)", language)}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Adım 2: yapıştır + toplu ayarlar */}
        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 12, padding: 16 }}>
          <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>2) {translateCopy("CSV yapıştır", language)}</Text>
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
            <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
              <Text style={{ color: colors.ink, flex: 1, fontSize: 15, fontWeight: "900" }}>3) {translateCopy("Önizleme", language)} · {validRows.length}/{rows.length} {translateCopy("geçerli", language)}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator style={{ maxWidth: "100%" }}>
              <View style={{ gap: 6, minWidth: 720 }}>
                <View style={{ flexDirection: "row", gap: 8, paddingBottom: 6 }}>
                  {["#", translateCopy("Durum", language), translateCopy("Başlık", language), translateCopy("Fiyat", language), translateCopy("Kategori", language), translateCopy("İl", language), "%"].map((h, i) => (
                    <Text key={i} style={{ color: colors.muted, fontSize: 11, fontWeight: "900", width: i === 0 ? 26 : i === 1 ? 60 : i === 2 ? 220 : i === 4 ? 150 : 90 }}>{h}</Text>
                  ))}
                </View>
                {rows.map((r, i) => {
                  const okRow = r.errors.length === 0;
                  return (
                    <View key={i} style={{ borderTopColor: colors.line, borderTopWidth: 1, gap: 3, paddingVertical: 7 }}>
                      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                        <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700", width: 26 }}>{i + 1}</Text>
                        <View style={{ alignItems: "center", flexDirection: "row", gap: 3, width: 60 }}>
                          <MaterialCommunityIcons name={okRow ? "check-circle" : "alert-circle"} size={14} color={okRow ? colors.success : colors.accent} />
                          <Text style={{ color: okRow ? colors.success : colors.accent, fontSize: 11, fontWeight: "800" }}>{okRow ? "OK" : translateCopy("Hata", language)}</Text>
                        </View>
                        <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12, fontWeight: "700", width: 220 }}>{r.title || "—"}</Text>
                        <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "700", width: 90 }}>{r.price ? `₺${r.price.toLocaleString("tr-TR")}` : "—"}</Text>
                        <Text numberOfLines={1} style={{ color: r.category ? colors.ink : colors.accent, fontSize: 12, fontWeight: "700", width: 150 }}>{r.category?.node.label ?? r.categoryRaw ?? "—"}</Text>
                        <Text numberOfLines={1} style={{ color: r.provinceName ? colors.ink : colors.accent, fontSize: 12, fontWeight: "700", width: 90 }}>{r.provinceName ?? "—"}</Text>
                        <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "700", width: 90 }}>%{r.commission}</Text>
                      </View>
                      {!okRow ? <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "700", marginLeft: 34 }}>{r.errors.join(" · ")}</Text> : null}
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            <View style={{ alignItems: "flex-start", backgroundColor: colors.infoSoft, borderRadius: 10, flexDirection: "row", gap: 8, padding: 11 }}>
              <MaterialCommunityIcons name="shield-check-outline" size={16} color={colors.info} style={{ marginTop: 1 }} />
              <Text style={{ color: colors.muted, flex: 1, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>{translateCopy("Toplu yüklenen ilanlar YAYINA ALINMADAN önce admin onayına düşer. Onaylananlar pazara çıkar.", language)}</Text>
            </View>

            <Pressable disabled={!validRows.length || publishing} onPress={() => void publish()} style={({ pressed }) => ({ alignItems: "center", backgroundColor: !validRows.length || publishing ? colors.line : colors.primary, borderRadius: 12, flexDirection: "row", gap: 8, justifyContent: "center", opacity: pressed ? 0.85 : 1, paddingVertical: 14 })}>
              <MaterialCommunityIcons name={publishing ? "loading" : "cloud-upload-outline"} size={18} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>{publishing ? translateCopy("Yükleniyor…", language) : `${validRows.length} ${translateCopy("ilanı onaya gönder", language)}`}</Text>
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
  const { isAuthenticated } = useStore();
  const mounted = useMounted();
  if (!mounted) return <ScreenSkeleton />; // hidrasyon-gate (#418)
  if (!isAuthenticated) return <AuthRequired title={translateCopy("Toplu ilan için giriş yapın", language)} />;
  return <BulkUploadInner />;
}

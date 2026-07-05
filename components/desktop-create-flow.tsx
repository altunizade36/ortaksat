import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { CategoryPicker } from "@/components/category-picker";
import { colors } from "@/components/colors";
import { LegalDisclaimer } from "@/components/legal-disclaimer";
import { LocationSelector, type LocationValue } from "@/components/location-selector";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { deriveFieldsFromPath, getFormSchema, MODELS_BY_BRAND, resolveFormKey, type CategoryNode, type FieldDef } from "@/lib/category-tree";
import { CURRENCIES, moneyIn, type CurrencyCode } from "@/lib/format";
import { formatLocation, getProvince } from "@/lib/locations";
import { uploadListingImage } from "@/lib/live-service";
import { autoFillListing } from "@/lib/listing-autofill";
import { categoryRisk, moderateListingText, MODERATION_MESSAGES, scanTextLocal } from "@/lib/moderation";
import { rateLimit } from "@/lib/rate-limit";
import type { CommissionType, PartnershipMode } from "@/lib/types";
import { useStore } from "@/lib/use-store";
import { LIMITS, parseTrPrice, validateListing } from "@/lib/validation";

const STEPS = ["Kategori", "İlan Bilgileri", "Konum", "Fotoğraflar", "Komisyon & Ortak Satış", "Önizleme & Yayınla"];
const CONDITION_IMG = "https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=1200";

type Values = Record<string, string | boolean | string[]>;

export function DesktopCreateFlow() {
  const router = useRouter();
  const { createListing, addCategorySuggestion, addLocationSuggestion, currentUser } = useStore();
  const [step, setStep] = useState(0);
  const [path, setPath] = useState<CategoryNode[]>([]);
  const [values, setValues] = useState<Values>({});
  const [images, setImages] = useState<string[]>([]);
  const [imageDraft, setImageDraft] = useState("");
  const [loc, setLoc] = useState<LocationValue>({});
  const [visibility, setVisibility] = useState<"city_only" | "district_only" | "neighborhood" | "full_address_private">("neighborhood");

  const [currency, setCurrency] = useState<CurrencyCode>("TRY");
  const [commissionType, setCommissionType] = useState<CommissionType>("rate");
  const [commissionValue, setCommissionValue] = useState("15");
  const [bonusAmount, setBonusAmount] = useState("");
  const [bonusQuota, setBonusQuota] = useState("");
  const [partnershipMode, setPartnershipMode] = useState<PartnershipMode>("approval");
  const [partnerNote, setPartnerNote] = useState("");
  const [contactMethod, setContactMethod] = useState<"message" | "whatsapp" | "phone">("message");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState(""); // bot tuzağı: gerçek kullanıcı boş bırakır

  const formKey = path.length ? resolveFormKey(path) : "";
  const schema = formKey ? getFormSchema(formKey) : undefined;
  const leafLabel = path.length ? path[path.length - 1].label : "";
  const coverImage = images[0] || path.find((p) => p.image)?.image || CONDITION_IMG;

  // Anlık moderasyon uyarısı (kullanıcı yazarken): yasaklı = kırmızı, dikkatli = sarı.
  const liveModeration = useMemo(() => {
    const kw = scanTextLocal(`${String(values.title ?? "")} ${String(values.description ?? "")}`);
    if (kw.verdict === "block") return { level: "block" as const, msg: `Yasaklı ifade tespit edildi: "${kw.matched}". Bu içerikle ilan yayınlanamaz.` };
    const cat = categoryRisk(path.map((p) => p.label));
    if (kw.verdict === "review") return { level: "review" as const, msg: `"${kw.matched}" ifadesi dikkat gerektirebilir; ilan yönetici onayına düşebilir.` };
    if (cat === "review") return { level: "review" as const, msg: "Bu kategori, güvenlik gereği yayından önce yönetici onayına düşer." };
    return null;
  }, [values.title, values.description, path]);

  const setV = (k: string, v: string | boolean | string[]) => setValues((s) => ({ ...s, [k]: v }));
  const missingFields = useMemo(() => (schema ? schema.fields.filter((f) => {
    if (!f.required) return false;
    const val = values[f.key];
    if (Array.isArray(val)) return val.length === 0;
    return !String(val ?? "").trim();
  }) : []), [schema, values]);

  // Kategori seçiminden form alanlarını otomatik doldur: ağaçta seçilen marka/model/
  // ilan-tipi ilgili alanlara taşınır, başlık önerilir. Böylece bir sonraki adımda
  // form boş gelmez. Marka/model/ilan-tipi kategoriyle güncellenir; başlık yalnızca
  // kullanıcı henüz yazmadıysa doldurulur (elle girdisinin üzerine yazılmaz).
  const pathKey = path.map((p) => p.key).join("/");
  useEffect(() => {
    if (!schema) return;
    const seed = deriveFieldsFromPath(path, schema);
    if (!Object.keys(seed).length) return;
    setValues((s) => {
      const next = { ...s };
      for (const [k, v] of Object.entries(seed)) {
        if (k === "title") {
          if (!String(next.title ?? "").trim()) next.title = v;
        } else {
          next[k] = v;
        }
      }
      return next;
    });
    // path/formKey değişince yeniden türet
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formKey, pathKey]);

  async function pickFromGallery() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, mediaTypes: ["images"], quality: 0.85, selectionLimit: 5 });
    if (result.canceled) return;
    const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
    const tooBig = result.assets.some((a) => typeof a.fileSize === "number" && a.fileSize > MAX_BYTES);
    if (tooBig) setError("Bazı görseller 5 MB sınırını aşıyor ve eklenmedi. Lütfen daha küçük dosyalar seçin.");
    const uris = result.assets
      .filter((a) => !(typeof a.fileSize === "number" && a.fileSize > MAX_BYTES))
      .map((a) => a.uri)
      .filter(Boolean);
    setImages((s) => {
      const next = [...s, ...uris].slice(0, 5); // en fazla 5 görsel
      if (s.length + uris.length > 5) setError("En fazla 5 görsel ekleyebilirsin. Fazlası eklenmedi.");
      return next;
    });
  }

  const canNext = () => {
    if (step === 0) return path.length > 0;
    if (step === 1) return missingFields.length === 0;
    if (step === 2) return !!loc.provinceId && !!loc.districtId;
    if (step === 3) return images.length > 0;
    if (step === 4) return Number(commissionValue) > 0;
    return true;
  };

  async function publish() {
    if (!schema) return;
    setError(null);
    setNotice(null);

    // Bot tuzağı: gizli alan doluysa sessizce reddet (kullanıcıya başarı gibi göster, kayıt oluşturma).
    if (honeypot.trim()) {
      router.replace("/(tabs)/seller");
      return;
    }

    const title = String(values.title ?? leafLabel).trim() || leafLabel;
    const description = String(values.description ?? "").trim();
    const descRequired = schema.fields.some((f) => f.key === "description" && f.required);

    // Merkezi doğrulama (başlık/açıklama/fiyat). Fiyat TR formatıyla ("1.500.000") ayrıştırılır.
    const v = validateListing({ title, description, price: parseTrPrice(String(values.price ?? "")) });
    const errs = v.errors.filter((e) => !(e.field === "description" && !descRequired && !description));
    if (errs.length) {
      setError(errs[0].message);
      setStep(1);
      return;
    }

    setPublishing(true);
    try {
      // Hız sınırı (spam/bot ilan yağmurunu engeller).
      const rl = await rateLimit("listing_create");
      if (!rl.allowed) {
        setError(rl.reason ?? "Çok sık denediniz, lütfen sonra tekrar deneyin.");
        return;
      }

      // Yasaklı/şüpheli içerik taraması (kelime) + hassas kategori kontrolü.
      const kwVerdict = await moderateListingText(title, description);
      if (kwVerdict === "block") {
        setError(MODERATION_MESSAGES.block);
        setStep(1);
        return;
      }
      const catVerdict = categoryRisk(path.map((p) => p.label).concat(leafLabel));
      const verdict = kwVerdict === "review" || catVerdict === "review" ? "review" : "none";
      const statusOverride = verdict === "review" ? ("pending_review" as const) : undefined;

      // "Diğer" seçildiyse kategori önerisi olarak admin incelemesine düşür.
      if (path[0]?.label === "Diğer") {
        addCategorySuggestion({ suggestedPath: `${title || "Yeni ürün"} — ${description.slice(0, 60)}`, note: "İlan formundan 'Diğer' kategorisi ile gönderildi." });
      }
      void addLocationSuggestion; // konum önerisi 'Mahallemi bulamadım' akışına bağlı (canlıda mahalle listesi gelince)
      const price = v.clean.price;
      const tags = [path[0]?.label, leafLabel, String(values.brand ?? ""), String(values.condition ?? "")].map((t) => String(t).trim()).filter(Boolean).slice(0, 8);
      const detailLines = schema.fields
        .filter((f) => f.key !== "title" && f.key !== "description" && f.key !== "price" && values[f.key] !== undefined && String(values[f.key]).trim() && typeof values[f.key] !== "boolean")
        .map((f) => `${f.label}: ${values[f.key]}${f.suffix ? " " + f.suffix : ""}`);
      const boolLines = schema.fields.filter((f) => f.type === "bool" && values[f.key] === true).map((f) => `${f.label}: Evet`);

      // Yapısal özellikler: form değerlerini (m², oda, imar, tapu…) filtrelenebilir
      // biçimde sakla. title/description/price zaten üst-seviye kolonlarda tutulur.
      const attributes: Record<string, string | number | boolean | string[]> = {};
      for (const f of schema.fields) {
        if (f.key === "title" || f.key === "description" || f.key === "price") continue;
        const raw = values[f.key];
        if (raw === undefined || raw === null || (typeof raw === "string" && !raw.trim())) continue;
        if (Array.isArray(raw)) { if (raw.length) attributes[f.key] = raw; continue; }
        if (typeof raw === "boolean") { if (raw) attributes[f.key] = true; continue; }
        attributes[f.key] = f.type === "number" ? Number(raw) : String(raw);
      }
      // Kategori bağlamı da sakla (alt-kategori filtresi ve rozetler için).
      if (leafLabel) attributes._leaf = leafLabel;
      if (path[0]?.label) attributes._root = path[0].label;

      // Görselleri Supabase storage'a yükle (web'de otomatik ölçekleme+sıkıştırma).
      // En fazla 5; yerel URI'ler public URL'e döner, böylece herkes görebilir.
      const pickedImages = images.slice(0, 5);
      const uploadedImages = currentUser?.id
        ? await Promise.all(pickedImages.map((uri) => uploadListingImage(uri, currentUser.id)))
        : pickedImages;
      const cover = uploadedImages[0] || coverImage;

      // Shopify-tarzı otomatik doldurma: açıklama boşsa doldurulur, paylaşım
      // metinleri (Instagram/WhatsApp/TikTok) her ilan için otomatik üretilir,
      // argüman/etiket zayıfsa zenginleştirilir. Uydurma ürün özelliği yok —
      // yalnızca başlık/kategori/fiyat/komisyondan düzenlenebilir taslak.
      const auto = autoFillListing({
        title: v.clean.title || leafLabel,
        category: leafLabel || path[0]?.label || "Genel",
        price,
        commission: Number(commissionValue) || 0,
        currency
      });

      createListing({
        title: v.clean.title || leafLabel,
        description: description ? v.clean.description : auto.description,
        salesPitch: detailLines.slice(0, 4).length ? detailLines.slice(0, 4) : auto.salesPitch,
        shareTemplates: auto.shareTemplates,
        adAssets: uploadedImages.slice(1, 5),
        tags: tags.length ? tags : auto.tags,
        price,
        currency,
        commissionType,
        commissionValue: Number(commissionValue) || 0,
        bonusAmount: Number(bonusAmount) > 0 && Number(bonusQuota) > 0 ? Number(bonusAmount) : undefined,
        bonusQuota: Number(bonusAmount) > 0 && Number(bonusQuota) > 0 ? Number(bonusQuota) : undefined,
        partnershipMode,
        attributes,
        category: leafLabel || path[0]?.label || "Genel",
        location: formatLocation(loc, visibility) || getProvince(loc.provinceId)?.name || "Türkiye",
        provinceId: loc.provinceId,
        districtId: loc.districtId,
        addressVisibility: visibility,
        locationNote: loc.neighborhood?.trim() || undefined,
        image: cover,
        stockCount: Number(values.stock) || 1,
        minPartnerRating: 4,
        commissionDueDays: 3,
        returnWindowDays: 7,
        partnerRules: [...boolLines, partnerNote.trim()].filter(Boolean).length ? [...boolLines, partnerNote.trim()].filter(Boolean) : ["Komisyon sadece onaylı satış kaydında oluşur."],
        deliveryNote: "Teslimat ve ödeme satıcıyla alıcı arasında netleştirilir; Ortaksat para tutmaz.",
        contactMethod
      }, statusOverride);

      if (verdict === "review") {
        // İnceleme gerektiren ilan: kullanıcıya bilgi ver, ardından yönlendir.
        setNotice(MODERATION_MESSAGES.review);
        setPublishing(false);
        setTimeout(() => router.replace("/(tabs)/seller"), 1800);
        return;
      }
      router.replace("/(tabs)/seller");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <View style={{ gap: 18 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: colors.ink, fontSize: 26, fontWeight: "900" }}>Yeni ilan oluştur</Text>
        <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>Kategorini seç, sana özel form açılsın. Ortak satışa açarak ortakların ürününü kendi kitlesine yaysın.</Text>
      </View>

      {/* Stepper */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {STEPS.map((s, i) => {
          const done = i < step;
          const on = i === step;
          const reachable = i <= step || (i === step + 1 && canNext());
          return (
            <Pressable key={s} onPress={() => { if (i < step || reachable) setStep(i); }} style={{ alignItems: "center", backgroundColor: on ? colors.primary : done ? colors.primarySoft : colors.surface, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 7, paddingHorizontal: 13, paddingVertical: 8 }}>
              <View style={{ alignItems: "center", backgroundColor: on ? "#FFFFFF" : done ? colors.primary : colors.surfaceAlt, borderRadius: 999, height: 20, justifyContent: "center", width: 20 }}>
                {done ? <MaterialCommunityIcons name="check" size={13} color="#FFFFFF" /> : <Text style={{ color: on ? colors.primary : colors.muted, fontSize: 11, fontWeight: "900" }}>{i + 1}</Text>}
              </View>
              <Text style={{ color: on ? "#FFFFFF" : done ? colors.primaryDark : colors.muted, fontSize: 12.5, fontWeight: "800" }}>{s}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Body */}
      <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 18, borderWidth: 1, padding: 22 }}>
        {step === 0 ? <CategoryPicker value={path} onChange={(p) => { setPath(p); if (p.length) setStep(1); }} /> : null}

        {step === 1 && schema ? (
          <View style={{ gap: 16 }}>
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{schema.title}</Text>
            <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>{leafLabel} için gerekli alanlar. * işaretliler zorunlu.</Text>
            {/* Seçilen kategori yolu — kullanıcı ne seçtiğini görür + tek tıkla değiştirir. */}
            {path.length ? (
              <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderColor: colors.primary, borderRadius: 10, borderWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 12, paddingVertical: 9 }}>
                <MaterialCommunityIcons name="tag-multiple-outline" size={15} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, flex: 1, fontSize: 12.5, fontWeight: "800", minWidth: 0 }}>{path.map((p) => p.label).join(" › ")}</Text>
                <Pressable onPress={() => setStep(0)} accessibilityRole="button" accessibilityLabel="Kategoriyi değiştir" style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 4, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <MaterialCommunityIcons name="pencil-outline" size={13} color={colors.primaryDark} />
                  <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>Değiştir</Text>
                </Pressable>
              </View>
            ) : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
              {schema.fields.map((f) => {
                // Model alanı: marka seçiliyse ve markanın modelleri biliniyorsa bağımlı select.
                if (f.key === "model") {
                  const brand = String(values.brand ?? "").trim();
                  const models = MODELS_BY_BRAND[brand];
                  if (models && models.length) {
                    const dep: FieldDef = { ...f, type: "select", options: [...models, "Diğer"] };
                    return <DField key={f.key} field={dep} value={values[f.key]} onChange={(v) => setV(f.key, v)} />;
                  }
                }
                return <DField key={f.key} field={f} value={values[f.key]} onChange={(v) => setV(f.key, v)} />;
              })}
            </View>
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>Para birimi</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {CURRENCIES.map((c) => {
                  const on = currency === c.code;
                  return (
                    <Pressable key={c.code} onPress={() => setCurrency(c.code)} style={{ alignItems: "center", backgroundColor: on ? colors.primary : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 15, paddingVertical: 9 }}>
                      <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 15, fontWeight: "900" }}>{c.symbol}</Text>
                      <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12.5, fontWeight: "800" }}>{c.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={{ color: colors.subtle, fontSize: 11.5, fontWeight: "600" }}>Fiyatı istediğin tutarda gir; üst sınır yok. Nokta binlik ayırıcıdır (örn. 1.500.000).</Text>
            </View>
          </View>
        ) : null}

        {step === 2 ? (
          <View style={{ gap: 16 }}>
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>Konum</Text>
            <LocationSelector value={loc} onChange={setLoc} required showNeighborhood showAddressLine mode="listing" />
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>Adres görünürlüğü</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {([["city_only", "Sadece il/ilçe"], ["neighborhood", "İl/ilçe/mahalle"], ["full_address_private", "Açık adres yalnızca onay sonrası"]] as const).map(([k, lbl]) => {
                  const on = visibility === k;
                  return (
                    <Pressable key={k} onPress={() => setVisibility(k)} style={{ backgroundColor: on ? colors.primary : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 8 }}>
                      <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12.5, fontWeight: "800" }}>{lbl}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        ) : null}

        {step === 3 ? (
          <View style={{ gap: 14 }}>
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>Fotoğraflar</Text>
            <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>En az 1, en fazla 5 görsel. İlk görsel kapak olur.</Text>
            <Pressable onPress={() => void pickFromGallery()} style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primarySoft, borderRadius: 11, flexDirection: "row", gap: 7, paddingHorizontal: 16, paddingVertical: 11 }}>
              <MaterialCommunityIcons name="image-multiple-outline" size={17} color={colors.primaryDark} />
              <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>Galeriden / cihazdan seç</Text>
            </Pressable>
            <Text style={{ color: colors.subtle, fontSize: 11.5, fontWeight: "600" }}>veya görsel adresi yapıştır:</Text>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
              <TextInput value={imageDraft} onChangeText={setImageDraft} placeholder="https://…/foto.jpg" placeholderTextColor={colors.subtle} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 11, borderWidth: 1, color: colors.ink, flex: 1, fontSize: 13.5, minHeight: 46, paddingHorizontal: 12 }} />
              <Pressable onPress={() => { const u = imageDraft.trim(); if (u && images.length < 5) { setImages((s) => [...s, u]); setImageDraft(""); } }} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 11, flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingVertical: 12 }}>
                <MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>Ekle</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {images.length === 0 ? <Text style={{ color: colors.subtle, fontSize: 12.5, fontWeight: "600" }}>Henüz görsel yok — kategori görseli kapak olarak kullanılır.</Text> : null}
              {images.map((img, i) => (
                <View key={img + i} style={{ borderColor: i === 0 ? colors.primary : colors.line, borderRadius: 12, borderWidth: i === 0 ? 2 : 1, height: 110, overflow: "hidden", width: 150 }}>
                  <SafeRemoteImage uri={img} style={{ height: "100%", width: "100%" }} contentFit="cover" />
                  <Pressable onPress={() => setImages((s) => s.filter((_, idx) => idx !== i))} style={{ alignItems: "center", backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 999, height: 24, justifyContent: "center", position: "absolute", right: 6, top: 6, width: 24 }}>
                    <MaterialCommunityIcons name="close" size={15} color="#FFFFFF" />
                  </Pressable>
                  {i === 0 ? (
                    <View style={{ backgroundColor: colors.primary, borderRadius: 6, left: 6, paddingHorizontal: 7, paddingVertical: 2, position: "absolute", top: 6 }}><Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "900" }}>Kapak</Text></View>
                  ) : (
                    <Pressable onPress={() => setImages((s) => [s[i], ...s.filter((_, idx) => idx !== i)])} style={{ alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 6, bottom: 6, flexDirection: "row", gap: 4, left: 6, paddingHorizontal: 7, paddingVertical: 3, position: "absolute" }}>
                      <MaterialCommunityIcons name="star-outline" size={11} color="#FFFFFF" />
                      <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "900" }}>Kapak yap</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {step === 4 ? (
          <View style={{ gap: 16 }}>
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>Komisyon & Ortak Satış</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              <View style={{ flex: 1, gap: 6, minWidth: 200 }}>
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>Komisyon tipi</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {(["rate", "fixed"] as const).map((tp) => {
                    const on = commissionType === tp;
                    return <Pressable key={tp} onPress={() => setCommissionType(tp)} style={{ backgroundColor: on ? colors.primary : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 10, borderWidth: 1, flex: 1, paddingVertical: 11 }}><Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12.5, fontWeight: "800", textAlign: "center" }}>{tp === "rate" ? "Yüzde (%)" : "Sabit (₺)"}</Text></Pressable>;
                  })}
                </View>
              </View>
              <View style={{ flex: 1, minWidth: 200 }}>
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800", marginBottom: 6 }}>Komisyon {commissionType === "rate" ? "oranı (%)" : "tutarı (₺)"}</Text>
                <TextInput value={commissionValue} onChangeText={setCommissionValue} keyboardType="numeric" style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 11, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 46, paddingHorizontal: 12 }} />
              </View>
            </View>

            {/* Teşvik bonusu (opsiyonel): ilk N satışa komisyon üstüne ek ödül. */}
            <View style={{ backgroundColor: colors.primarySoft, borderColor: colors.primary, borderRadius: 12, borderWidth: 1, gap: 10, padding: 12 }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
                <MaterialCommunityIcons name="rocket-launch-outline" size={16} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>Hızlı başlangıç bonusu (opsiyonel)</Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>İlk satışları yapan ortaklara komisyonun üstüne ek ödül taahhüt et — ilanın öne çıkar, ortaklar daha hızlı harekete geçer.</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                <View style={{ flex: 1, minWidth: 150 }}>
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800", marginBottom: 6 }}>Bonus tutarı ({CURRENCIES.find((c) => c.code === currency)?.symbol ?? "₺"})</Text>
                  <TextInput value={bonusAmount} onChangeText={setBonusAmount} keyboardType="numeric" placeholder="Örn. 500" placeholderTextColor={colors.subtle} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 11, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 46, paddingHorizontal: 12 }} />
                </View>
                <View style={{ flex: 1, minWidth: 150 }}>
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800", marginBottom: 6 }}>İlk kaç satış için?</Text>
                  <TextInput value={bonusQuota} onChangeText={setBonusQuota} keyboardType="numeric" placeholder="Örn. 5" placeholderTextColor={colors.subtle} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 11, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 46, paddingHorizontal: 12 }} />
                </View>
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>Ortaklık kabul şekli</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {([["open", "Herkese açık (anında ortak)"], ["approval", "Başvuru onayı gerekir"], ["invite", "Sadece davetle"]] as const).map(([k, lbl]) => {
                  const on = partnershipMode === k;
                  return <Pressable key={k} onPress={() => setPartnershipMode(k)} style={{ backgroundColor: on ? colors.primary : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 8 }}><Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12.5, fontWeight: "800" }}>{lbl}</Text></Pressable>;
                })}
              </View>
            </View>


            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>İletişim tercihi</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {([["message", "Mesaj"], ["whatsapp", "WhatsApp"], ["phone", "Telefon"]] as const).map(([k, lbl]) => {
                  const on = contactMethod === k;
                  return <Pressable key={k} onPress={() => setContactMethod(k)} style={{ backgroundColor: on ? colors.primary : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 8 }}><MaterialCommunityIcons name={k === "whatsapp" ? "whatsapp" : k === "phone" ? "phone" : "message-text-outline"} size={15} color={on ? "#FFFFFF" : colors.primary} /><Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12.5, fontWeight: "800" }}>{lbl}</Text></Pressable>;
                })}
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>Ortak satıcıya özel açıklama (opsiyonel)</Text>
              <TextInput value={partnerNote} onChangeText={setPartnerNote} multiline placeholder="Ortakların dikkat etmesi gerekenler…" placeholderTextColor={colors.subtle} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 11, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 70, paddingHorizontal: 12, paddingVertical: 10, textAlignVertical: "top" }} />
            </View>

            <View style={{ alignItems: "flex-start", backgroundColor: colors.infoSoft, borderRadius: 10, flexDirection: "row", gap: 8, padding: 11 }}>
              <MaterialCommunityIcons name="information-outline" size={16} color={colors.info} style={{ marginTop: 1 }} />
              <Text style={{ color: colors.muted, flex: 1, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>Ortaksat para tutmaz; komisyon, satış sonrası satıcı ile ortak arasında doğrudan ödenir. Uygulama yalnızca kaydı tutar.</Text>
            </View>
          </View>
        ) : null}

        {step === 5 ? (
          <View style={{ gap: 14 }}>
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>Önizleme & Yayınla</Text>
            <View style={{ alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: 18 }}>
              <View style={{ borderColor: colors.line, borderRadius: 16, borderWidth: 1, overflow: "hidden", width: 280 }}>
                <View style={{ backgroundColor: colors.line, height: 170, width: "100%" }}><SafeRemoteImage uri={coverImage} style={{ height: "100%", width: "100%" }} contentFit="cover" /></View>
                <View style={{ gap: 6, padding: 14 }}>
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}>{path.map((p) => p.label).join(" › ")}</Text>
                  <Text numberOfLines={2} style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>{String(values.title ?? leafLabel)}</Text>
                  <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{moneyIn(parseTrPrice(String(values.price ?? "")), currency)}</Text>
                  <View style={{ backgroundColor: colors.primarySoft, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 6 }}>
                    <MaterialCommunityIcons name="cash-multiple" size={14} color={colors.primaryDark} />
                    <Text style={{ color: colors.primaryDark, flex: 1, fontSize: 11, fontWeight: "800" }}>Ortak kazancı</Text>
                    <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{moneyIn(commissionType === "rate" ? Math.round((parseTrPrice(String(values.price ?? "")) * (Number(commissionValue) || 0)) / 100) : Number(commissionValue) || 0, currency)}</Text>
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{formatLocation(loc, visibility) || "Konum belirtilmedi"}</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    <View style={{ backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
                      <Text style={{ color: colors.primaryDark, fontSize: 11, fontWeight: "900" }}>{commissionType === "rate" ? `%${commissionValue} komisyon` : `${moneyIn(Number(commissionValue) || 0, currency)} komisyon`}</Text>
                    </View>
                    {Number(bonusAmount) > 0 && Number(bonusQuota) > 0 ? (
                      <View style={{ backgroundColor: colors.warningSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
                        <Text style={{ color: colors.warning, fontSize: 11, fontWeight: "900" }}>ilk {Number(bonusQuota)} satışa +{moneyIn(Number(bonusAmount), currency)} bonus</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
              <View style={{ flex: 1, gap: 8, minWidth: 240 }}>
                <PreviewRow label="Kategori" value={path.map((p) => p.label).join(" › ")} />
                <PreviewRow label="Konum" value={formatLocation(loc, "neighborhood") || "—"} />
                <PreviewRow label="Görsel" value={`${images.length || "kategori görseli"} adet`} />
                <PreviewRow label="Ortaklık" value={partnershipMode === "open" ? "Herkese açık" : partnershipMode === "approval" ? "Onaylı" : "Davetle"} />
                {missingFields.length ? <Text style={{ color: colors.accent, fontSize: 12.5, fontWeight: "700" }}>Eksik zorunlu alan: {missingFields.map((f) => f.label).join(", ")}</Text> : <Text style={{ color: colors.success, fontSize: 12.5, fontWeight: "800" }}>✓ Tüm zorunlu alanlar dolu</Text>}
              </View>
            </View>
          </View>
        ) : null}
      </View>

      <LegalDisclaimer />

      {/* Honeypot (botlar için gizli tuzak; ekranda görünmez, gerçek kullanıcı dokunmaz) */}
      <TextInput
        value={honeypot}
        onChangeText={setHoneypot}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        autoCorrect={false}
        autoCapitalize="none"
        style={{ height: 0, opacity: 0, position: "absolute", width: 0 }}
        placeholder="Bu alanı boş bırakın"
      />

      {/* Anlık moderasyon uyarısı (kategori/kelime riski) */}
      {liveModeration ? (
        <View style={{ alignItems: "center", backgroundColor: liveModeration.level === "block" ? colors.accentSoft : colors.warningSoft, borderRadius: 12, flexDirection: "row", gap: 9, padding: 13 }}>
          <MaterialCommunityIcons name={liveModeration.level === "block" ? "cancel" : "shield-alert-outline"} size={18} color={liveModeration.level === "block" ? colors.accent : colors.warning} />
          <Text style={{ color: liveModeration.level === "block" ? colors.accent : colors.warning, flex: 1, fontSize: 12.5, fontWeight: "700" }}>{liveModeration.msg}</Text>
        </View>
      ) : null}

      {/* Hata / bilgi banner'ı */}
      {error ? (
        <View style={{ alignItems: "center", backgroundColor: colors.accentSoft, borderRadius: 12, flexDirection: "row", gap: 9, padding: 13 }}>
          <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.accent} />
          <Text style={{ color: colors.accent, flex: 1, fontSize: 13, fontWeight: "700" }}>{error}</Text>
        </View>
      ) : null}
      {notice ? (
        <View style={{ alignItems: "center", backgroundColor: colors.warningSoft, borderRadius: 12, flexDirection: "row", gap: 9, padding: 13 }}>
          <MaterialCommunityIcons name="clock-check-outline" size={18} color={colors.warning} />
          <Text style={{ color: colors.warning, flex: 1, fontSize: 13, fontWeight: "700" }}>{notice}</Text>
        </View>
      ) : null}

      {/* Nav */}
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <Pressable
          onPress={() => {
            // İlk adımdayken (kategori) geri = ilan verme ekranından çık.
            if (step === 0) { if (router.canGoBack()) router.back(); else router.replace("/(tabs)"); return; }
            setStep((s) => Math.max(0, s - 1));
          }}
          style={{ alignItems: "center", borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 18, paddingVertical: 11 }}
        >
          <MaterialCommunityIcons name="arrow-left" size={16} color={colors.muted} /><Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>{step === 0 ? "Vazgeç" : "Geri"}</Text>
        </Pressable>
        {step < STEPS.length - 1 ? (
          <Pressable disabled={!canNext()} onPress={() => setStep((s) => s + 1)} style={{ alignItems: "center", backgroundColor: canNext() ? colors.primary : colors.line, borderRadius: 10, flexDirection: "row", gap: 7, paddingHorizontal: 22, paddingVertical: 12 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" }}>Devam</Text><MaterialCommunityIcons name="arrow-right" size={16} color="#FFFFFF" />
          </Pressable>
        ) : (
          <Pressable disabled={publishing || missingFields.length > 0 || liveModeration?.level === "block"} onPress={() => void publish()} style={{ alignItems: "center", backgroundColor: missingFields.length || liveModeration?.level === "block" ? colors.line : colors.primary, borderRadius: 10, flexDirection: "row", gap: 7, paddingHorizontal: 24, paddingVertical: 12 }}>
            <MaterialCommunityIcons name="check-decagram" size={17} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" }}>{publishing ? "Yayınlanıyor…" : "İlanı Yayınla"}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function DField({ field, value, onChange }: { field: FieldDef; value: string | boolean | string[] | undefined; onChange: (v: string | boolean | string[]) => void }) {
  const wide = field.type === "textarea" || field.type === "multiselect";
  // Başlık/açıklama için karakter standardı (Sahibinden benzeri) + canlı sayaç.
  const charLimit = field.key === "title" ? LIMITS.title : field.key === "description" ? LIMITS.description : null;
  const charLen = charLimit ? String(value ?? "").length : 0;
  const selected = Array.isArray(value) ? value : [];
  return (
    <View style={{ flexBasis: wide ? "100%" : 230, flexGrow: 1, gap: 6, minWidth: 0 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <Text style={{ color: colors.muted, flex: 1, fontSize: 12.5, fontWeight: "800" }}>{field.label}{field.required ? " *" : ""}{field.suffix ? ` (${field.suffix})` : ""}{field.type === "multiselect" && selected.length ? ` · ${selected.length} seçili` : ""}</Text>
        {charLimit ? <Text style={{ color: charLen > charLimit.max || (charLen > 0 && charLen < charLimit.min) ? colors.accent : colors.subtle, fontSize: 11, fontWeight: "700" }}>{charLen}/{charLimit.max}</Text> : null}
      </View>
      {field.type === "multiselect" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {(field.options ?? []).map((opt) => {
            const on = selected.includes(opt);
            return (
              <Pressable key={opt} onPress={() => onChange(on ? selected.filter((x) => x !== opt) : [...selected, opt])} style={{ alignItems: "center", backgroundColor: on ? colors.primarySoft : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 4, paddingHorizontal: 11, paddingVertical: 7 }}>
                {on ? <MaterialCommunityIcons name="check" size={13} color={colors.primaryDark} /> : null}
                <Text style={{ color: on ? colors.primaryDark : colors.ink, fontSize: 12, fontWeight: on ? "800" : "600" }}>{opt}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : field.type === "bool" ? (
        <Pressable onPress={() => onChange(!(value === true))} style={{ alignItems: "center", flexDirection: "row", gap: 9 }}>
          <View style={{ alignItems: value === true ? "flex-end" : "flex-start", backgroundColor: value === true ? colors.primary : colors.line, borderRadius: 999, height: 26, justifyContent: "center", paddingHorizontal: 3, width: 48 }}><View style={{ backgroundColor: "#FFFFFF", borderRadius: 999, height: 20, width: 20 }} /></View>
          <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "700" }}>{value === true ? "Evet" : "Hayır"}</Text>
        </Pressable>
      ) : field.type === "select" ? (
        <DSelect label="" value={String(value ?? "")} options={field.options ?? []} onChange={onChange} placeholder="Seçin" />
      ) : (
        <TextInput
          value={String(value ?? "")}
          onChangeText={onChange}
          keyboardType={field.type === "number" ? "numeric" : "default"}
          multiline={wide}
          maxLength={charLimit ? charLimit.max : undefined}
          placeholder={field.key === "title" ? `En az ${LIMITS.title.min} karakter — kısa ve net başlık` : field.placeholder}
          placeholderTextColor={colors.subtle}
          style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 11, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: wide ? 84 : 46, paddingHorizontal: 12, paddingVertical: wide ? 10 : 8, textAlignVertical: wide ? "top" : "center" }}
        />
      )}
    </View>
  );
}

function DSelect({ label, value, options, onChange, placeholder }: { label: string; value: string; options: string[]; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: label ? 6 : 0 }}>
      {label ? <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{label}</Text> : null}
      <Pressable onPress={() => setOpen((o) => !o)} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: open ? colors.primary : colors.line, borderRadius: 11, borderWidth: 1, flexDirection: "row", gap: 8, minHeight: 46, paddingHorizontal: 12 }}>
        <Text style={{ color: value ? colors.ink : colors.subtle, flex: 1, fontSize: 13.5, fontWeight: value ? "700" : "500" }}>{value || placeholder || "Seçin"}</Text>
        <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
      </Pressable>
      {/* Inline açılır liste: alttaki alanların ÜSTÜNE binmez, onları aşağı iter (mobil dahil sorunsuz). */}
      {open ? (
        <View style={{ backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: 11, borderWidth: 1, marginTop: 4, maxHeight: 240, overflow: "hidden" }}>
          <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {options.map((o) => (
              <Pressable key={o} onPress={() => { onChange(o); setOpen(false); }} style={({ pressed }) => ({ backgroundColor: pressed || o === value ? colors.surfaceAlt : "transparent", borderBottomColor: colors.line, borderBottomWidth: 1, paddingHorizontal: 12, paddingVertical: 11 })}>
                <Text style={{ color: o === value ? colors.primaryDark : colors.ink, fontSize: 13, fontWeight: o === value ? "800" : "600" }}>{o}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function ToggleRow({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
      <View style={{ alignItems: on ? "flex-end" : "flex-start", backgroundColor: on ? colors.primary : colors.line, borderRadius: 999, height: 26, justifyContent: "center", paddingHorizontal: 3, width: 48 }}><View style={{ backgroundColor: "#FFFFFF", borderRadius: 999, height: 20, width: 20 }} /></View>
      <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 10, paddingVertical: 8 }}>
      <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700", width: 140 }}>{label}</Text>
      <Text style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "800" }}>{value}</Text>
    </View>
  );
}

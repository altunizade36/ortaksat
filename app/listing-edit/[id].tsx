import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Alert } from "@/lib/alert";

import { AttributeFields } from "@/components/attribute-fields";
import { colors } from "@/components/colors";
import { LocationSelector, type LocationValue } from "@/components/location-selector";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { Card, EmptyState, PrimaryButton, SectionTitle, StatusPill } from "@/components/ui";
import { CategoryPicker as TreeCategoryPicker } from "@/components/category-picker";
import { getFormSchema, resolveFormKey, type CategoryNode } from "@/lib/category-tree";
import { type CurrencyCode } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { uploadListingImage } from "@/lib/live-service";
import { formatLocation, getProvince, type AddressVisibility } from "@/lib/locations";
import type { CommissionType, Listing, PartnershipMode } from "@/lib/types";
import { useStore } from "@/lib/use-store";
import { parseTrPrice } from "@/lib/validation";

type ContactMethod = Listing["contactMethod"];

const fallbackImage = "https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=1200";

export default function ListingEditRoute() {
  const { language } = useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser, findListing } = useStore();
  const listing = findListing(id);

  if (!listing || listing.ownerId !== currentUser.id) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16 }}>
        <EmptyState title={translateCopy("İlan düzenlenemiyor", language)} body={translateCopy("Bu ilan bulunamadı veya düzenleme yetkin yok.", language)} />
      </ScrollView>
    );
  }

  return <ListingEditForm listing={listing} />;
}

function ListingEditForm({ listing }: { listing: Listing }) {
  const { language } = useLanguage();
  const router = useRouter();
  const { authError, backendMode, currentUser, updateListing, removeListing, partnerships, leads, sales } = useStore();
  const isLiveAccount = backendMode === "supabase" && currentUser.id.includes("-");
  const [title, setTitle] = useState(listing.title);
  const [description, setDescription] = useState(listing.description);
  const [price, setPrice] = useState(`${listing.price}`);
  const [commissionType, setCommissionType] = useState<CommissionType>(listing.commissionType);
  const [commissionValue, setCommissionValue] = useState(`${listing.commissionValue}`);
  const [partnershipMode, setPartnershipMode] = useState<PartnershipMode>(listing.partnershipMode);
  const [category, setCategory] = useState(listing.category);
  const [catPath, setCatPath] = useState<CategoryNode[]>([]);
  const [currency, setCurrency] = useState<CurrencyCode>((listing.currency as CurrencyCode) ?? "TRY");
  const [bonusAmount, setBonusAmount] = useState(listing.bonusAmount ? String(listing.bonusAmount) : "");
  const [bonusQuota, setBonusQuota] = useState(listing.bonusQuota ? String(listing.bonusQuota) : "");
  // Kademeli komisyon (yalnız yüzde) — mevcut kademelerden yüklenir.
  const [tiers, setTiers] = useState<Array<{ minSales: string; rate: string }>>((listing.commissionTiers ?? []).map((tr) => ({ minSales: String(tr.minSales), rate: String(tr.rate) })));
  // Yapısal konum (create ile aynı): il/ilçe korunur; boş metin-alan bug'ı giderildi.
  const [loc, setLoc] = useState<LocationValue>({ provinceId: listing.provinceId ?? undefined, districtId: listing.districtId ?? undefined });
  const [visibility, setVisibility] = useState<AddressVisibility>((listing.addressVisibility as AddressVisibility) ?? "neighborhood");
  const [stockCount, setStockCount] = useState(`${listing.stockCount}`);
  const [minPartnerRating, setMinPartnerRating] = useState(`${listing.minPartnerRating}`);
  const [commissionDueDays, setCommissionDueDays] = useState(`${listing.commissionDueDays}`);
  const [returnWindowDays, setReturnWindowDays] = useState(`${listing.returnWindowDays}`);
  const [attributionWindowDays, setAttributionWindowDays] = useState(`${listing.attributionWindowDays ?? 30}`);
  const [image, setImage] = useState(listing.image);
  const [deliveryNote, setDeliveryNote] = useState(listing.deliveryNote);
  const [tags, setTags] = useState(listing.tags.join(", "));
  const [pitch, setPitch] = useState(listing.salesPitch.join("\n"));
  const [instagramText, setInstagramText] = useState(listing.shareTemplates?.instagram ?? "");
  const [whatsappText, setWhatsappText] = useState(listing.shareTemplates?.whatsapp ?? "");
  const [tiktokText, setTiktokText] = useState(listing.shareTemplates?.tiktok ?? "");
  const [adAssets, setAdAssets] = useState<string[]>(listing.adAssets ?? []);
  const [partnerRules, setPartnerRules] = useState(listing.partnerRules.join("\n"));
  const [contactMethod, setContactMethod] = useState<ContactMethod>(listing.contactMethod);
  const [saving, setSaving] = useState(false);
  // Yapısal kategori özellikleri (emlak: m²/oda/imar…) düzenlenebilir.
  const [attrValues, setAttrValues] = useState<Record<string, string | boolean | string[]>>(() => {
    const a = listing.attributes ?? {};
    const out: Record<string, string | boolean | string[]> = {};
    for (const [k, v] of Object.entries(a)) { if (!k.startsWith("_")) out[k] = typeof v === "number" ? String(v) : v; }
    return out;
  });
  // Form şeması: kategori yeniden seçildiyse ondan, değilse ilanın kayıtlı _formKey'inden.
  const formKey = catPath.length ? resolveFormKey(catPath) : ((listing.attributes?._formKey as string) || "");
  const attrSchema = formKey ? getFormSchema(formKey) : null;
  const setAttr = (k: string, v: string | boolean | string[]) => setAttrValues((s) => ({ ...s, [k]: v }));

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(translateCopy("İzin gerekli", language), translateCopy("İlan fotoğrafı seçmek için galeri izni vermelisin.", language));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ["images"],
      quality: 0.82
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setImage(result.assets[0].uri);
    }
  }

  async function pickAdAssets() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(translateCopy("İzin gerekli", language), translateCopy("Ek fotoğraf seçmek için galeri izni vermelisin.", language));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, mediaTypes: ["images"], quality: 0.82, selectionLimit: 4 });
    if (result.canceled) return;
    const uris = result.assets.map((a) => a.uri).filter(Boolean);
    setAdAssets((s) => [...s, ...uris].slice(0, 4));
  }

  async function submit() {
    const parsedPrice = parseTrPrice(price); // "1.500.000" gibi TR biçimini doğru okur (Number NaN veriyordu)
    // Fiyat, şemada price alanı yoksa (İş İlanı) veya opsiyonelse (hayvan/hizmet/ders
    // "Teklif al") zorunlu değildir — create ile parite. Aksi hâlde edit bu ilanları kilitliyordu.
    const priceSchemaField = attrSchema?.fields.find((f) => f.key === "price") ?? attrSchema?.fields.find((f) => f.type === "number" && f.suffix === "₺");
    const priceRequired = priceSchemaField ? !!priceSchemaField.required : false;
    const parsedCommission = Number(commissionValue);
    const parsedStock = Number(stockCount);
    const parsedMinRating = Number(minPartnerRating);
    const parsedCommissionDueDays = Number(commissionDueDays);
    const parsedReturnWindowDays = Number(returnWindowDays);
    const parsedAttributionWindowDays = Number(attributionWindowDays);
    const salesPitch = pitch.split("\n").map((item) => item.trim()).filter(Boolean);
    const parsedRules = partnerRules.split("\n").map((item) => item.trim()).filter(Boolean);
    const parsedTags = tags.split(",").map((item) => item.trim()).filter(Boolean);
    const parsedAdAssets = adAssets.slice(0, 4);

    // Yapısal özellikleri düzenleyiciden yeniden kur (create ile aynı mantık);
    // şema yoksa mevcut değerleri koru. _leaf/_root/_formKey meta bilgisi saklanır.
    const builtAttrs: Record<string, string | number | boolean | string[]> = {};
    if (attrSchema) {
      for (const f of attrSchema.fields) {
        if (f.key === "title" || f.key === "description" || f.key === "price") continue;
        const raw = attrValues[f.key];
        if (raw === undefined || raw === null || (typeof raw === "string" && !raw.trim())) continue;
        if (Array.isArray(raw)) { if (raw.length) builtAttrs[f.key] = raw; continue; }
        if (typeof raw === "boolean") { if (raw) builtAttrs[f.key] = true; continue; }
        // TR biçimli sayı ("150.000") — Number() binlik ayıracını bozardı (km/m²).
        builtAttrs[f.key] = f.type === "number" ? parseTrPrice(String(raw)) : String(raw);
      }
    } else {
      for (const [k, v] of Object.entries(attrValues)) if (v !== "" && !(Array.isArray(v) && !v.length)) builtAttrs[k] = v;
    }
    const meta = listing.attributes ?? {};
    if (meta._leaf) builtAttrs._leaf = meta._leaf as string;
    if (meta._root) builtAttrs._root = meta._root as string;
    if (formKey) builtAttrs._formKey = formKey;
    const shareTemplates = buildShareTemplates({
      title,
      price: parsedPrice,
      commissionType,
      commissionValue: parsedCommission,
      pitch: salesPitch,
      instagramText,
      whatsappText,
      tiktokText
    });

    if (
      !title.trim() ||
      !description.trim() ||
      !Number.isFinite(parsedPrice) ||
      (priceRequired ? parsedPrice <= 0 : parsedPrice < 0) ||
      !Number.isFinite(parsedCommission) ||
      parsedCommission < 0 ||
      !Number.isFinite(parsedStock) ||
      parsedStock < 0
    ) {
      Alert.alert(translateCopy("Eksik bilgi", language), translateCopy("Başlık, açıklama, fiyat, stok ve komisyon alanlarını kontrol et.", language));
      return;
    }

    // Zorunlu kategori özelliklerini create ile aynı şekilde doğrula (edit'te eksikti).
    if (attrSchema) {
      const missing = attrSchema.fields.filter((f) => {
        if (!f.required || f.key === "title" || f.key === "description" || f.key === "price") return false;
        const val = attrValues[f.key];
        if (Array.isArray(val)) return val.length === 0;
        return !String(val ?? "").trim();
      });
      if (missing.length) {
        Alert.alert(translateCopy("Eksik zorunlu alan", language), `${translateCopy("Şu alanları doldur:", language)} ${missing.map((f) => f.label).join(", ")}`);
        return;
      }
    }

    // Yapısal konumdan metni kur (il/ilçe korunur); serbest metin bug'ı giderildi.
    const locText = formatLocation(loc, visibility) || getProvince(loc.provinceId)?.name || listing.location || "Türkiye";
    const bonusNum = Number(bonusAmount);
    const quotaNum = Number(bonusQuota);
    const hasBonus = bonusNum > 0 && quotaNum > 0;

    setSaving(true);
    const uploadedImage = isLiveAccount ? await uploadListingImage(image.trim() || fallbackImage, currentUser.id) : image.trim();
    const uploadedAssets = isLiveAccount
      ? await Promise.all(parsedAdAssets.map((uri) => uploadListingImage(uri, currentUser.id)))
      : parsedAdAssets;
    const ok = await updateListing(listing.id, {
      title: title.trim(),
      description: description.trim(),
      salesPitch: salesPitch.length > 0 ? salesPitch : ["Ürünün ana faydasını kısa ve net anlat."],
      shareTemplates,
      adAssets: uploadedAssets,
      tags: parsedTags.length > 0 ? parsedTags : ["ortak satış"],
      price: parsedPrice,
      commissionType,
      commissionValue: parsedCommission,
      commissionTiers: commissionType === "rate"
        ? tiers.map((tr) => ({ minSales: Math.max(0, Math.floor(Number(tr.minSales) || 0)), rate: Math.max(0, Math.min(90, Number(tr.rate) || 0)) })).filter((tr) => tr.rate > 0).sort((a, b) => a.minSales - b.minSales)
        : undefined,
      partnershipMode,
      attributes: builtAttrs,
      category: category.trim() || "Genel",
      location: locText,
      provinceId: loc.provinceId,
      districtId: loc.districtId,
      addressVisibility: visibility,
      currency,
      bonusAmount: hasBonus ? bonusNum : undefined,
      bonusQuota: hasBonus ? quotaNum : undefined,
      image: uploadedImage || listing.image,
      stockCount: Math.max(0, parsedStock),
      minPartnerRating: Number.isFinite(parsedMinRating) ? parsedMinRating : 0,
      commissionDueDays: Number.isFinite(parsedCommissionDueDays) ? parsedCommissionDueDays : 3,
      returnWindowDays: Number.isFinite(parsedReturnWindowDays) ? parsedReturnWindowDays : 7,
      attributionWindowDays: Number.isFinite(parsedAttributionWindowDays) && parsedAttributionWindowDays > 0 ? parsedAttributionWindowDays : 30,
      partnerRules: parsedRules.length > 0 ? parsedRules : ["Komisyon sadece onaylı satış kaydında oluşur."],
      deliveryNote: deliveryNote.trim() || "Teslimat satıcıyla alıcı arasında netleştirilir.",
      contactMethod
    });
    setSaving(false);

    if (!ok) {
      Alert.alert(translateCopy("Kaydedilemedi", language), authError ?? translateCopy("İlan güncellenemedi.", language));
      return;
    }

    Alert.alert(translateCopy("İlan güncellendi", language), translateCopy("Satıcı panelindeki ilan bilgileri yenilendi.", language));
    router.back();
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 14, padding: 16, paddingBottom: 128 }}>
        <Card>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <StatusPill label={translateCopy("İlan düzenleme", language)} tone="info" />
            <StatusPill label={isLiveAccount ? translateCopy("Canlı kayıt", language) : translateCopy("Ön izleme", language)} tone={isLiveAccount ? "success" : "warning"} />
            <StatusPill label={listing.status === "active" ? translateCopy("Aktif", language) : listing.status === "paused" ? translateCopy("Pasif", language) : translateCopy("Satıldı", language)} tone={listing.status === "active" ? "success" : "warning"} />
          </View>
          <Text selectable style={{ color: colors.ink, fontSize: 24, fontWeight: "900", lineHeight: 30 }}>
            {translateCopy("İlanı profesyonelce güncelle", language)}
          </Text>
          <Text selectable style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
            {translateCopy("Fiyat, stok, komisyon, ortaklık kuralı, teslimat notu ve görseli buradan canlı şekilde yönet.", language)}
          </Text>
        </Card>

        <Card>
          <SectionTitle title={translateCopy("Fotoğraf", language)} action={translateCopy("1:1 önerilir", language)} />
          <Image source={{ uri: image || listing.image || fallbackImage }} contentFit="cover" style={{ backgroundColor: colors.line, borderRadius: 8, height: 210 }} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton icon="image-plus" tone="secondary" onPress={() => void pickImage()}>
                {translateCopy("Fotoğraf Seç", language)}
              </PrimaryButton>
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton icon="content-save-outline" onPress={() => void submit()}>
                {saving ? translateCopy("Kaydediliyor", language) : translateCopy("Kaydet", language)}
              </PrimaryButton>
            </View>
          </View>
          <Field label="Fotoğraf adresi" value={image} onChangeText={setImage} />
        </Card>

        <Card>
          <SectionTitle title={translateCopy("Ürün bilgileri", language)} />
          <Field label="Başlık" value={title} onChangeText={setTitle} />
          <Field label="Açıklama" value={description} onChangeText={setDescription} multiline />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="Fiyat" value={price} onChangeText={setPrice} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Stok" value={stockCount} onChangeText={setStockCount} keyboardType="numeric" />
            </View>
          </View>
          {/* Kategori: mevcut kategori korunur (ince yaprak). Önceki yerel picker
              lib/categories.ts'in 19 kaba kategorisini kullandığı için eşleşmez ve
              seçince kategoriyi bozuyordu. Artık create ile AYNI ağaç-tabanlı picker. */}
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>{translateCopy("Kategori", language)}</Text>
            <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <View style={{ backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>Şu anki: {category || "—"}</Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{translateCopy("Değiştirmek istersen aşağıdan yeni kategori seç (opsiyonel).", language)}</Text>
            </View>
            <TreeCategoryPicker value={catPath} onChange={(p) => { setCatPath(p); if (p.length) setCategory(p[p.length - 1].label); }} />
          </View>
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>{translateCopy("Konum", language)}</Text>
            <LocationSelector value={loc} onChange={setLoc} showNeighborhood showAddressLine mode="listing" />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {([["district_only", "Sadece il/ilçe"], ["neighborhood", "İl/ilçe/mahalle"], ["full_address_private", "Açık adres yalnızca onay sonrası"]] as const).map(([k, lbl]) => {
                const on = visibility === k;
                return (
                  <Pressable key={k} onPress={() => setVisibility(k)} style={{ backgroundColor: on ? colors.primary : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 8 }}>
                    <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12.5, fontWeight: "800" }}>{translateCopy(lbl, language)}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ color: colors.subtle, fontSize: 11.5, fontWeight: "600" }}>{formatLocation(loc, visibility) || translateCopy("İl/ilçe seçildikçe konum güncellenir.", language)}</Text>
          </View>
        </Card>

        {attrSchema ? (
          <Card>
            <SectionTitle title={`Özellikler — ${attrSchema.title}`} action={translateCopy("Emlak / kategori detayları", language)} />
            <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{translateCopy("Bu kategorinin yapısal özellikleri (m², oda, imar, tapu, donatılar…). Doldurdukça ilan detayında ve filtrelerde görünür.", language)}</Text>
            <AttributeFields fields={attrSchema.fields} values={attrValues} onChange={setAttr} schemaKey={attrSchema.key} />
          </Card>
        ) : null}

        <Card>
          <SectionTitle title={translateCopy("Ortaklık ve komisyon", language)} />
          <Segmented options={[["open", "Açık"], ["approval", "Onaylı"], ["invite", "Davetli"]]} value={partnershipMode} onChange={(value) => setPartnershipMode(value as PartnershipMode)} />
          <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
            {translateCopy("Açık: herkes anında ortak olur. Onaylı: satıcı başvuruyu değerlendirir. Davetli: sadece seçilen ortaklar katılır.", language)}
          </Text>
          <Segmented options={[["rate", "Yüzde"], ["fixed", "Sabit"]]} value={commissionType} onChange={(value) => setCommissionType(value as CommissionType)} />
          <Field label="Komisyon" value={commissionValue} onChangeText={setCommissionValue} keyboardType="numeric" />
          {/* Kademeli komisyon (yalnız yüzde): hacimle artan oran. */}
          {commissionType === "rate" ? (
            <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 12, borderWidth: 1, gap: 8, padding: 12 }}>
              <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{translateCopy("Kademeli komisyon (opsiyonel)", language)}</Text>
              <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>{translateCopy("Ortağın bu ilandaki kümülatif satışı arttıkça oran yükselsin. Boş → tek oran.", language)}</Text>
              {tiers.map((tr, i) => (
                <View key={i} style={{ alignItems: "flex-end", flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}><Field label="Satıştan sonra" value={tr.minSales} onChangeText={(v) => setTiers((s) => s.map((x, j) => (j === i ? { ...x, minSales: v } : x)))} keyboardType="numeric" /></View>
                  <View style={{ flex: 1 }}><Field label="Oran (%)" value={tr.rate} onChangeText={(v) => setTiers((s) => s.map((x, j) => (j === i ? { ...x, rate: v } : x)))} keyboardType="numeric" /></View>
                  <Pressable onPress={() => setTiers((s) => s.filter((_, j) => j !== i))} hitSlop={8} style={{ paddingBottom: 14 }}><MaterialCommunityIcons name="close-circle" size={22} color={colors.muted} /></Pressable>
                </View>
              ))}
              {tiers.length < 4 ? (
                <Pressable onPress={() => setTiers((s) => [...s, { minSales: "", rate: "" }])} style={{ alignItems: "center", borderColor: colors.primary, borderRadius: 10, borderStyle: "dashed", borderWidth: 1, flexDirection: "row", gap: 6, justifyContent: "center", paddingVertical: 9 }}>
                  <MaterialCommunityIcons name="plus" size={15} color={colors.primaryDark} />
                  <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Kademe ekle", language)}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>{translateCopy("Para birimi", language)}</Text>
            <Segmented options={[["TRY", "₺ TL"], ["USD", "$ USD"], ["EUR", "€ EUR"]]} value={currency} onChange={(value) => setCurrency(value as CurrencyCode)} />
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="Başlangıç bonusu (ops.)" value={bonusAmount} onChangeText={setBonusAmount} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Bonus kontenjanı" value={bonusQuota} onChangeText={setBonusQuota} keyboardType="numeric" />
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="Min. puan" value={minPartnerRating} onChangeText={setMinPartnerRating} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Ödeme günü" value={commissionDueDays} onChangeText={setCommissionDueDays} keyboardType="numeric" />
            </View>
          </View>
          <Field label="İade bekleme günü" value={returnWindowDays} onChangeText={setReturnWindowDays} keyboardType="numeric" />
          <Field label="Atıf (referans) süresi (gün)" value={attributionWindowDays} onChangeText={setAttributionWindowDays} keyboardType="numeric" />
          <Field label="Etiketler" value={tags} onChangeText={setTags} />
          <Field label="Satış argümanları" value={pitch} onChangeText={setPitch} multiline />
          <SectionTitle title={translateCopy("Hazır paylaşım metinleri", language)} action={translateCopy("Ortak kullanır", language)} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <View style={{ flexBasis: "31%", flexGrow: 1 }}>
              <PrimaryButton tone="secondary" onPress={() => setInstagramText(buildShareTemplates({ title, price: Number(price), commissionType, commissionValue: Number(commissionValue), pitch: pitch.split("\n") }).instagram)}>Instagram</PrimaryButton>
            </View>
            <View style={{ flexBasis: "31%", flexGrow: 1 }}>
              <PrimaryButton tone="secondary" onPress={() => setWhatsappText(buildShareTemplates({ title, price: Number(price), commissionType, commissionValue: Number(commissionValue), pitch: pitch.split("\n") }).whatsapp)}>WhatsApp</PrimaryButton>
            </View>
            <View style={{ flexBasis: "31%", flexGrow: 1 }}>
              <PrimaryButton tone="secondary" onPress={() => setTiktokText(buildShareTemplates({ title, price: Number(price), commissionType, commissionValue: Number(commissionValue), pitch: pitch.split("\n") }).tiktok)}>TikTok</PrimaryButton>
            </View>
          </View>
          <Field label="Instagram açıklaması" value={instagramText} onChangeText={setInstagramText} multiline />
          <Field label="WhatsApp paylaşım mesajı" value={whatsappText} onChangeText={setWhatsappText} multiline />
          <Field label="Kısa TikTok açıklaması" value={tiktokText} onChangeText={setTiktokText} multiline />
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Ek görseller (en fazla 4)", language)}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {adAssets.map((img, i) => (
                <View key={img + i} style={{ borderColor: colors.line, borderRadius: 10, borderWidth: 1, height: 84, overflow: "hidden", width: 84 }}>
                  <SafeRemoteImage uri={img} style={{ height: "100%", width: "100%" }} contentFit="cover" />
                  <Pressable onPress={() => setAdAssets((s) => s.filter((_, idx) => idx !== i))} style={{ alignItems: "center", backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 999, height: 22, justifyContent: "center", position: "absolute", right: 4, top: 4, width: 22 }}>
                    <MaterialCommunityIcons name="close" size={13} color="#FFFFFF" />
                  </Pressable>
                </View>
              ))}
              {adAssets.length < 4 ? (
                <Pressable onPress={() => void pickAdAssets()} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 10, borderStyle: "dashed", borderWidth: 1.5, gap: 3, height: 84, justifyContent: "center", width: 84 }}>
                  <MaterialCommunityIcons name="image-plus" size={22} color={colors.primary} />
                  <Text style={{ color: colors.primaryDark, fontSize: 10.5, fontWeight: "800" }}>{translateCopy("Ekle", language)}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          <Field label="Ortak satış kuralları" value={partnerRules} onChangeText={setPartnerRules} multiline />
          <Field label="Teslimat notu" value={deliveryNote} onChangeText={setDeliveryNote} multiline />
        </Card>

        <Card>
          <SectionTitle title={translateCopy("İletişim tipi", language)} />
          <Segmented options={[["whatsapp", "WhatsApp"], ["message", "Mesaj"], ["phone", "Telefon"]]} value={contactMethod} onChange={(value) => setContactMethod(value as ContactMethod)} />
          <PrimaryButton icon="content-save-outline" onPress={() => void submit()}>
            {saving ? translateCopy("Kaydediliyor", language) : translateCopy("Değişiklikleri Kaydet", language)}
          </PrimaryButton>
        </Card>

        {/* İlanı sil — düzenleme ekranından da erişilebilir (kullanıcı burada da bekliyor). */}
        <Card>
          <SectionTitle title={translateCopy("İlanı sil", language)} />
          <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", lineHeight: 19 }}>
            {translateCopy("İlanı listenden kaldırır. Geçmişi (talep/ortaklık/satış) olan ilan arşivlenir, kayıtların korunur. Geçici gizlemek için satıcı panelinden \"Pasife Al\" kullan.", language)}
          </Text>
          <PrimaryButton
            tone="danger"
            icon="trash-can-outline"
            onPress={() => {
              const hasHistory = partnerships.some((p) => p.listingId === listing.id) || leads.some((l) => l.listingId === listing.id) || sales.some((s) => s.listingId === listing.id);
              Alert.alert(
                translateCopy("İlanı sil", language),
                hasHistory
                  ? translateCopy("Bu ilanın talep/ortaklık/satış geçmişi var. İlan kaldırılıp arşivlenir; komisyon ve satış kayıtların korunur.", language)
                  : translateCopy("İlan kalıcı olarak silinir. Bu işlem geri alınamaz.", language),
                [
                  { text: translateCopy("Vazgeç", language), style: "cancel" },
                  { text: translateCopy(hasHistory ? "Kaldır ve arşivle" : "Kalıcı sil", language), style: "destructive", onPress: () => { removeListing(listing.id); router.back(); } }
                ]
              );
            }}
          >
            {translateCopy("İlanı sil", language)}
          </PrimaryButton>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Segmented({ onChange, options, value }: { options: Array<[string, string]>; value: string; onChange: (value: string) => void }) {
  const { language } = useLanguage();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map(([key, label]) => {
        const active = key === value;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            style={({ pressed }) => ({
              alignItems: "center",
              backgroundColor: active ? colors.primarySoft : colors.surfaceAlt,
              borderColor: active ? colors.primary : colors.line,
              borderRadius: 8,
              borderWidth: 1,
              flexBasis: "30%",
              flexGrow: 1,
              justifyContent: "center",
              minHeight: 42,
              opacity: pressed ? 0.72 : 1,
              paddingHorizontal: 8
            })}
          >
            <Text adjustsFontSizeToFit minimumFontScale={0.84} numberOfLines={1} style={{ color: active ? colors.primaryDark : colors.ink, fontSize: 13, fontWeight: "900" }}>
              {translateCopy(label, language)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function buildShareTemplates({
  commissionType,
  commissionValue,
  instagramText,
  pitch,
  price,
  tiktokText,
  title,
  whatsappText
}: {
  title: string;
  price: number;
  commissionType: CommissionType;
  commissionValue: number;
  pitch: string[];
  instagramText?: string;
  whatsappText?: string;
  tiktokText?: string;
}) {
  const cleanTitle = title.trim() || "Bu ürün";
  const cleanPitch = pitch.map((item) => item.trim()).filter(Boolean)[0] || "Stok hazır, detay için yazabilirsin.";
  const commission = commissionType === "rate" ? `%${commissionValue}` : `${commissionValue} TL`;
  const priceText = Number.isFinite(price) ? `${price} TL` : "fiyat bilgisi ilanda";

  return {
    instagram: instagramText?.trim() || `${cleanTitle}\n${cleanPitch}\nFiyat: ${priceText}\nDetay ve sipariş için bağlantıya tıkla. #ortaksat #komisyonlusatış`,
    whatsapp: whatsappText?.trim() || `Merhaba, ${cleanTitle} için detayları göndereyim.\n${cleanPitch}\nFiyat: ${priceText}\nBağlantıdan inceleyebilirsin.`,
    tiktok: tiktokText?.trim() || `${cleanTitle} kısa tanıtım: ${cleanPitch} Komisyon modeli: ${commission}. Detay bağlantıda.`
  };
}

function Field({
  keyboardType,
  label,
  multiline,
  onChangeText,
  value
}: {
  keyboardType?: "default" | "numeric";
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  value: string;
}) {
  const { language } = useLanguage();
  return (
    <View style={{ gap: 6 }}>
      <Text selectable style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>
        {translateCopy(label, language)}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        placeholderTextColor={colors.muted}
        style={{
          backgroundColor: colors.surfaceAlt,
          borderColor: colors.line,
          borderRadius: 8,
          borderWidth: 1,
          color: colors.ink,
          fontSize: 15,
          minHeight: multiline ? 96 : 48,
          padding: 12,
          textAlignVertical: multiline ? "top" : "center"
        }}
      />
    </View>
  );
}

import { parseListingMoney, parseListingRate, listingCommissionError, listingNumberInput, LISTING_MONEY_ERROR } from "@/lib/listing-numbers";
import { ListingLocationFields } from "@/components/listing-location-fields";
import { ListingTitleField } from "@/components/listing-title-field";
import { validateListingTitle } from "@/lib/listing-title";
import { isMobileApp } from "@/lib/mobile-app";
import { MobileListingEditor } from "@/components/mobile/listing-editor";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import { MaterialCommunityIcons } from "@/components/icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Alert } from "@/lib/alert";
import { showToast } from "@/lib/toast";

import { AttributeFields } from "@/components/attribute-fields";
import { colors } from "@/components/colors";
import { type LocationValue } from "@/components/location-selector";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { Card, EmptyState, PrimaryButton, SectionTitle, StatusPill } from "@/components/ui";
import { CategoryPicker as TreeCategoryPicker } from "@/components/category-picker";
import { listingCategoryPath } from "@/lib/category-match";
import { categoryPathAttributes, isLeafCategoryPath, savedCategoryPath } from "@/lib/category-path";
import { deriveFieldsFromPath, getFormSchema, resolveFormKey, type CategoryNode } from "@/lib/category-tree";
import { listingCategoryTrail } from "@/lib/mobile-catalog";
import { type CurrencyCode } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { uploadListingImage } from "@/lib/live-service";
import { deleteListingVideo, splitListingMedia, withListingVideo, type ListingVideoValue } from "@/lib/listing-video";
import { ListingVideoField, type ListingVideoStatus } from "@/components/listing-video-field";
import { formatLocation, getProvince, validateListingLocation, type AddressVisibility } from "@/lib/locations";
import type { CommissionType, Listing, PartnershipMode } from "@/lib/types";
import { useStore } from "@/lib/use-store";
import { parseTrPrice } from "@/lib/validation";

type ContactMethod = Listing["contactMethod"];

const fallbackImage = "https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=1200";
const MAX_LISTING_PHOTOS = 5;
const MAX_AD_ASSETS = MAX_LISTING_PHOTOS - 1;

export default function ListingEditRoute() {
  const { language } = useLanguage();
  const { id, view } = useLocalSearchParams<{ id: string; view?: string }>();
  const { currentUser, findListing, authReady, accountLoaded, marketplaceInitialLoading } = useStore();
  const listing = findListing(id);

  if (!authReady || !accountLoaded || marketplaceInitialLoading) return <ScreenSkeleton />;
  if (!listing || listing.ownerId !== currentUser.id) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16 }}>
        <EmptyState title={translateCopy("İlan düzenlenemiyor", language)} body={translateCopy("Bu ilan bulunamadı veya düzenleme yetkin yok.", language)} />
      </ScrollView>
    );
  }

  return isMobileApp && view !== "advanced" ? <MobileListingEditor key={listing.id} listing={listing} /> : <ListingEditForm key={listing.id} listing={listing} />;
}

function ListingEditForm({ listing }: { listing: Listing }) {
  const { language } = useLanguage();
  const router = useRouter();
  const { authError, backendMode, currentUser, updateListing, removeListing, partnerships, leads, sales, categoryTree } = useStore();
  const isLiveAccount = backendMode === "supabase" && currentUser.id.includes("-");
  const [title, setTitle] = useState(listing.title);
  const [description, setDescription] = useState(listing.description);
  const [price, setPrice] = useState(listingNumberInput(listing.price));
  const [commissionType, setCommissionType] = useState<CommissionType>(listing.commissionType);
  const [commissionValue, setCommissionValue] = useState(listingNumberInput(listing.commissionValue));
  const [partnershipMode, setPartnershipMode] = useState<PartnershipMode>(listing.partnershipMode);
  // KAYITLI KATEGORİ YOLU: önce benzersiz `_path`, yoksa keşfet/kategori sayfalarıyla AYNI çözücü
  // (listingCategoryPath), o da bulamazsa (yönetici-eklentisi kategori) etiket araması.
  const [savedPath] = useState<CategoryNode[]>(() => {
    const exact = savedCategoryPath(categoryTree, listing);
    if (exact) return exact;
    const resolved = listingCategoryPath(listing);
    return resolved.length ? resolved : listingCategoryTrail(categoryTree, listing);
  });
  // Seçici kayıtlı yolla ÖN-SEÇİLİ açılır (eskiden boş açılıyor, yalnız yaprak adı gösteriliyordu).
  const [catPath, setCatPath] = useState<CategoryNode[]>(savedPath);
  // Kullanıcı kategoriye DOKUNMADIYSA _root/_leaf/_formKey/_path aynen korunur (tahmin yazılmaz).
  const [catChanged, setCatChanged] = useState(false);
  const newPath = catChanged && isLeafCategoryPath(catPath) ? catPath : null;
  const category = newPath ? newPath[newPath.length - 1].label : listing.category;
  const [currency, setCurrency] = useState<CurrencyCode>((listing.currency as CurrencyCode) ?? "TRY");
  const [bonusAmount, setBonusAmount] = useState(listing.bonusAmount ? String(listing.bonusAmount) : "");
  const [bonusQuota, setBonusQuota] = useState(listing.bonusQuota ? String(listing.bonusQuota) : "");
  // Kademeli komisyon (yalnız yüzde) — mevcut kademelerden yüklenir.
  const [tiers, setTiers] = useState<Array<{ minSales: string; rate: string }>>((listing.commissionTiers ?? []).map((tr) => ({ minSales: String(tr.minSales), rate: listingNumberInput(tr.rate) })));
  // Yapısal konum (create ile aynı): il/ilçe korunur; boş metin-alan bug'ı giderildi.
  const [loc, setLoc] = useState<LocationValue>({ provinceId: listing.provinceId ?? undefined, districtId: listing.districtId ?? undefined, neighborhood: listing.locationNote, neighborhoodId: listing.neighborhoodId });
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
  // adAssets = ek FOTOĞRAFLAR + (varsa, en sonda) TEK video. Eskiden hepsi fotoğraf sayılıyordu:
  // video kırık görsel olarak çiziliyor ve 4 ek fotoğraflı ilanda kaydederken sessizce siliniyordu.
  const originalVideo = splitListingMedia(listing.adAssets).video;
  const [adAssets, setAdAssets] = useState<string[]>(() => splitListingMedia(listing.adAssets).photos);
  const [video, setVideo] = useState<ListingVideoValue | null>(originalVideo ? { url: originalVideo } : null);
  const [videoStatus, setVideoStatus] = useState<ListingVideoStatus>("idle");
  const [partnerRules, setPartnerRules] = useState(listing.partnerRules.join("\n"));
  const [contactMethod, setContactMethod] = useState<ContactMethod>(listing.contactMethod);
  const [saving, setSaving] = useState(false);
  // Yapısal kategori özellikleri (emlak: m²/oda/imar…) düzenlenebilir.
  const savedAttrValues = () => {
    const a = listing.attributes ?? {};
    const out: Record<string, string | boolean | string[]> = {};
    for (const [k, v] of Object.entries(a)) { if (!k.startsWith("_")) out[k] = typeof v === "number" ? String(v) : v; }
    return out;
  };
  const [attrValues, setAttrValues] = useState<Record<string, string | boolean | string[]>>(savedAttrValues);
  // Form şeması: kategori yeniden seçildiyse ondan, değilse ilanın kayıtlı _formKey'inden.
  const savedFormKey = (listing.attributes?._formKey as string) || "";
  const formKey = newPath ? resolveFormKey(newPath) : savedFormKey;
  const attrSchema = formKey ? getFormSchema(formKey) : null;
  const setAttr = (k: string, v: string | boolean | string[]) => setAttrValues((s) => ({ ...s, [k]: v }));

  /** Seçiciden gelen yol: [] = kullanıcı geziniyor (henüz seçim yok), yaprak = yeni kategori. */
  function changeCategory(next: CategoryNode[]) {
    setCatPath(next);
    if (!isLeafCategoryPath(next)) {
      // Yeni seçimden geri dönüldü → kayıt KAYITLI kategoriyle yapılacak; form da ona dönmeli
      // (yoksa yeni şemanın değerleri eski şemayla kaydedilip kayıtlı özellikleri silerdi).
      if (catChanged) { if (formKey !== savedFormKey) setAttrValues(savedAttrValues()); setCatChanged(false); }
      return;
    }
    const prevPath = newPath ?? savedPath;
    const nextKey = resolveFormKey(next);
    // Eski kategoriden türeyen marka/model/ilan-tipi yeni kategoride bayat kalmasın; şema
    // DEĞİŞTİYSE önceki şemanın tüm özellikleri temizlenir (eskiden aynı adlı alanlar — ör.
    // otomobilin "brand"i — telefon ilanına taşınıyordu).
    const oldSeed: Record<string, string> = prevPath.length ? deriveFieldsFromPath(prevPath, getFormSchema(formKey || resolveFormKey(prevPath))) : {};
    const seed = deriveFieldsFromPath(next, getFormSchema(nextKey));
    delete seed.title;
    setAttrValues((old) => ({
      ...(nextKey === formKey ? Object.fromEntries(Object.entries(old).filter(([k, v]) => !(k in oldSeed) || v !== oldSeed[k])) : {}),
      ...seed
    }));
    setCatChanged(true);
  }
  /** Kategori değişikliğinden vazgeç → kayıtlı kategori ve (şema değiştiyse) kayıtlı özellikler. */
  function keepSavedCategory() {
    if (formKey !== savedFormKey) setAttrValues(savedAttrValues());
    setCatPath(savedPath);
    setCatChanged(false);
  }

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
    // Kapak (image) dışı ek görseller: create akışıyla aynı, toplam en fazla 5 fotoğraf.
    const result = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, mediaTypes: ["images"], quality: 0.82, selectionLimit: MAX_AD_ASSETS });
    if (result.canceled) return;
    const uris = result.assets.map((a) => a.uri).filter(Boolean);
    setAdAssets((s) => [...s, ...uris].slice(0, MAX_AD_ASSETS));
  }

  async function submit() {
    if (saving) return;
    if (videoStatus === "uploading") { Alert.alert(translateCopy("Video yükleniyor", language), translateCopy("Video yükleniyor; yükleme bitince tekrar dene.", language)); return; }
    if (videoStatus === "error") { Alert.alert(translateCopy("Video yüklenemedi", language), translateCopy("Video bölümünden \"Tekrar dene\" ya da \"Vazgeç\" seçeneğini kullan.", language)); return; }
    const parsedPrice = parseListingMoney(price.trim() ? price : 0); // "1.500.000" gibi TR biçimini doğru okur (Number NaN veriyordu)
    // Fiyat, şemada price alanı yoksa (İş İlanı) veya opsiyonelse (hayvan/hizmet/ders
    // "Teklif al") zorunlu değildir — create ile parite. Aksi hâlde edit bu ilanları kilitliyordu.
    const priceSchemaField = attrSchema?.fields.find((f) => f.key === "price") ?? attrSchema?.fields.find((f) => f.type === "number" && f.suffix === "₺");
    const priceRequired = priceSchemaField ? !!priceSchemaField.required : false;
    // TR-SAYI GÜVENLİĞİ (create ile parite): sabit (₺) komisyonu "1.500" yazınca Number()
    // 1.5 ₺ yapardı → sessizce yanlış komisyonla KAYDEDİLİR. Sabit=TR-binlik parseTrPrice;
    // oran=% ondalık olabilir (12,5) → virgülü noktaya çevir. Stok da TR-binlik olabilir.
    const parsedCommission = commissionType === "rate"
      ? parseListingRate(String(commissionValue))
      : parseListingMoney(String(commissionValue));
    const parsedStock = parseListingMoney(String(stockCount));
    const parsedMinRating = Number(minPartnerRating);
    const parsedCommissionDueDays = Number(commissionDueDays);
    const parsedReturnWindowDays = Number(returnWindowDays);
    const parsedAttributionWindowDays = Number(attributionWindowDays);
    const salesPitch = pitch.split("\n").map((item) => item.trim()).filter(Boolean);
    const parsedRules = partnerRules.split("\n").map((item) => item.trim()).filter(Boolean);
    const parsedTags = tags.split(",").map((item) => item.trim()).filter(Boolean);
    const parsedAdAssets = adAssets.slice(0, MAX_AD_ASSETS);

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
    // KATEGORİ META: yeni kategori seçildiyse dördü de (_root/_leaf/_formKey/_path) SEÇİLEN YOLDAN
    // yazılır. Eskiden yalnız `category` + `_formKey` güncelleniyor, `_leaf`/`_root` ESKİ kalıyordu
    // → ilan kategori değiştirildikten sonra da eski kategoride listeleniyordu. Dokunulmadıysa
    // aşağıdaki döngü kayıtlı meta'yı aynen taşır.
    if (newPath) Object.assign(builtAttrs, categoryPathAttributes(newPath));
    // Form'un YÖNETMEDİĞİ meta anahtarlarını (_ ile başlayan) koru. Eskiden yalnız _leaf/_root/
    // _formKey geri ekleniyordu → düzenleme (ör. fiyat) _urgentUntil (Acil rozeti) + _partnerRegion
    // + _maxPartners + _commissionCondition'ı KALICI SİLİYORDU. attrValues zaten _-anahtarlarını
    // dışlar → burada üzerine yazmadan taşı.
    for (const [k, v] of Object.entries(meta)) {
      if (k.startsWith("_") && !(k in builtAttrs)) builtAttrs[k] = v as string | number | boolean | string[];
    }
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

    if (!Number.isFinite(parsedPrice) || parsedPrice > 999_999_999_999) { Alert.alert("Fiyatı kontrol et", LISTING_MONEY_ERROR); return; }
    const commissionError = partnershipMode !== "none" ? listingCommissionError(commissionType, commissionValue) : "";
    if (commissionError) { Alert.alert("Komisyonu kontrol et", commissionError); return; }
    // Kademeler (create ile parite): oran TR ondalığıyla da yazılabilir ("12,5"). Eskiden Number("12,5") = NaN → 0
    // oluyor ve kademe kaydederken SESSİZCE siliniyordu. Geçersiz satır artık kaydı durdurur; tamamen boş satır yok sayılır.
    const tierError = partnershipMode !== "none" && commissionType === "rate" && tiers.some((tr) => {
      if (!tr.rate.trim() && !tr.minSales.trim()) return false;
      const rate = parseListingRate(tr.rate);
      return !(rate > 0 && rate <= 90) || !/^\d+$/.test(tr.minSales.trim());
    });
    if (tierError) { Alert.alert("Kademeleri kontrol et", "Kademelerde satış adedini tam sayı, oranı 1–90 arasında gir (ör. 5 satıştan sonra %12,5)."); return; }
    if (!Number.isSafeInteger(parsedStock) || parsedStock < 0) { Alert.alert("Stok", "Stok sıfır veya daha büyük bir tam sayı olmalı."); return; }
    const titleCheck = validateListingTitle(title);
    if (titleCheck.error) { Alert.alert("Başlığı düzenleyin", titleCheck.error); return; }
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

    const locationError = validateListingLocation(loc);
    if (locationError) { Alert.alert(translateCopy("Konum", language), translateCopy(locationError, language)); return; }

    // Yapısal konumdan metni kur (il/ilçe korunur); serbest metin bug'ı giderildi.
    const locText = formatLocation(loc, visibility) || getProvince(loc.provinceId)?.name || listing.location || "Türkiye";
    const bonusNum = parseTrPrice(String(bonusAmount)) || 0; // TR-binlik ("1.000"→1000, Number 1 yapardı)
    const quotaNum = Number(bonusQuota); // adet (küçük tam sayı)
    const hasBonus = bonusNum > 0 && quotaNum > 0;

    setSaving(true);
    let uploadedImage=image.trim(),uploadedAssets=parsedAdAssets;
    try {if(isLiveAccount){uploadedImage=await uploadListingImage(image.trim()||fallbackImage,currentUser.id);uploadedAssets=await Promise.all(parsedAdAssets.map(uri=>uploadListingImage(uri,currentUser.id)));}}
    catch {setSaving(false);Alert.alert("Fotoğraf yüklenemedi","İlan kaydedilmedi; görsellerini ve bağlantını kontrol ederek tekrar dene.");return;}
    const ok = await updateListing(listing.id, {
      title: titleCheck.title,
      description: description.trim(),
      salesPitch: salesPitch.length > 0 ? salesPitch : ["Ürünün ana faydasını kısa ve net anlat."],
      shareTemplates,
      adAssets: withListingVideo(uploadedAssets, video?.url),
      tags: parsedTags.length > 0 ? parsedTags : ["ortak satış"],
      price: parsedPrice,
      commissionType,
      // NORMAL İLAN'a çevrilirse komisyon/tier/bonus SIFIRLANIR (create ile parite) — aksi halde
      // kart/panelde hayalet komisyon kalırdı.
      commissionValue: partnershipMode === "none" ? 0 : parsedCommission,
      commissionTiers: partnershipMode !== "none" && commissionType === "rate"
        ? tiers.map((tr) => ({ minSales: Math.max(0, Math.floor(Number(tr.minSales) || 0)), rate: Math.max(0, Math.min(90, parseListingRate(tr.rate) || 0)) })).filter((tr) => tr.rate > 0).sort((a, b) => a.minSales - b.minSales)
        : undefined,
      partnershipMode,
      attributes: builtAttrs,
      category: category.trim() || "Genel",
      location: locText,
      provinceId: loc.provinceId,
      districtId: loc.districtId,
      neighborhoodId: loc.neighborhoodId,
      locationNote: loc.neighborhood?.trim() || undefined,
      addressVisibility: visibility,
      currency,
      bonusAmount: partnershipMode !== "none" && hasBonus ? bonusNum : undefined,
      bonusQuota: partnershipMode !== "none" && hasBonus ? quotaNum : undefined,
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

    // Kayıt başarılı: değiştirilen/kaldırılan ESKİ video artık hiçbir ilana bağlı değil → depodan sil (en-iyi-çaba).
    if (originalVideo && originalVideo !== video?.url) void deleteListingVideo(originalVideo, currentUser.id);
    showToast(translateCopy("İlan güncellendi", language));
    router.back();
  }

  // Paylaşım şablonu metni için komisyonu doğru oku (submit'teki parsedCommission ile aynı mantık;
  // sabit "1.500" TR-binlik Number ile 1.5 ₺ olup yanlış pazarlama metni üretmesin).
  const commissionNum = commissionType === "rate"
    ? parseListingRate(String(commissionValue))
    : parseListingMoney(String(commissionValue));

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 14, padding: 16, paddingBottom: 128 }}>
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
          <ListingTitleField value={title} onChange={setTitle} />
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
              {/* TAM YOL: yalnız yaprak adı ("Satılık", "Diğer") hangi dal olduğunu söylemiyordu. */}
              <View style={{ backgroundColor: colors.primarySoft, borderRadius: 12, maxWidth: "100%", paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800", lineHeight: 18 }}>{translateCopy("Kayıtlı kategori", language)}: {savedPath.length ? savedPath.map((n) => translateCopy(n.label, language)).join(" › ") : (listing.category || "—")}</Text>
              </View>
              {catChanged || catPath.length !== savedPath.length ? (
                <Pressable accessibilityRole="button" onPress={keepSavedCategory} hitSlop={6} style={{ justifyContent: "center", minHeight: 32 }}>
                  <Text style={{ color: colors.primary, fontSize: 12.5, fontWeight: "800", textDecorationLine: "underline" }}>{translateCopy("Kayıtlı kategoriyi koru", language)}</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 17 }}>
              {newPath
                ? `${translateCopy("Yeni kategori", language)}: ${newPath.map((n) => translateCopy(n.label, language)).join(" › ")}. ${translateCopy("Kaydedince ilan bu kategoride görünür.", language)}`
                : catPath.length
                  ? translateCopy("Değiştirmek için \"Değiştir\"e bas ve yeni kategoriyi seç (opsiyonel).", language)
                  : translateCopy("Yeni bir alt kategori seçmezsen kayıtlı kategori korunur.", language)}
            </Text>
            <TreeCategoryPicker value={catPath} onChange={changeCategory} />
          </View>
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>{translateCopy("Konum", language)}</Text>
            <ListingLocationFields value={loc} onChange={setLoc} visibility={visibility} onVisibility={setVisibility} />
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
          {/* BİRİNCİL SEÇİM (create ile parite): ortak satışa aç mı, normal ilan mı.
              Eskiden yalnız Açık/Onaylı/Davetli vardı → NORMAL İLAN'a geçilemiyordu (tip destekliyor). */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {([["approval", "Ortak satışa aç"], ["none", "Normal ilan"]] as const).map(([m, lbl]) => {
              const on = m === "none" ? partnershipMode === "none" : partnershipMode !== "none";
              return (
                <Pressable key={m} accessibilityRole="button" onPress={() => setPartnershipMode(m as PartnershipMode)}
                  style={{ alignItems: "center", backgroundColor: on ? colors.primaryDark : colors.surfaceAlt, borderColor: on ? colors.primaryDark : colors.line, borderRadius: 10, borderWidth: 1, flex: 1, paddingVertical: 11 }}>
                  <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 13, fontWeight: "800" }}>{translateCopy(lbl, language)}</Text>
                </Pressable>
              );
            })}
          </View>
          {partnershipMode === "none" ? (
            <Text selectable style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>
              {translateCopy("Normal ilan: ürün doğrudan alıcılara açık; ortak satış ve komisyon yoktur. İstediğin zaman ortak satışa açabilirsin.", language)}
            </Text>
          ) : (
          <>
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
          </>
          )}
          {/* "Atıf (referans) süresi" alanı KALDIRILDI: model'de zorunlu referans linki/tıklama
              takibi yok (create ile parite). attributionWindowDays içeride varsayılanla korunur. */}
          <Field label="Etiketler" value={tags} onChangeText={setTags} />
          <Field label="Satış argümanları" value={pitch} onChangeText={setPitch} multiline />
          <SectionTitle title={translateCopy("Hazır paylaşım metinleri", language)} action={translateCopy("Ortak kullanır", language)} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <View style={{ flexBasis: "31%", flexGrow: 1 }}>
              <PrimaryButton tone="secondary" onPress={() => setInstagramText(buildShareTemplates({ title, price: parseTrPrice(price), commissionType, commissionValue: commissionNum, pitch: pitch.split("\n") }).instagram)}>Instagram</PrimaryButton>
            </View>
            <View style={{ flexBasis: "31%", flexGrow: 1 }}>
              <PrimaryButton tone="secondary" onPress={() => setWhatsappText(buildShareTemplates({ title, price: parseTrPrice(price), commissionType, commissionValue: commissionNum, pitch: pitch.split("\n") }).whatsapp)}>WhatsApp</PrimaryButton>
            </View>
            <View style={{ flexBasis: "31%", flexGrow: 1 }}>
              <PrimaryButton tone="secondary" onPress={() => setTiktokText(buildShareTemplates({ title, price: parseTrPrice(price), commissionType, commissionValue: commissionNum, pitch: pitch.split("\n") }).tiktok)}>TikTok</PrimaryButton>
            </View>
          </View>
          <Field label="Instagram açıklaması" value={instagramText} onChangeText={setInstagramText} multiline />
          <Field label="WhatsApp paylaşım mesajı" value={whatsappText} onChangeText={setWhatsappText} multiline />
          <Field label="Kısa TikTok açıklaması" value={tiktokText} onChangeText={setTiktokText} multiline />
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{translateCopy(`Ek görseller (en fazla ${MAX_AD_ASSETS})`, language)}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {adAssets.map((img, i) => (
                <View key={img + i} style={{ borderColor: colors.line, borderRadius: 10, borderWidth: 1, height: 84, overflow: "hidden", width: 84 }}>
                  <SafeRemoteImage uri={img} style={{ height: "100%", width: "100%" }} contentFit="cover" />
                  <Pressable onPress={() => setAdAssets((s) => s.filter((_, idx) => idx !== i))} style={{ alignItems: "center", backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 999, height: 22, justifyContent: "center", position: "absolute", right: 4, top: 4, width: 22 }}>
                    <MaterialCommunityIcons name="close" size={13} color="#FFFFFF" />
                  </Pressable>
                </View>
              ))}
              {adAssets.length < MAX_AD_ASSETS ? (
                <Pressable onPress={() => void pickAdAssets()} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 10, borderStyle: "dashed", borderWidth: 1.5, gap: 3, height: 84, justifyContent: "center", width: 84 }}>
                  <MaterialCommunityIcons name="image-plus" size={22} color={colors.primary} />
                  <Text style={{ color: colors.primaryDark, fontSize: 10.5, fontWeight: "800" }}>{translateCopy("Ekle", language)}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          <ListingVideoField value={video} onChange={setVideo} userId={currentUser.id} canUpload={isLiveAccount} disabled={saving} keepUrl={originalVideo} onStatus={setVideoStatus} />
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

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { Card, EmptyState, PrimaryButton, SectionTitle, StatusPill } from "@/components/ui";
import { listingCategories } from "@/lib/categories";
import { CategoryPicker as TreeCategoryPicker } from "@/components/category-picker";
import type { CategoryNode } from "@/lib/category-tree";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { uploadListingImage } from "@/lib/live-service";
import type { CommissionType, Listing, PartnershipMode } from "@/lib/types";
import { useStore } from "@/lib/use-store";

type ContactMethod = Listing["contactMethod"];

const fallbackImage = "https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=1200";

export default function ListingEditRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser, findListing } = useStore();
  const listing = findListing(id);

  if (!listing || listing.ownerId !== currentUser.id) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16 }}>
        <EmptyState title="İlan düzenlenemiyor" body="Bu ilan bulunamadı veya düzenleme yetkin yok." />
      </ScrollView>
    );
  }

  return <ListingEditForm listing={listing} />;
}

function ListingEditForm({ listing }: { listing: Listing }) {
  const router = useRouter();
  const { authError, backendMode, currentUser, updateListing } = useStore();
  const isLiveAccount = backendMode === "supabase" && currentUser.id.includes("-");
  const [title, setTitle] = useState(listing.title);
  const [description, setDescription] = useState(listing.description);
  const [price, setPrice] = useState(`${listing.price}`);
  const [commissionType, setCommissionType] = useState<CommissionType>(listing.commissionType);
  const [commissionValue, setCommissionValue] = useState(`${listing.commissionValue}`);
  const [partnershipMode, setPartnershipMode] = useState<PartnershipMode>(listing.partnershipMode);
  const [category, setCategory] = useState(listing.category);
  const [catPath, setCatPath] = useState<CategoryNode[]>([]);
  const [location, setLocation] = useState(listing.location);
  const [stockCount, setStockCount] = useState(`${listing.stockCount}`);
  const [minPartnerRating, setMinPartnerRating] = useState(`${listing.minPartnerRating}`);
  const [commissionDueDays, setCommissionDueDays] = useState(`${listing.commissionDueDays}`);
  const [returnWindowDays, setReturnWindowDays] = useState(`${listing.returnWindowDays}`);
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

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("İzin gerekli", "İlan fotoğrafı seçmek için galeri izni vermelisin.");
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
      Alert.alert("İzin gerekli", "Ek fotoğraf seçmek için galeri izni vermelisin.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, mediaTypes: ["images"], quality: 0.82, selectionLimit: 4 });
    if (result.canceled) return;
    const uris = result.assets.map((a) => a.uri).filter(Boolean);
    setAdAssets((s) => [...s, ...uris].slice(0, 4));
  }

  async function submit() {
    const parsedPrice = Number(price);
    const parsedCommission = Number(commissionValue);
    const parsedStock = Number(stockCount);
    const parsedMinRating = Number(minPartnerRating);
    const parsedCommissionDueDays = Number(commissionDueDays);
    const parsedReturnWindowDays = Number(returnWindowDays);
    const salesPitch = pitch.split("\n").map((item) => item.trim()).filter(Boolean);
    const parsedRules = partnerRules.split("\n").map((item) => item.trim()).filter(Boolean);
    const parsedTags = tags.split(",").map((item) => item.trim()).filter(Boolean);
    const parsedAdAssets = adAssets.slice(0, 4);
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
      parsedPrice <= 0 ||
      !Number.isFinite(parsedCommission) ||
      parsedCommission < 0 ||
      !Number.isFinite(parsedStock) ||
      parsedStock < 0
    ) {
      Alert.alert("Eksik bilgi", "Başlık, açıklama, fiyat, stok ve komisyon alanlarını kontrol et.");
      return;
    }

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
      partnershipMode,
      category: category.trim() || "Genel",
      location: location.trim() || "Türkiye",
      image: uploadedImage || listing.image,
      stockCount: Math.max(0, parsedStock),
      minPartnerRating: Number.isFinite(parsedMinRating) ? parsedMinRating : 0,
      commissionDueDays: Number.isFinite(parsedCommissionDueDays) ? parsedCommissionDueDays : 3,
      returnWindowDays: Number.isFinite(parsedReturnWindowDays) ? parsedReturnWindowDays : 7,
      partnerRules: parsedRules.length > 0 ? parsedRules : ["Komisyon sadece onaylı satış kaydında oluşur."],
      deliveryNote: deliveryNote.trim() || "Teslimat satıcıyla alıcı arasında netleştirilir.",
      contactMethod
    });
    setSaving(false);

    if (!ok) {
      Alert.alert("Kaydedilemedi", authError ?? "İlan güncellenemedi.");
      return;
    }

    Alert.alert("İlan güncellendi", "Satıcı panelindeki ilan bilgileri yenilendi.");
    router.back();
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 14, padding: 16, paddingBottom: 128 }}>
        <Card>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <StatusPill label="İlan düzenleme" tone="info" />
            <StatusPill label={isLiveAccount ? "Canlı kayıt" : "Ön izleme"} tone={isLiveAccount ? "success" : "warning"} />
            <StatusPill label={listing.status === "active" ? "Aktif" : listing.status === "paused" ? "Pasif" : "Satıldı"} tone={listing.status === "active" ? "success" : "warning"} />
          </View>
          <Text selectable style={{ color: colors.ink, fontSize: 24, fontWeight: "900", lineHeight: 30 }}>
            İlanı profesyonelce güncelle
          </Text>
          <Text selectable style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
            Fiyat, stok, komisyon, ortaklık kuralı, teslimat notu ve görseli buradan canlı şekilde yönet.
          </Text>
        </Card>

        <Card>
          <SectionTitle title="Fotoğraf" action="1:1 önerilir" />
          <Image source={{ uri: image || listing.image || fallbackImage }} contentFit="cover" style={{ backgroundColor: colors.line, borderRadius: 8, height: 210 }} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton icon="image-plus" tone="secondary" onPress={() => void pickImage()}>
                Fotoğraf Seç
              </PrimaryButton>
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton icon="content-save-outline" onPress={() => void submit()}>
                {saving ? "Kaydediliyor" : "Kaydet"}
              </PrimaryButton>
            </View>
          </View>
          <Field label="Fotoğraf adresi" value={image} onChangeText={setImage} />
        </Card>

        <Card>
          <SectionTitle title="Ürün bilgileri" />
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
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>Kategori</Text>
            <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <View style={{ backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>Şu anki: {category || "—"}</Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>Değiştirmek istersen aşağıdan yeni kategori seç (opsiyonel).</Text>
            </View>
            <TreeCategoryPicker value={catPath} onChange={(p) => { setCatPath(p); if (p.length) setCategory(p[p.length - 1].label); }} />
          </View>
          <Field label="Konum" value={location} onChangeText={setLocation} />
        </Card>

        <Card>
          <SectionTitle title="Ortaklık ve komisyon" />
          <Segmented options={[["open", "Açık"], ["approval", "Onaylı"], ["invite", "Davetli"]]} value={partnershipMode} onChange={(value) => setPartnershipMode(value as PartnershipMode)} />
          <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
            Açık: herkes anında ortak olur. Onaylı: satıcı başvuruyu değerlendirir. Davetli: sadece seçilen ortaklar katılır.
          </Text>
          <Segmented options={[["rate", "Yüzde"], ["fixed", "Sabit"]]} value={commissionType} onChange={(value) => setCommissionType(value as CommissionType)} />
          <Field label="Komisyon" value={commissionValue} onChangeText={setCommissionValue} keyboardType="numeric" />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="Min. puan" value={minPartnerRating} onChangeText={setMinPartnerRating} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Ödeme günü" value={commissionDueDays} onChangeText={setCommissionDueDays} keyboardType="numeric" />
            </View>
          </View>
          <Field label="İade bekleme günü" value={returnWindowDays} onChangeText={setReturnWindowDays} keyboardType="numeric" />
          <Field label="Etiketler" value={tags} onChangeText={setTags} />
          <Field label="Satış argümanları" value={pitch} onChangeText={setPitch} multiline />
          <SectionTitle title="Hazır paylaşım metinleri" action="Ortak kullanır" />
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
            <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>Ek görseller (en fazla 4)</Text>
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
                  <Text style={{ color: colors.primaryDark, fontSize: 10.5, fontWeight: "800" }}>Ekle</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          <Field label="Ortak satış kuralları" value={partnerRules} onChangeText={setPartnerRules} multiline />
          <Field label="Teslimat notu" value={deliveryNote} onChangeText={setDeliveryNote} multiline />
        </Card>

        <Card>
          <SectionTitle title="İletişim tipi" />
          <Segmented options={[["whatsapp", "WhatsApp"], ["message", "Mesaj"], ["phone", "Telefon"]]} value={contactMethod} onChange={(value) => setContactMethod(value as ContactMethod)} />
          <PrimaryButton icon="content-save-outline" onPress={() => void submit()}>
            {saving ? "Kaydediliyor" : "Değişiklikleri Kaydet"}
          </PrimaryButton>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function CategoryPicker({ onChange, value }: { value: string; onChange: (value: string) => void }) {
  const { language } = useLanguage();
  return (
    <View style={{ gap: 8 }}>
      <Text selectable style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>
        {translateCopy("Kategori", language)}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {listingCategories.map((item) => {
          const active = item.key === value;

          return (
            <Pressable
              key={item.key}
              onPress={() => onChange(item.key)}
              style={({ pressed }) => ({
                alignItems: "center",
                backgroundColor: active ? colors.primary : colors.surface,
                borderColor: active ? colors.primary : colors.line,
                borderRadius: 8,
                borderWidth: 1,
                flexBasis: "31%",
                flexGrow: 1,
                gap: 6,
                justifyContent: "center",
                minHeight: 72,
                opacity: pressed ? 0.72 : 1,
                paddingHorizontal: 8,
                paddingVertical: 10
              })}
            >
              <MaterialCommunityIcons name={item.icon} size={20} color={active ? "#FFFFFF" : colors.primary} />
              <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={2} style={{ color: active ? "#FFFFFF" : colors.ink, fontSize: 12, fontWeight: "900", lineHeight: 15, textAlign: "center" }}>
                {translateCopy(item.label, language)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
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

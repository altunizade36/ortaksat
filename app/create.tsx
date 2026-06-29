import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { Card, PrimaryButton, SectionTitle, StatusPill } from "@/components/ui";
import { WebContainer } from "@/components/web-container";
import { getCategoryPartnerHint, getCategoryRequiredDetails, getCategorySubcategories, listingCategories } from "@/lib/categories";
import { money } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useIsWideWeb } from "@/lib/layout";
import { uploadListingImage } from "@/lib/live-service";
import type { CommissionType, Listing, PartnershipMode } from "@/lib/types";
import { useStore } from "@/lib/use-store";

type ContactMethod = Listing["contactMethod"];

const fallbackImage = "https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=1200";
const mascot = require("../assets/mascot.png");

export default function CreateListingScreen() {
  const { language, t } = useLanguage();
  const router = useRouter();
  const isWideWeb = useIsWideWeb();
  const { backendMode, createListing, currentUser } = useStore();
  const isLiveAccount = backendMode === "supabase" && currentUser.id.includes("-");
  const [title, setTitle] = useState("Kablosuz şarj standı");
  const [description, setDescription] = useState("Kutulu, stok hazır. Sosyal medyada hızlı anlatılabilecek pratik aksesuar.");
  const [price, setPrice] = useState("750");
  const [commissionType, setCommissionType] = useState<CommissionType>("rate");
  const [commissionValue, setCommissionValue] = useState("15");
  const [partnershipMode, setPartnershipMode] = useState<PartnershipMode>("approval");
  const [category, setCategory] = useState("Elektronik");
  const [location, setLocation] = useState("İstanbul");
  const [stockCount, setStockCount] = useState("12");
  const [minPartnerRating, setMinPartnerRating] = useState("4.0");
  const [commissionDueDays, setCommissionDueDays] = useState("3");
  const [returnWindowDays, setReturnWindowDays] = useState("7");
  const [images, setImages] = useState<string[]>([fallbackImage]);
  const [deliveryNote, setDeliveryNote] = useState("Satıcı 24 saat içinde kargoya verir. Ödeme ilk sürümde uygulama dışında yapılır.");
  const [tags, setTags] = useState("hazır stok, aksesuar, hızlı satış");
  const [pitch, setPitch] = useState("Masa üstünde düzen sağlar.\nTelefonu dik konumda kullanmayı kolaylaştırır.\nUygun fiyatlı hediye alternatifi olarak anlatılabilir.");
  const [instagramText, setInstagramText] = useState("");
  const [whatsappText, setWhatsappText] = useState("");
  const [tiktokText, setTiktokText] = useState("");
  const [adAssets, setAdAssets] = useState("");
  const [partnerRules, setPartnerRules] = useState("Satıcı onayı olmadan fiyat değiştirilemez.\nAlıcı bilgisi uygulamaya eksiksiz kaydedilir.\nİade olursa komisyon beklemeye alınır.");
  const [contactMethod, setContactMethod] = useState<ContactMethod>("message");
  const [publishing, setPublishing] = useState(false);
  const [step, setStep] = useState(1);
  const [subcategory, setSubcategory] = useState("");
  const [district, setDistrict] = useState("");
  const [condition, setCondition] = useState("");
  const [brand, setBrand] = useState("");
  const [color, setColor] = useState("");
  const [warrantyStatus, setWarrantyStatus] = useState("");
  const [warrantyDuration, setWarrantyDuration] = useState("");
  const cleanImageCount = images.map((item) => item.trim()).filter(Boolean).length;
  const priceNumber = Number(price);
  const commissionNumber = Number(commissionValue);
  const stockNumber = Number(stockCount);
  const minPartnerRatingNumber = Number(minPartnerRating);
  const commissionDueDaysNumber = Number(commissionDueDays);
  const returnWindowDaysNumber = Number(returnWindowDays);
  const salesPitchCount = pitch.split("\n").map((item) => item.trim()).filter(Boolean).length;
  const adAssetCount = adAssets.split("\n").map((item) => item.trim()).filter(Boolean).length;
  const estimatedCommission = Number.isFinite(priceNumber) && Number.isFinite(commissionNumber)
    ? commissionType === "rate"
      ? Math.round((priceNumber * commissionNumber) / 100)
      : commissionNumber
    : 0;
  const commissionIsValid =
    Number.isFinite(commissionNumber) &&
    commissionNumber > 0 &&
    (commissionType === "rate" ? commissionNumber <= 80 : Number.isFinite(priceNumber) && commissionNumber <= priceNumber);
  const publishChecks = [
    { ok: title.trim().length >= 3, text: "Ürün adı net" },
    { ok: description.trim().length >= 20, text: "Açıklama yeterli" },
    { ok: cleanImageCount >= 1 && cleanImageCount <= 5, text: "Medya sınırı doğru" },
    { ok: Number.isFinite(priceNumber) && priceNumber > 0 && Number.isFinite(stockNumber) && stockNumber >= 1, text: "Fiyat ve stok geçerli" },
    { ok: commissionIsValid, text: "Komisyon bilgisi net" },
    { ok: Number.isFinite(minPartnerRatingNumber) && minPartnerRatingNumber >= 0 && minPartnerRatingNumber <= 5, text: "Ortak puanı 0-5 aralığında" },
    { ok: Number.isFinite(commissionDueDaysNumber) && commissionDueDaysNumber >= 0 && commissionDueDaysNumber <= 30, text: "Ödeme vadesi geçerli" },
    { ok: Number.isFinite(returnWindowDaysNumber) && returnWindowDaysNumber >= 0 && returnWindowDaysNumber <= 30, text: "İade penceresi geçerli" },
    { ok: salesPitchCount >= 2, text: "Ortak satış argümanı hazır" },
    { ok: adAssetCount <= 5, text: "Reklam görseli sınırı doğru" },
    { ok: Boolean(contactMethod), text: "İletişim kanalı seçildi" }
  ];
  const canPublish = publishChecks.every((item) => item.ok);

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(translateCopy("İzin gerekli", language), translateCopy("İlan fotoğrafı seçmek için galeri izni vermelisin.", language));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ["images", "videos"],
      quality: 0.82
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setImages((items) => {
        const next = [result.assets[0].uri, ...items.filter((item) => item !== fallbackImage && item !== result.assets[0].uri)];
        return next.slice(0, 5);
      });
    }
  }

  function removeImage(uri: string) {
    setImages((items) => {
      const next = items.filter((item) => item !== uri);
      return next.length > 0 ? next : [fallbackImage];
    });
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
    const extraTags = [subcategory, condition, brand, color].map((item) => item.trim()).filter(Boolean);
    const parsedTags = [...tags.split(",").map((item) => item.trim()).filter(Boolean), ...extraTags].slice(0, 12);
    const parsedAdAssets = adAssets.split("\n").map((item) => item.trim()).filter(Boolean);
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

    const cleanImages = images.map((item) => item.trim()).filter(Boolean);

    if (!canPublish || cleanImages.length < 1 || cleanImages.length > 5 || parsedAdAssets.length > 5) {
      const firstError = publishChecks.find((item) => !item.ok)?.text ?? "Form alanlarını kontrol et";
      Alert.alert(translateCopy("Eksik bilgi", language), translateCopy(firstError, language));
      return;
    }

    setPublishing(true);
    try {
      const uploadedImages = isLiveAccount
        ? await Promise.all(cleanImages.map((image) => uploadListingImage(image, currentUser.id)))
        : cleanImages;
      const savedImages = uploadedImages.filter(Boolean);
      const coverImage = savedImages.find((item) => !isVideoUri(item)) || fallbackImage;
      const extraMedia = savedImages.filter((item) => item !== coverImage);
      createListing({
        title: title.trim(),
        description: description.trim(),
        salesPitch: salesPitch.length > 0 ? salesPitch : ["Ürünün ana faydasını kısa ve net anlat."],
        shareTemplates,
        adAssets: [...extraMedia, ...parsedAdAssets].slice(0, 5),
        tags: parsedTags.length > 0 ? parsedTags : ["ortak satış"],
        price: parsedPrice,
        commissionType,
        commissionValue: parsedCommission,
        partnershipMode,
        category: category.trim() || "Genel",
        location: [location.trim(), district.trim()].filter(Boolean).join(", ") || "Türkiye",
        image: coverImage,
        stockCount: parsedStock,
        minPartnerRating: parsedMinRating,
        commissionDueDays: parsedCommissionDueDays,
        returnWindowDays: parsedReturnWindowDays,
        partnerRules: parsedRules.length > 0 ? parsedRules : ["Komisyon sadece onaylı satış kaydında oluşur."],
        deliveryNote: deliveryNote.trim() || "Teslimat satıcıyla alıcı arasında netleştirilir.",
        contactMethod
      });
      router.replace("/(tabs)/seller");
    } catch (error) {
      Alert.alert(translateCopy("Yayınlanamadı", language), error instanceof Error ? error.message : translateCopy("İlan oluşturulurken beklenmeyen bir hata oluştu.", language));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 14, padding: 16, paddingBottom: 128 }}>
        {isWideWeb ? (
          <View style={{ alignSelf: "center", gap: 4, maxWidth: 1200, width: "100%" }}>
            <Text style={{ color: colors.ink, fontSize: 26, fontWeight: "900" }}>Yeni ilan oluştur</Text>
            <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>Ürününü binlerce alıcı ve ortak satıcıya ulaştır.</Text>
            <CreateStepper current={step} onStep={setStep} />
          </View>
        ) : null}
        <View style={isWideWeb ? { alignItems: "flex-start", alignSelf: "center", flexDirection: "row", gap: 24, maxWidth: 1200, width: "100%" } : undefined}>
        <View style={isWideWeb ? { flex: 1, minWidth: 0 } : undefined}>
        <WebContainer max={860} padding={0} style={{ gap: 14 }}>
        <Card>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1, gap: 8 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                <StatusPill label="Satıcı ilanı" tone="success" />
                <StatusPill label={isLiveAccount ? "Canlı yayın" : "Ön izleme"} tone={isLiveAccount ? "success" : "warning"} />
              </View>
              <Text selectable style={{ color: colors.ink, fontSize: 22, fontWeight: "900", lineHeight: 27 }}>
                {translateCopy("İlan oluştur", language)}
              </Text>
            </View>
            <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 8, height: 68, justifyContent: "center", overflow: "hidden", width: 68 }}>
              <Image source={mascot} contentFit="cover" style={{ height: 84, width: 84 }} />
            </View>
          </View>
          <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
            {language === "en" ? "Add the product, commission, stock, and the copy partners will share." : "Ürünü, komisyonu, stok bilgisini ve ortakların paylaşacağı metinleri ekle."}
          </Text>
          <PrimaryButton href="/(tabs)/seller" tone="secondary" icon="storefront-outline">İlanlarım ve Satıcı Paneli</PrimaryButton>
          {!isLiveAccount ? (
            <PrimaryButton href="/auth" tone="soft">Canlı hesapla giriş yap</PrimaryButton>
          ) : null}
        </Card>

        {(!isWideWeb || step === 5) ? (<Card>
          <SectionTitle title="Yayın kontrolü" action={canPublish ? "Hazır" : "Kontrol"} />
          <Text selectable style={{ color: colors.muted, fontSize: 13, fontWeight: "700", lineHeight: 19 }}>
            {translateCopy("İlan yayına çıkmadan önce eksik alanları burada görürsün.", language)}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <DraftMetric label="Medya" value={`${cleanImageCount}/5`} />
            <DraftMetric label="Tahmini komisyon" value={`${estimatedCommission} TL`} />
            <DraftMetric label="Stok" value={`${Number.isFinite(stockNumber) ? stockNumber : 0}`} />
          </View>
          <View style={{ gap: 8 }}>
            {publishChecks.map((item) => (
              <CheckRow key={item.text} ok={item.ok} text={item.text} />
            ))}
          </View>
        </Card>) : null}

        {(!isWideWeb || step === 2) ? (<Card>
          <SectionTitle title="Medya" action="1-5 medya" />
          <MediaPreview uri={images[0] || fallbackImage} large />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {images.map((item, index) => (
              <Pressable
                key={`${item}-${index}`}
                onPress={() => removeImage(item)}
                style={({ pressed }) => ({
                  backgroundColor: colors.line,
                  borderColor: index === 0 ? colors.primary : colors.line,
                  borderRadius: 10,
                  borderWidth: index === 0 ? 2 : 1,
                  height: 62,
                  opacity: pressed ? 0.72 : 1,
                  overflow: "hidden",
                  width: 62
                })}
              >
                <MediaPreview uri={item} />
                {index === 0 ? (
                  <View style={{ backgroundColor: "rgba(0,134,111,0.9)", bottom: 0, left: 0, position: "absolute", right: 0 }}>
                    <Text adjustsFontSizeToFit minimumFontScale={0.75} numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 8, fontWeight: "900", paddingHorizontal: 3, textAlign: "center" }}>
                      {translateCopy("Vitrin", language)}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
          <Text selectable style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
            {language === "en" ? "The first media becomes the cover. You can add up to 5 images or videos." : "İlk medya vitrin olur. En fazla 5 görsel veya video ekleyebilirsin."}
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton tone="secondary" onPress={pickImage}>Medya Seç</PrimaryButton>
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton tone="secondary" onPress={() => setImages([fallbackImage])}>Temizle</PrimaryButton>
            </View>
          </View>
          <Field label="Vitrin medya adresi" value={images[0] ?? ""} onChangeText={(value) => setImages((items) => [value, ...items.slice(1)].slice(0, 5))} />
        </Card>) : null}

        {(!isWideWeb || step === 1) ? (<Card>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
            <View style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 999, height: 30, justifyContent: "center", width: 30 }}>
              <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>1</Text>
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>Temel Bilgiler</Text>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>Ürününüz hakkında temel bilgileri girin.</Text>
            </View>
          </View>

          <CounterField label="İlan Başlığı" required value={title} onChangeText={(v) => setTitle(v.slice(0, 80))} placeholder="Örn. iPhone 15 Pro 256GB Titanyum Mavi" max={80} />

          <View style={isWideWeb ? { flexDirection: "row", gap: 12 } : { gap: 14 }}>
            <View style={{ flex: 1 }}>
              <SelectField label="Kategori" required value={category} placeholder="Seçiniz" options={listingCategories.map((c) => ({ label: c.label, value: c.key }))} onSelect={(v) => { setCategory(String(v)); setSubcategory(""); }} />
            </View>
            <View style={{ flex: 1 }}>
              <SelectField label="Alt Kategori" required value={subcategory} placeholder="Seçiniz" options={getCategorySubcategories(category).map((s) => ({ label: s, value: s }))} onSelect={(v) => setSubcategory(String(v))} />
            </View>
          </View>

          <View style={isWideWeb ? { flexDirection: "row", gap: 12 } : { gap: 14 }}>
            <View style={{ flex: 1.4 }}>
              <FieldLabel label="Açıklama" required />
              <RichToolbar />
              <TextInput
                value={description}
                onChangeText={(v) => setDescription(v.slice(0, 2000))}
                placeholder="Ürününüzü detaylı olarak açıklayın. Özelliklerini, kullanım durumunu, avantajlarını belirtin."
                placeholderTextColor={colors.muted}
                multiline
                style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, borderWidth: 1, borderTopWidth: 0, color: colors.ink, fontSize: 14, fontWeight: "500", minHeight: 120, padding: 12, textAlignVertical: "top" }}
              />
              <Text style={{ alignSelf: "flex-end", color: colors.subtle, fontSize: 11, fontWeight: "700", marginTop: 4 }}>{description.length}/2000</Text>
            </View>
            <View style={{ flex: 1, gap: 14 }}>
              <View style={isWideWeb ? { flexDirection: "row", gap: 12 } : { gap: 14 }}>
                <View style={{ flex: 1 }}>
                  <SelectField label="Şehir" required value={location} placeholder="Seçiniz" clearable options={CITY_OPTIONS.map((c) => ({ label: c, value: c }))} onSelect={(v) => setLocation(String(v))} />
                </View>
                <View style={{ flex: 1 }}>
                  <CounterField label="İlçe" value={district} onChangeText={setDistrict} placeholder="Örn. Kadıköy" />
                </View>
              </View>
              <View style={isWideWeb ? { flexDirection: "row", gap: 12 } : { gap: 14 }}>
                <View style={{ flex: 1 }}>
                  <SelectField label="Ürün Durumu" required value={condition} placeholder="Seçiniz" options={[{ label: "Sıfır", value: "Sıfır" }, { label: "Yenilenmiş", value: "Yenilenmiş" }, { label: "İkinci el", value: "İkinci el" }]} onSelect={(v) => setCondition(String(v))} />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel label="Stok Adedi" required />
                  <QtyStepper value={stockCount} onChange={setStockCount} />
                </View>
              </View>
            </View>
          </View>

          <View style={isWideWeb ? { flexDirection: "row", gap: 12 } : { gap: 14 }}>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Fiyat (₺)" required />
              <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", paddingRight: 12 }}>
                <TextInput value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="Örn. 2.450" placeholderTextColor={colors.muted} style={{ color: colors.ink, flex: 1, fontSize: 14, fontWeight: "700", height: 46, paddingHorizontal: 12 }} />
                <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "800" }}>₺</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <CounterField label="Etiketler" value={tags} onChangeText={setTags} placeholder="Örn. orijinal, sıfır, garantili" max={0} hint="Virgülle ayırın, max 5 etiket" countText={`${tags.split(",").map((x) => x.trim()).filter(Boolean).length}/5`} />
            </View>
          </View>

          <View style={isWideWeb ? { flexDirection: "row", gap: 12 } : { gap: 14 }}>
            <View style={{ flex: 1 }}>
              <CounterField label="Marka/Model" value={brand} onChangeText={setBrand} placeholder="Örn. Apple / iPhone 15 Pro" />
            </View>
            <View style={{ flex: 1 }}>
              <CounterField label="Renk" value={color} onChangeText={setColor} placeholder="Örn. Mavi Titanyum" />
            </View>
          </View>

          <View style={isWideWeb ? { flexDirection: "row", gap: 12 } : { gap: 14 }}>
            <View style={{ flex: 1 }}>
              <SelectField label="Garanti Durumu" value={warrantyStatus} placeholder="Seçiniz" options={[{ label: "Garantili", value: "Garantili" }, { label: "Garantisiz", value: "Garantisiz" }]} onSelect={(v) => setWarrantyStatus(String(v))} />
            </View>
            <View style={{ flex: 1 }}>
              <CounterField label="Garanti Süresi" value={warrantyDuration} onChangeText={setWarrantyDuration} placeholder="Örn. 24 Ay" />
            </View>
          </View>

          <CategoryRequirementGuide category={category} />
        </Card>) : null}

        {(!isWideWeb || step === 3) ? (<Card>
          <SectionTitle title="Ortaklık ve komisyon" />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton tone={partnershipMode === "open" ? "soft" : "secondary"} onPress={() => setPartnershipMode("open")}>Açık</PrimaryButton>
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton tone={partnershipMode === "approval" ? "soft" : "secondary"} onPress={() => setPartnershipMode("approval")}>Onaylı</PrimaryButton>
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton tone={partnershipMode === "invite" ? "soft" : "secondary"} onPress={() => setPartnershipMode("invite")}>Davetli</PrimaryButton>
            </View>
          </View>
          <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
            {language === "en" ? "Open: everyone becomes a partner instantly. Approved: application arrives and seller accepts. Invite-only: only selected partners join." : "Açık: herkes anında ortak olur. Onaylı: başvuru gelir, satıcı kabul eder. Davetli: sadece seçilen ortaklar."}
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton tone={commissionType === "rate" ? "primary" : "secondary"} onPress={() => setCommissionType("rate")}>Yüzde</PrimaryButton>
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton tone={commissionType === "fixed" ? "primary" : "secondary"} onPress={() => setCommissionType("fixed")}>Sabit</PrimaryButton>
            </View>
          </View>
          <Field label="Komisyon" value={commissionValue} onChangeText={setCommissionValue} keyboardType="numeric" />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="Min. ortak puanı" value={minPartnerRating} onChangeText={setMinPartnerRating} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Ödeme günü" value={commissionDueDays} onChangeText={setCommissionDueDays} keyboardType="numeric" />
            </View>
          </View>
          <Field label="İade bekleme günü" value={returnWindowDays} onChangeText={setReturnWindowDays} keyboardType="numeric" />
          <Field label="Etiketler" value={tags} onChangeText={setTags} />
          <Field label="Satış argümanları" value={pitch} onChangeText={setPitch} multiline />
          <SectionTitle title="Paylaşım metinleri" action="Hazırla" />
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
          <Field label="Hazır reklam görselleri adres listesi" value={adAssets} onChangeText={setAdAssets} multiline />
          <Text selectable style={{ color: adAssetCount > 5 ? colors.accent : colors.muted, fontSize: 12, fontWeight: "800", lineHeight: 17 }}>
            {translateCopy("Her satıra bir reklam görseli adresi ekle. En fazla 5 adet.", language)} {adAssetCount}/5
          </Text>
          <Field label="Ortak satış kuralları" value={partnerRules} onChangeText={setPartnerRules} multiline />
          <Field label="Teslimat notu" value={deliveryNote} onChangeText={setDeliveryNote} multiline />
        </Card>) : null}

        {(!isWideWeb || step === 4) ? (<Card>
          <SectionTitle title="İletişim" />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton tone={contactMethod === "whatsapp" ? "soft" : "secondary"} onPress={() => setContactMethod("whatsapp")}>WhatsApp</PrimaryButton>
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton tone={contactMethod === "message" ? "soft" : "secondary"} onPress={() => setContactMethod("message")}>Mesaj</PrimaryButton>
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton tone={contactMethod === "phone" ? "soft" : "secondary"} onPress={() => setContactMethod("phone")}>Telefon</PrimaryButton>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton href="/(tabs)/seller" tone="secondary" icon="view-list-outline">{t("myListings")}</PrimaryButton>
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton icon="store-plus-outline" onPress={() => void submit()}>{publishing ? "Yayınlanıyor" : canPublish ? "Yayına Al" : "Eksikleri Kontrol Et"}</PrimaryButton>
            </View>
          </View>
          <Text selectable style={{ color: colors.muted, fontSize: 12, fontWeight: "700", lineHeight: 18, textAlign: "center" }}>
            {language === "en" ? "After publishing, you can edit, pause, or remove the listing from the Seller Panel." : "Yayından sonra ilanını Satıcı Paneli'nde düzenleyebilir, pasife alabilir veya kaldırabilirsin."}
          </Text>
        </Card>) : null}

        {isWideWeb ? (
          <View style={{ flexDirection: "row", gap: 10 }}>
            {step > 1 ? (
              <View style={{ flex: 1 }}>
                <PrimaryButton tone="secondary" icon="chevron-left" onPress={() => setStep((s) => Math.max(1, s - 1))}>Geri</PrimaryButton>
              </View>
            ) : null}
            <View style={{ flex: 2 }}>
              {step < 5 ? (
                <PrimaryButton icon="arrow-right" onPress={() => setStep((s) => Math.min(5, s + 1))}>Kaydet ve Devam Et</PrimaryButton>
              ) : (
                <PrimaryButton icon="store-plus-outline" onPress={() => void submit()}>{publishing ? "Yayınlanıyor" : canPublish ? "Yayına Al" : "Eksikleri Kontrol Et"}</PrimaryButton>
              )}
            </View>
          </View>
        ) : null}
        </WebContainer>
        </View>
        {isWideWeb ? (
          <LivePreviewSidebar
            title={title}
            price={priceNumber}
            category={category}
            location={location}
            image={(images[0] ?? "").trim() || fallbackImage}
            commission={estimatedCommission}
            stock={stockNumber}
            partnershipMode={partnershipMode}
            verifiedPhone={Boolean(currentUser?.verifiedPhone)}
            verifiedIdentity={Boolean(currentUser?.verifiedIdentity)}
          />
        ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function CategoryPicker({ onChange, value }: { value: string; onChange: (value: string) => void }) {
  const { language } = useLanguage();
  return (
    <View style={{ gap: 8 }}>
      <Text selectable style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>
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
                width: "31.5%",
                gap: 6,
                justifyContent: "center",
                minHeight: 72,
                opacity: pressed ? 0.72 : 1,
                paddingHorizontal: 8,
                paddingVertical: 10
              })}
            >
              <MaterialCommunityIcons name={item.icon} size={20} color={active ? "#FFFFFF" : colors.primary} />
              <Text
                numberOfLines={2}
                selectable
                style={{
                  color: active ? "#FFFFFF" : colors.ink,
                  fontSize: 12,
                  fontWeight: "900",
                  lineHeight: 15,
                  textAlign: "center"
                }}
              >
                {translateCopy(item.label, language)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function CategoryRequirementGuide({ category }: { category: string }) {
  const { language } = useLanguage();
  const subcategories = getCategorySubcategories(category);
  const requiredDetails = getCategoryRequiredDetails(category);
  const partnerHint = getCategoryPartnerHint(category);

  return (
    <View style={{ backgroundColor: colors.primarySoft, borderColor: colors.line, borderRadius: 12, borderWidth: 1, gap: 10, padding: 10 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <MaterialCommunityIcons name="shape-outline" size={18} color={colors.primaryDark} />
        <Text selectable numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 14, fontWeight: "900" }}>
          {translateCopy("Kategori rehberi", language)}
        </Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {subcategories.slice(0, 5).map((item) => (
          <View key={item} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 5 }}>
            <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={{ color: colors.primaryDark, fontSize: 11, fontWeight: "900" }}>
              {translateCopy(item, language)}
            </Text>
          </View>
        ))}
      </View>
      <Text selectable style={{ color: colors.ink, fontSize: 12, fontWeight: "900" }}>
        {translateCopy("Bu kategoride net yazılması gerekenler", language)}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {requiredDetails.map((item) => (
          <View key={item} style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 5, minHeight: 28, paddingHorizontal: 8 }}>
            <MaterialCommunityIcons name="check-circle-outline" size={13} color={colors.success} />
            <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 11, fontWeight: "800" }}>
              {translateCopy(item, language)}
            </Text>
          </View>
        ))}
      </View>
      <Text selectable style={{ color: colors.muted, fontSize: 12, fontWeight: "800", lineHeight: 17 }}>
        {translateCopy(partnerHint, language)}
      </Text>
    </View>
  );
}

function ListingDraftPreview({
  category,
  commission,
  image,
  location,
  price,
  stock,
  title
}: {
  category: string;
  commission: number;
  image: string;
  location: string;
  price: number;
  stock: number;
  title: string;
}) {
  const { language } = useLanguage();
  const safePrice = Number.isFinite(price) ? price : 0;
  const safeStock = Number.isFinite(stock) ? stock : 0;

  return (
    <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 12, borderWidth: 1, gap: 10, padding: 10 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <MaterialCommunityIcons name="cellphone-screenshot" size={18} color={colors.primary} />
        <Text selectable numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 14, fontWeight: "900" }}>
          {translateCopy("Kart ön izlemesi", language)}
        </Text>
        <StatusPill label="Pazar kartı" tone="info" />
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ borderRadius: 12, height: 104, overflow: "hidden", width: 104 }}>
          <MediaPreview uri={image} />
        </View>
        <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <StatusPill label={category || "Genel"} tone="info" />
            <StatusPill label="Anında ortak" tone="success" />
          </View>
          <Text selectable numberOfLines={2} style={{ color: colors.ink, fontSize: 17, fontWeight: "900", lineHeight: 21 }}>
            {title.trim() || translateCopy("Ürün adı", language)}
          </Text>
          <Text selectable numberOfLines={1} style={{ color: colors.ink, fontSize: 16, fontVariant: ["tabular-nums"], fontWeight: "900" }}>
            {money(safePrice)}
          </Text>
          <Text selectable numberOfLines={1} style={{ color: colors.primaryDark, fontSize: 13, fontVariant: ["tabular-nums"], fontWeight: "900" }}>
            {translateCopy("Kazanç", language)}: {money(commission)}
          </Text>
          <Text selectable numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>
            {location.trim() || translateCopy("Konum", language)} · {safeStock} {translateCopy("stok", language)}
          </Text>
        </View>
      </View>
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

function MediaPreview({ large, uri }: { large?: boolean; uri: string }) {
  const { language } = useLanguage();
  if (isVideoUri(uri)) {
    return (
      <View style={{ alignItems: "center", backgroundColor: colors.ink, borderRadius: large ? 14 : 0, height: large ? 210 : "100%", justifyContent: "center", overflow: "hidden", width: "100%" }}>
        <MaterialCommunityIcons name="play-circle" size={large ? 44 : 24} color="#FFFFFF" />
        {large ? (
          <Text selectable style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "900", marginTop: 6 }}>
            {translateCopy("Video medya", language)}
          </Text>
        ) : null}
      </View>
    );
  }

  return <Image source={{ uri }} contentFit="cover" style={{ backgroundColor: colors.line, borderRadius: large ? 14 : 0, height: large ? 210 : "100%", width: "100%" }} />;
}

function DraftMetric({ label, value }: { label: string; value: string }) {
  const { language } = useLanguage();

  return (
    <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flex: 1, gap: 4, padding: 10 }}>
      <Text selectable numberOfLines={1} style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}>
        {translateCopy(label, language)}
      </Text>
      <Text adjustsFontSizeToFit minimumFontScale={0.76} numberOfLines={1} selectable style={{ color: colors.ink, fontSize: 18, fontVariant: ["tabular-nums"], fontWeight: "900" }}>
        {value}
      </Text>
    </View>
  );
}

function CheckRow({ ok, text }: { ok: boolean; text: string }) {
  const { language } = useLanguage();

  return (
    <View style={{ alignItems: "center", backgroundColor: ok ? colors.successSoft : colors.warningSoft, borderRadius: 8, flexDirection: "row", gap: 8, minHeight: 40, paddingHorizontal: 10, paddingVertical: 8 }}>
      <MaterialCommunityIcons name={ok ? "check-circle" : "alert-circle-outline"} size={18} color={ok ? colors.success : colors.warning} />
      <Text selectable numberOfLines={2} style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "800", lineHeight: 17 }}>
        {translateCopy(text, language)}
      </Text>
    </View>
  );
}

function isVideoUri(uri: string) {
  return /\.(mp4|mov|m4v|webm)(\?|$)/i.test(uri);
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  multiline
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "numeric";
  multiline?: boolean;
}) {
  const { language } = useLanguage();
  return (
    <View style={{ gap: 6 }}>
      <Text selectable style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>
        {translateCopy(label, language)}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        placeholderTextColor={colors.muted}
        style={{
          backgroundColor: "#FAFBFC",
          borderColor: colors.line,
          borderRadius: 12,
          borderWidth: 1,
          color: colors.ink,
          fontSize: 16,
          minHeight: multiline ? 100 : 48,
          padding: 14,
          textAlignVertical: multiline ? "top" : "center"
        }}
      />
    </View>
  );
}


function CreateStepper({ current, onStep }: { current: number; onStep: (n: number) => void }) {
  const steps = ["Temel Bilgiler", "Görseller", "Komisyon", "Teslimat", "Önizleme"];
  return (
    <View style={{ alignItems: "flex-start", flexDirection: "row", marginTop: 8 }}>
      {steps.map((stepLabel, index) => {
        const n = index + 1;
        const active = n === current;
        const done = n < current;
        return (
          <View key={stepLabel} style={{ alignItems: "center", flex: index === steps.length - 1 ? 0 : 1, flexDirection: "row" }}>
            <Pressable onPress={() => onStep(n)} style={{ alignItems: "center", gap: 6, width: 120 }}>
              <View style={{ alignItems: "center", backgroundColor: active || done ? colors.primary : colors.surfaceAlt, borderColor: active || done ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, height: 32, justifyContent: "center", width: 32 }}>
                {done ? <MaterialCommunityIcons name="check" size={18} color="#FFFFFF" /> : <Text style={{ color: active ? "#FFFFFF" : colors.muted, fontSize: 14, fontWeight: "900" }}>{n}</Text>}
              </View>
              <Text numberOfLines={1} style={{ color: active ? colors.ink : colors.muted, fontSize: 12, fontWeight: active ? "900" : "700" }}>{stepLabel}</Text>
            </Pressable>
            {index < steps.length - 1 ? <View style={{ backgroundColor: done ? colors.primary : colors.line, flex: 1, height: 2, marginBottom: 20, marginHorizontal: 4 }} /> : null}
          </View>
        );
      })}
    </View>
  );
}

function LivePreviewSidebar({ title, price, category, location, image, commission, stock, partnershipMode, verifiedPhone, verifiedIdentity }: { title: string; price: number; category: string; location: string; image: string; commission: number; stock: number; partnershipMode: PartnershipMode; verifiedPhone: boolean; verifiedIdentity: boolean }) {
  const trust = [
    { ok: verifiedIdentity, label: "Kimlik Doğrulandı" },
    { ok: verifiedPhone, label: "Telefon Doğrulandı" },
    { ok: true, label: "E-posta Doğrulandı" },
    { ok: true, label: "Şeffaf Komisyon" }
  ];
  const tips = [
    "Açıklamanı detaylı ve doğru yaz.",
    "Yüksek kaliteli görseller yükle.",
    "Rekabetçi bir fiyat belirle.",
    "Doğru kategori seçimi görünürlük sağlar."
  ];
  return (
    <View style={{ gap: 16, width: 340 }}>
      <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 16 }}>
        <View style={{ gap: 2 }}>
          <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>Canlı Önizleme</Text>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>İlanının alıcılara nasıl görüneceğini gör.</Text>
        </View>
        <View style={{ borderColor: colors.line, borderRadius: 14, borderWidth: 1, overflow: "hidden" }}>
          <View style={{ backgroundColor: colors.line, height: 170, width: "100%" }}>
            <SafeRemoteImage uri={image} style={{ height: "100%", width: "100%" }} contentFit="cover" transition={140} />
          </View>
          <View style={{ gap: 6, padding: 12 }}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <View style={{ backgroundColor: colors.infoSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: colors.info, fontSize: 10, fontWeight: "900" }}>Yeni</Text>
              </View>
              <View style={{ backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: colors.primaryDark, fontSize: 10, fontWeight: "900" }}>{partnershipMode === "open" ? "Ortak Satışa Açık" : "Satıcı Onaylı"}</Text>
              </View>
            </View>
            <Text numberOfLines={2} style={{ color: colors.ink, fontSize: 15, fontWeight: "900", lineHeight: 19 }}>{title || "İlan başlığı"}</Text>
            <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{location} · {category}</Text>
            <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 8, justifyContent: "space-between" }}>
              <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{Number.isFinite(price) && price > 0 ? money(price) : "₺—"}</Text>
              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}>Stok: {Number.isFinite(stock) ? stock : "—"}</Text>
            </View>
          </View>
        </View>
        <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 12, gap: 4, padding: 12 }}>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>Tahmini Kazanç (Ortak)</Text>
          <Text style={{ color: colors.primaryDark, fontSize: 20, fontWeight: "900" }}>{commission > 0 ? money(commission) : "₺—"}</Text>
          <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "600" }}>Seçtiğin komisyon ayarlarına göre değişir.</Text>
        </View>
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>Güvenilir Satıcı</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {trust.map((item) => (
              <View key={item.label} style={{ alignItems: "center", flexBasis: 140, flexDirection: "row", flexGrow: 1, gap: 6 }}>
                <MaterialCommunityIcons name={item.ok ? "check-circle" : "circle-outline"} size={15} color={item.ok ? colors.success : colors.subtle} />
                <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "700" }}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 10, padding: 16 }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
          <MaterialCommunityIcons name="lightbulb-on-outline" size={18} color={colors.gold} />
          <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>İpuçları</Text>
        </View>
        {tips.map((tip) => (
          <View key={tip} style={{ flexDirection: "row", gap: 8 }}>
            <MaterialCommunityIcons name="circle-small" size={18} color={colors.muted} />
            <Text style={{ color: colors.muted, flex: 1, fontSize: 13, fontWeight: "600", lineHeight: 19 }}>{tip}</Text>
          </View>
        ))}
      </View>

      <View style={{ backgroundColor: colors.primarySoft, borderRadius: 16, gap: 8, padding: 16 }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
          <MaterialCommunityIcons name="lifebuoy" size={18} color={colors.primaryDark} />
          <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "900" }}>Yardıma mı ihtiyacın var?</Text>
        </View>
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 18 }}>7/24 destek ekibimiz ilan oluştururken sana yardımcı olur.</Text>
        <Link href="/legal" asChild>
          <Pressable style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingVertical: 10 }}>
            <MaterialCommunityIcons name="message-text-outline" size={15} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>Bize Ulaş</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const CITY_OPTIONS = ["Adana", "Ankara", "Antalya", "Bursa", "Denizli", "Diyarbakır", "Eskişehir", "Gaziantep", "İstanbul", "İzmir", "Kayseri", "Kocaeli", "Konya", "Mersin", "Muğla", "Samsun", "Trabzon"];

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800", marginBottom: 6 }}>
      {label}{required ? <Text style={{ color: colors.accent }}> *</Text> : null}
    </Text>
  );
}

function CounterField({ label, required, value, onChangeText, placeholder, max, hint, countText }: { label: string; required?: boolean; value: string; onChangeText: (v: string) => void; placeholder?: string; max?: number; hint?: string; countText?: string }) {
  return (
    <View>
      <FieldLabel label={label} required={required} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 14, fontWeight: "600", height: 46, paddingHorizontal: 12 }}
      />
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8, marginTop: 4 }}>
        {hint ? <Text style={{ color: colors.subtle, flex: 1, fontSize: 11, fontWeight: "600" }}>{hint}</Text> : <View style={{ flex: 1 }} />}
        {countText ? <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "700" }}>{countText}</Text> : max ? <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "700" }}>{value.length}/{max}</Text> : null}
      </View>
    </View>
  );
}

function QtyStepper({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const n = Math.max(0, Number(value) || 0);
  return (
    <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", height: 46, overflow: "hidden" }}>
      <Pressable onPress={() => onChange(String(Math.max(0, n - 1)))} style={({ pressed }) => ({ alignItems: "center", height: "100%", justifyContent: "center", opacity: pressed ? 0.6 : 1, width: 44 })}>
        <MaterialCommunityIcons name="minus" size={18} color={colors.primaryDark} />
      </Pressable>
      <TextInput value={String(n)} onChangeText={(v) => onChange(v.replace(/[^0-9]/g, ""))} keyboardType="numeric" style={{ borderColor: colors.line, borderLeftWidth: 1, borderRightWidth: 1, color: colors.ink, flex: 1, fontSize: 14, fontWeight: "800", height: "100%", paddingHorizontal: 8, textAlign: "center" }} />
      <Pressable onPress={() => onChange(String(n + 1))} style={({ pressed }) => ({ alignItems: "center", height: "100%", justifyContent: "center", opacity: pressed ? 0.6 : 1, width: 44 })}>
        <MaterialCommunityIcons name="plus" size={18} color={colors.primaryDark} />
      </Pressable>
    </View>
  );
}

function RichToolbar() {
  const icons: Array<keyof typeof MaterialCommunityIcons.glyphMap> = ["format-bold", "format-italic", "format-list-bulleted", "format-list-numbered", "link-variant", "image-outline"];
  return (
    <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderTopLeftRadius: 10, borderTopRightRadius: 10, borderWidth: 1, flexDirection: "row", gap: 14, paddingHorizontal: 12, paddingVertical: 8 }}>
      {icons.map((icon) => (
        <MaterialCommunityIcons key={icon} name={icon} size={16} color={colors.muted} />
      ))}
    </View>
  );
}

function SelectField({ label, required, value, placeholder, options, onSelect, clearable }: { label: string; required?: boolean; value: string; placeholder?: string; options: Array<{ label: string; value: string | number }>; onSelect: (v: string | number) => void; clearable?: boolean }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={{ position: "relative", zIndex: open ? 50 : 1 }}>
      <FieldLabel label={label} required={required} />
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: open ? colors.primary : colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, height: 46, paddingHorizontal: 12 }}
      >
        <Text numberOfLines={1} style={{ color: selected ? colors.ink : colors.muted, flex: 1, fontSize: 14, fontWeight: selected ? "700" : "500" }}>
          {selected ? selected.label : placeholder ?? "Seçiniz"}
        </Text>
        {clearable && value ? (
          <Pressable onPress={() => onSelect("")} hitSlop={8}>
            <MaterialCommunityIcons name="close" size={16} color={colors.muted} />
          </Pressable>
        ) : null}
        <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
      </Pressable>
      {open ? (
        <>
          <Pressable onPress={() => setOpen(false)} style={{ bottom: -2000, left: -2000, position: "absolute", right: -2000, top: -2000, zIndex: 40 }} />
          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, left: 0, maxHeight: 240, position: "absolute", right: 0, shadowColor: "#101828", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.16, shadowRadius: 20, top: 74, zIndex: 50 }}>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 240 }}>
              {options.length === 0 ? (
                <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", paddingHorizontal: 12, paddingVertical: 10 }}>Önce kategori seç</Text>
              ) : (
                options.map((opt) => {
                  const isSel = opt.value === value;
                  return (
                    <Pressable key={`${opt.value}`} onPress={() => { onSelect(opt.value); setOpen(false); }} style={({ pressed }) => ({ alignItems: "center", backgroundColor: pressed || isSel ? colors.surfaceAlt : "transparent", flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 10 })}>
                      <Text style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: isSel ? "900" : "600" }}>{opt.label}</Text>
                      {isSel ? <MaterialCommunityIcons name="check" size={16} color={colors.primary} /> : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
        </>
      ) : null}
    </View>
  );
}

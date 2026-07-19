import { Image } from "expo-image";
import { MaterialCommunityIcons } from "@/components/icons";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Alert } from "@/lib/alert";

import { colors } from "@/components/colors";
import { Card, EmptyState, Metric, PrimaryButton, SectionTitle, StatusPill } from "@/components/ui";
import { money } from "@/lib/format";
import { insertReferralLead, logReferralClick, resolveReferralLink, type ReferralLink } from "@/lib/live-service";
import { localize } from "@/lib/locale";
import { saveRefAttribution } from "@/lib/referral";
import { useStore } from "@/lib/use-store";

export default function ReferralLeadScreen() {
  const params = useLocalSearchParams<{ slug: string; ref?: string }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const ref = Array.isArray(params.ref) ? params.ref[0] : params.ref;
  const { createLead, findUser, listings, partnerships } = useStore();
  const router = useRouter();
  const [remoteReferral, setRemoteReferral] = useState<ReferralLink | null>(null);
  const [loading, setLoading] = useState(Boolean(ref));
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("+90");
  const [note, setNote] = useState(localize("Bu ürün için bilgi almak istiyorum.", "I want more information about this product."));
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const localListing = useMemo(() => listings.find((listing) => listing.slug === slug), [listings, slug]);
  const localPartnership = useMemo(
    () => partnerships.find((partnership) => partnership.refCode === ref && partnership.listingId === localListing?.id),
    [localListing?.id, partnerships, ref]
  );
  const viewListingId = remoteReferral?.listingId ?? localListing?.id;
  const title = remoteReferral?.title ?? localListing?.title;
  const image = remoteReferral?.imageUrl ?? localListing?.image;
  const price = remoteReferral?.price ?? localListing?.price ?? 0;
  const category = remoteReferral?.category ?? localListing?.category;
  const location = remoteReferral?.location ?? localListing?.location;
  const canSubmit = Boolean(title && ref && (remoteReferral || localPartnership));
  // GÜVEN BANDI: yabancı ziyaretçinin "kime güveneceğim" bariyeri. remote (anon) snapshot'tan
  // gelir; giriş yapılıysa local kullanıcıdan türetilir.
  const localPartner = !remoteReferral && localPartnership ? findUser(localPartnership.partnerId) : undefined;
  const localSeller = !remoteReferral && localListing ? findUser(localListing.ownerId) : undefined;
  const partnerName = remoteReferral?.partnerName ?? localPartner?.name;
  const partnerVerified = remoteReferral?.partnerVerified ?? (localPartner ? (localPartner.verifiedIdentity || localPartner.verifiedPhone || !!localPartner.verifiedInstagram) : false);
  const partnerSales = remoteReferral?.partnerSales ?? 0;
  const sellerRating = remoteReferral?.sellerRating ?? localSeller?.rating;
  const sellerVerified = remoteReferral?.sellerVerified ?? (localSeller ? (localSeller.verifiedIdentity || localSeller.verifiedPhone || !!localSeller.verifiedInstagram) : false);

  // Yerel (önizleme/bellek) eşleşmede de atfı sakla — landing'den ilana geçişte korunur.
  useEffect(() => {
    if (localListing && localPartnership && ref) saveRefAttribution(localListing.id, localPartnership.id, ref, localPartnership.agreedAttributionWindowDays ?? localListing.attributionWindowDays);
  }, [localListing?.id, localPartnership?.id, ref]);

  useEffect(() => {
    let mounted = true;

    async function resolve() {
      if (!slug || !ref) {
        setLoading(false);
        return;
      }
      const result = await resolveReferralLink(slug, ref);
      if (mounted) {
        setRemoteReferral(result);
        setLoading(false);
        // Tıklamayı kaydet (ortağın dönüşüm ölçümü için) + atfı sakla ki alıcı buradan
        // normal ilan detayına geçse bile ortak bağlantısı kaybolmasın.
        if (result?.partnershipId) {
          void logReferralClick(result.listingId, result.partnershipId, ref);
          // ANLAŞILAN atıf penceresini onurlandır (ortaklığın join'de kilitlenen snapshot'ı);
          // yoksa canlı ilandan, o da yoksa 30 varsayılan. Satıcı pencereyi sonradan kısaltsa
          // bile ortak anlaştığı krediyi kaybetmez.
          const localWin = listings.find((l) => l.id === result.listingId)?.attributionWindowDays;
          saveRefAttribution(result.listingId, result.partnershipId, ref, result.attributionWindowDays ?? localWin);
        }
      }
    }

    void resolve();

    return () => {
      mounted = false;
    };
  }, [ref, slug]);

  async function submit() {
    if (sent || sending) return; // çift-gönderim → mükerrer lead engellenir
    if (!buyerName.trim() || buyerPhone.replace(/\D/g, "").length < 10) {
      Alert.alert(localize("Eksik bilgi", "Missing information"), localize("Adını ve telefonunu yaz.", "Enter your name and phone."));
      return;
    }

    setSending(true);
    const ok = remoteReferral
      ? await insertReferralLead({
          listingId: remoteReferral.listingId,
          partnershipId: remoteReferral.partnershipId,
          buyerName: buyerName.trim(),
          buyerPhone: buyerPhone.trim(),
          note: note.trim() || localize("Referans bağlantısından gelen talep.", "Lead from referral link.")
        })
      : localListing && localPartnership
        ? Boolean(
            createLead({
              listingId: localListing.id,
              partnershipId: localPartnership.id,
              buyerName: buyerName.trim(),
              buyerPhone: buyerPhone.trim(),
              source: "web",
              intent: "warm",
              note: note.trim() || localize("Referans bağlantısından gelen talep.", "Lead from referral link.")
            })
          )
        : false;

    if (ok) {
      setSent(true);
      Alert.alert(localize("Talep alındı", "Request received"), localize("Satıcı bu talebi panelinde görecek.", "The seller will see this request."));
    } else {
      Alert.alert(localize("Talep gönderilemedi", "Request failed"), localize("Bağlantı pasif olabilir veya ilan yayından kalkmış olabilir.", "The link may be inactive."));
    }
    setSending(false);
  }

  if (loading) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16 }}>
        <EmptyState title={localize("Bağlantı kontrol ediliyor", "Checking link")} body={localize("Referans bilgisi doğrulanıyor.", "Verifying referral information.")} />
      </ScrollView>
    );
  }

  if (!canSubmit) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 14, padding: 16 }}>
        <EmptyState
          title={localize("Geçersiz ortak satış bağlantısı", "Invalid referral link")}
          body={localize("Bu ilan pasif olabilir veya referans kodu artık geçerli olmayabilir.", "This listing may be inactive or the referral code is no longer valid.")}
        />
        <Link href="/" asChild>
          <PrimaryButton>{localize("Keşfete Dön", "Back to Discover")}</PrimaryButton>
        </Link>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 14, marginHorizontal: "auto", maxWidth: 640, padding: 16, paddingBottom: 90, width: "100%" }}>
        {image ? <Image source={{ uri: image }} contentFit="cover" style={{ backgroundColor: colors.line, borderRadius: 18, height: 240 }} /> : null}

        <Card>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <StatusPill label={localize("Ortak satış bağlantısı", "Referral link")} tone="success" />
            {category ? <StatusPill label={category} /> : null}
          </View>
          <Text selectable style={{ color: colors.ink, fontSize: 25, fontWeight: "900", lineHeight: 31 }}>
            {title}
          </Text>
          {/* GÜVEN BANDI: ortağın kim olduğu + doğrulama + satış geçmişi + satıcı puanı.
              Sosyalden gelen yabancı için #1 dönüşüm bariyerini ("kime güveneceğim") giderir. */}
          {(partnerName || sellerRating != null) ? (
            <View style={{ backgroundColor: colors.primarySoft, borderColor: colors.line, borderRadius: 12, borderWidth: 1, gap: 6, padding: 12 }}>
              {partnerName ? (
                <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  <MaterialCommunityIcons name="account-heart-outline" size={16} color={colors.primaryDark} />
                  <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "800" }} numberOfLines={1}>
                    {localize(`${partnerName} öneriyor`, `Recommended by ${partnerName}`)}
                  </Text>
                  {partnerVerified ? (
                    <View style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 999, flexDirection: "row", gap: 3, paddingHorizontal: 7, paddingVertical: 2 }}>
                      <MaterialCommunityIcons name="check-decagram" size={11} color="#FFFFFF" />
                      <Text style={{ color: "#FFFFFF", fontSize: 10.5, fontWeight: "900" }}>{localize("Doğrulanmış", "Verified")}</Text>
                    </View>
                  ) : null}
                  {partnerSales > 0 ? (
                    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>· {localize(`${partnerSales} satış`, `${partnerSales} sales`)}</Text>
                  ) : null}
                </View>
              ) : null}
              {sellerRating != null && sellerRating > 0 ? (
                <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
                  <MaterialCommunityIcons name="storefront-outline" size={15} color={colors.muted} />
                  <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>{localize("Satıcı puanı", "Seller rating")}</Text>
                  <MaterialCommunityIcons name="star" size={13} color="#F5A623" />
                  <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "900" }}>{sellerRating.toFixed(1)}</Text>
                  {sellerVerified ? <MaterialCommunityIcons name="check-decagram-outline" size={13} color={colors.primaryDark} /> : null}
                </View>
              ) : null}
            </View>
          ) : null}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Metric label={localize("Fiyat", "Price")} value={money(price)} />
            <Metric label={localize("Konum", "Location")} value={location ?? "-"} />
          </View>
          <Text selectable style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
            {localize("Bu talep, ürünü paylaşan ortak satıcıya doğru şekilde bağlanır.", "This request is linked to the partner who shared the product.")}
          </Text>
          {/* KRİTİK dönüşüm: paylaşılan linke tıklayan alıcı ürünün TÜM detayını (galeri,
              açıklama, satıcı, yorumlar) görebilmeli. Atıf zaten saklandı (saveRefAttribution)
              → ilana geçince ortak kredisi KORUNUR. Eskiden bu buton YOKTU, alıcı tek foto +
              formda kalıp geri dönüyordu (tüm ortaklık modelinin dönüşümünü öldürüyordu). */}
          {viewListingId ? (
            <Pressable onPress={() => router.push(`/listing/${viewListingId}`)} accessibilityRole="button" style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.primary, borderRadius: 12, flexDirection: "row", gap: 8, justifyContent: "center", opacity: pressed ? 0.9 : 1, paddingVertical: 14 })}>
              <MaterialCommunityIcons name="eye-outline" size={18} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "900" }}>{localize("Ürünü İncele", "View product")}</Text>
            </Pressable>
          ) : null}
        </Card>

        <Card>
          <SectionTitle title={localize("Talep bırak", "Leave a request")} />
          <Field label={localize("Ad Soyad", "Full name")} value={buyerName} onChangeText={setBuyerName} />
          <Field label={localize("Telefon", "Phone")} value={buyerPhone} onChangeText={setBuyerPhone} keyboardType="phone-pad" />
          <Field label={localize("Not", "Note")} value={note} onChangeText={setNote} multiline />
          <PrimaryButton onPress={() => void submit()} tone={sent ? "soft" : "primary"}>
            {sent ? localize("Talep Gönderildi", "Request Sent") : sending ? localize("Gönderiliyor…", "Sending…") : localize("Satıcıya Talep Gönder", "Send Request")}
          </PrimaryButton>
        </Card>

        {/* VİRAL KANCA: her paylaşılan link bir büyüme fırsatı. Ziyaretçiyi yalnız alıcı
            olarak bırakma — kendisi de ORTAK (bu ürünü paylaşıp komisyon) veya SATICI (kendi
            ürününü ekle) olabilsin. Döngüyü kendisi besler (K-faktörü > 0). */}
        <Card>
          <SectionTitle title={localize("Sen de kazan", "Earn too")} />
          <Text style={{ color: colors.muted, fontSize: 13.5, lineHeight: 19, marginBottom: 4 }}>
            {localize("OrtakSat'ta ürünleri paylaşıp her satıştan komisyon kazanırsın — ya da kendi ürününü satışa çıkarırsın. Ücretsiz.", "On OrtakSat you earn a commission on every sale you help drive — or list your own product. Free.")}
          </Text>
          {viewListingId ? (
            <Pressable onPress={() => router.push(`/listing/${viewListingId}?apply=1`)} accessibilityRole="button" style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.primary, borderRadius: 12, flexDirection: "row", gap: 8, justifyContent: "center", opacity: pressed ? 0.9 : 1, paddingVertical: 13 })}>
              <MaterialCommunityIcons name="cash-multiple" size={18} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 14.5, fontWeight: "900" }}>{localize("Bu ürünü paylaş, kazan", "Share this product, earn")}</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => router.push("/create")} accessibilityRole="button" style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 8, opacity: pressed ? 0.9 : 1, paddingVertical: 13 })}>
            <MaterialCommunityIcons name="store-plus-outline" size={18} color={colors.primaryDark} />
            <Text style={{ color: colors.primaryDark, fontSize: 14.5, fontWeight: "900" }}>{localize("Kendi ürününü sat", "Sell your own product")}</Text>
          </Pressable>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType = "default",
  multiline
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "phone-pad";
  multiline?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text selectable style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>
        {label}
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
          minHeight: multiline ? 88 : 50,
          padding: 14,
          textAlignVertical: multiline ? "top" : "center"
        }}
      />
    </View>
  );
}


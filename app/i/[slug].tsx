import { Image } from "expo-image";
import { Link, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { Card, EmptyState, Metric, PrimaryButton, SectionTitle, StatusPill } from "@/components/ui";
import { money } from "@/lib/format";
import { insertReferralLead, resolveReferralLink, type ReferralLink } from "@/lib/live-service";
import { localize } from "@/lib/locale";
import { useStore } from "@/lib/use-store";

export default function ReferralLeadScreen() {
  const params = useLocalSearchParams<{ slug: string; ref?: string }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const ref = Array.isArray(params.ref) ? params.ref[0] : params.ref;
  const { createLead, listings, partnerships } = useStore();
  const [remoteReferral, setRemoteReferral] = useState<ReferralLink | null>(null);
  const [loading, setLoading] = useState(Boolean(ref));
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("+90");
  const [note, setNote] = useState(localize("Bu ürün için bilgi almak istiyorum.", "I want more information about this product."));
  const [sent, setSent] = useState(false);

  const localListing = useMemo(() => listings.find((listing) => listing.slug === slug), [listings, slug]);
  const localPartnership = useMemo(
    () => partnerships.find((partnership) => partnership.refCode === ref && partnership.listingId === localListing?.id),
    [localListing?.id, partnerships, ref]
  );
  const title = remoteReferral?.title ?? localListing?.title;
  const image = remoteReferral?.imageUrl ?? localListing?.image;
  const price = remoteReferral?.price ?? localListing?.price ?? 0;
  const category = remoteReferral?.category ?? localListing?.category;
  const location = remoteReferral?.location ?? localListing?.location;
  const canSubmit = Boolean(title && ref && (remoteReferral || localPartnership));

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
      }
    }

    void resolve();

    return () => {
      mounted = false;
    };
  }, [ref, slug]);

  async function submit() {
    if (!buyerName.trim() || buyerPhone.replace(/\D/g, "").length < 10) {
      Alert.alert(localize("Eksik bilgi", "Missing information"), localize("Adını ve telefonunu yaz.", "Enter your name and phone."));
      return;
    }

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
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 14, padding: 16, paddingBottom: 90 }}>
        {image ? <Image source={{ uri: image }} contentFit="cover" style={{ backgroundColor: colors.line, borderRadius: 18, height: 240 }} /> : null}

        <Card>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <StatusPill label={localize("Ortak satış bağlantısı", "Referral link")} tone="success" />
            {category ? <StatusPill label={category} /> : null}
          </View>
          <Text selectable style={{ color: colors.ink, fontSize: 25, fontWeight: "900", lineHeight: 31 }}>
            {title}
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Metric label={localize("Fiyat", "Price")} value={money(price)} />
            <Metric label={localize("Konum", "Location")} value={location ?? "-"} />
          </View>
          <Text selectable style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
            {localize("Bu talep, ürünü paylaşan ortak satıcıya doğru şekilde bağlanır.", "This request is linked to the partner who shared the product.")}
          </Text>
        </Card>

        <Card>
          <SectionTitle title={localize("Talep bırak", "Leave a request")} />
          <Field label={localize("Ad Soyad", "Full name")} value={buyerName} onChangeText={setBuyerName} />
          <Field label={localize("Telefon", "Phone")} value={buyerPhone} onChangeText={setBuyerPhone} keyboardType="phone-pad" />
          <Field label={localize("Not", "Note")} value={note} onChangeText={setNote} multiline />
          <PrimaryButton onPress={() => void submit()} tone={sent ? "soft" : "primary"}>
            {sent ? localize("Talep Gönderildi", "Request Sent") : localize("Satıcıya Talep Gönder", "Send Request")}
          </PrimaryButton>
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


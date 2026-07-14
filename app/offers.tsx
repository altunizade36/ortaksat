import { MaterialCommunityIcons } from "@/components/icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { AuthRequired } from "@/components/auth-gate";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import { WebContainer } from "@/components/web-container";
import { WebFooter } from "@/components/web-landing";
import { Card, EmptyState, SectionTitle } from "@/components/ui";
import { moneyIn } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useMounted } from "@/lib/layout";
import { shortDate } from "@/lib/locale";
import type { Offer } from "@/lib/types";
import { useStore } from "@/lib/use-store";

/*
 * TEKLİFLERİM (alıcı tarafı). Satıcının teklif listesi panelinde vardı; alıcının
 * hiç yoktu — 5 ilana teklif veren kullanıcı hepsini tek tek ilan sayfasından
 * bulmak zorundaydı. Karşı teklife yanıt da yalnız ilan sayfasında verilebiliyordu.
 */
const TONE: Record<Offer["status"], { bg: string; line: string; ink: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string }> = {
  pending: { bg: colors.goldSoft, line: colors.gold, ink: colors.goldInk, icon: "clock-outline", label: "Yanıt bekleniyor" },
  countered: { bg: colors.primarySoft, line: colors.primary, ink: colors.primaryDark, icon: "swap-horizontal", label: "Karşı teklif geldi" },
  accepted: { bg: colors.successSoft, line: colors.success, ink: colors.success, icon: "check-decagram", label: "Kabul edildi" },
  rejected: { bg: colors.accentSoft, line: colors.accent, ink: colors.accent, icon: "close-circle-outline", label: "Kabul edilmedi" },
  withdrawn: { bg: colors.surfaceAlt, line: colors.line, ink: colors.muted, icon: "undo", label: "Geri çekildi" }
};

function OffersInner() {
  const { language } = useLanguage();
  const router = useRouter();
  const { currentUser, offers, findListing, findUser, buyerOfferAction, startConversation } = useStore();
  const [busy, setBusy] = useState<string | null>(null);

  const mine = useMemo(
    () => offers
      .filter((o) => o.buyerId === currentUser.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [offers, currentUser.id]
  );
  const open = mine.filter((o) => o.status === "pending" || o.status === "countered");
  const closed = mine.filter((o) => o.status !== "pending" && o.status !== "countered");

  const act = async (id: string, action: "withdrawn" | "accept_counter" | "reject_counter") => {
    if (busy) return;
    setBusy(id);
    await buyerOfferAction(id, action);
    setBusy(null);
  };

  const Row = ({ o }: { o: Offer }) => {
    const l = findListing(o.listingId);
    const seller = findUser(o.sellerId);
    const t = TONE[o.status];
    // Karşı teklif geldiyse gösterilecek tutar satıcının istediği tutardır.
    const shown = o.status === "countered" ? (o.counterAmount ?? o.amount) : o.amount;
    return (
      <View style={{ backgroundColor: t.bg, borderColor: t.line, borderRadius: 12, borderWidth: 1, gap: 8, padding: 12 }}>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push({ pathname: "/listing/[id]", params: { id: o.listingId } })}
          style={({ pressed }) => ({ alignItems: "center", flexDirection: "row", gap: 8, opacity: pressed ? 0.7 : 1 })}
        >
          <MaterialCommunityIcons name={t.icon} size={17} color={t.ink} />
          <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 13.5, fontWeight: "900" }}>
            {l?.title ?? translateCopy("İlan", language)}
          </Text>
          <Text style={{ color: t.ink, fontSize: 15, fontWeight: "900" }}>{moneyIn(shown, l?.currency)}</Text>
        </Pressable>

        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
          {translateCopy(t.label, language)}
          {o.status === "countered" ? ` · ${translateCopy("senin teklifin", language)}: ${moneyIn(o.amount, l?.currency)}` : ""}
          {seller ? ` · ${seller.name}` : ""}
          {` · ${shortDate(o.createdAt)}`}
        </Text>

        {o.status === "countered" ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => void act(o.id, "accept_counter")}
              style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.success, borderRadius: 9, flexDirection: "row", gap: 6, opacity: pressed ? 0.85 : 1, paddingHorizontal: 14, paddingVertical: 9 })}
            >
              <MaterialCommunityIcons name="check" size={15} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: "900" }}>
                {busy === o.id ? translateCopy("…", language) : translateCopy("Kabul Et", language)}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => void act(o.id, "reject_counter")}
              style={({ pressed }) => ({ alignItems: "center", borderColor: colors.line, borderRadius: 9, borderWidth: 1, opacity: pressed ? 0.85 : 1, paddingHorizontal: 14, paddingVertical: 9 })}
            >
              <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Reddet", language)}</Text>
            </Pressable>
          </View>
        ) : null}

        {o.status === "pending" ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void act(o.id, "withdrawn")}
            hitSlop={6}
            style={({ pressed }) => ({ alignSelf: "flex-start", opacity: pressed ? 0.7 : 1 })}
          >
            <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "900" }}>{translateCopy("Teklifi geri çek", language)}</Text>
          </Pressable>
        ) : null}

        {o.status === "accepted" ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              const c = startConversation(o.listingId, o.sellerId, "Teklifim kabul edildi, teslimatı konuşalım.");
              if (c) router.push({ pathname: "/chat/[id]", params: { id: c.id } });
            }}
            style={({ pressed }) => ({ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 9, flexDirection: "row", gap: 6, opacity: pressed ? 0.85 : 1, paddingHorizontal: 14, paddingVertical: 9 })}
          >
            <MaterialCommunityIcons name="message-text-outline" size={15} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: "900" }}>{translateCopy("Satıcıyla mesajlaş", language)}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 28 }}>
      <WebContainer>
        <View style={{ gap: 12, padding: 12 }}>
          <Card>
            <SectionTitle title="Tekliflerim" action={`${mine.length}`} />
            <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>
              {translateCopy("OrtakSat para tutmaz — kabul edilen teklifte ödeme ve teslimatı satıcıyla doğrudan yaparsın.", language)}
            </Text>
          </Card>

          {mine.length === 0 ? (
            <EmptyState
              title={translateCopy("Henüz teklif vermedin", language)}
              body={translateCopy("Beğendiğin ilanın sayfasındaki “Teklif Ver” ile pazarlığa başlayabilirsin.", language)}
              action={{ label: translateCopy("İlanlara göz at", language), href: "/(tabs)/explore", icon: "compass-outline" }}
            />
          ) : null}

          {open.length > 0 ? (
            <Card>
              <SectionTitle title="Süren teklifler" action={`${open.length}`} />
              <View style={{ gap: 10 }}>{open.map((o) => <Row key={o.id} o={o} />)}</View>
            </Card>
          ) : null}

          {closed.length > 0 ? (
            <Card>
              <SectionTitle title="Geçmiş" action={`${closed.length}`} />
              <View style={{ gap: 10 }}>{closed.map((o) => <Row key={o.id} o={o} />)}</View>
            </Card>
          ) : null}
        </View>
      </WebContainer>
      <WebFooter />
    </ScrollView>
  );
}

export default function OffersScreen() {
  const { language } = useLanguage();
  const auth = useStore();
  const mounted = useMounted();
  if (!mounted) return <ScreenSkeleton />; // hidrasyon-gate (#418)
  if (!auth.isAuthenticated) return <AuthRequired title={translateCopy("Tekliflerin için giriş yapın", language)} />;
  return <OffersInner />;
}

import { MaterialCommunityIcons } from "@/components/icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

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
import { useNativeRefresh } from "@/lib/use-native-refresh";
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
  const { currentUser, offers, findListing, findUser, buyerOfferAction, startConversation, refreshUserData } = useStore();
  // Teklif durumu UZAKTAN degisir (pending -> countered/accepted): satici karsi teklif
  // verince alici asagi cekip yenileyebilmeli. Yoksa tek care uygulamayi oldurup acmak.
  const { refreshing, onRefresh } = useNativeRefresh(refreshUserData);
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
    // NÖTR kart (eskiden tüm satır durum-renginde boyanıyordu → renk çorbası). Durum
    // artık ikon çipi + pill ile taşınır; kart beyaz kalır (app kart deseniyle uyumlu).
    return (
      <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 12, borderWidth: 1, gap: 8, padding: 12 }}>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push({ pathname: "/listing/[id]", params: { id: o.listingId } })}
          style={({ pressed }) => ({ alignItems: "center", flexDirection: "row", gap: 9, opacity: pressed ? 0.7 : 1 })}
        >
          <View style={{ alignItems: "center", backgroundColor: t.bg, borderRadius: 9, height: 34, justifyContent: "center", width: 34 }}>
            <MaterialCommunityIcons name={t.icon} size={18} color={t.ink} />
          </View>
          <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 13.5, fontWeight: "900", minWidth: 0 }}>
            {l?.title ?? translateCopy("İlan", language)}
          </Text>
          <Text style={{ color: t.ink, fontSize: 15, fontWeight: "900" }}>{moneyIn(shown, l?.currency)}</Text>
        </Pressable>

        <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
          <View style={{ backgroundColor: t.bg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
            <Text style={{ color: t.ink, fontSize: 11, fontWeight: "900" }}>{translateCopy(t.label, language)}</Text>
          </View>
          <Text numberOfLines={1} style={{ color: colors.muted, flex: 1, fontSize: 11.5, fontWeight: "700", minWidth: 0 }}>
            {o.status === "countered" ? `${translateCopy("senin teklifin", language)}: ${moneyIn(o.amount, l?.currency)} · ` : ""}
            {seller ? `${seller.name} · ` : ""}
            {shortDate(o.createdAt)}
          </Text>
        </View>

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
    <ScrollView
      contentContainerStyle={{ gap: 12, paddingBottom: 28 }}
      refreshControl={Platform.OS === "web" ? undefined : <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
    >
      <WebContainer>
        <View style={{ gap: 12, padding: 12 }}>
          <Card>
            <SectionTitle title="Tekliflerim" action={`${mine.length}`} />
            <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>
              {translateCopy("OrtakSat para tutmaz — kabul edilen teklifte ödeme ve teslimatı satıcıyla doğrudan yaparsın.", language)}
            </Text>
          </Card>

          {/* Stat çipleri (app hero/chip paritesi — eskiden başlık çıplaktı). */}
          {mine.length > 0 ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <OfferMini icon="progress-clock" tint={colors.goldSoft} color={colors.gold} value={`${open.length}`} label={translateCopy("Süren", language)} />
              <OfferMini icon="check-decagram" tint={colors.successSoft} color={colors.success} value={`${mine.filter((o) => o.status === "accepted").length}`} label={translateCopy("Kabul edilen", language)} />
              <OfferMini icon="tag-multiple-outline" tint={colors.primarySoft} color={colors.primaryDark} value={`${mine.length}`} label={translateCopy("Toplam", language)} />
            </View>
          ) : null}

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

function OfferMini({ icon, tint, color, value, label }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; tint: string; color: string; value: string; label: string }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 12, borderWidth: 1, flex: 1, gap: 6, minWidth: 0, padding: 10 }}>
      <View style={{ alignItems: "center", backgroundColor: tint, borderRadius: 9, height: 30, justifyContent: "center", width: 30 }}>
        <MaterialCommunityIcons name={icon} size={16} color={color} />
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>{value}</Text>
      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 10.5, fontWeight: "800" }}>{label}</Text>
    </View>
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

// İLAN DETAYI — TEK STANDART.
// Web (dar + geniş) ve native uygulama aynı bilgi sırasını, aynı adlandırmayı ve aynı
// token'ları bu dosyadaki parçalardan alır:
//   galeri → başlık → FİYAT → sessiz meta satırı → ortaklık özeti → Özet → Açıklama →
//   Ortaklık koşulları → Satıcı → Konum → Güvenli alışveriş → benzer ilanlar.
// Kurallar: kart içinde kart yok, tek vurgu rengi (marka mavisi) + durum renkleri,
// sayılar tabular, uzun değerler sarar (kırpılmaz), dokunma hedefi ≥40px, metin ≥10px.
import { useCallback, useEffect, useRef, useState, createElement, type PropsWithChildren, type ReactNode } from "react";
import { Platform, Pressable, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import { useFocusEffect } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";

import { colors } from "@/components/colors";
import { MaterialCommunityIcons } from "@/components/icons";
import { Skeleton } from "@/components/skeleton";
import { PressLink } from "@/components/ui";
import { UserAvatar } from "@/components/user-avatar";
import { VerificationBadges } from "@/components/verification-badges";
import { categoryChipLabel } from "@/lib/categories";
import { listingCategoryPath } from "@/lib/category-match";
import { describeAttributes } from "@/lib/category-tree";
import { commissionAmount, listingNo, moneyIn } from "@/lib/format";
import { translateCopy, useLanguage, type AppLanguage } from "@/lib/i18n";
import { openUrlSafe } from "@/lib/link";
import { listingCommissionDisplay } from "@/lib/mobile-listing";
import type { Listing, User } from "@/lib/types";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/** Ortak ölçüler — bölüm kartı, başlık ve boşluklar her platformda aynı. */
export const detail = {
  radius: 12,
  pad: 14,
  gap: 12,
  gutter: 12,
  heading: 15,
  /** Karartılmış fotoğraf üstü katman (düğme/sayaç zemini). */
  scrim: "rgba(9,39,94,0.62)",
  stage: "#0B1220"
} as const;

// ---- Medya -----------------------------------------------------------------

/** İlan videosu (herkese açık `listing-videos` bucket'ı) adAssets içinde URL olarak durur. */
export function isVideoUri(uri: string) {
  return /\.(mp4|mov|m4v|webm)(\?|$)/i.test(uri);
}

/** Fotoğraflar + (en fazla bir) video. Video ASLA kapak olmaz; galeride daima SON öğedir. */
export function splitListingMedia(urls: string[]) {
  const photos = urls.filter((u) => !isVideoUri(u));
  const video = urls.find((u) => isVideoUri(u));
  return { photos, video, count: photos.length + (video ? 1 : 0) };
}

/** Uzun tutarlar taşmasın: kart fiyatındaki (cardPriceFontSize) yaklaşımın detay eşleniği. */
export function detailPriceFontSize(label: string, availableWidth: number, preferred = 30) {
  return Math.max(18, Math.min(preferred, Math.floor(Math.max(120, availableWidth) / Math.max(1, label.length * 0.62))));
}

/** Dar ekran galerisi: genişliğin ~%62'si, ama görünür alanın %40'ını asla aşmaz. */
export function galleryHeightFor(width: number, viewportHeight: number) {
  const byWidth = Math.round(Math.max(190, Math.min(420, width * 0.62)));
  return viewportHeight > 0 ? Math.min(byWidth, Math.max(160, Math.round(viewportHeight * 0.4))) : byWidth;
}

export function listingDateLabel(createdAt: string | undefined, language: AppLanguage) {
  const created = new Date(createdAt ?? "");
  if (Number.isNaN(created.getTime())) return "";
  const days = Math.floor((Date.now() - created.getTime()) / 86400000);
  if (days <= 0) return translateCopy("Bugün", language);
  if (days === 1) return translateCopy("Dün", language);
  if (days < 30) return `${days} ${translateCopy("gün önce", language)}`;
  return created.toLocaleDateString(language === "en" ? "en-GB" : "tr-TR");
}

/** Ortaklık modu — ListingTermsSummary ile AYNI adlandırma (tek sözlük). */
export function partnershipModeLabel(mode: Listing["partnershipMode"]) {
  return mode === "open" ? "Anında katılım" : mode === "invite" ? "Yalnızca davetle" : mode === "none" ? "Ortaklığa kapalı" : "Satıcı onayıyla";
}

export function contactMethodLabel(method: Listing["contactMethod"]) {
  return method === "whatsapp" ? "WhatsApp" : method === "phone" ? "Telefon" : "Uygulama içi mesaj";
}

export type SummaryRow = { label: string; value: string };

/** Özet tablosu satırları: kategoriye özel skaler özellikler + her ilanda bulunan temel alanlar. */
export function buildSummaryRows(listing: Listing, language: AppLanguage): { rows: SummaryRow[]; chips: { label: string; items: string[] }[] } {
  const described = describeAttributes(listing.attributes).filter((r) => !/^(başlık|açıklama|fiyat)$/i.test(r.label));
  const rows: SummaryRow[] = described.filter((r) => !r.items).map((r) => ({ label: r.label, value: r.value }));
  const listingType = listing.attributes?.listingType ? String(listing.attributes.listingType) : "";
  // Kategori TAM yoluyla yazılır (kök › … › yaprak): yalnız yaprak ("Bosch") hangi dalda olduğunu
  // söylemiyordu. Web'deki breadcrumb ile aynı iz; native detayda breadcrumb olmadığı için tek kaynak budur.
  const trail = listingCategoryPath(listing);
  const categoryValue = trail.length ? trail.map((n) => translateCopy(categoryChipLabel(n.label), language)).join(" › ") : listing.category;
  const base: SummaryRow[] = [
    { label: "Kategori", value: categoryValue },
    ...(listingType ? [{ label: "İlan tipi", value: listingType }] : []),
    { label: "Stok", value: `${listing.stockCount} ${translateCopy("adet", language)}` },
    { label: "İade süresi", value: `${listing.returnWindowDays} ${translateCopy("gün", language)}` },
    { label: "İletişim", value: contactMethodLabel(listing.contactMethod) }
  ];
  const chips = described.filter((r) => r.items && r.items.length).map((r) => ({ label: r.label, items: r.items ?? [] }));
  return { rows: [...rows, ...base], chips };
}

// ---- Yapı taşları ------------------------------------------------------------

/** Bölüm kartı: tek stil (yüzey + ince kenarlık), tek başlık ölçüsü. İçine KART konmaz. */
export function DetailSection({ title, icon, right, children, testID, style }: PropsWithChildren<{ title?: string; icon?: IconName; right?: ReactNode; testID?: string; style?: StyleProp<ViewStyle> }>) {
  const { language } = useLanguage();
  return (
    <View testID={testID} style={[{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: detail.radius, borderWidth: 1, gap: 10, padding: detail.pad }, style]}>
      {title ? (
        <View style={{ alignItems: "center", flexDirection: "row", gap: 8, minHeight: 22 }}>
          {icon ? <MaterialCommunityIcons name={icon} size={18} color={colors.primary} /> : null}
          <Text accessibilityRole="header" {...({ role: "heading", "aria-level": 2 } as Record<string, unknown>)} numberOfLines={2} style={{ color: colors.ink, flex: 1, fontSize: detail.heading, fontWeight: "800", lineHeight: 20, minWidth: 0 }}>{translateCopy(title, language)}</Text>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/**
 * Tanım ızgarası: 2 sütun; dar kapta (≈320px ekran) tek sütuna düşer. Değerler SARAR.
 * Genişlik yüzdeyle verilir (flexBasis değil — RN-web'de sütun kabında yükseklik olur).
 */
export function DefinitionGrid({ rows, initial = 6, expandLabel = "Tüm özellikler" }: { rows: SummaryRow[]; initial?: number; expandLabel?: string }) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [single, setSingle] = useState(false);
  const onLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width < 300;
    setSingle((prev) => (prev === next ? prev : next));
  };
  const shown = open ? rows : rows.slice(0, initial);
  return (
    <View onLayout={onLayout} testID="listing-summary-grid">
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {shown.map((row, i) => (
          single ? (
            <View key={`${row.label}-${i}`} style={{ borderTopColor: colors.line, borderTopWidth: i === 0 ? 0 : 1, flexDirection: "row", gap: 10, paddingVertical: 8, width: "100%" }}>
              <Text style={{ color: colors.muted, flex: 1, fontSize: 12.5, fontWeight: "600", lineHeight: 18, minWidth: 0 }}>{translateCopy(row.label, language)}</Text>
              <Text selectable style={{ color: colors.ink, flex: 1.2, fontSize: 13, fontWeight: "700", lineHeight: 18, minWidth: 0, textAlign: "right" }}>{translateCopy(row.value, language)}</Text>
            </View>
          ) : (
            <View key={`${row.label}-${i}`} style={{ borderTopColor: colors.line, borderTopWidth: i < 2 ? 0 : 1, gap: 2, paddingRight: i % 2 === 0 ? 12 : 0, paddingVertical: 8, width: "50%" }}>
              <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", lineHeight: 15 }}>{translateCopy(row.label, language)}</Text>
              <Text selectable style={{ color: colors.ink, fontSize: 13.5, fontWeight: "700", lineHeight: 18 }}>{translateCopy(row.value, language)}</Text>
            </View>
          )
        ))}
      </View>
      {rows.length > initial ? (
        <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Tüm ilan özellikleri", language)} accessibilityState={{ expanded: open }} onPress={() => setOpen((v) => !v)} style={{ alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 6, minHeight: 40, marginTop: 2 }}>
          <Text style={{ color: colors.primary, flex: 1, fontSize: 12.5, fontWeight: "700" }}>{translateCopy(open ? "Daha az göster" : expandLabel, language)} ({rows.length})</Text>
          <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Çok-seçimli özellikler (donanım vb.) — sakin çipler, Özet kartının içinde alt başlıkla. */
export function FeatureChips({ groups }: { groups: { label: string; items: string[] }[] }) {
  const { language } = useLanguage();
  if (!groups.length) return null;
  return (
    <View style={{ borderTopColor: colors.line, borderTopWidth: 1, gap: 10, paddingTop: 10 }}>
      {groups.map((g) => (
        <View key={g.label} style={{ gap: 6 }}>
          <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{translateCopy(g.label, language)}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {g.items.map((it) => (
              <View key={it} style={{ backgroundColor: colors.surfaceAlt, borderRadius: 999, maxWidth: "100%", paddingHorizontal: 10, paddingVertical: 5 }}>
                <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "600" }}>{translateCopy(it, language)}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Uzun metin: birkaç satıra kısılır, "Devamını oku" ile açılır. Kısa metinde düğme çıkmaz. */
export function ClampedText({ text, lines = 6 }: { text: string; lines?: number }) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const long = text.length > 280 || text.split("\n").length > lines;
  return (
    <View style={{ gap: 4 }}>
      <Text selectable numberOfLines={open || !long ? undefined : lines} style={{ color: colors.ink, fontSize: 14, fontWeight: "400", lineHeight: 21 }}>{text}</Text>
      {long ? (
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((v) => !v)} style={{ alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 4, minHeight: 40 }}>
          <Text style={{ color: colors.primary, fontSize: 12.5, fontWeight: "700" }}>{translateCopy(open ? "Daha az göster" : "Devamını oku", language)}</Text>
          <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Sessiz TEK meta satırı: konum · tarih · ilan no. */
export function DetailMetaLine({ listing }: { listing: Pick<Listing, "id" | "location" | "createdAt"> }) {
  const { language } = useLanguage();
  const parts = [listing.location?.trim(), listingDateLabel(listing.createdAt, language), `${translateCopy("İlan no", language)} ${listingNo(listing.id)}`].filter(Boolean);
  return (
    <Text testID="listing-detail-meta" selectable style={{ color: colors.muted, fontSize: 12.5, fontVariant: ["tabular-nums"], fontWeight: "500", lineHeight: 18 }}>
      {parts.join("  ·  ")}
    </Text>
  );
}

/** Fiyatın altındaki ortaklık özeti: komisyon tutarı/oranı + katılım modu (tek satır kutu). */
export function CommissionSummary({ listing, demand }: { listing: Listing; demand?: boolean }) {
  const { language } = useLanguage();
  if (listing.partnershipMode === "none") {
    return (
      <View testID="listing-commission-summary" style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
        <MaterialCommunityIcons name="information-outline" size={15} color={colors.muted} />
        <Text style={{ color: colors.muted, flex: 1, fontSize: 12.5, fontWeight: "500", lineHeight: 17, minWidth: 0 }}>{translateCopy("Bu ilan sahibi ürünü ortaklığa açmamış.", language)}</Text>
      </View>
    );
  }
  const valid = listingCommissionDisplay(listing) !== null;
  const amount = moneyIn(commissionAmount(listing), listing.currency);
  const rate = listing.commissionType === "rate" && valid ? `%${listing.commissionValue}` : "";
  return (
    <View testID="listing-commission-summary" style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 10, flexDirection: "row", gap: 10, paddingHorizontal: 12, paddingVertical: 9 }}>
      <MaterialCommunityIcons name={demand ? "magnify" : "handshake-outline"} size={20} color={colors.primary} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", lineHeight: 15 }}>{translateCopy(demand ? "Buluş komisyonu" : "Ortak komisyonu", language)}</Text>
        {valid ? (
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ color: colors.ink, fontSize: 17, fontVariant: ["tabular-nums"], fontWeight: "800", lineHeight: 22 }}>
            {amount}{rate ? <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>{`  ·  ${rate}`}</Text> : null}
          </Text>
        ) : (
          <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 14, fontWeight: "700", lineHeight: 22 }}>{translateCopy("Komisyonu satıcıya sor", language)}</Text>
        )}
      </View>
      <View style={{ backgroundColor: colors.surface, borderRadius: 999, flexShrink: 0, maxWidth: "46%", paddingHorizontal: 10, paddingVertical: 5 }}>
        <Text numberOfLines={1} style={{ color: colors.primary, fontSize: 11.5, fontWeight: "700" }}>{translateCopy(partnershipModeLabel(listing.partnershipMode), language)}</Text>
      </View>
    </View>
  );
}

/** Durum bandı (satıldı / yayında değil / örnek ilan) — her platformda aynı görünüm. */
export function DetailNotice({ icon, title, body, tone = "danger" }: { icon: IconName; title: string; body?: string; tone?: "danger" | "neutral" | "info" | "pending" }) {
  const fg = tone === "danger" ? colors.accent : tone === "info" ? colors.primary : tone === "pending" ? colors.goldInk : colors.muted;
  const bg = tone === "danger" ? colors.accentSoft : tone === "info" ? colors.primarySoft : tone === "pending" ? colors.goldSoft : colors.surfaceAlt;
  return (
    <View accessibilityRole="alert" style={{ alignItems: "flex-start", backgroundColor: bg, borderRadius: 10, flexDirection: "row", gap: 9, paddingHorizontal: 12, paddingVertical: 10 }}>
      <MaterialCommunityIcons name={icon} size={18} color={fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <Text style={{ color: tone === "neutral" ? colors.ink : fg, fontSize: 13, fontWeight: "800", lineHeight: 18 }}>{title}</Text>
        {body ? <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "500", lineHeight: 17 }}>{body}</Text> : null}
      </View>
    </View>
  );
}

/** Satıcı bölümü içeriği (kart DetailSection'dan gelir). */
export function SellerSummary({ owner, ownerId, demo, activeCount }: { owner?: User | null; ownerId: string; demo?: boolean; activeCount?: number }) {
  const { language } = useLanguage();
  const verified = !demo && !!(owner?.verifiedPhone || owner?.verifiedIdentity);
  const since = owner?.createdAt && !Number.isNaN(new Date(owner.createdAt).getTime()) ? String(new Date(owner.createdAt).getFullYear()) : "";
  const count = activeCount ?? owner?.listingCount ?? 0;
  const sales = owner?.successfulSales ?? 0;
  const facts = [
    since ? `${translateCopy("Üyelik", language)}: ${since}` : "",
    `${count} ${translateCopy("aktif ilan", language)}`,
    sales > 0 ? `${sales} ${translateCopy("tamamlanan satış", language)}` : "",
    !demo && (owner?.responseRate ?? 0) > 0 ? `${translateCopy("Yanıt oranı", language)} %${Math.round(owner!.responseRate)}` : ""
  ].filter(Boolean);
  return (
    <View style={{ gap: 10 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 11 }}>
        <UserAvatar uri={owner?.avatar} size={46} />
        <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 5 }}>
            <Text numberOfLines={2} style={{ color: colors.ink, flexShrink: 1, fontSize: 14.5, fontWeight: "800", lineHeight: 19 }}>{owner?.name || translateCopy("Satıcı", language)}</Text>
            {verified ? <MaterialCommunityIcons name="check-decagram" size={15} color={colors.primary} /> : null}
            {!demo && owner?.rating ? (
              <View style={{ alignItems: "center", flexDirection: "row", gap: 2 }}>
                <MaterialCommunityIcons name="star" size={13} color={colors.gold} />
                <Text style={{ color: colors.ink, fontSize: 12.5, fontVariant: ["tabular-nums"], fontWeight: "700" }}>{owner.rating.toFixed(1)}</Text>
              </View>
            ) : null}
          </View>
          <Text style={{ color: colors.muted, fontSize: 12, fontVariant: ["tabular-nums"], fontWeight: "500", lineHeight: 17 }}>
            {demo ? translateCopy("Örnek vitrin satıcısı", language) : facts.join("  ·  ")}
          </Text>
        </View>
      </View>
      {!demo ? <VerificationBadges user={owner} size="sm" /> : null}
      <PressLink href={{ pathname: "/store/[id]", params: { id: ownerId } }} accessibilityLabel={translateCopy("Mağazayı aç", language)} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 6, justifyContent: "center", minHeight: 42, paddingHorizontal: 12 }}>
        <MaterialCommunityIcons name="storefront-outline" size={16} color={colors.primary} />
        <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>{translateCopy("Satıcının mağazasını gör", language)}</Text>
      </PressLink>
    </View>
  );
}

/** Konum satırı — dokununca haritada açılır. */
export function LocationRow({ location }: { location: string }) {
  const { language } = useLanguage();
  const has = !!location?.trim();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={translateCopy("Konumu haritada aç", language)}
      disabled={!has}
      onPress={() => void openUrlSafe(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`)}
      style={{ alignItems: "center", flexDirection: "row", gap: 10, minHeight: 44 }}
    >
      <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 10, height: 40, justifyContent: "center", width: 40 }}>
        <MaterialCommunityIcons name="map-marker-outline" size={21} color={colors.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text selectable style={{ color: colors.ink, fontSize: 13.5, fontWeight: "700", lineHeight: 18 }}>{has ? location : translateCopy("Konum belirtilmemiş", language)}</Text>
        {has ? <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "500", lineHeight: 16 }}>{translateCopy("Haritada aç", language)}</Text> : null}
      </View>
      {has ? <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} /> : null}
    </Pressable>
  );
}

/** Güvenli alışveriş ipuçları — düz madde listesi (uyarı kartı değil). */
export function SafetyTips({ children }: PropsWithChildren) {
  const { language } = useLanguage();
  const tips = [
    "Ödemeyi ürünü görmeden yapma; kapora/ön ödeme isteyen kişiye dikkat et.",
    "Fiyat, teslimat ve iade koşullarını satışı kapatmadan önce satıcıyla netleştir.",
    "OrtakSat ödeme tutmaz; ödeme ve teslimat taraflar arasındadır. Şüpheli durumu bildir."
  ];
  return (
    <View style={{ gap: 8 }}>
      {tips.map((tip) => (
        <View key={tip} style={{ alignItems: "flex-start", flexDirection: "row", gap: 8 }}>
          <MaterialCommunityIcons name="check-circle-outline" size={16} color={colors.primary} style={{ marginTop: 2 }} />
          <Text style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "400", lineHeight: 19, minWidth: 0 }}>{translateCopy(tip, language)}</Text>
        </View>
      ))}
      <PressLink href="/guvenli-alisveris" style={{ alignSelf: "flex-start", justifyContent: "center", minHeight: 40 }}>
        <Text style={{ color: colors.primary, fontSize: 12.5, fontWeight: "700" }}>{translateCopy("Güvenli alışveriş rehberi →", language)}</Text>
      </PressLink>
      {children}
    </View>
  );
}

// ---- Galeri parçaları --------------------------------------------------------

/** Fotoğraf üstü yuvarlak düğme: 40px dokunma alanı, 34px görsel daire. */
export function GalleryOverlayButton({ icon, label, onPress, active, testID }: { icon: IconName; label: string; onPress: () => void; active?: boolean; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!active }} onPress={onPress} style={{ alignItems: "center", height: 40, justifyContent: "center", width: 40 }}>
      <View style={{ alignItems: "center", backgroundColor: active ? colors.surface : detail.scrim, borderRadius: 999, height: 34, justifyContent: "center", width: 34 }}>
        <MaterialCommunityIcons name={icon} size={19} color={active ? colors.accent : "#FFFFFF"} />
      </View>
    </Pressable>
  );
}

/** Sayaç rozeti (1/5). `video` ise küçük oynat simgesi. */
export function GalleryCounter({ index, total, video, testID }: { index: number; total: number; video?: boolean; testID?: string }) {
  return (
    <View testID={testID} style={{ pointerEvents: "none", alignItems: "center", backgroundColor: detail.scrim, borderRadius: 999, flexDirection: "row", gap: 5, paddingHorizontal: 9, paddingVertical: 5 }}>
      <MaterialCommunityIcons name={video ? "play-circle-outline" : "image-outline"} size={13} color="#FFFFFF" />
      <Text style={{ color: "#FFFFFF", fontSize: 11.5, fontVariant: ["tabular-nums"], fontWeight: "700" }}>{index + 1}/{total}</Text>
    </View>
  );
}

/**
 * Galeri önceki / sonraki düğmeleri. Nokta göstergesinin OLMADIĞI durumlarda (video öğesi,
 * 8'den fazla medya) gösterilir: fare ve klavyeyle de gezinilebilsin (kaydırma yalnız dokunmatik).
 * `top` = galeri kutusunun üstünden uzaklık (dikeyde ortalamak için: yükseklik / 2 − 20).
 */
export function GalleryNavButtons({ onPrev, onNext, top }: { onPrev: () => void; onNext: () => void; top: number }) {
  const { language } = useLanguage();
  return (
    <>
      <View style={{ left: 4, position: "absolute", top }}>
        <GalleryOverlayButton testID="listing-gallery-prev" icon="chevron-left" label={translateCopy("Önceki görsel", language)} onPress={onPrev} />
      </View>
      <View style={{ position: "absolute", right: 4, top }}>
        <GalleryOverlayButton testID="listing-gallery-next" icon="chevron-right" label={translateCopy("Sonraki görsel", language)} onPress={onNext} />
      </View>
    </>
  );
}

/** Küçük resim şeridindeki video karosu (oynat rozeti). */
export function VideoThumb({ size, height }: { size: number; height?: number }) {
  return (
    <View style={{ alignItems: "center", backgroundColor: detail.stage, height: height ?? size, justifyContent: "center", width: size }}>
      <MaterialCommunityIcons name="play-circle" size={Math.min(28, Math.round(size * 0.42))} color="#FFFFFF" />
    </View>
  );
}

/** "Video" rozeti — galeride video olduğunu gösterir, dokununca video öğesine gider. */
export function VideoBadge({ onPress }: { onPress: () => void }) {
  const { language } = useLanguage();
  return (
    <Pressable testID="listing-video-badge" accessibilityRole="button" accessibilityLabel={translateCopy("Videoyu göster", language)} onPress={onPress} style={{ height: 40, justifyContent: "center" }}>
      <View style={{ alignItems: "center", backgroundColor: detail.scrim, borderRadius: 999, flexDirection: "row", gap: 4, paddingHorizontal: 9, paddingVertical: 5 }}>
        <MaterialCommunityIcons name="play" size={14} color="#FFFFFF" />
        <Text style={{ color: "#FFFFFF", fontSize: 11.5, fontWeight: "700" }}>{translateCopy("Video", language)}</Text>
      </View>
    </Pressable>
  );
}

/**
 * İlan videosu — galerinin SON öğesi. Satır içi oynar, yerel kontroller, varsayılan SESSİZ,
 * otomatik oynatma YOK, yalnız metadata ön-yüklenir. `active` false olunca (kullanıcı başka
 * öğeye geçince) DURDURULUR.
 *
 * Ekran odağı da izlenir: ilan ekranı, üstüne başka ekran (sohbet, mağaza, başka ilan) açılınca
 * stack'te MOUNT'lu kalır; odak gidince video durdurulur (yoksa ses alttaki ekrandan çalmaya
 * devam ediyordu). Odak geri gelince kendiliğinden OYNATILMAZ.
 */
export function ListingVideo({ uri, active, style }: { uri: string; active: boolean; style?: StyleProp<ViewStyle> }) {
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );
  const playable = active && focused;
  return (
    <View testID="listing-video" style={[{ backgroundColor: detail.stage, overflow: "hidden" }, style]}>
      {Platform.OS === "web" ? <WebVideo uri={uri} active={playable} /> : <NativeVideo uri={uri} active={playable} />}
    </View>
  );
}

function WebVideo({ uri, active }: { uri: string; active: boolean }) {
  const ref = useRef<{ pause?: () => void } | null>(null);
  useEffect(() => {
    if (!active) ref.current?.pause?.();
  }, [active]);
  // #t=0.1 → tarayıcı metadata ile ilk kareyi poster gibi gösterir (ayrı poster dosyası yok).
  return createElement("video", {
    ref,
    src: uri.includes("#") ? uri : `${uri}#t=0.1`,
    controls: true,
    muted: true,
    playsInline: true,
    preload: "metadata",
    controlsList: "nodownload",
    style: { backgroundColor: detail.stage, display: "block", height: "100%", objectFit: "contain", width: "100%" }
  });
}

function NativeVideo({ uri, active }: { uri: string; active: boolean }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
    instance.muted = true; // otomatik oynatma yok: play() çağrılmaz
  });
  useEffect(() => {
    if (!active) player.pause();
  }, [active, player]);
  return <VideoView player={player} nativeControls contentFit="contain" style={{ height: "100%", width: "100%" }} />;
}

// ---- İskelet -----------------------------------------------------------------

/** Yükleme iskeleti — nihai düzenle AYNI bloklar (galeri → başlık → fiyat → meta → özet). */
export function DetailSkeleton({ wide, galleryHeight }: { wide: boolean; galleryHeight: number }) {
  const head = (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: detail.radius, borderWidth: 1, gap: 10, padding: detail.pad }}>
      <Skeleton style={{ height: 20, width: "92%" }} />
      <Skeleton style={{ height: 20, width: "60%" }} />
      <Skeleton style={{ height: 34, width: "44%" }} />
      <Skeleton style={{ height: 13, width: "78%" }} />
      <Skeleton style={{ borderRadius: 10, height: 56, width: "100%" }} />
    </View>
  );
  const section = (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: detail.radius, borderWidth: 1, gap: 10, padding: detail.pad }}>
      <Skeleton style={{ height: 16, width: "30%" }} />
      <Skeleton style={{ height: 13, width: "100%" }} />
      <Skeleton style={{ height: 13, width: "86%" }} />
      <Skeleton style={{ height: 13, width: "64%" }} />
    </View>
  );
  if (wide) {
    return (
      <View testID="listing-detail-skeleton" style={{ alignSelf: "center", flexDirection: "row", gap: 20, maxWidth: 1280, paddingHorizontal: 20, paddingTop: 16, width: "100%" }}>
        <View style={{ flex: 1.12, minWidth: 0 }}><Skeleton style={{ borderRadius: detail.radius, height: galleryHeight, width: "100%" }} /></View>
        <View style={{ flex: 1, gap: detail.gap, minWidth: 0 }}>{head}{section}</View>
      </View>
    );
  }
  return (
    <View testID="listing-detail-skeleton" style={{ gap: detail.gap }}>
      <Skeleton style={{ borderRadius: 0, height: galleryHeight, width: "100%" }} />
      <View style={{ gap: detail.gap, paddingHorizontal: detail.gutter }}>{head}{section}</View>
    </View>
  );
}

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { memo } from "react";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { getCategoryIcon, getCategoryShortLabel } from "@/lib/categories";
import { useCompare } from "@/lib/compare";
import { useFavoriteFlag } from "@/lib/favorites-cache";
import { commissionAmount, groupThousands, moneyIn } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { compactNumber, REFERENCE_NOW } from "@/lib/locale";
import { displayText } from "@/lib/text";
import type { Listing, User } from "@/lib/types";

type StatusTone = "success" | "accent" | "info" | "dark" | "gold";

function ListingCardBase({ listing, owner, width, priceNote }: { listing: Listing; owner?: User; width?: number; priceNote?: { text: string; down: boolean } }) {
  const { language, t } = useLanguage();
  const commission = commissionAmount(listing);
  const conversionScore = listing.leadCount + listing.partnerCount * 2 + Math.round(listing.favoriteCount / 8);
  const isHighConversion = conversionScore >= 18;
  const isNew = isNewListing(listing.createdAt);
  const featured = Boolean(listing.featured);
  const statusLabel = featured ? translateCopy("★ Öne Çıkan", language) : listing.partnershipMode === "open" ? t("instantPartner") : isHighConversion ? t("highConversion") : isNew ? t("newListing") : `${compactNumber(listing.partnerCount)} ${t("partners")}`;
  const statusTone: StatusTone = featured ? "gold" : listing.partnershipMode === "open" ? "success" : isHighConversion ? "accent" : isNew ? "info" : "dark";
  // Kartın kategori etiketleri ilanın GERÇEK ağaç kategorisinden gelir. Eski sezgisel
  // inferListingSubcategory tree-ilanlarda yanlış eşliyordu (kamera → "Araç elektroniği").
  const rootCat = String(listing.attributes?._root || "").trim();
  const leafCat = displayText(listing.category);
  const isVerified = Boolean(owner?.verifiedPhone || owner?.verifiedIdentity);
  const rating = owner?.rating ?? 0;
  const hasRating = rating > 0;
  const sellerSales = owner?.successfulSales ?? 0;
  const { has, toggle } = useCompare();
  const inCompare = has(listing.id);
  const { isFav, toggle: toggleFav } = useFavoriteFlag(listing.id);
  const imageUri = listing.imageUrl ?? listing.image;
  const imageAlt = listing.imageAlt ?? `${displayText(listing.title)} ${translateCopy("ilan görseli", language)}`;
  // Karttaki en önemli 3 yapısal özellik rozeti — kategoriye göre (Sahibinden gibi):
  // vasıta → yıl · km · yakıt; emlak → oda · m² · ilan tipi; genel → marka · model · durum.
  const attrSpecs = (() => {
    const a = listing.attributes;
    if (!a) return [] as string[];
    const out: string[] = [];
    const num = (v: unknown) => (typeof v === "number" ? v : Number(String(v).replace(/[^\d]/g, "")));
    // Vasıta: yalnız gerçek araç sinyali (km/yakıt/vites) varken. Sadece "year" ile
    // tetikleme (koleksiyon/antika "üretim yılı") araç sanılıyordu.
    const isVehicle = a.km != null || a.fuel != null || a.gear != null;
    if (isVehicle) {
      if (a.year) out.push(String(a.year));
      if (a.km != null && String(a.km).trim() !== "") out.push(`${groupThousands(num(a.km))} km`);
      if (a.fuel) out.push(translateCopy(String(a.fuel), language));
      if (out.length < 3 && a.gear) out.push(translateCopy(String(a.gear), language));
      if (out.length) return out.slice(0, 3);
    }
    // Emlak
    if (a.rooms) out.push(String(a.rooms));
    const m2 = a.grossM2 ?? a.m2 ?? a.totalGrossM2 ?? a.netM2 ?? a.closedM2;
    if (m2) out.push(`${groupThousands(num(m2))} m²`);
    if (a.listingType) out.push(translateCopy(String(a.listingType), language));
    if (out.length < 3 && a.buildingAge) out.push(`${a.buildingAge} ${translateCopy("yaş", language)}`);
    if (out.length) return out.slice(0, 3);
    // Genel
    if (a.brand) out.push(String(a.brand));
    if (a.model && out.length < 2) out.push(String(a.model));
    const cond = a.condition ?? a.durum;
    if (cond && out.length < 3) out.push(translateCopy(String(cond), language));
    return out.slice(0, 3);
  })();
  // İlan etiketleri (Acil / Fırsat / Yatırımlık…) — renkli vurgu rozetleri (spec 72).
  const etiketler = Array.isArray(listing.attributes?.etiketler) ? (listing.attributes!.etiketler as string[]).slice(0, 2) : [];

  return (
    <View style={{ width }}>
      <Link href={`/listing/${listing.id}`} asChild>
        <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1, width: "100%" })}>
          <View
            dataSet={{ card: "listing" }}
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.line,
              borderRadius: 16,
              borderWidth: 1,
              overflow: "hidden",
              shadowColor: "#101828",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.07,
              shadowRadius: 18
            }}
          >
            <View style={{ aspectRatio: 1, backgroundColor: colors.surfaceAlt, overflow: "hidden", width: "100%" }}>
              <SafeRemoteImage
                uri={imageUri}
                fallbackUri={listing.fallbackCategoryImage}
                style={{ height: "100%", width: "100%" }}
                contentFit="cover"
                transition={160}
                loading="lazy"
                priority="low"
                alt={imageAlt}
                accessibilityLabel={imageAlt}
              />
              {/* Demo ilan: tam-genişlik sarı uyarı çubuğu yerine zarif köşe "ÖRNEK" pili
                  (dürüst — detay sayfasında tam açıklama banner'ı var; feed gerçek pazar gibi durur). */}
              <View style={{ position: "absolute", top: 10, left: 10, right: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                {listing.demo ? (
                  <View style={{ alignItems: "center", backgroundColor: "rgba(245,197,24,0.96)", borderRadius: 999, flexDirection: "row", gap: 3, paddingHorizontal: 8, paddingVertical: 3, shadowColor: "#000000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 3 }}>
                    <MaterialCommunityIcons name="eye-outline" size={10} color="#1A1A00" />
                    <Text style={{ color: "#1A1A00", fontSize: 9.5, fontWeight: "900", letterSpacing: 0.4 }}>{translateCopy("ÖRNEK", language)}</Text>
                  </View>
                ) : (
                  <StatusBadge label={statusLabel} tone={statusTone} />
                )}
                <View style={{ backgroundColor: "rgba(255,255,255,0.94)", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }}>
                  <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 10, fontWeight: "900" }}>
                    {translateCopy(rootCat || getCategoryShortLabel(listing.category), language)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={{ gap: 8, padding: 12 }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                <MaterialCommunityIcons name={getCategoryIcon(listing.category)} size={12} color={colors.primaryDark} />
                <Text numberOfLines={1} selectable style={{ color: colors.primaryDark, flex: 1, fontSize: 11, fontWeight: "800", letterSpacing: 0.3, textTransform: "uppercase" }}>
                  {translateCopy(leafCat, language)}
                </Text>
              </View>
              <Text numberOfLines={2} selectable style={{ color: colors.ink, fontSize: 15, fontWeight: "800", lineHeight: 19, minHeight: 38 }}>
                {displayText(listing.title)}
              </Text>
              {attrSpecs.length || etiketler.length ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                  {etiketler.map((e) => (
                    <View key={e} style={{ backgroundColor: colors.accentSoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text numberOfLines={1} style={{ color: colors.accent, fontSize: 10.5, fontWeight: "900" }}>{e}</Text>
                    </View>
                  ))}
                  {attrSpecs.map((s) => (
                    <View key={s} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 6, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 10.5, fontWeight: "800" }}>{s}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={{ gap: 5 }}>
                <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  <Text numberOfLines={1} selectable style={{ color: colors.ink, fontSize: 19, fontVariant: ["tabular-nums"], fontWeight: "900" }}>
                    {moneyIn(listing.price, listing.currency)}
                  </Text>
                  {priceNote ? (
                    <View style={{ alignItems: "center", backgroundColor: priceNote.down ? colors.successSoft : colors.warningSoft, borderRadius: 999, flexDirection: "row", gap: 2, paddingHorizontal: 7, paddingVertical: 2 }}>
                      <MaterialCommunityIcons name={priceNote.down ? "arrow-down-bold" : "arrow-up-bold"} size={11} color={priceNote.down ? colors.success : colors.warning} />
                      <Text style={{ color: priceNote.down ? colors.success : colors.warning, fontSize: 10.5, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{priceNote.text}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
                  <View style={{ backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text numberOfLines={1} style={{ color: colors.primaryDark, fontSize: 11, fontVariant: ["tabular-nums"], fontWeight: "900" }}>
                      {t("earning")} {moneyIn(commission, listing.currency)}
                    </Text>
                  </View>
                  {listing.bonusAmount && listing.bonusAmount > 0 && listing.bonusQuota ? (
                    <View style={{ alignItems: "center", backgroundColor: colors.warningSoft, borderRadius: 999, flexDirection: "row", gap: 3, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <MaterialCommunityIcons name="rocket-launch" size={11} color={colors.warning} />
                      <Text numberOfLines={1} style={{ color: colors.warning, fontSize: 10.5, fontVariant: ["tabular-nums"], fontWeight: "900" }}>
                        +{moneyIn(listing.bonusAmount, listing.currency)} bonus
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                {hasRating ? (
                  <>
                    <MaterialCommunityIcons name="star" size={13} color={colors.gold} />
                    <Text numberOfLines={1} selectable style={{ color: colors.ink, fontSize: 12, fontVariant: ["tabular-nums"], fontWeight: "800" }}>
                      {rating.toFixed(1)}
                    </Text>
                  </>
                ) : (
                  <>
                    <MaterialCommunityIcons name="sprout-outline" size={13} color={colors.info} />
                    <Text numberOfLines={1} style={{ color: colors.info, fontSize: 11.5, fontWeight: "800" }}>{translateCopy("Yeni satıcı", language)}</Text>
                  </>
                )}
                {isVerified ? <MaterialCommunityIcons name="check-decagram" size={13} color={colors.primary} /> : null}
                <Text numberOfLines={1} selectable style={{ color: colors.muted, flex: 1, fontSize: 12, fontWeight: "700" }}>
                  {" · "}{displayText(listing.location)}
                </Text>
                {sellerSales > 0 ? (
                  <>
                    <MaterialCommunityIcons name="check-circle" size={13} color={colors.success} />
                    <Text numberOfLines={1} selectable style={{ color: colors.success, fontSize: 11, fontVariant: ["tabular-nums"], fontWeight: "800" }}>
                      {compactNumber(sellerSales)} {translateCopy("satış", language)}
                    </Text>
                  </>
                ) : (
                  <>
                    <MaterialCommunityIcons name="account-group-outline" size={13} color={colors.subtle} />
                    <Text numberOfLines={1} selectable style={{ color: colors.subtle, fontSize: 11, fontWeight: "700" }}>
                      {compactNumber(listing.partnerCount)} {translateCopy("ortak", language)}
                    </Text>
                  </>
                )}
              </View>

              <View style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 6, justifyContent: "center", marginTop: 2, minHeight: 38, paddingHorizontal: 8 }}>
                <MaterialCommunityIcons name="handshake-outline" size={16} color="#FFFFFF" />
                <Text adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1} style={{ color: "#FFFFFF", flexShrink: 1, fontSize: 13, fontWeight: "900" }}>
                  {translateCopy(listing.partnershipMode === "open" ? "Hemen ortak ol" : "Ortaklık iste", language)}
                </Text>
              </View>
            </View>
          </View>
        </Pressable>
      </Link>
      {!listing.demo ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isFav }}
            accessibilityLabel={isFav ? translateCopy("Favorilerden çıkar", language) : translateCopy("Favorilere ekle", language)}
            onPress={toggleFav}
            style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.92)", borderColor: isFav ? colors.accent : colors.line, borderRadius: 999, borderWidth: 1, height: 30, justifyContent: "center", position: "absolute", right: 8, top: 8, width: 30, zIndex: 4 }}
          >
            <MaterialCommunityIcons name={isFav ? "heart" : "heart-outline"} size={16} color={isFav ? colors.accent : colors.muted} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: inCompare }}
            accessibilityLabel={inCompare ? translateCopy("Karşılaştırmadan çıkar", language) : translateCopy("Karşılaştır", language)}
            onPress={() => toggle(listing.id)}
            style={{ alignItems: "center", backgroundColor: inCompare ? colors.primary : "rgba(255,255,255,0.92)", borderColor: inCompare ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, height: 30, justifyContent: "center", position: "absolute", right: 44, top: 8, width: 30, zIndex: 4 }}
          >
            <MaterialCommunityIcons name="compare-horizontal" size={16} color={inCompare ? "#FFFFFF" : colors.muted} />
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

// memo: ust bilesen render olsa da ayni listing/owner/width ile yeniden render
// olmaz. Binlerce kartli listelerde CPU'yu ciddi dusurur.
export const ListingCard = memo(ListingCardBase);

function isNewListing(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const age = REFERENCE_NOW - date.getTime();
  return age >= 0 && age <= 7 * 24 * 60 * 60 * 1000;
}

function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  const backgroundColor =
    tone === "success" ? "rgba(0,134,111,0.96)" : tone === "accent" ? "rgba(229,75,75,0.96)" : tone === "info" ? "rgba(49,87,213,0.96)" : tone === "gold" ? "rgba(202,138,4,0.97)" : "rgba(17,24,39,0.78)";

  return (
    <View style={{ alignSelf: "flex-start", backgroundColor, borderRadius: 999, maxWidth: "72%", paddingHorizontal: 10, paddingVertical: 5 }}>
      <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "900" }}>
        {label}
      </Text>
    </View>
  );
}

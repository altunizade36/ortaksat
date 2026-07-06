import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Keyboard, NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, ScrollView, Share, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/components/colors";
import { commissionAmount, money, productUrl, shareUrl } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import type { Listing, Review } from "@/lib/types";
import { useStore } from "@/lib/use-store";

type FeedMedia = {
  id: string;
  index: number;
  poster: string;
  type: "image" | "video";
  uri: string;
  listing: Listing;
};

export default function ExploreFeedScreen() {
  const { id, media: mediaId } = useLocalSearchParams<{ id?: string; media?: string }>();
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { language } = useLanguage();
  const scrollRef = useRef<ScrollView>(null);
  const {
    authError,
    currentUser,
    findUser,
    isAuthenticated,
    isFavorite,
    joinListing,
    listings,
    partnerships,
    reviews,
    startConversation,
    toggleFavorite
  } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const [seed, setSeed] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  // Klavye açılınca yorum kutusunu klavyenin üstüne kaldır (ekran bozulmasın).
  const [kbInset, setKbInset] = useState(0);
  useEffect(() => {
    if (Platform.OS === "web") {
      if (typeof window === "undefined" || !window.visualViewport) return;
      const vv = window.visualViewport;
      const onResize = () => {
        const covered = window.innerHeight - vv.height - vv.offsetTop;
        setKbInset(covered > 90 ? Math.round(covered) : 0);
      };
      vv.addEventListener("resize", onResize);
      vv.addEventListener("scroll", onResize);
      return () => { vv.removeEventListener("resize", onResize); vv.removeEventListener("scroll", onResize); };
    }
    const show = Keyboard.addListener("keyboardDidShow", (e) => setKbInset(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKbInset(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const feed = useMemo(() => {
    const active = listings.filter((listing) => listing.status === "active").sort((a, b) => feedScore(b, seed) - feedScore(a, seed));
    const media = active.flatMap((listing) => listingMedia(listing));
    const exactMediaIndex = media.findIndex((item) => item.id === mediaId);
    const selectedIndex = exactMediaIndex >= 0 ? exactMediaIndex : media.findIndex((item) => item.listing.id === id);
    return selectedIndex >= 0 ? [...media.slice(selectedIndex), ...media.slice(0, selectedIndex)] : media;
  }, [id, listings, mediaId, seed]);

  useEffect(() => {
    if (feed.length <= 1 || Object.values(openComments).some(Boolean)) return;
    const timer = setTimeout(() => {
      const nextIndex = currentIndex + 1 >= feed.length ? 0 : currentIndex + 1;
      scrollRef.current?.scrollTo({ animated: true, y: nextIndex * height });
      setCurrentIndex(nextIndex);
    }, feed[currentIndex]?.type === "video" ? 9500 : 6500);

    return () => clearTimeout(timer);
  }, [currentIndex, feed, height, openComments]);

  function handleScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.y / height);
    setCurrentIndex(Math.max(0, Math.min(feed.length - 1, nextIndex)));
  }

  function becomePartner(listing: Listing) {
    if (!isAuthenticated) { router.push("/auth"); return; }
    const existing = partnerships.find((p) => p.listingId === listing.id && p.partnerId === currentUser.id);
    if (existing) { router.push(`/listing/${listing.id}`); return; } // zaten ortak → detay/panel
    if (listing.partnershipMode === "open") {
      // Anında ortaklık: gerçekten ortak yap, paylaşım linki hazır olsun.
      const created = joinListing(listing.id);
      if (created) {
        Alert.alert(
          translateCopy("Ortak oldun! 🎉", language),
          translateCopy("Paylaşım bağlantın hazır. Paylaş düğmesiyle linkini yay; senden gelen satışta komisyonu kazan.", language)
        );
      } else {
        Alert.alert(translateCopy("Ortak olunamadı", language), authError ?? translateCopy("Bu ilana şu an ortak olunamıyor.", language));
      }
    } else {
      // Onay gerektiren ilan: gerçek başvuru formu (kendi kitleni/erişimini girersin) ilan detayında.
      router.push(`/listing/${listing.id}`);
    }
  }

  function sendProductMessage(listing: Listing) {
    const owner = findUser(listing.ownerId);
    if (!owner || owner.id === currentUser.id) {
      router.push(`/listing/${listing.id}`);
      return;
    }
    const conversation = startConversation(listing.id, owner.id, `${listing.title} ${translateCopy("için bilgi almak istiyorum.", language)}`);
    if (conversation) router.push(`/chat/${conversation.id}`);
  }

  async function shareListing(listing: Listing) {
    // Aktif ortaksan referans (komisyon) linkini, değilsen temiz ürün linkini paylaş.
    // Ürünün OLMAYAN /i/{slug} referans formunu ref'siz paylaşmak anlamsızdı — düzeltildi.
    const mine = partnerships.find((p) => p.listingId === listing.id && p.partnerId === currentUser.id && p.status === "active");
    const url = mine ? shareUrl(listing, mine.refCode) : productUrl(listing);
    const message = mine
      ? `${listing.title}\n${money(listing.price)}\n${url}`
      : `${listing.title}\n${money(listing.price)}\n${translateCopy("OrtakSat'ta gör:", language)} ${url}`;
    try {
      await Share.share({ title: listing.title, message, url });
    } catch {
      // kullanıcı iptal etti / paylaşım desteklenmiyor
    }
  }

  function submitComment(listing: Listing) {
    const text = commentDrafts[listing.id]?.trim();
    if (!text) return;
    // Önceden bu kutu HERKESE her ürüne sabit 5 yıldız review yazdırıyordu (satıcı
    // puanını sahte şişiriyordu). Artık yorum/soru, satıcıya gerçek mesaj olarak gider.
    if (currentUser.id === "anon") { router.push("/auth"); return; }
    const owner = findUser(listing.ownerId);
    if (!owner || owner.id === currentUser.id) { router.push(`/listing/${listing.id}`); return; }
    const conversation = startConversation(listing.id, owner.id, text);
    setCommentDrafts((items) => ({ ...items, [listing.id]: "" }));
    if (conversation) router.push(`/chat/${conversation.id}`);
  }

  return (
    <View style={{ backgroundColor: "#000000", flex: 1 }}>
      <StatusBar style="light" />
      <ScrollView
        ref={scrollRef}
        decelerationRate="fast"
        pagingEnabled
        onMomentumScrollEnd={handleScrollEnd}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ backgroundColor: "#000000" }}
        style={{ backgroundColor: "#000000", flex: 1 }}
      >
      {feed.length === 0 ? (
        <View style={{ alignItems: "center", gap: 16, height, justifyContent: "center", paddingHorizontal: 32, width }}>
          <MaterialCommunityIcons name="movie-open-off-outline" size={48} color="rgba(255,255,255,0.7)" />
          <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "800", textAlign: "center" }}>{translateCopy("Şu an gösterilecek keşfet içeriği yok", language)}</Text>
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "600", textAlign: "center" }}>{translateCopy("Yeni ilanlar eklendikçe keşfet akışı burada canlanacak.", language)}</Text>
          <Pressable onPress={() => { if (router.canGoBack()) router.back(); else router.replace("/(tabs)/explore"); }} style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 999, flexDirection: "row", gap: 7, paddingHorizontal: 20, paddingVertical: 12 }}>
            <MaterialCommunityIcons name="chevron-left" size={20} color={colors.primaryDark} />
            <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{translateCopy("Keşfete dön", language)}</Text>
          </Pressable>
        </View>
      ) : null}
      {feed.map((item, index) => {
        const listing = item.listing;
        const owner = findUser(listing.ownerId);
        const existing = partnerships.find((partnership) => partnership.listingId === listing.id && partnership.partnerId === currentUser.id);
        const listingReviews = reviews.filter((review) => review.listingId === listing.id).slice(0, 3);
        const favorited = isFavorite(listing.id);
        const commentsOpen = Boolean(openComments[listing.id]);

        return (
          <View key={`${item.id}-${index}-${seed}`} style={{ backgroundColor: "#000000", height, overflow: "hidden", width }}>
            <FeedMediaView item={item} />
            <View style={{ backgroundColor: "rgba(0,0,0,0.24)", bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }} />

            <View style={{ left: 68, position: "absolute", right: 74, top: insets.top + 13 }}>
              <View style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 999, flexDirection: "row", gap: 6, maxWidth: "100%", paddingHorizontal: 10, paddingVertical: 7 }}>
                <MaterialCommunityIcons name={item.type === "video" ? "play-circle" : "image-multiple"} size={16} color={colors.primary} />
                <Text numberOfLines={1} selectable style={{ color: colors.ink, flexShrink: 1, fontSize: 12, fontWeight: "900" }}>
                  {translateCopy(item.type === "video" ? "Video keşfet" : "Görsel keşfet", language)}
                </Text>
              </View>
            </View>

            <Pressable
              accessibilityLabel={translateCopy("Keşfete dön", language)}
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace("/(tabs)/explore");
              }}
              style={({ pressed }) => ({
                alignItems: "center",
                backgroundColor: "rgba(255,255,255,0.92)",
                borderRadius: 999,
                height: 44,
                justifyContent: "center",
                left: 14,
                opacity: pressed ? 0.72 : 1,
                position: "absolute",
                top: insets.top + 8,
                width: 44
              })}
            >
              <MaterialCommunityIcons name="chevron-left" size={28} color={colors.primaryDark} />
            </Pressable>

            <View style={{ alignItems: "center", backgroundColor: "rgba(0,0,0,0.44)", borderRadius: 999, minWidth: 54, paddingHorizontal: 9, paddingVertical: 6, position: "absolute", right: 14, top: insets.top + 8 }}>
              <Text numberOfLines={1} selectable style={{ color: "#FFFFFF", fontSize: 11, fontVariant: ["tabular-nums"], fontWeight: "900" }}>
                {index + 1}/{feed.length}
              </Text>
            </View>

            <View style={{ bottom: insets.bottom + 18 + (commentsOpen ? kbInset : 0), gap: 10, left: 14, position: "absolute", right: 78 }}>
              <View style={{ gap: 5 }}>
                <Text selectable numberOfLines={2} style={{ color: "#FFFFFF", fontSize: 23, fontWeight: "900", lineHeight: 28 }}>
                  {listing.title}
                </Text>
                <Text selectable numberOfLines={commentsOpen ? 4 : 2} style={{ color: "#E6F8F4", fontSize: 13, fontWeight: "700", lineHeight: 19 }}>
                  {listing.description}
                </Text>
                <Pressable
                  onPress={() => owner && router.push({ pathname: "/store/[id]", params: { id: owner.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={translateCopy("Satıcı profilini gör", language)}
                  style={({ pressed }) => ({ alignItems: "center", flexDirection: "row", gap: 6, opacity: pressed ? 0.7 : 1 })}
                >
                  <MaterialCommunityIcons name="storefront-outline" size={14} color="#CFF8EC" />
                  <Text selectable numberOfLines={1} style={{ color: "#CFF8EC", flexShrink: 1, fontSize: 12, fontWeight: "900" }}>
                    {owner?.name ?? translateCopy("Satıcı", language)}
                    {owner && owner.rating > 0 ? ` · ${owner.rating.toFixed(1)} ${translateCopy("puan", language)}` : ` · ${translateCopy("Yeni satıcı", language)}`}
                    {` · ${listing.location} · ${translateCopy(listing.category, language)}`}
                  </Text>
                  <MaterialCommunityIcons name="chevron-right" size={14} color="#CFF8EC" />
                </Pressable>
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                <InfoPill label={money(listing.price)} icon="tag-outline" />
                <InfoPill label={`${translateCopy("Kazanç", language)} ${money(commissionAmount(listing))}`} icon="cash-plus" strong wide />
                <InfoPill label={`${listing.stockCount} ${translateCopy("stok", language)}`} icon="package-variant-closed" />
                <InfoPill label={listing.partnershipMode === "open" ? "Anında ortak" : "Onay gerekir"} icon="handshake-outline" wide />
              </View>

              {commentsOpen ? (
                <View style={{ backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 16, gap: 7, padding: 10 }}>
                  {listingReviews.length === 0 ? (
                    <Text selectable style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>
                      {translateCopy("Henüz yorum yok. İlk yorumu sen yaz.", language)}
                    </Text>
                  ) : (
                    listingReviews.map((review) => <ReviewLine key={review.id} review={review} />)
                  )}
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
                    <TextInput
                      value={commentDrafts[listing.id] ?? ""}
                      onChangeText={(value) => setCommentDrafts((items) => ({ ...items, [listing.id]: value }))}
                      autoFocus
                      returnKeyType="send"
                      onSubmitEditing={() => submitComment(listing)}
                      placeholder={translateCopy("Satıcıya mesaj yaz", language)}
                      placeholderTextColor={colors.muted}
                      style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 12, borderWidth: 1, color: colors.ink, flex: 1, fontSize: 13, fontWeight: "700", minHeight: 40, paddingHorizontal: 12 }}
                    />
                    <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Yorumu gönder", language)} onPress={() => submitComment(listing)} style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.primary, borderRadius: 12, height: 38, justifyContent: "center", opacity: pressed ? 0.72 : 1, width: 42 })}>
                      <MaterialCommunityIcons name="send" size={18} color="#FFFFFF" />
                    </Pressable>
                  </View>
                </View>
              ) : null}

              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={() => becomePartner(listing)}
                  style={({ pressed }) => ({
                    alignItems: "center",
                    backgroundColor: existing?.status === "active" ? colors.primarySoft : colors.primary,
                    borderRadius: 14,
                    flex: 1,
                    minHeight: 46,
                    justifyContent: "center",
                    opacity: pressed ? 0.75 : 1
                  })}
                >
                  <Text selectable style={{ color: existing?.status === "active" ? colors.primaryDark : "#FFFFFF", fontSize: 14, fontWeight: "900" }}>
                    {translateCopy(existing?.status === "active" ? "Bağlantı hazır" : existing?.status === "pending" ? "Onay bekliyor" : "Ortak ol", language)}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push(`/listing/${listing.id}`)}
                  style={({ pressed }) => ({
                    alignItems: "center",
                    backgroundColor: "rgba(255,255,255,0.92)",
                    borderRadius: 14,
                    minHeight: 46,
                    justifyContent: "center",
                    opacity: pressed ? 0.75 : 1,
                    width: 92
                  })}
                >
                  <Text selectable style={{ color: colors.ink, fontSize: 14, fontWeight: "900" }}>
                    {translateCopy("Detay", language)}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={{ bottom: insets.bottom + 132, gap: 15, position: "absolute", right: 14 }}>
              {/* Tek favori aksiyonu = KALP. Önceden kalp + ayrı 'Kaydet' vardı; ikisi de
                  aynı favoriyi tetikleyip birbirini değiştiriyordu (kafa karıştırıcı). */}
              <SideAction active={favorited} icon={favorited ? "heart" : "heart-outline"} label={favorited ? translateCopy("Favoride", language) : translateCopy("Favori", language)} a11y={favorited ? "Favoriden çıkar" : "Favorilere ekle"} onPress={() => { if (!isAuthenticated) { router.push("/auth"); return; } toggleFavorite(listing.id); }} />
              <SideAction icon="comment-text-outline" label={`${reviews.filter((review) => review.listingId === listing.id).length}`} a11y="Yorum yaz" onPress={() => setOpenComments((items) => ({ ...items, [listing.id]: !items[listing.id] }))} />
              <SideAction icon="message-text-outline" label="Mesaj" onPress={() => sendProductMessage(listing)} />
              <SideAction icon="share-variant" label="Paylaş" onPress={() => void shareListing(listing)} />
            </View>
          </View>
        );
      })}
      </ScrollView>
    </View>
  );
}

function FeedMediaView({ item }: { item: FeedMedia }) {
  if (item.type === "video") return <VideoPlayer uri={item.uri} />;
  return <Image source={{ uri: item.uri }} style={{ height: "100%", width: "100%" }} contentFit="cover" />;
}

function VideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.play();
  });

  return <VideoView player={player} nativeControls={false} contentFit="cover" style={{ height: "100%", width: "100%" }} />;
}

function InfoPill({ icon, label, strong, wide }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; strong?: boolean; wide?: boolean }) {
  const { language } = useLanguage();
  return (
    <View style={{ alignItems: "center", backgroundColor: strong ? colors.primarySoft : "rgba(255,255,255,0.9)", borderRadius: 999, flexDirection: "row", gap: 5, minWidth: wide ? 142 : 96, paddingHorizontal: 10, paddingVertical: 7 }}>
      <MaterialCommunityIcons name={icon} size={14} color={strong ? colors.primaryDark : colors.ink} />
      <Text selectable adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={{ color: strong ? colors.primaryDark : colors.ink, flexShrink: 1, fontSize: 12, fontWeight: "900" }}>
        {translateCopy(label, language)}
      </Text>
    </View>
  );
}

function ReviewLine({ review }: { review: Review }) {
  const { language } = useLanguage();
  return (
    <View style={{ gap: 2 }}>
      <Text selectable numberOfLines={1} style={{ color: colors.ink, fontSize: 12, fontWeight: "900" }}>
        {review.rating}/5 {translateCopy("yorum", language)}
      </Text>
      <Text selectable numberOfLines={2} style={{ color: colors.muted, fontSize: 12, fontWeight: "700", lineHeight: 16 }}>
        {review.comment}
      </Text>
    </View>
  );
}

function SideAction({ active, icon, label, a11y, onPress }: { active?: boolean; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; a11y?: string; onPress: () => void }) {
  const { language } = useLanguage();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={translateCopy(a11y ?? label, language)} onPress={onPress} style={({ pressed }) => ({ alignItems: "center", opacity: pressed ? 0.72 : 1 })}>
      <View style={{ alignItems: "center", backgroundColor: active ? colors.primary : "rgba(255,255,255,0.92)", borderRadius: 999, height: 46, justifyContent: "center", width: 46 }}>
        <MaterialCommunityIcons name={icon} size={22} color={active ? "#FFFFFF" : colors.primaryDark} />
      </View>
      <Text selectable adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "900", marginTop: 4, maxWidth: 56 }}>
        {translateCopy(label, language)}
      </Text>
    </Pressable>
  );
}

function listingMedia(listing: Listing): FeedMedia[] {
  const media = [listing.image, ...(listing.adAssets ?? [])].map((item) => item?.trim()).filter((item): item is string => Boolean(item));
  return Array.from(new Set(media)).map((uri, index) => ({
    id: `${listing.id}-media-${index}`,
    index,
    listing,
    poster: listing.image,
    type: isVideoUri(uri) ? "video" : "image",
    uri
  }));
}

function feedScore(listing: Listing, seed: number) {
  return listing.favoriteCount * 3 + listing.leadCount * 7 + listing.partnerCount * 5 + (((listing.id.charCodeAt(listing.id.length - 1) || 0) * 17 + seed * 31) % 97);
}

function isVideoUri(uri: string) {
  return /\.(mp4|mov|m4v|webm)(\?|$)/i.test(uri);
}

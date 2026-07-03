import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { Link, type Href, useLocalSearchParams, useRouter } from "expo-router";
import Head from "expo-router/head";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, Modal, Platform, Pressable, ScrollView, Share, Text, TextInput, View, useWindowDimensions } from "react-native";

import { Accordion } from "@/components/accordion";
import { AgreementCard } from "@/components/agreement-card";
import { colors } from "@/components/colors";
import { LegalNote } from "@/components/legal-disclaimer";
import { ListingCard } from "@/components/listing-card";
import { EarningsCalculator } from "@/components/earnings-calculator";
import { ListingQA } from "@/components/listing-qa";
import { ShareRow } from "@/components/share-row";
import { Skeleton } from "@/components/skeleton";
import { tokenize } from "@/lib/search";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { Card, EmptyState, Metric, PrimaryButton, StatusPill } from "@/components/ui";
import { commissionAmount, commissionText, listingShareTemplates, money, moneyIn, productUrl, shareUrl, trPhoneIntl } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useIsWideWeb } from "@/lib/layout";
import { WebContainer } from "@/components/web-container";
import { fetchListingById } from "@/lib/supabase-data";
import { isSupabaseConfigured } from "@/lib/supabase";
import { pushRecent } from "@/lib/recent";
import { calculateUserTrustScores } from "@/lib/trust-score";
import type { LeadSource, Listing, PartnershipStatus, PurchaseIntent, User } from "@/lib/types";
import { useStore } from "@/lib/use-store";

const sourceLabels: Record<LeadSource, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  web: "Web",
  phone: "Telefon"
};

const intentLabels: Record<PurchaseIntent, string> = {
  hot: "Sıcak",
  warm: "Ilık",
  cold: "Soğuk"
};

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { language } = useLanguage();
  const { width } = useWindowDimensions();
  const isWideWeb = useIsWideWeb();
  const {
    createLead,
    createSaleReview,
    canReviewSale,
    authError,
    currentUser,
    findListing,
    findPartnership,
    findUser,
    isFavorite,
    joinListing,
    reportListing,
    reviews,
    sales,
    leads,
    listings,
    partnerships,
    reports,
    startConversation,
    toggleFavorite
  } = useStore();
  const storeListing = findListing(id);
  const [remote, setRemote] = useState<{ listing: Listing; owner?: User } | null>(null);
  const [fetching, setFetching] = useState(false);
  const [applicationNote, setApplicationNote] = useState("");
  const [applicationChannel, setApplicationChannel] = useState("Instagram ve WhatsApp");
  const [applicationAudience, setApplicationAudience] = useState("Aileler, yakın çevrem ve sosyal medya takipçilerim");
  const [applicationHandle, setApplicationHandle] = useState("");
  const [applicationReach, setApplicationReach] = useState("250");
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [leadNote, setLeadNote] = useState("");
  const [leadSource, setLeadSource] = useState<LeadSource>("whatsapp");
  const [purchaseIntent, setPurchaseIntent] = useState<PurchaseIntent>("warm");
  const [message, setMessage] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [activeImage, setActiveImage] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const swipeStartX = useRef(0);
  const router = useRouter();

  // Lightbox açıkken web'de klavye: ← → gezinme, Esc kapatma.
  useEffect(() => {
    if (!lightbox || Platform.OS !== "web" || typeof window === "undefined") return;
    const l = storeListing ?? remote?.listing;
    const n = l ? [l.image, ...(l.adAssets ?? [])].filter(Boolean).length : 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false);
      else if (e.key === "ArrowRight" && n > 1) { setActiveImage((i) => (i + 1) % n); setZoomed(false); }
      else if (e.key === "ArrowLeft" && n > 1) { setActiveImage((i) => (i - 1 + n) % n); setZoomed(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, storeListing, remote?.listing?.id]);

  // Paylaşılan link herkeste açılsın: ilan bellekte yoksa Supabase'den id ile çek.
  useEffect(() => {
    let active = true;
    if (storeListing || !id || !isSupabaseConfigured) return;
    setFetching(true);
    fetchListingById(id)
      .then((res) => {
        if (active) setRemote(res);
      })
      .finally(() => {
        if (active) setFetching(false);
      });
    return () => {
      active = false;
    };
  }, [id, storeListing]);

  const listing = storeListing ?? remote?.listing;

  // Son gezilen ilanları kaydet — "Son Gezdiklerin" için.
  useEffect(() => {
    if (listing?.id) pushRecent(listing.id);
  }, [listing?.id]);

  if (!listing) {
    if (fetching) {
      return (
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 14, padding: 16 }}>
          <View style={{ alignSelf: "center", gap: 14, maxWidth: 1000, width: "100%" }}>
            <Skeleton style={{ borderRadius: 16, height: 300, width: "100%" }} />
            <Skeleton style={{ height: 14, width: "35%" }} />
            <Skeleton style={{ height: 26, width: "80%" }} />
            <Skeleton style={{ height: 30, width: "40%" }} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Skeleton style={{ borderRadius: 12, flex: 1, height: 70 }} />
              <Skeleton style={{ borderRadius: 12, flex: 1, height: 70 }} />
            </View>
            <Skeleton style={{ borderRadius: 12, height: 48, width: "100%" }} />
            <Skeleton style={{ height: 14, width: "90%" }} />
            <Skeleton style={{ height: 14, width: "75%" }} />
          </View>
        </ScrollView>
      );
    }
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ alignItems: "center", flexGrow: 1, justifyContent: "center", padding: 24 }}>
        <EmptyState title="İlan bulunamadı" body="Bu ilan kaldırılmış, satılmış ya da bağlantı artık geçerli değil." />
      </ScrollView>
    );
  }

  const currentListing = listing;
  const gallery = [currentListing.image, ...(currentListing.adAssets ?? [])].filter(Boolean);
  const galleryIdx = Math.min(activeImage, Math.max(0, gallery.length - 1));
  const owner = findUser(currentListing.ownerId) ?? remote?.owner;
  const ownerTrust = owner ? calculateUserTrustScores({ leads, listings, partnerships, reports, reviews, sales, user: owner }).seller : undefined;
  const partnership = findPartnership(currentListing.id);
  const activeShareUrl = partnership?.status === "active" ? shareUrl(currentListing, partnership.refCode) : undefined;
  const isOwner = currentListing.ownerId === currentUser.id;
  const isDemo = Boolean(currentListing.demo);
  function demoBlocked() {
    Alert.alert("Örnek ilan", "Bu bir örnek (vitrin) ilandır; yalnızca platformun nasıl göründüğünü göstermek içindir. Mesajlaşma, iletişim ve ortaklık bu ilanda kapalıdır.");
  }
  const listingReviews = reviews.filter((item) => item.listingId === currentListing.id);
  const favorited = isFavorite(currentListing.id);
  const commission = commissionAmount(currentListing);
  const reviewableSale = sales.find((sale) => sale.listingId === currentListing.id && canReviewSale(sale.id));
  const activeTemplates = listingShareTemplates(currentListing, activeShareUrl);
  const relatedCardWidth = Math.max(148, Math.min(176, Math.floor((width - 34) / 2)));
  const sellerOtherListings = listings
    .filter((item) => item.ownerId === currentListing.ownerId && item.id !== currentListing.id && item.status === "active")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);
  // Benzerlik: aynı kategori (güçlü sinyal) + başlık/etiket terim örtüşmesi + popülerlik.
  const meTerms = new Set(tokenize(`${currentListing.title} ${currentListing.tags.join(" ")}`));
  const similarListings = listings
    .filter((item) => item.ownerId !== currentListing.ownerId && item.status === "active" && item.id !== currentListing.id)
    .map((item) => {
      const terms = tokenize(`${item.title} ${item.tags.join(" ")}`);
      let overlap = 0;
      for (const term of terms) if (meTerms.has(term)) overlap += 1;
      const sameCat = item.category === currentListing.category ? 2.5 : 0;
      const pop = (item.leadCount + item.partnerCount) * 0.002;
      return { item, s: overlap * 1.5 + sameCat + pop };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 8)
    .map((x) => x.item);

  function handleJoin() {
    if (isDemo) return demoBlocked();
    const result = joinListing(currentListing.id, {
      note: applicationNote.trim(),
      shareChannel: applicationChannel.trim(),
      audience: applicationAudience.trim(),
      platformHandle: applicationHandle.trim(),
      reachEstimate: Number(applicationReach)
    });
    if (!result) {
      Alert.alert(translateCopy("İşlem yapılamadı", language), translateCopy(authError ?? "Kendi ilanına ortak olamazsın veya ilan aktif olmayabilir.", language));
      return;
    }
    Alert.alert(translateCopy(result.status === "active" ? "Ortaklık aktif" : "Başvuru gönderildi", language), translateCopy(result.status === "active" ? "Paylaşım bağlantın hazır." : "Satıcı kabul edince bağlantın aktif olacak.", language));
  }

  async function handleShare() {
    // Ortak aktif paylaşımıysa referans linki (komisyon takibi), değilse düz ürün linki.
    const url = activeShareUrl ?? productUrl(currentListing);
    await Share.share({ title: currentListing.title, message: `${currentListing.title}\n${moneyIn(currentListing.price, currentListing.currency)}\n${url}`, url });
  }

  async function copyText(label: string, text: string) {
    await Clipboard.setStringAsync(text);
    Alert.alert(translateCopy("Kopyalandı", language), translateCopy(`${label} panoya kopyalandı.`, language));
  }

  async function openShareTarget(target: "whatsapp" | "telegram") {
    if (!activeShareUrl) return;
    const text = encodeURIComponent(`${activeTemplates.whatsapp}\n${activeShareUrl}`);
    const url = target === "whatsapp" ? `https://wa.me/?text=${text}` : `https://t.me/share/url?url=${encodeURIComponent(activeShareUrl)}&text=${text}`;
    await Linking.openURL(url);
  }

  async function handleContact() {
    if (isDemo) return demoBlocked();
    if (!owner) return;
    const waPhone = trPhoneIntl(owner.phone);
    if (currentListing.contactMethod === "whatsapp") {
      // Numara uluslararası formata çevrilebiliyorsa WhatsApp'a git; değilse mesaja düş.
      if (waPhone) { await Linking.openURL(`https://wa.me/${waPhone}?text=${encodeURIComponent(`${currentListing.title} ilanı hakkında bilgi almak istiyorum.`)}`); return; }
    } else if (currentListing.contactMethod === "phone") {
      const tel = owner.phone.replace(/[^0-9+]/g, "");
      if (tel) { await Linking.openURL(`tel:${tel}`); return; }
    }
    const fallbackMessage = `${currentListing.title} ilanı için bilgi almak istiyorum. Fiyat, stok ve teslimat detayları güncel mi?`;
    const conversation = startConversation(currentListing.id, owner.id, message.trim() || fallbackMessage);
    setMessage("");
    if (conversation) router.push({ pathname: "/chat/[id]", params: { id: conversation.id } });
  }

  function handlePartnershipMessage() {
    if (isDemo) return demoBlocked();
    if (!owner) return;
    const conversation = startConversation(currentListing.id, owner.id, `${currentListing.title} için ortaklık başvurumu ve satış detaylarını konuşmak istiyorum.`);
    if (conversation) router.push({ pathname: "/chat/[id]", params: { id: conversation.id } });
  }

  function handleCreateLead() {
    if (!partnership || partnership.status !== "active") return;
    if (!buyerName.trim() || !buyerPhone.trim()) {
      Alert.alert(translateCopy("Eksik bilgi", language), translateCopy("Alıcı adı ve telefonu gerekli.", language));
      return;
    }
    const created = createLead({
      listingId: currentListing.id,
      partnershipId: partnership.id,
      buyerName: buyerName.trim(),
      buyerPhone: buyerPhone.trim(),
      source: leadSource,
      intent: purchaseIntent,
      note: leadNote.trim() || "Ortak paylaşımından gelen talep."
    });
    if (!created) {
      Alert.alert(translateCopy("Talep açılamadı", language), translateCopy(authError ?? "İlan pasif olabilir veya ortaklık bağlantısı aktif değildir.", language));
      return;
    }
    setBuyerName("");
    setBuyerPhone("");
    setLeadNote("");
    Alert.alert(translateCopy("Talep kaydedildi", language), translateCopy("Satıcı paneline ve ortak paneline işlendi.", language));
  }

  function handleSaleReview() {
    if (!reviewableSale) return;
    const created = createSaleReview(reviewableSale.id, reviewRating, reviewComment);
    if (!created) {
      Alert.alert(translateCopy("Yorum eklenemedi", language), translateCopy("Yorum için tamamlanmış satış ve tekil yorum hakkı gerekli.", language));
      return;
    }
    setReviewComment("");
    Alert.alert(translateCopy("Yorum eklendi", language), translateCopy("Puan ve yorum güven alanında görünecek.", language));
  }

  async function handleReport() {
    const ok = await reportListing(currentListing.id, "İlan güvenliği", `${currentListing.title} ilanı kullanıcı tarafından incelemeye gönderildi.`);
    Alert.alert(translateCopy(ok ? "Bildirim alındı" : "Giriş gerekli", language), translateCopy(ok ? "Moderasyon ekibi bu ilanı inceleyecek." : "İlan bildirmek için e-posta ile giriş yapmalısın.", language));
  }

  const metaDesc = `${currentListing.title} — ${moneyIn(currentListing.price, currentListing.currency)}. ${currentListing.description}`.replace(/\s+/g, " ").slice(0, 160);
  const metaUrl = `https://ortaksat.com/listing/${currentListing.id}`;
  // JSON-LD Product şeması — Google zengin sonuç (fiyat, stok, kategori) için.
  const productLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    name: currentListing.title,
    image: [currentListing.image, ...(currentListing.adAssets ?? [])].filter(Boolean).slice(0, 5),
    description: metaDesc,
    category: currentListing.category,
    offers: {
      "@type": "Offer",
      price: currentListing.price,
      priceCurrency: currentListing.currency ?? "TRY",
      availability: currentListing.stockCount > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: metaUrl
    }
  });

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 12, paddingBottom: 96 }}>
      <Head>
        <title>{`${currentListing.title} — OrtakSat`}</title>
        <meta name="description" content={metaDesc} />
        <link rel="canonical" href={metaUrl} />
        <meta property="og:type" content="product" />
        <meta property="og:title" content={`${currentListing.title} — OrtakSat`} />
        <meta property="og:description" content={metaDesc} />
        <meta property="og:image" content={currentListing.image} />
        <meta property="og:url" content={metaUrl} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${currentListing.title} — OrtakSat`} />
        <meta name="twitter:description" content={metaDesc} />
        <meta name="twitter:image" content={currentListing.image} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: productLd }} />
      </Head>
      <WebContainer max={1200} padding={0} style={{ gap: 16 }}>
      {/* Breadcrumb: Ana Sayfa › Kategori › Ürün */}
      <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 4, marginHorizontal: isWideWeb ? 0 : 12 }}>
        <Link href="/" asChild><Pressable><Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>Ana Sayfa</Text></Pressable></Link>
        <MaterialCommunityIcons name="chevron-right" size={14} color={colors.subtle} />
        <Link href="/kategoriler" asChild><Pressable><Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>{currentListing.category}</Text></Pressable></Link>
        <MaterialCommunityIcons name="chevron-right" size={14} color={colors.subtle} />
        <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "800", minWidth: 0 }}>{currentListing.title}</Text>
      </View>
      {isDemo ? (
        <View style={{ alignItems: "center", backgroundColor: "#FEF7DC", borderColor: "#F5C518", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 10, marginHorizontal: isWideWeb ? 0 : 12, padding: 13 }}>
          <View style={{ alignItems: "center", backgroundColor: "#F5C518", borderRadius: 999, height: 34, justifyContent: "center", width: 34 }}>
            <MaterialCommunityIcons name="eye-outline" size={19} color="#1A1A00" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "900" }}>Örnek (vitrin) ilan</Text>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 16 }}>Bu ilan yalnızca platformun nasıl göründüğünü göstermek içindir. Mesajlaşma, iletişim ve ortaklık kapalıdır.</Text>
          </View>
        </View>
      ) : null}
      <View style={isWideWeb ? { flexDirection: "row", gap: 20, alignItems: "flex-start" } : { gap: 12 }}>
      <View style={isWideWeb ? { flex: 1.12, minWidth: 0 } : undefined}>
      {(() => {
        const mainImg = gallery[galleryIdx] ?? currentListing.image;
        return (
          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: isWideWeb ? 18 : 0, borderWidth: isWideWeb ? 1 : 0, marginTop: isWideWeb ? 16 : 0, overflow: "hidden" }}>
            <Pressable onPress={() => setLightbox(true)} style={{ position: "relative" }}>
              <SafeRemoteImage uri={mainImg} style={{ backgroundColor: colors.line, height: isWideWeb ? 520 : 330, width: "100%" }} contentFit="cover" />
              <View style={{ alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 999, bottom: 12, flexDirection: "row", gap: 5, paddingHorizontal: 11, paddingVertical: 6, position: "absolute", right: 12 }}>
                <MaterialCommunityIcons name="magnify-plus-outline" size={14} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 11.5, fontWeight: "800" }}>Büyüt{gallery.length > 1 ? ` · ${galleryIdx + 1}/${gallery.length}` : ""}</Text>
              </View>
            </Pressable>
            {gallery.length > 1 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 12, paddingTop: 12 }}>
                {gallery.map((img, i) => (
                  <Pressable key={img + i} onPress={() => setActiveImage(i)} style={{ borderColor: i === galleryIdx ? colors.primary : colors.line, borderRadius: 10, borderWidth: i === galleryIdx ? 2 : 1, height: 64, overflow: "hidden", width: 64 }}>
                    <SafeRemoteImage uri={img} style={{ height: "100%", width: "100%" }} contentFit="cover" />
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View style={{ flexDirection: "row", gap: 8, padding: 12 }}>
              <IconButton active={favorited} icon={favorited ? "heart" : "heart-outline"} label="Beğen" onPress={() => toggleFavorite(currentListing.id)} />
              <IconButton icon="share-variant-outline" label="Paylaş" onPress={() => void handleShare()} />
              {!isOwner ? <IconButton icon="flag-outline" label="Bildir" onPress={() => void handleReport()} /> : null}
            </View>
          </View>
        );
      })()}
      </View>

      <View style={isWideWeb ? { flex: 1, gap: 12, minWidth: 0, marginTop: 16 } : { gap: 12, paddingHorizontal: 12 }}>
        <Card>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <StatusPill label={currentListing.category} />
            <StatusPill label={currentListing.partnershipMode === "open" ? "Anında ortaklık" : "Satıcı onaylı"} tone={currentListing.partnershipMode === "open" ? "success" : "warning"} />
            <StatusPill label={currentListing.status === "active" ? "Aktif" : "Pasif"} tone={currentListing.status === "active" ? "success" : "warning"} />
          </View>

          <Text selectable style={{ color: colors.ink, fontSize: 24, fontWeight: "900", lineHeight: 30 }}>
            {currentListing.title}
          </Text>
          <Text selectable style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
            {currentListing.description}
          </Text>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <Metric label="Fiyat" value={moneyIn(currentListing.price, currentListing.currency)} />
            <Metric label="Ortak kazancı" value={moneyIn(commission, currentListing.currency)} />
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Metric label="Stok" value={`${currentListing.stockCount}`} />
            <Metric label="Ortak" value={`${currentListing.partnerCount}`} />
            <Metric label="Beğeni" value={`${currentListing.favoriteCount}`} />
          </View>
        </Card>

        {!isOwner ? <EarningsCalculator listing={currentListing} isDemo={isDemo} onJoin={handleJoin} /> : null}

        {!isDemo ? (
          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 9, padding: 14 }}>
            <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "900" }}>Bu ürünü paylaş</Text>
            <ShareRow url={productUrl(currentListing)} text={`${currentListing.title} — ${moneyIn(currentListing.price, currentListing.currency)}`} />
          </View>
        ) : null}

        <ListingDecisionCard
          listing={currentListing}
          commission={commission}
          ownerTrustScore={ownerTrust?.score}
          partnershipStatus={partnership?.status}
        />

        <ListingActionCard
          activeShareUrl={activeShareUrl}
          contactMethod={currentListing.contactMethod}
          isOwner={isOwner}
          listing={currentListing}
          onContact={() => void handleContact()}
          onJoin={handleJoin}
          onMessageSeller={handlePartnershipMessage}
          onShare={() => void handleShare()}
          partnershipStatus={partnership?.status}
        />

        <AgreementCard listing={currentListing} partnership={partnership} />
      </View>
      </View>

      <View style={{ gap: 12, paddingHorizontal: isWideWeb ? 0 : 12 }}>
        <Card>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
            <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 8, height: 46, justifyContent: "center", width: 46 }}>
              <Text selectable style={{ color: colors.primaryDark, fontSize: 16, fontWeight: "900" }}>{owner?.avatar ?? "S"}</Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text selectable numberOfLines={1} style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{owner?.name ?? "Satıcı"}</Text>
              <Text selectable numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>
                {owner?.rating ?? 0} puan · %{owner?.responseRate ?? 0} yanıt · {owner?.successfulSales ?? 0} satış
              </Text>
            </View>
          </View>
          {ownerTrust ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Metric label="Satıcı güveni" value={`%${ownerTrust.score}`} />
              <Metric label="Durum" value={ownerTrust.label} />
            </View>
          ) : null}
          {!isOwner && currentListing.contactMethod === "message" ? <Field label="Satıcıya mesaj" value={message} onChangeText={setMessage} multiline /> : null}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              {!isOwner ? <PrimaryButton icon={currentListing.contactMethod === "whatsapp" ? "whatsapp" : currentListing.contactMethod === "phone" ? "phone" : "message-text-outline"} onPress={() => void handleContact()}>{contactLabel(currentListing.contactMethod)}</PrimaryButton> : <PrimaryButton href="/(tabs)/seller" tone="secondary" icon="storefront-outline">Satıcı panelinde yönet</PrimaryButton>}
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton href={{ pathname: "/store/[id]", params: { id: currentListing.ownerId } }} tone="secondary" icon="store-search-outline">Mağaza</PrimaryButton>
            </View>
          </View>
        </Card>

        <Card>
          <Text selectable style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{translateCopy("Ortak satış", language)}</Text>
          <Text selectable style={{ color: colors.primaryDark, fontSize: 16, fontWeight: "900" }}>
            {commissionText(currentListing)} · {moneyIn(commission, currentListing.currency)} {translateCopy("tahmini kazanç", language)}
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Metric label="Vade" value={`${currentListing.commissionDueDays} gün`} />
            <Metric label="İade" value={`${currentListing.returnWindowDays} gün`} />
            <Metric label="Min. puan" value={`${currentListing.minPartnerRating}+`} />
          </View>
          <View style={{ backgroundColor: colors.primarySoft, borderRadius: 8, gap: 6, padding: 10 }}>
            <Bullet icon="handshake-outline" text={partnershipModeDescription(currentListing.partnershipMode)} tone="info" />
            <Bullet icon="link-variant" text="Onay sonrası özel bağlantın açılır; alıcı talebi o bağlantıdan doğru ortağa bağlanır." tone="info" />
            <Bullet icon="cash-check" text="Satıcı satışı onaylar, iade penceresi biter, komisyon uygulama dışında ödenir ve iki tarafça takip edilir." tone="info" />
          </View>
          <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>{translateCopy("Teslimat", language)}: {translateCopy(currentListing.deliveryNote, language)}</Text>
          {currentListing.salesPitch.slice(0, 3).map((pitch) => <Bullet key={pitch} icon="check-circle" text={pitch} tone="success" />)}
        </Card>

        <PartnerSaleTimeline listing={currentListing} partnershipStatus={partnership?.status} />

        {!isOwner ? (
          <PartnershipBox
            listing={currentListing}
            status={partnership?.status}
            activeShareUrl={activeShareUrl}
            applicationNote={applicationNote}
            setApplicationNote={setApplicationNote}
            applicationChannel={applicationChannel}
            setApplicationChannel={setApplicationChannel}
            applicationAudience={applicationAudience}
            setApplicationAudience={setApplicationAudience}
            applicationHandle={applicationHandle}
            setApplicationHandle={setApplicationHandle}
            applicationReach={applicationReach}
            setApplicationReach={setApplicationReach}
            handleJoin={handleJoin}
            handleShare={handleShare}
            copyText={copyText}
            openShareTarget={openShareTarget}
            mode={currentListing.partnershipMode}
            onMessageSeller={handlePartnershipMessage}
          />
        ) : null}

        {partnership?.status === "active" ? (
          <Card>
            <Text selectable style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{translateCopy("Alıcı talebi", language)}</Text>
            <Field label="Alıcı adı" value={buyerName} onChangeText={setBuyerName} />
            <Field label="Telefon" value={buyerPhone} onChangeText={setBuyerPhone} />
            <ChoiceRow<LeadSource> value={leadSource} setValue={setLeadSource} options={["whatsapp", "instagram", "web", "phone"]} labels={sourceLabels} />
            <ChoiceRow<PurchaseIntent> value={purchaseIntent} setValue={setPurchaseIntent} options={["hot", "warm", "cold"]} labels={intentLabels} />
            <Field label="Not" value={leadNote} onChangeText={setLeadNote} multiline />
            <PrimaryButton icon="account-plus-outline" onPress={handleCreateLead}>Talebi kaydet</PrimaryButton>
          </Card>
        ) : null}

        <Card>
          <Text selectable style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{translateCopy("Kurallar ve güven", language)}</Text>
          {currentListing.partnerRules.slice(0, 4).map((rule) => <Bullet key={rule} icon="shield-check-outline" text={rule} tone="info" />)}
        </Card>

        <View style={{ gap: 10 }}>
          <Accordion title="Ürün açıklaması" icon="text-box-outline" defaultOpen>
            <Text selectable style={{ color: colors.ink, fontSize: 14, fontWeight: "500", lineHeight: 22 }}>{currentListing.description}</Text>
            {currentListing.salesPitch.slice(0, 4).map((line) => (
              <Bullet key={line} icon="check-circle-outline" text={line} tone="info" />
            ))}
          </Accordion>
          <Accordion title="Ürün özellikleri" icon="format-list-bulleted">
            <SpecRow label="Kategori" value={currentListing.category} />
            <SpecRow label="Konum" value={currentListing.location} />
            <SpecRow label="Stok" value={`${currentListing.stockCount} adet`} />
            <SpecRow label="Komisyon" value={currentListing.commissionType === "rate" ? `%${currentListing.commissionValue}` : moneyIn(commission, currentListing.currency)} />
            <SpecRow label="Ortaklık" value={currentListing.partnershipMode === "open" ? "Anında ortaklık" : "Satıcı onaylı"} />
            <SpecRow label="İletişim" value={contactLabel(currentListing.contactMethod)} />
          </Accordion>
          <Accordion title="Teslimat ve iade" icon="truck-outline">
            <Text selectable style={{ color: colors.ink, fontSize: 14, fontWeight: "500", lineHeight: 22 }}>
              Teslimat ve ödeme, satıcı ile alıcı arasında {contactLabel(currentListing.contactMethod).toLocaleLowerCase("tr-TR")} üzerinden kararlaştırılır. İade ve değişim koşullarını satışı kapatmadan önce satıcıyla netleştir.
            </Text>
            <LegalNote style={{ marginTop: 8 }} />
          </Accordion>
          <Accordion title="Sıkça sorulan sorular" icon="comment-question-outline">
            <SpecRow label="Komisyonu kim öder?" value="İlan sahibi, satış gerçekleştiğinde ortağa öder." />
            <SpecRow label="Ortak olmak ücretli mi?" value="Hayır, ortaklık ücretsizdir." />
            <SpecRow label="Süreç güvenli mi?" value="Komisyon şartı ve talepler sistemde kayıt altındadır." />
          </Accordion>
        </View>

        <ListingQA listingId={currentListing.id} isOwner={isOwner} isDemo={isDemo} />

        <RelatedListingsSection
          cardWidth={relatedCardWidth}
          listings={sellerOtherListings}
          ownersById={(ownerId) => findUser(ownerId)}
          title={translateCopy("Satıcının diğer ürünleri", language)}
          actionLabel={translateCopy("Mağazayı aç", language)}
          actionHref={{ pathname: "/store/[id]", params: { id: currentListing.ownerId } }}
          emptyText={translateCopy("Bu satıcının başka aktif ürünü yok.", language)}
        />

        <RelatedListingsSection
          cardWidth={relatedCardWidth}
          listings={similarListings}
          ownersById={(ownerId) => findUser(ownerId)}
          title={translateCopy("Benzer ürünler", language)}
          emptyText={translateCopy("Bu kategoride başka aktif ürün yok.", language)}
        />

        <Card>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <Text selectable style={{ color: colors.ink, flex: 1, fontSize: 18, fontWeight: "900" }}>{translateCopy("Yorumlar", language)}</Text>
            <Text selectable style={{ color: colors.muted, fontSize: 12, fontWeight: "900" }}>{listingReviews.length}</Text>
          </View>
          {reviewableSale ? (
            <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, gap: 10, padding: 10 }}>
              <Text selectable style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>{translateCopy("Satış sonrası yorum hakkın var", language)}</Text>
              <View style={{ flexDirection: "row", gap: 6 }}>{[5, 4, 3].map((rating) => (<Pressable key={rating} onPress={() => setReviewRating(rating)} style={({ pressed }) => ({ alignItems: "center", backgroundColor: reviewRating === rating ? colors.primarySoft : colors.surface, borderColor: reviewRating === rating ? colors.primary : colors.line, borderRadius: 8, borderWidth: 1, flex: 1, minHeight: 38, justifyContent: "center", opacity: pressed ? 0.74 : 1 })}><Text selectable style={{ color: reviewRating === rating ? colors.primaryDark : colors.ink, fontSize: 12, fontWeight: "900" }}>{rating} {translateCopy("yıldız", language)}</Text></Pressable>))}</View>
              <Field label="Yorum" value={reviewComment} onChangeText={setReviewComment} multiline />
              <PrimaryButton tone="secondary" icon="star-outline" onPress={handleSaleReview}>Yorumu kaydet</PrimaryButton>
            </View>
          ) : null}
          {listingReviews.length === 0 ? (
            <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>
              {translateCopy("Bu ürün için henüz yorum yok.", language)}
            </Text>
          ) : null}
          {listingReviews.map((item) => {
            const reviewer = findUser(item.reviewerId);
            return (
              <View key={item.id} style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, gap: 5, padding: 10 }}>
                <Text selectable style={{ color: colors.ink, fontSize: 14, fontWeight: "900" }}>{reviewer?.name ?? "Kullanıcı"} · {item.rating}/5</Text>
                <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>{item.comment}</Text>
              </View>
            );
          })}
        </Card>
      </View>
      </WebContainer>

      {/* Tam ekran görsel (lightbox) */}
      <Modal visible={lightbox} transparent animationType="fade" onRequestClose={() => { setLightbox(false); setZoomed(false); }}>
        <View style={{ backgroundColor: "rgba(0,0,0,0.92)", flex: 1, justifyContent: "center" }}>
          <Pressable accessibilityLabel="Kapat" onPress={() => { setLightbox(false); setZoomed(false); }} style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999, height: 42, justifyContent: "center", position: "absolute", right: 18, top: 18, width: 42, zIndex: 5 }}>
            <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
          </Pressable>
          <Pressable
            onPress={() => setZoomed((z) => !z)}
            accessibilityRole="imagebutton"
            accessibilityLabel={zoomed ? "Uzaklaştır" : "Yakınlaştır"}
            onTouchStart={(e) => { swipeStartX.current = e.nativeEvent.pageX; }}
            onTouchEnd={(e) => {
              const dx = e.nativeEvent.pageX - swipeStartX.current;
              if (!zoomed && Math.abs(dx) > 50 && gallery.length > 1) {
                setActiveImage((dx < 0 ? galleryIdx + 1 : galleryIdx - 1 + gallery.length) % gallery.length);
              }
            }}
            style={{ alignItems: "center", height: "78%", justifyContent: "center", overflow: "hidden", width: "100%" }}
          >
            <SafeRemoteImage
              uri={gallery[galleryIdx] ?? currentListing.image}
              style={{ height: "100%", transform: [{ scale: zoomed ? 2.2 : 1 }], width: "100%" }}
              contentFit="contain"
            />
          </Pressable>
          <View style={{ alignItems: "center", bottom: 74, left: 0, position: "absolute", right: 0 }}>
            <View style={{ backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "700" }}>{zoomed ? "Uzaklaştırmak için dokun" : "Yakınlaştırmak için dokun · kaydırarak gez"}</Text>
            </View>
          </View>
          {gallery.length > 1 ? (
            <>
              <Pressable accessibilityLabel="Önceki görsel" onPress={() => { setActiveImage((galleryIdx - 1 + gallery.length) % gallery.length); setZoomed(false); }} style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999, height: 48, justifyContent: "center", left: 14, position: "absolute", top: "46%", width: 48 }}>
                <MaterialCommunityIcons name="chevron-left" size={30} color="#FFFFFF" />
              </Pressable>
              <Pressable accessibilityLabel="Sonraki görsel" onPress={() => { setActiveImage((galleryIdx + 1) % gallery.length); setZoomed(false); }} style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999, height: 48, justifyContent: "center", position: "absolute", right: 14, top: "46%", width: 48 }}>
                <MaterialCommunityIcons name="chevron-right" size={30} color="#FFFFFF" />
              </Pressable>
              <View style={{ alignItems: "center", bottom: 26, flexDirection: "row", gap: 8, justifyContent: "center", left: 0, position: "absolute", right: 0 }}>
                {gallery.map((_, i) => (
                  <Pressable key={i} onPress={() => setActiveImage(i)} style={{ backgroundColor: i === galleryIdx ? "#FFFFFF" : "rgba(255,255,255,0.4)", borderRadius: 999, height: 8, width: i === galleryIdx ? 22 : 8 }} />
                ))}
              </View>
            </>
          ) : null}
        </View>
      </Modal>
    </ScrollView>
  );
}

function contactLabel(method: "whatsapp" | "phone" | "message") {
  if (method === "whatsapp") return "WhatsApp ile iletişim";
  if (method === "phone") return "Satıcıyı ara";
  return "Mesaj gönder";
}

function partnershipModeDescription(mode: Listing["partnershipMode"]) {
  if (mode === "open") return "Bu ürün anında ortaklığa açık; başvurunca bağlantın hemen hazır olur.";
  if (mode === "approval") return "Bu üründe satıcı onayı gerekir; satıcı başvurunu görür, uygun bulursa ortaklık açılır.";
  return "Bu ürün davetli ortaklığa açık; satıcı sadece seçtiği ortaklarla çalışır.";
}

function PartnerSaleTimeline({ listing, partnershipStatus }: { listing: Listing; partnershipStatus?: PartnershipStatus }) {
  const { language } = useLanguage();
  const steps = [
    {
      active: true,
      icon: "store-plus-outline" as const,
      title: "İlan yayında",
      body: `${listing.stockCount} ${translateCopy("stok", language)} · ${commissionText(listing)}`
    },
    {
      active: partnershipStatus === "pending" || partnershipStatus === "active",
      icon: "account-check-outline" as const,
      title: partnershipStatus === "active" ? "Ortaklık onaylandı" : partnershipStatus === "pending" ? "Onay bekliyor" : "Ortaklık başvurusu",
      body: listing.partnershipMode === "open" ? "Anında bağlantı açılır." : "Satıcı uygun ortağı onaylar."
    },
    {
      active: partnershipStatus === "active",
      icon: "share-variant-outline" as const,
      title: "Paylaşım ve talep",
      body: "Alıcı linkten gelirse talep doğru ortağa bağlanır."
    },
    {
      active: false,
      icon: "cash-check" as const,
      title: "Komisyon kapanışı",
      body: `${listing.returnWindowDays} gün iade · ${listing.commissionDueDays} gün ödeme vadesi`
    }
  ];

  return (
    <Card>
      <Text selectable style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{translateCopy("Ortak satış akışı", language)}</Text>
      <View style={{ gap: 8 }}>
        {steps.map((step, index) => (
          <View key={step.title} style={{ alignItems: "flex-start", flexDirection: "row", gap: 9 }}>
            <View style={{ alignItems: "center", gap: 4 }}>
              <View style={{ alignItems: "center", backgroundColor: step.active ? colors.primary : colors.surfaceAlt, borderColor: step.active ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, height: 30, justifyContent: "center", width: 30 }}>
                <MaterialCommunityIcons name={step.icon} size={16} color={step.active ? "#FFFFFF" : colors.muted} />
              </View>
              {index < steps.length - 1 ? <View style={{ backgroundColor: colors.line, height: 20, width: 2 }} /> : null}
            </View>
            <View style={{ flex: 1, gap: 2, paddingTop: 3 }}>
              <Text selectable numberOfLines={1} style={{ color: colors.ink, fontSize: 14, fontWeight: "900" }}>{translateCopy(step.title, language)}</Text>
              <Text selectable numberOfLines={2} style={{ color: colors.muted, fontSize: 12, fontWeight: "800", lineHeight: 17 }}>{translateCopy(step.body, language)}</Text>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

function RelatedListingsSection({
  actionHref,
  actionLabel,
  cardWidth,
  emptyText,
  listings,
  ownersById,
  title
}: {
  actionHref?: Href;
  actionLabel?: string;
  cardWidth: number;
  emptyText: string;
  listings: Listing[];
  ownersById: (ownerId: string) => User | undefined;
  title: string;
}) {
  const { language } = useLanguage();

  return (
    <Card>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <Text selectable numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 18, fontWeight: "900" }}>{translateCopy(title, language)}</Text>
        {actionHref && actionLabel ? <PrimaryButton href={actionHref} tone="secondary" icon="store-search-outline">{actionLabel}</PrimaryButton> : null}
      </View>
      {listings.length === 0 ? (
        <Text selectable style={{ color: colors.muted, fontSize: 13, fontWeight: "800", lineHeight: 18 }}>{translateCopy(emptyText, language)}</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
          {listings.map((item) => (
            <ListingCard key={item.id} listing={item} owner={ownersById(item.ownerId)} width={cardWidth} />
          ))}
        </ScrollView>
      )}
    </Card>
  );
}

function ListingActionCard({
  activeShareUrl,
  contactMethod,
  isOwner,
  listing,
  onContact,
  onJoin,
  onMessageSeller,
  onShare,
  partnershipStatus
}: {
  activeShareUrl?: string;
  contactMethod: Listing["contactMethod"];
  isOwner: boolean;
  listing: Listing;
  onContact: () => void;
  onJoin: () => void;
  onMessageSeller: () => void;
  onShare: () => void;
  partnershipStatus?: PartnershipStatus;
}) {
  const { language } = useLanguage();
  const canApply = !partnershipStatus && listing.status === "active" && listing.stockCount > 0 && listing.partnershipMode !== "invite";
  const partnerReady = partnershipStatus === "active";
  const partnerButtonLabel = partnershipStatus === "pending" || !canApply ? "Satıcıyla konuş" : listing.partnershipMode === "open" ? "Hemen ortak ol" : "Ortaklık iste";

  return (
    <Card>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
        <View style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 8, height: 42, justifyContent: "center", width: 42 }}>
          <MaterialCommunityIcons name={isOwner ? "storefront-outline" : partnerReady ? "link-variant" : "gesture-tap-button"} size={22} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text selectable numberOfLines={1} style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>
            {translateCopy(isOwner ? "Bu ilan senin mağazanda" : partnerReady ? "Ortak satış bağlantın hazır" : "Bu ürünle ne yapmak istiyorsun?", language)}
          </Text>
          <Text selectable numberOfLines={2} style={{ color: colors.muted, fontSize: 12, fontWeight: "800", lineHeight: 17 }}>
            {translateCopy(isOwner ? "İlanı düzenle, stok ve komisyonu satıcı panelinden yönet." : partnerReady ? "Bağlantıyı paylaş, alıcı talebini kaydet ve komisyonu ortak panelinden takip et." : "Alıcıysan satıcıya yaz, ortak olmak istiyorsan başvurunu gönder.", language)}
          </Text>
        </View>
      </View>

      {isOwner ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <PrimaryButton href={{ pathname: "/listing-edit/[id]", params: { id: listing.id } }} icon="pencil-outline">
              İlanı düzenle
            </PrimaryButton>
          </View>
          <View style={{ flex: 1 }}>
            <PrimaryButton href="/(tabs)/seller" tone="secondary" icon="view-dashboard-outline">
              Satıcı paneli
            </PrimaryButton>
          </View>
        </View>
      ) : partnerReady ? (
        <View style={{ gap: 8 }}>
          <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 8, borderWidth: 1, padding: 10 }}>
            <Text selectable numberOfLines={1} style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "900" }}>
              {activeShareUrl}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton icon="share-variant-outline" onPress={onShare}>
                Paylaş
              </PrimaryButton>
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton tone="secondary" href="/(tabs)/partner" icon="chart-line">
                Ortak paneli
              </PrimaryButton>
            </View>
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <View style={{ flexBasis: "47%", flexGrow: 1 }}>
            <PrimaryButton icon={contactMethod === "whatsapp" ? "whatsapp" : contactMethod === "phone" ? "phone" : "message-text-outline"} onPress={onContact}>
              {contactLabel(contactMethod)}
            </PrimaryButton>
          </View>
          <View style={{ flexBasis: "47%", flexGrow: 1 }}>
            <PrimaryButton tone={canApply ? "soft" : "secondary"} icon={canApply ? "handshake-outline" : "message-text-outline"} onPress={canApply ? onJoin : onMessageSeller}>
              {partnerButtonLabel}
            </PrimaryButton>
          </View>
        </View>
      )}
    </Card>
  );
}

function ListingDecisionCard({
  commission,
  listing,
  ownerTrustScore,
  partnershipStatus
}: {
  commission: number;
  listing: Listing;
  ownerTrustScore?: number;
  partnershipStatus?: PartnershipStatus;
}) {
  const { language } = useLanguage();
  const readyToPartner = listing.status === "active" && listing.stockCount > 0 && partnershipStatus !== "active";
  const statusLabel = partnershipStatus === "active" ? "Bağlantı hazır" : partnershipStatus === "pending" ? "Onay bekliyor" : readyToPartner ? "Ortaklığa uygun" : "Kontrol gerekli";

  return (
    <Card>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
        <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 8, height: 42, justifyContent: "center", width: 42 }}>
          <MaterialCommunityIcons name="shield-star-outline" size={22} color={colors.primaryDark} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} selectable style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>
            {translateCopy("Satın alma ve ortaklık özeti", language)}
          </Text>
          <Text numberOfLines={2} selectable style={{ color: colors.muted, fontSize: 12, fontWeight: "800", lineHeight: 17 }}>
            {translateCopy("Ürün, stok, satıcı güveni ve komisyon şartlarını tek bakışta kontrol et.", language)}
          </Text>
        </View>
        <StatusPill label={statusLabel} tone={partnershipStatus === "active" || readyToPartner ? "success" : "warning"} />
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <DecisionMetric icon="package-variant-closed" label="Stok" value={listing.stockCount > 0 ? `${listing.stockCount}` : "Yok"} tone={listing.stockCount > 0 ? "success" : "warning"} />
        <DecisionMetric icon="shield-check-outline" label="Satıcı güveni" value={ownerTrustScore === undefined ? "-" : `%${ownerTrustScore}`} tone={(ownerTrustScore ?? 0) >= 70 ? "success" : "warning"} />
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <DecisionMetric icon="cash-plus" label="Ortak kazancı" value={moneyIn(commission, listing.currency)} tone="success" />
        <DecisionMetric icon="calendar-clock" label="Vade" value={`${listing.commissionDueDays} gün`} tone="neutral" />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        <StatusPill label={`${translateCopy("İade", language)} ${listing.returnWindowDays} ${translateCopy("gün", language)}`} tone="info" />
        <StatusPill label={translateCopy(listing.contactMethod === "message" ? "Uygulama içi mesaj" : listing.contactMethod === "whatsapp" ? "WhatsApp iletişim" : "Telefon iletişim", language)} tone="info" />
      </View>
    </Card>
  );
}

function DecisionMetric({ icon, label, tone, value }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; tone: "success" | "warning" | "neutral"; value: string }) {
  const { language } = useLanguage();
  const color = tone === "success" ? colors.success : tone === "warning" ? colors.warning : colors.primary;

  return (
    <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flex: 1, gap: 6, padding: 10 }}>
      <MaterialCommunityIcons name={icon} size={18} color={color} />
      <Text numberOfLines={1} selectable style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}>
        {translateCopy(label, language)}
      </Text>
      <Text adjustsFontSizeToFit minimumFontScale={0.75} numberOfLines={1} selectable style={{ color: colors.ink, fontSize: 16, fontVariant: ["tabular-nums"], fontWeight: "900" }}>
        {translateCopy(value, language)}
      </Text>
    </View>
  );
}

function PartnershipBox({
  activeShareUrl,
  applicationAudience,
  applicationChannel,
  applicationHandle,
  applicationNote,
  applicationReach,
  copyText,
  handleJoin,
  handleShare,
  listing,
  mode,
  openShareTarget,
  onMessageSeller,
  setApplicationAudience,
  setApplicationChannel,
  setApplicationHandle,
  setApplicationNote,
  setApplicationReach,
  status
}: {
  activeShareUrl?: string;
  applicationAudience: string;
  applicationChannel: string;
  applicationHandle: string;
  applicationNote: string;
  applicationReach: string;
  copyText: (label: string, text: string) => void;
  handleJoin: () => void;
  handleShare: () => void;
  listing: Listing;
  mode: "open" | "invite" | "approval" | "blocked";
  openShareTarget: (target: "whatsapp" | "telegram") => void;
  onMessageSeller: () => void;
  setApplicationAudience: (value: string) => void;
  setApplicationChannel: (value: string) => void;
  setApplicationHandle: (value: string) => void;
  setApplicationNote: (value: string) => void;
  setApplicationReach: (value: string) => void;
  status?: PartnershipStatus;
}) {
  const { language } = useLanguage();
  if (status === "active") {
    const templates = listingShareTemplates(listing, activeShareUrl);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(activeShareUrl ?? "")}`;

    return (
      <Card>
        <StatusPill label="Ortaklığın aktif" tone="success" />
        <Text selectable style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{translateCopy("Satış araçların hazır", language)}</Text>
        <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>{activeShareUrl}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <View style={{ flexBasis: "31%", flexGrow: 1 }}>
            <PrimaryButton icon="content-copy" tone="secondary" onPress={() => activeShareUrl && copyText("Satış bağlantısı", activeShareUrl)}>Bağlantıyı Kopyala</PrimaryButton>
          </View>
          <View style={{ flexBasis: "31%", flexGrow: 1 }}>
            <PrimaryButton icon="whatsapp" tone="soft" onPress={() => openShareTarget("whatsapp")}>WhatsApp</PrimaryButton>
          </View>
          <View style={{ flexBasis: "31%", flexGrow: 1 }}>
            <PrimaryButton icon="send-outline" tone="secondary" onPress={() => openShareTarget("telegram")}>Telegram</PrimaryButton>
          </View>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <View style={{ flexBasis: "31%", flexGrow: 1 }}>
            <PrimaryButton tone="secondary" onPress={() => copyText("Instagram açıklaması", templates.instagram)}>Instagram Kopyala</PrimaryButton>
          </View>
          <View style={{ flexBasis: "31%", flexGrow: 1 }}>
            <PrimaryButton tone="secondary" onPress={() => copyText("TikTok açıklaması", templates.tiktok)}>TikTok Kopyala</PrimaryButton>
          </View>
          <View style={{ flexBasis: "31%", flexGrow: 1 }}>
            <PrimaryButton icon="share-variant-outline" onPress={handleShare}>Genel Paylaş</PrimaryButton>
          </View>
        </View>
        <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 8, borderWidth: 1, gap: 10, padding: 12 }}>
          <Image source={{ uri: qrUrl }} contentFit="contain" style={{ backgroundColor: "#FFFFFF", borderRadius: 8, height: 148, width: 148 }} />
          <Text selectable style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{translateCopy("QR kodu ekran görüntüsüyle paylaşabilirsin.", language)}</Text>
        </View>
        <View style={{ backgroundColor: colors.ink, borderRadius: 8, gap: 8, overflow: "hidden", padding: 12 }}>
          <SafeRemoteImage uri={listing.image} contentFit="cover" style={{ borderRadius: 8, height: 150, width: "100%" }} />
          <Text selectable numberOfLines={2} style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "900" }}>{listing.title}</Text>
          <Text selectable style={{ color: "#DCE8E3", fontSize: 13, lineHeight: 18 }}>{translateCopy(templates.whatsapp, language)}</Text>
          <PrimaryButton tone="soft" onPress={() => copyText("Ürün kartı metni", `${listing.title}\n${templates.whatsapp}\n${activeShareUrl}`)}>Ürün Kartı Metnini Kopyala</PrimaryButton>
        </View>
        {(listing.adAssets ?? []).length > 0 ? (
          <View style={{ gap: 8 }}>
            <Text selectable style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>{translateCopy("Hazır reklam görselleri", language)}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {(listing.adAssets ?? []).map((asset) => (
                <SafeRemoteImage key={asset} uri={asset} contentFit="cover" style={{ backgroundColor: colors.line, borderRadius: 8, height: 128, width: 96 }} />
              ))}
            </ScrollView>
          </View>
        ) : null}
      </Card>
    );
  }

  if (status === "pending") {
    return (
      <Card>
        <StatusPill label="Başvuru bekliyor" tone="warning" />
        <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>{translateCopy("Satıcı kabul edince referans bağlantın aktif olacak.", language)}</Text>
        <PrimaryButton tone="secondary" icon="message-text-outline" onPress={onMessageSeller}>Satıcıyla konuş</PrimaryButton>
      </Card>
    );
  }

  return (
    <Card>
      <Text selectable style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{translateCopy("Ortak satıcı ol", language)}</Text>
      <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>
        {translateCopy(mode === "open" ? "Bu ilan anında ortaklığa açık. Formu doldurunca bağlantın hemen oluşur." : "Satıcı başvurunu bu bilgilerle değerlendirir; onaylanınca bağlantın açılır.", language)}
      </Text>
      <Field label="Nerede paylaşacağım?" value={applicationChannel} onChangeText={setApplicationChannel} />
      <Field label="Hedef kitlem kim?" value={applicationAudience} onChangeText={setApplicationAudience} multiline />
      <Field label="Instagram / WhatsApp / TikTok kanalım" value={applicationHandle} onChangeText={setApplicationHandle} />
      <Field label="Tahmini kaç kişiye ulaşırım?" value={applicationReach} onChangeText={setApplicationReach} />
      <Field label="Satıcıya not" value={applicationNote} onChangeText={setApplicationNote} multiline />
      <PrimaryButton icon="handshake-outline" onPress={handleJoin}>{mode === "open" ? "Hemen Ortak Ol" : "Başvuru Gönder"}</PrimaryButton>
    </Card>
  );
}

function IconButton({ active, icon, label, onPress }: { active?: boolean; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void }) {
  const { language } = useLanguage();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ alignItems: "center", backgroundColor: active ? colors.primarySoft : colors.surfaceAlt, borderRadius: 8, flex: 1, flexDirection: "row", gap: 6, justifyContent: "center", minHeight: 42, opacity: pressed ? 0.72 : 1 })}>
      <MaterialCommunityIcons name={icon} size={18} color={active ? colors.primaryDark : colors.ink} />
      <Text ellipsizeMode="tail" numberOfLines={1} selectable style={{ color: active ? colors.primaryDark : colors.ink, flexShrink: 1, fontSize: 13, fontWeight: "900" }}>{translateCopy(label, language)}</Text>
    </Pressable>
  );
}

function Bullet({ icon, text, tone }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; text: string; tone: "success" | "info" }) {
  const { language } = useLanguage();
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      <MaterialCommunityIcons name={icon} size={18} color={tone === "success" ? colors.success : colors.info} />
      <Text selectable style={{ color: colors.ink, flex: 1, fontSize: 14, lineHeight: 20 }}>{translateCopy(text, language)}</Text>
    </View>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  const { language } = useLanguage();
  return (
    <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 12, paddingVertical: 4 }}>
      <Text selectable style={{ color: colors.muted, fontSize: 13, fontWeight: "700", width: 130 }}>{translateCopy(label, language)}</Text>
      <Text selectable style={{ color: colors.ink, flex: 1, fontSize: 14, fontWeight: "600", lineHeight: 20 }}>{translateCopy(value, language)}</Text>
    </View>
  );
}

function ChoiceRow<T extends string>({ labels, options, setValue, value }: { labels: Record<T, string>; options: T[]; setValue: (value: T) => void; value: T }) {
  const { language } = useLanguage();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {options.map((item) => (
        <Pressable key={item} onPress={() => setValue(item)} style={({ pressed }) => ({ alignItems: "center", backgroundColor: item === value ? colors.primarySoft : colors.surfaceAlt, borderColor: item === value ? colors.primary : colors.line, borderRadius: 8, borderWidth: 1, flexGrow: 1, flexBasis: options.length > 3 ? "23%" : "30%", minHeight: 38, justifyContent: "center", opacity: pressed ? 0.74 : 1, paddingHorizontal: 8 })}>
          <Text adjustsFontSizeToFit ellipsizeMode="tail" minimumFontScale={0.82} numberOfLines={1} selectable style={{ color: item === value ? colors.primaryDark : colors.ink, fontSize: 12, fontWeight: "900" }}>{translateCopy(labels[item], language)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Field({ label, value, onChangeText, multiline }: { label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean }) {
  const { language } = useLanguage();
  return (
    <View style={{ gap: 6 }}>
      <Text selectable style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>{translateCopy(label, language)}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        placeholderTextColor={colors.muted}
        style={{
          backgroundColor: colors.surfaceAlt,
          borderColor: colors.line,
          borderRadius: 8,
          borderWidth: 1,
          color: colors.ink,
          fontSize: 15,
          minHeight: multiline ? 82 : 46,
          padding: 12,
          textAlignVertical: multiline ? "top" : "center"
        }}
      />
    </View>
  );
}

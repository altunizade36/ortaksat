import { ListingTermsSummary } from "@/components/listing-terms-summary";
import { listingJoinAction, type ListingJoinAction } from "@/lib/listing-actions";
import { listingMedia } from "@/lib/mobile-listing";
import { useBackNavigation } from "@/lib/use-back-navigation";
import { HorizontalScroll } from "@/components/horizontal-scroll";
import { displayListingTitle } from "@/lib/listing-title";
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { OptionSheet } from "@/components/option-sheet";
import { colors } from "@/components/colors";
import { ClampedText, CommissionSummary, DefinitionGrid, DetailMetaLine, DetailNotice, DetailSection, FeatureChips, GalleryCounter, GalleryNavButtons, GalleryOverlayButton, ListingVideo, LocationRow, SafetyTips, SellerSummary, VideoBadge, VideoThumb, buildSummaryRows, detail, detailPriceFontSize, galleryHeightFor, splitListingMedia } from "@/components/listing-detail/shared";
import { moneyIn } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import type { Listing, PartnershipStatus, User } from "@/lib/types";
import { MobileButton, IconButton, mobile, ms, useMobileLayout } from "./ui";

// NATIVE İLAN DETAYI — web ile AYNI standart (components/listing-detail/shared.tsx):
// galeri → başlık → FİYAT → meta satırı → ortaklık özeti → Özet → Açıklama →
// Ortaklık koşulları → Satıcı → Konum → Güvenli alışveriş. Alt aksiyon çubuğu akışın
// içindedir (mutlak konumlu değil) → içeriği asla örtmez.
type Props = { listing: Listing; owner?: User; favorite: boolean; onFavorite: () => void; onShare: () => void; onMessage: () => void; onCall: () => void; onJoin: () => void; onReport: (reason: string) => void; isOwner: boolean; unavailable?: string; partnershipStatus?: PartnershipStatus; joinAction?: ListingJoinAction; contactBusy?: boolean; sellerBlocked?: boolean };
export function MobileListingDetail({ listing: l, owner, favorite, onFavorite, onShare, onMessage, onCall, onJoin, onReport, isOwner, unavailable, partnershipStatus, joinAction: suppliedJoinAction, contactBusy = false, sellerBlocked = false }: Props) {
  const { width, height, insets, tablet, maxWidth } = useMobileLayout();
  const { language } = useLanguage();
  const router = useRouter();
  const goBack = useBackNavigation();
  const [image, setImage] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const galleryRef = useRef<ScrollView>(null);
  const selectedImage = useRef(image); selectedImage.current = image;
  // Fotoğraflar + (varsa) TEK video. Video kapak olmaz; galeride daima SON öğedir.
  const media = splitListingMedia(listingMedia(l));
  const photos = media.photos;
  const mediaCount = media.count;
  const onVideo = !!media.video && image === photos.length;
  const galleryWidth = tablet ? Math.round(maxWidth * 0.55) : width;
  // Telefon: galeri görünür alanın %40'ını aşmaz (başlık + fiyat + komisyon ilk ekranda kalsın).
  const galleryHeight = tablet ? Math.round(galleryWidth * 0.65) : galleryHeightFor(width, height) + insets.top;
  const photoKey = [...photos, media.video ?? ""].join("\n");
  useEffect(() => { selectedImage.current = 0; setImage(0); setLightbox(false); galleryRef.current?.scrollTo({ x: 0, animated: false }); }, [l.id, photoKey]);
  useEffect(() => { galleryRef.current?.scrollTo({ x: galleryWidth * selectedImage.current, animated: false }); }, [galleryWidth]);
  useEffect(() => { galleryRef.current?.scrollTo({ x: image * galleryWidth, animated: false }); }, [image, galleryWidth]);

  const partnerable = l.partnershipMode !== "none";
  const summary = buildSummaryRows(l, language);
  const joinAction = suppliedJoinAction ?? listingJoinAction({ listing: l, status: partnershipStatus, isOwner, sellerBlocked });
  const joinLabel = joinAction.label;
  const joinDisabled = joinAction.kind === "disabled";
  const contactDisabled = !!(unavailable || l.demo || isOwner || sellerBlocked || contactBusy);
  const externalContact = l.contactMethod === "phone" || l.contactMethod === "whatsapp";
  const priceLabel = moneyIn(l.price, l.currency);
  const headWidth = (tablet ? maxWidth - galleryWidth - 20 : width) - (tablet ? 0 : detail.gutter * 2) - detail.pad * 2;
  const priceSize = detailPriceFontSize(priceLabel, headWidth, 30);
  const lightboxIndex = Math.min(image, Math.max(0, photos.length - 1));

  function selectImage(i: number) { setImage(i); galleryRef.current?.scrollTo({ x: i * galleryWidth, animated: true }); }
  return <View style={ms.screen}>
    <Stack.Screen options={{ headerShown: false }} />
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ width: "100%", maxWidth: tablet ? maxWidth : undefined, alignSelf: "center", paddingBottom: 20 }}>
      <View style={{ flexDirection: tablet ? "row" : "column", paddingTop: tablet ? insets.top + 12 : 0, gap: tablet ? 20 : detail.gap }}>
        {/* GALERİ: kaydır + nokta (telefon), küçük resimler (tablet), sayaç, dokununca tam ekran. */}
        <View style={{ width: galleryWidth }}>
          <View style={{ height: galleryHeight, backgroundColor: colors.neutralSoft, borderRadius: tablet ? detail.radius : 0, overflow: "hidden" }}>
            {mediaCount ? <ScrollView ref={galleryRef} style={{ flex: 1 }} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(e) => setImage(Math.max(0, Math.min(mediaCount - 1, Math.round(e.nativeEvent.contentOffset.x / galleryWidth))))}>
              {photos.map((uri, i) => <Pressable key={`${uri}-${i}`} accessibilityRole="button" accessibilityLabel={`Fotoğrafı büyüt ${i + 1}`} style={{ width: galleryWidth, height: galleryHeight }} onPress={() => { setImage(i); setLightbox(true); }}><SafeRemoteImage full uri={uri} fallbackUri={l.fallbackCategoryImage} style={{ width: galleryWidth, height: "100%" }} contentFit="cover" /></Pressable>)}
              {media.video ? <ListingVideo key="video" uri={media.video} active={onVideo && !lightbox} style={{ width: galleryWidth, height: galleryHeight, paddingTop: tablet ? 0 : insets.top }} /> : null}
            </ScrollView> : <View accessibilityLabel="İlan fotoğrafı bulunmuyor" style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 9 }}><Icon name="image-off-outline" size={40} color={mobile.muted} /><Text style={ms.muted}>{translateCopy("Bu ilanda fotoğraf yok", language)}</Text></View>}
            {/* Fotoğraf üstü küçük düğmeler: 40px dokunma alanı, 34px görsel. */}
            <View style={[s.galleryTools, { top: tablet ? 6 : insets.top + 4 }]}>
              <GalleryOverlayButton icon="chevron-left" label="Geri" onPress={goBack} />
              <View style={{ flex: 1 }} />
              <GalleryOverlayButton icon={favorite ? "heart" : "heart-outline"} active={favorite} label={favorite ? "Favorilerden çıkar" : "Favorilere ekle"} onPress={onFavorite} />
              <GalleryOverlayButton icon="share-variant-outline" label="Paylaş" onPress={onShare} />
              <GalleryOverlayButton icon="dots-horizontal" label="İlan seçenekleri" onPress={() => setMenu(true)} />
            </View>
            {!!mediaCount && !onVideo && <View style={s.counter}><GalleryCounter testID="listing-gallery-counter" index={image} total={mediaCount} /></View>}
            {!!mediaCount && onVideo && <View style={[s.counter, { bottom: undefined, top: (tablet ? 6 : insets.top + 4) + 46 }]}><GalleryCounter testID="listing-gallery-counter" index={image} total={mediaCount} video /></View>}
            {!tablet && mediaCount > 1 && mediaCount <= 8 && !onVideo && <View style={s.dots}>
              {Array.from({ length: mediaCount }, (_, i) => <Pressable key={i} accessibilityRole="button" accessibilityLabel={i < photos.length ? `Fotoğraf ${i + 1}` : "Video"} accessibilityState={{ selected: image === i }} aria-pressed={image === i} hitSlop={6} onPress={() => selectImage(i)} style={{ height: 32, justifyContent: "center", paddingHorizontal: 6 }}><View style={{ backgroundColor: i === image ? "#FFFFFF" : "rgba(255,255,255,0.55)", borderRadius: 999, height: 6, width: i === image ? 16 : 6 }} /></Pressable>)}
            </View>}
            {/* Video öğesinde noktalar gizlidir (yerel kontrollerle çakışmasın) → görünür önceki/sonraki düğmeleri. */}
            {onVideo && mediaCount > 1 && <GalleryNavButtons top={(tablet ? 0 : insets.top) + Math.round((galleryHeight - (tablet ? 0 : insets.top)) / 2) - 20} onPrev={() => selectImage((image - 1 + mediaCount) % mediaCount)} onNext={() => selectImage((image + 1) % mediaCount)} />}
            {!!media.video && !onVideo && <View style={{ position: "absolute", left: 8, bottom: 2 }}><VideoBadge onPress={() => selectImage(mediaCount - 1)} /></View>}
          </View>
          {tablet && mediaCount > 1 && <HorizontalScroll showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 10 }}>
            {photos.map((uri, i) => <Pressable key={`${uri}-${i}`} accessibilityRole="button" accessibilityLabel={`Fotoğraf ${i + 1}`} accessibilityState={{ selected: image === i }} aria-pressed={image === i} onPress={() => selectImage(i)} style={{ borderRadius: 8, overflow: "hidden", borderWidth: 2, borderColor: i === image ? colors.primary : colors.line }}><SafeRemoteImage uri={uri} style={{ width: 88, height: 62 }} /></Pressable>)}
            {media.video ? <Pressable accessibilityRole="button" accessibilityLabel="Video" accessibilityState={{ selected: onVideo }} aria-pressed={onVideo} onPress={() => selectImage(mediaCount - 1)} style={{ borderRadius: 8, overflow: "hidden", borderWidth: 2, borderColor: onVideo ? colors.primary : colors.line }}><VideoThumb size={88} height={62} /></Pressable> : null}
          </HorizontalScroll>}
        </View>
        {/* BAŞLIK KARTI: başlık → FİYAT → meta → durum → ortaklık özeti */}
        <View style={{ flex: tablet ? 1 : undefined, paddingHorizontal: tablet ? 0 : detail.gutter }}>
          <View testID="listing-detail-head" style={s.head}>
            <Text accessibilityRole="header" numberOfLines={3} style={s.title}>{displayListingTitle(l.title)}</Text>
            <Text testID="listing-detail-price" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[s.price, { fontSize: priceSize, lineHeight: Math.round(priceSize * 1.18) }]}>{priceLabel}</Text>
            <DetailMetaLine listing={l} />
            {unavailable ? <DetailNotice icon={l.status === "sold" ? "check-decagram" : "close-circle-outline"} tone="danger" title={unavailable} /> : null}
            {l.demo ? <DetailNotice icon="eye-outline" tone="neutral" title={translateCopy("Örnek ilan — ortaklık ve iletişim kapalıdır.", language)} /> : null}
            <CommissionSummary listing={l} demand={l.attributes?._formKey === "arayan"} />
            {!!joinAction.reason && partnerable && !isOwner ? <Text accessibilityRole="alert" style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>{joinAction.reason}</Text> : null}
          </View>
        </View>
      </View>
      {/* GÖVDE (sabit sıra) */}
      <View style={{ paddingHorizontal: tablet ? 0 : detail.gutter, marginTop: detail.gap, gap: detail.gap }}>
        <DetailSection title="Özet" icon="format-list-bulleted">
          <DefinitionGrid rows={summary.rows} />
          <FeatureChips groups={summary.chips} />
        </DetailSection>
        <DetailSection title="Açıklama" icon="text-box-outline">
          <ClampedText key={l.id} text={l.description} />
        </DetailSection>
        {partnerable && <ListingTermsSummary key={l.id} listing={l} />}
        <DetailSection title="Satıcı" icon="account-outline">
          <SellerSummary owner={owner} ownerId={l.ownerId} demo={!!l.demo} />
        </DetailSection>
        <DetailSection title="Konum" icon="map-marker-outline">
          <LocationRow location={l.location} />
        </DetailSection>
        <DetailSection title="Güvenli alışveriş" icon="shield-check-outline">
          <SafetyTips />
        </DetailSection>
      </View>
    </ScrollView>
    {/* ALT AKSİYON ÇUBUĞU — tek birincil CTA; sahip görünümünde düzenle + istatistik kısayolu. */}
    <View testID="listing-detail-actions" style={[s.footer, { paddingBottom: Math.max(10, insets.bottom) }]}>{isOwner ? <><MobileButton secondary onPress={() => router.push(`/listing-stats/${l.id}` as never)} style={{ flex: 1 }} icon="chart-box-outline">İstatistikler</MobileButton><MobileButton onPress={() => router.push(`/listing-edit/${l.id}` as never)} style={{ flex: 1 }} icon="pencil">İlanı Düzenle</MobileButton></> : <>{externalContact && <Pressable accessibilityRole="button" accessibilityLabel={contactBusy ? "Açılıyor…" : l.contactMethod === "whatsapp" ? "WhatsApp" : "Satıcıyı Ara"} disabled={contactDisabled} accessibilityState={{ disabled: contactDisabled }} onPress={onCall} style={{ width: 46, height: 46, borderRadius: 10, borderWidth: 1, borderColor: mobile.line, alignItems: "center", justifyContent: "center", opacity: contactDisabled ? 0.45 : 1 }}><Icon name={contactBusy ? "loading" : l.contactMethod === "whatsapp" ? "whatsapp" : "phone"} size={21} color={mobile.teal} /></Pressable>}<MobileButton secondary onPress={onMessage} disabled={contactDisabled} style={{ flex: 1 }} icon="chat">Mesaj</MobileButton>{(partnerable || joinAction.kind === "view") && <MobileButton onPress={onJoin} disabled={joinDisabled} style={{ flex: 1 }} icon={joinAction.kind === "view" ? undefined : "account-group"}>{joinLabel}</MobileButton>}</>}</View>
    <Modal visible={lightbox} animationType="fade" onRequestClose={() => setLightbox(false)}><View testID="listing-lightbox" style={{ flex: 1, backgroundColor: detail.stage, paddingTop: insets.top }}><View style={{ alignItems: "flex-end", padding: 8 }}><IconButton name="close" color="white" label="Galeriyi kapat" onPress={() => setLightbox(false)} /></View><ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentOffset={{ x: width * lightboxIndex, y: 0 }} onMomentumScrollEnd={e => setImage(Math.max(0, Math.min(photos.length - 1, Math.round(e.nativeEvent.contentOffset.x / width))))}>{photos.map((uri, i) => <SafeRemoteImage full key={i} uri={uri} contentFit="contain" style={{ width, height: Math.max(120, height - insets.top - 60), backgroundColor: detail.stage }} />)}</ScrollView></View></Modal>
    <OptionSheet visible={menu} title="İlan seçenekleri" options={["İlanı paylaş", "İlanı bildir"]} onClose={() => setMenu(false)} onSelect={(v) => { setMenu(false); if (v === "İlanı paylaş") onShare(); else router.push({ pathname: "/report", params: { listingId: l.id } } as never); }} />
    <OptionSheet visible={report} title="Bildirim nedeni" options={["Yanıltıcı ilan", "Uygunsuz içerik", "Yanlış kategori", "Dolandırıcılık şüphesi"]} onClose={() => setReport(false)} onSelect={(v) => { setReport(false); onReport(v); }} />
  </View>;
}
const s = StyleSheet.create({
  galleryTools: { position: "absolute", left: 6, right: 6, flexDirection: "row", gap: 2, alignItems: "center" },
  counter: { position: "absolute", bottom: 10, right: 10 },
  dots: { position: "absolute", left: 60, right: 60, bottom: 4, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  head: { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: detail.radius, borderWidth: 1, gap: 10, padding: detail.pad },
  title: { color: colors.ink, fontSize: 19, lineHeight: 24, fontWeight: "700" },
  price: { color: colors.ink, fontWeight: "800", letterSpacing: -0.4, fontVariant: ["tabular-nums"] },
  footer: { flexDirection: "row", padding: 10, gap: 8, backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.line }
});

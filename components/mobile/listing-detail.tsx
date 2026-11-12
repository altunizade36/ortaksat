import { ListingTermsSummary } from "@/components/listing-terms-summary";
import { listingJoinAction, type ListingJoinAction } from "@/lib/listing-actions";
import { listingCommissionDisplay, listingPhotos } from "@/lib/mobile-listing";
import { useBackNavigation } from "@/lib/use-back-navigation";
import { HorizontalScroll } from "@/components/horizontal-scroll";
import { displayListingTitle } from "@/lib/listing-title";
import { UserAvatar } from "@/components/user-avatar";
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { BrandMark } from "@/components/brand/brand-mark";
import { OptionSheet } from "@/components/option-sheet";
import { describeAttributes } from "@/lib/category-tree";
import { groupThousands, moneyIn } from "@/lib/format";
import { openUrlSafe } from "@/lib/link";
import type { Listing, PartnershipStatus, User } from "@/lib/types";
import { MobileButton, MobileCard, IconButton, mobile, ms, useMobileLayout } from "./ui";

type Props = { listing: Listing; owner?: User; favorite: boolean; onFavorite: () => void; onShare: () => void; onMessage: () => void; onCall: () => void; onJoin: () => void; onReport: (reason: string) => void; isOwner: boolean; unavailable?: string; partnershipStatus?: PartnershipStatus; joinAction?: ListingJoinAction; contactBusy?: boolean; sellerBlocked?: boolean };
export function MobileListingDetail({ listing: l, owner, favorite, onFavorite, onShare, onMessage, onCall, onJoin, onReport, isOwner, unavailable, partnershipStatus, joinAction: suppliedJoinAction, contactBusy = false, sellerBlocked = false }: Props) {
  const { width, height, insets, tablet, maxWidth } = useMobileLayout();
  const router = useRouter();
  const goBack = useBackNavigation();
  const [image, setImage] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const galleryRef = useRef<ScrollView>(null);
  const selectedImage = useRef(image); selectedImage.current = image;
  const photos = listingPhotos(l);
  const galleryWidth = tablet ? Math.round(maxWidth * 0.55) : width;
  const galleryHeight = galleryWidth * 0.65 + (tablet ? 0 : insets.top);
  const photoKey = photos.join("\n");
  useEffect(() => { selectedImage.current = 0; setImage(0); setLightbox(false); galleryRef.current?.scrollTo({ x: 0, animated: false }); }, [l.id, photoKey]);
  useEffect(() => { galleryRef.current?.scrollTo({ x: galleryWidth * selectedImage.current, animated: false }); }, [galleryWidth]);
  useEffect(() => { galleryRef.current?.scrollTo({ x: image * galleryWidth, animated: false }); }, [image, galleryWidth]);

  const a = l.attributes ?? {};
  const commission = listingCommissionDisplay(l);
  const partnerable = l.partnershipMode !== "none";
  const details = describeAttributes(a).filter((d) => !/başlık|açıklama|fiyat/i.test(d.label));
  const info = [["map-marker", l.location], ["calendar", a.year], ["speedometer", a.km != null ? `${groupThousands(Number(a.km))} km` : a.rooms], ["gas-station", a.fuel], ["car-shift-pattern", a.gear ?? a.transmission]] as const;
  const joinAction = suppliedJoinAction ?? listingJoinAction({ listing: l, status: partnershipStatus, isOwner, sellerBlocked });
  const joinLabel = joinAction.label;
  const joinDisabled = joinAction.kind === "disabled";
  const contactDisabled = !!(unavailable || l.demo || isOwner || sellerBlocked || contactBusy);
  const externalContact = l.contactMethod === "phone" || l.contactMethod === "whatsapp";

  function selectImage(i: number) { setImage(i); galleryRef.current?.scrollTo({ x: i * galleryWidth, animated: true }); }
  return <View style={ms.screen}>
    <Stack.Screen options={{ headerShown: false }} />
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ width: "100%", maxWidth: tablet ? maxWidth : undefined, alignSelf: "center", paddingBottom: 20 }}>
      <View style={{ flexDirection: tablet ? "row" : "column", paddingTop: tablet ? insets.top + 12 : 0, gap: tablet ? 20 : 0 }}>
        <View style={{ width: galleryWidth }}>
          <View style={{ height: galleryHeight, backgroundColor: "#DCE6EC" }}>
            {photos.length ? <ScrollView ref={galleryRef} style={{ flex: 1 }} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(e) => setImage(Math.max(0, Math.min(photos.length - 1, Math.round(e.nativeEvent.contentOffset.x / galleryWidth))))}>{photos.map((uri, i) => <Pressable key={`${uri}-${i}`} accessibilityRole="button" accessibilityLabel={`Fotoğrafı büyüt ${i + 1}`} style={{ width: galleryWidth, height: galleryHeight }} onPress={() => { setImage(i); setLightbox(true); }}><SafeRemoteImage full uri={uri} fallbackUri={l.fallbackCategoryImage} style={{ width: galleryWidth, height: "100%" }} contentFit="cover" /></Pressable>)}</ScrollView> : <View accessibilityLabel="İlan fotoğrafı bulunmuyor" style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 9 }}><Icon name="image-off-outline" size={42} color={mobile.muted} /><Text style={ms.muted}>Bu ilanda fotoğraf yok</Text></View>}
            <View style={[s.galleryTools, { top: tablet ? 8 : insets.top + 7 }]}><IconButton name="chevron-left" label="Geri" color="white" style={s.roundButton} onPress={goBack} /><View style={{ flex: 1 }} /><IconButton name={favorite ? "heart" : "heart-outline"} label={favorite ? "Favorilerden çıkar" : "Favorilere ekle"} color="white" style={s.roundButton} onPress={onFavorite} /><IconButton name="share-variant" label="Paylaş" color="white" style={s.roundButton} onPress={onShare} /></View>
            {partnerable && <View style={s.commission}><Icon name="account-group" size={20} color="white" /><Text style={{ color: "white", fontSize: 15, fontWeight: "700" }}>{commission ? `Komisyon ${commission}` : "Komisyonu satıcıya sor"}</Text></View>}
            {!!photos.length && <View testID="listing-gallery-counter" style={s.counter}><Icon name="image" size={16} color="white" /><Text style={{ color: "white", fontSize: 13 }}>{image + 1}/{photos.length}</Text></View>}
          </View>
          <HorizontalScroll  showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, padding: 9 }}>{photos.map((uri, i) => <Pressable key={`${uri}-${i}`} accessibilityRole="button" accessibilityLabel={`Fotoğraf ${i + 1}`} accessibilityState={{ selected: image === i }} aria-pressed={image === i} onPress={() => selectImage(i)} style={{ borderRadius: 7, overflow: "hidden", borderWidth: 1.5, borderColor: i === image ? mobile.teal : "transparent" }}><SafeRemoteImage uri={uri} style={{ width: tablet ? 104 : (width - 50) / 5, height: tablet ? 73 : 48 }} /></Pressable>)}</HorizontalScroll>
        </View>
        <View style={{ flex: 1, paddingHorizontal: tablet ? 0 : 14, paddingTop: tablet ? 10 : 1 }}>
          <Text accessibilityRole="header" style={s.title}>{displayListingTitle(l.title)}</Text><View style={[ms.row, { justifyContent: "space-between" }]}><Text style={[s.status, !partnerable && { backgroundColor: "#EEE9FF", color: "#7253C6" }]}>{l.partnershipMode === "invite" ? "Davetle Ortaklık" : partnerable ? "Ortaklığa Açık" : "Ortaklığa Kapalı"}</Text><IconButton name="dots-vertical" label="İlan seçenekleri" onPress={() => setMenu(true)} style={{ width: 22 }} /></View>
          <Text style={s.price}>{moneyIn(l.price, l.currency)}</Text>
          <View style={[ms.wrap, { marginVertical: 9 }]}>{info.filter(([, v]) => v != null && v !== "").map(([icon, value]) => <View key={icon} style={{ flexDirection: "row", gap: 4, alignItems: "center" }}><Icon name={icon} size={14} color={mobile.muted} /><Text style={{ color: mobile.muted, fontSize: 11 }}>{String(value)}</Text></View>)}</View>
          {unavailable && <Text style={ms.error}>{unavailable}</Text>}
          {l.demo && <Text style={ms.muted}>Örnek ilan — iletişim ve ortaklık işlemleri kapalıdır.</Text>}
          <MobileCard style={{ flexDirection: "row", alignItems: "center", padding: 10, marginTop: 5 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Satıcı profili" onPress={() => owner && router.push(`/store/${owner.id}` as never)} style={{ flexDirection: "row", gap: 8, alignItems: "center", flex: 1 }}><UserAvatar uri={owner?.avatar} style={s.avatar} /><View style={{ flex: 1 }}><View style={ms.row}><Text numberOfLines={1} style={s.owner}>{owner?.name || "Satıcı"}</Text>{(owner?.verifiedIdentity || owner?.verifiedPhone) && <Icon name="check-decagram" size={15} color={mobile.teal} />}</View><Text style={ms.muted}>{owner?.createdAt ? `Üyelik: ${owner.createdAt.slice(0, 4)}` : "OrtakSat üyesi"}</Text><Text style={ms.muted}>{owner?.listingCount ?? 0} aktif ilan</Text></View></Pressable>

          </MobileCard>
          {partnerable && <ListingTermsSummary key={l.id} listing={l} />}
        </View>
      </View>
      <View style={{ paddingHorizontal: 14, marginTop: 3 }}>
        {!!joinAction.reason && partnerable && !isOwner && <MobileCard><Text accessibilityRole="alert" style={ms.muted}>{joinAction.reason}</Text></MobileCard>}
        {!!details.length && <MobileCard><HorizontalScroll  showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 0 }}>{details.map((d) => <View key={d.label} style={s.attribute}><Icon name={/yıl/i.test(d.label) ? "calendar" : /kilometre/i.test(d.label) ? "speedometer" : /yakıt/i.test(d.label) ? "gas-station" : /vites/i.test(d.label) ? "car-shift-pattern" : /model/i.test(d.label) ? "car" : "tag-outline"} size={21} color="#536074" /><Text style={{ color: mobile.muted, fontSize: 10, marginTop: 6 }}>{d.label}</Text><Text style={{ color: mobile.ink, fontSize: 11, marginTop: 6 }}>{d.value}</Text></View>)}</HorizontalScroll></MobileCard>}
        <MobileCard><Text style={ms.section}>Açıklama</Text><Text numberOfLines={expanded ? undefined : 5} style={{ color: "#656F80", fontSize: 13, lineHeight: 20 }}>{l.description}</Text><Pressable accessibilityRole="button" onPress={() => setExpanded((v) => !v)} style={ms.row}><Text style={{ color: mobile.teal, fontSize: 12 }}>{expanded ? "Daha Az Göster" : "Daha Fazla Göster"}</Text><Icon name={expanded ? "chevron-up" : "chevron-down"} size={19} color={mobile.teal} /></Pressable></MobileCard>
        <Text style={[ms.section, { marginVertical: 9 }]}>Konum</Text><Pressable accessibilityRole="button" accessibilityLabel="Konumu haritada aç" onPress={() => void openUrlSafe(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.location)}`)}><MobileCard style={{ flexDirection: "row", alignItems: "center" }}><View style={{ width: 80, height: 48, borderRadius: 8, backgroundColor: "#E5E9F2", justifyContent: "center", alignItems: "center" }}><Icon name="map-marker-radius" size={35} color={mobile.teal} /></View><View style={{ flex: 1 }}><Text style={{ color: mobile.ink, fontSize: 13, fontWeight: "600" }}>{l.location}</Text><Text style={ms.muted}>Haritada aç</Text></View><Icon name="chevron-right" size={22} color={mobile.muted} /></MobileCard></Pressable>
        <Text style={[ms.muted, { marginVertical: 10, fontSize: 10 }]}>Ödeme ve teslimat satıcı ile alıcı arasında gerçekleşir. OrtakSat aracılık platformudur. İlan no: {l.id.slice(0, 12)}</Text>
      </View>
    </ScrollView>
    <View style={[s.footer, { paddingBottom: Math.max(10, insets.bottom) }]}>{isOwner ? <MobileButton onPress={() => router.push(`/listing-edit/${l.id}` as never)} style={{ flex: 1 }} icon="pencil">İlanı Düzenle</MobileButton> : <>{externalContact && <Pressable accessibilityRole="button" accessibilityLabel={contactBusy ? "Açılıyor…" : l.contactMethod === "whatsapp" ? "WhatsApp" : "Satıcıyı Ara"} disabled={contactDisabled} accessibilityState={{disabled:contactDisabled}} onPress={onCall} style={{width:44,height:46,borderRadius:10,borderWidth:1,borderColor:mobile.line,alignItems:"center",justifyContent:"center",opacity:contactDisabled ? 0.45 : 1}}><Icon name={contactBusy?"loading":l.contactMethod === "whatsapp"?"whatsapp":"phone"} size={21} color={mobile.teal}/></Pressable>}<MobileButton secondary onPress={onMessage} disabled={contactDisabled} style={{ flex: 1 }} icon="chat">Mesaj</MobileButton>{(partnerable || joinAction.kind === "view") && <MobileButton onPress={onJoin} disabled={joinDisabled} style={{ flex: 1 }} icon={joinAction.kind === "view" ? undefined : "account-group"}>{joinLabel}</MobileButton>}</>}</View>
    <Modal visible={lightbox} animationType="fade" onRequestClose={() => setLightbox(false)}><View testID="listing-lightbox" style={{ flex: 1, backgroundColor: "#070D13", paddingTop: insets.top }}><View style={{ alignItems: "flex-end", padding: 8 }}><IconButton name="close" color="white" label="Galeriyi kapat" onPress={() => setLightbox(false)} /></View><ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentOffset={{ x: width * image, y: 0 }} onMomentumScrollEnd={e => setImage(Math.max(0, Math.min(photos.length - 1, Math.round(e.nativeEvent.contentOffset.x / width))))}>{photos.map((uri, i) => <SafeRemoteImage full key={i} uri={uri} contentFit="contain" style={{ width, height: Math.max(120, height - insets.top - 60), backgroundColor: "#070D13" }} />)}</ScrollView></View></Modal>
    <OptionSheet visible={menu} title="İlan seçenekleri" options={["İlanı paylaş", "İlanı bildir"]} onClose={() => setMenu(false)} onSelect={(v) => { setMenu(false); if (v === "İlanı paylaş") onShare(); else router.push({pathname:"/report",params:{listingId:l.id}} as never); }} />
    <OptionSheet visible={report} title="Bildirim nedeni" options={["Yanıltıcı ilan", "Uygunsuz içerik", "Yanlış kategori", "Dolandırıcılık şüphesi"]} onClose={() => setReport(false)} onSelect={(v) => { setReport(false); onReport(v); }} />
  </View>;
}
const s = StyleSheet.create({ galleryTools: { position: "absolute", left: 10, right: 10, flexDirection: "row", gap: 7, alignItems: "center" }, roundButton: { backgroundColor: "#17233199", borderRadius: 24, width: 37, height: 37 }, commission: { position: "absolute", left: 12, bottom: 9, borderRadius: 19, backgroundColor: "#0645C9EE", paddingHorizontal: 11, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 6 }, counter: { position: "absolute", bottom: 10, right: 12, backgroundColor: "#172331BB", borderRadius: 14, paddingHorizontal: 9, paddingVertical: 6, flexDirection: "row", gap: 5 }, title: { color: mobile.ink, fontSize: 21, lineHeight: 26, fontWeight: "800" }, price: { color: mobile.teal, fontSize: 25, fontWeight: "800", marginTop: 5 }, status: { backgroundColor: "#E3F9ED", color: "#087F39", fontSize: 9, fontWeight: "600", borderRadius: 4, padding: 5, marginTop: 5 }, avatar: { width: 44, height: 44, borderRadius: 22 }, owner: { fontSize: 14, fontWeight: "700", color: mobile.ink, flexShrink: 1 }, messageSeller: { backgroundColor: "#E5F0FF", padding: 8, borderRadius: 10, alignItems: "center", gap: 5, maxWidth: 123 }, handshake: { width: 44, height: 44, borderRadius: 22, backgroundColor: mobile.teal, alignItems: "center", justifyContent: "center" }, attribute: { minWidth: 73, paddingHorizontal: 10, alignItems: "center", borderRightWidth: 1, borderColor: mobile.line }, footer: { flexDirection: "row", padding: 10, gap: 7, backgroundColor: "white", borderTopLeftRadius: 17, borderTopRightRadius: 17, borderTopWidth: 1, borderColor: mobile.line } });

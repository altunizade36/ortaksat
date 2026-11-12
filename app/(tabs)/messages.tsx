import { conversationGroup } from "@/lib/inbox-model";
import { ConversationListingStrip } from "@/components/conversation-listing-strip";
import { ConversationOfferCard } from "@/components/conversation-offer-card";
import { ConversationListingActions } from "@/components/conversation-listing-actions";
import { ListingCommission } from "@/components/listing-commission";
import { Accordion } from "@/components/accordion";
import { CompactFooter } from "@/components/compact-footer";
import { displayListingTitle } from "@/lib/listing-title";
import { UserAvatar } from "@/components/user-avatar";
import { isMobileApp } from "@/lib/mobile-app";
import { MobileMessages } from "@/components/mobile/messages";
import { MaterialCommunityIcons } from "@/components/icons";
import * as ImagePicker from "expo-image-picker";
import { Link, useLocalSearchParams, type Href } from "expo-router";

import { SafeRemoteImage } from "@/components/safe-remote-image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";

import { Alert } from "@/lib/alert";

import { openUrlSafe } from "@/lib/link";

import { colors } from "@/components/colors";
import { AuthRequired } from "@/components/auth-gate";
import { EmptyState, PressLink } from "@/components/ui";
import { commissionAmount, localToday, moneyIn } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useNativeRefresh } from "@/lib/use-native-refresh";
import { useForegroundRefresh } from "@/lib/use-foreground-refresh";
import { uploadMessageAttachment } from "@/lib/live-service";
import { fetchSellerPhone } from "@/lib/supabase-data";
import { useTypingIndicator } from "@/lib/use-typing";
import { useContentWidth, useIsWideWeb, useMounted } from "@/lib/layout";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import { searchKey, shortDate } from "@/lib/locale";
import { displayText } from "@/lib/text";
import type { Conversation, Lead, Message, Partnership } from "@/lib/types";
import { useInboxPrefs } from "@/lib/inbox-prefs";
import { useStore } from "@/lib/use-store";

type InboxFilter = "all" | "unread" | "action" | "sales" | "buyers" | "sellers" | "partner";

// Mesaj zaman damgasi "YYYY-MM-DD HH:MM" formatinda; sadece saati goster.
function msgTime(createdAt: string) {
  const m = /\d{2}:\d{2}/.exec(createdAt);
  return m ? m[0] : "";
}
const MONTHS_SHORT_TR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
// Inbox listesi zaman damgasi: bugun -> saat, dun -> "Dun", daha eski -> gun+ay.
// (msgTime HEP HH:MM dondurdugu icin 3 gun onceki mesaj tarihsiz "14:30" gorunuyordu;
//  "|| shortDate" fallback'i asla tetiklenmiyordu.)
function inboxTime(createdAt: string) {
  const day = createdAt.slice(0, 10); // "YYYY-MM-DD"
  const today = localToday();
  if (day === today) return msgTime(createdAt) || shortDate(createdAt);
  const [ty, tm, td] = today.split("-").map(Number);
  const yd = new Date(ty, tm - 1, td - 1); // yerel; ay/yil devri güvenli
  const yStr = `${yd.getFullYear()}-${String(yd.getMonth() + 1).padStart(2, "0")}-${String(yd.getDate()).padStart(2, "0")}`;
  if (day === yStr) return "Dün";
  const p = day.split("-");
  return p.length === 3 ? `${p[2]} ${MONTHS_SHORT_TR[Number(p[1]) - 1] ?? ""}`.trim() : shortDate(createdAt);
}
function messagePreview(m: Message | undefined): string {
  if (!m) return "";
  if (m.body) return m.body;
  if (m.attachmentType === "file") return `📎 ${m.attachmentName ?? "Dosya"}`;
  if (m.attachmentUrl) return "📷 Görsel";
  return "";
}
function msgDay(createdAt: string) {
  return createdAt.slice(0, 10);
}
function dayHeader(day: string) {
  const today = localToday();
  if (day === today) return "Bugün";
  // "YYYY-MM-DD" doğrudan ayrıştırılır: new Date("YYYY-MM-DD") UTC gece yarısıdır →
  // UTC'nin gerisindeki saat dilimlerinde başlık bir gün ÖNCEYİ gösterirdi.
  const [y, mo, d] = day.split("-").map(Number);
  if (!y || !d || !MONTHS_SHORT_TR[mo - 1]) return day;
  return `${String(d).padStart(2, "0")} ${MONTHS_SHORT_TR[mo - 1]} ${y}`;
}
const MONTHS_TR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
function longDateTr(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}`;
}

const sourceLabels: Record<Lead["source"], string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  web: "Web form",
  phone: "Telefon"
};

const MESSAGE_RISK_WORDS = [
  "iban",
  "havale",
  "eft",
  "kapora",
  "kaparo",
  "whatsapp",
  "telegram",
  "papara",
  "kripto",
  "site disi",
  "site dışı",
  "western union",
  "hesap numarasi",
  "hesap numarası",
  "kart bilgisi",
  "dolandirici",
  "dolandırıcı"
];

function scanMessageRisk(text: string) {
  const key = searchKey(text);
  const matches = MESSAGE_RISK_WORDS.filter((word) => key.includes(searchKey(word)));
  return {
    hasRisk: matches.length > 0,
    matches: Array.from(new Set(matches)).slice(0, 3)
  };
}

function MessagesScreenInner() {
  const { conversations, currentUser, findListing, findUser, leads, markConversationRead, messages, partnerships, refreshUserData, sales, sendConversationMessage, retryMessage, isUserBlocked, blockUser, unblockUser } = useStore();
  const { refreshing, onRefresh } = useNativeRefresh(refreshUserData);
  // Sekme ön plana dönünce mesajları tazele (WS askıdayken kaçan yanıtları getirir).
  useForegroundRefresh(refreshUserData);
  const { t, language } = useLanguage();
  const isWideWeb = useIsWideWeb();
  const contentWidth = useContentWidth();
  // Orta genişlikte (tablet/yatay telefon) 3. panel sohbeti sıkıştırır; ≥1040px'te göster.
  const roomForContextPanel = contentWidth >= 1200;
  const params = useLocalSearchParams<{ c?: string }>();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [activeId, setActiveId] = useState<string | null>(params.c ?? null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [showDetails, setShowDetails] = useState(true);
  const [showTools, setShowTools] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  // Yıldız / takip / arşiv artık kullanıcıya göre kalıcı (web localStorage).
  const { starred, following, archivedIds, toggleStar, toggleFollow, toggleArchive } = useInboxPrefs(currentUser.id);
  const [showArchived, setShowArchived] = useState(false);
  const deskScrollRef = useRef<ScrollView>(null);
  // Yukarı kaydırıldıysa gelen mesaj/görsel zorla aşağı çekmesin (dibe yakınken in).
  const deskNearBottomRef = useRef(true);
  const sendingDraftRef = useRef(false); // çift-gönderim (hızlı Enter) koruması

  const handledConversationParam = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (params.c && handledConversationParam.current !== params.c) {
      handledConversationParam.current = params.c;
      setActiveId(params.c);setQuery("");setFilter("all");setShowArchived(archivedIds.includes(params.c));
    }
  }, [params.c, archivedIds]);

  // PERF: memo'lu → composer/arama tuş vuruşlarında (draft/query) yeniden hesaplanmaz.
  const myConversations = useMemo(() => conversations
    .filter((conversation) => conversation.participantIds.includes(currentUser.id))
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt)), [conversations, currentUser.id]);

  const unreadMessages = useMemo(() => messages.filter((item) => item.receiverId === currentUser.id && !item.read), [messages, currentUser.id]);
  const tokens = useMemo(() => searchKey(query).split(" ").filter(Boolean), [query]);

  // PERF: her konuşmanın context'i RENDER BAŞINA BİR KEZ hesaplanır (Map). Eskiden
  // buildConversationContext filter + sort (O(n log n)) + iki render map'inde DEFALARCA
  // yeniden kuruluyordu (her tuş vuruşunda ağır). Tek hesap → sort/filter/render Map'ten okur.
  const ctxById = useMemo(() => new Map(myConversations.map((conversation) => [conversation.id, buildConversationContext({ conversation, currentUserId: currentUser.id, findUser, leads, messages, partnerships, sales, t })])), [myConversations, messages, leads, partnerships, sales, currentUser.id, findUser, t]);

  const visibleConversations = useMemo(() => myConversations.filter((conversation) => {
    if (archivedIds.includes(conversation.id) !== showArchived) return false;
    const context = ctxById.get(conversation.id)!;
    const listing = findListing(conversation.listingId);
    const otherId = conversation.participantIds.find((id) => id !== currentUser.id);
    const otherUser = otherId ? findUser(otherId) : undefined;
    const conversationMessages = messages.filter((item) => item.conversationId === conversation.id);
    const unreadCount = conversationMessages.filter((item) => item.receiverId === currentUser.id && !item.read).length;
    if (filter === "unread" && unreadCount === 0) return false;
    if (filter === "action" && !context.needsAction) return false;
    if (filter === "sales" && conversation.partnerId) return false;
    if (["buyers", "sellers", "partner"].includes(filter) && conversationGroup(conversation, currentUser.id) !== filter) return false;
    if (tokens.length === 0) return true;

    const haystack = searchKey(
      [
        otherUser?.name,
        listing?.title,
        listing?.category,
        listing?.location,
        context.status,
        context.source,
        context.channel,
        ...conversationMessages.map((item) => item.body)
      ]
        .filter(Boolean)
        .join(" ")
    );
    return tokens.every((token) => haystack.includes(token));
  }).sort((a, b) => conversationPriority(b, currentUser.id, messages, ctxById.get(b.id)!) - conversationPriority(a, currentUser.id, messages, ctxById.get(a.id)!)), [myConversations, ctxById, messages, archivedIds, showArchived, filter, tokens, currentUser.id, findListing, findUser]);
  const actionCount = myConversations.reduce((n, conversation) => n + (ctxById.get(conversation.id)!.needsAction ? 1 : 0), 0);

  // Keep the explicitly opened unread thread after its unread badge disappears.
  // Never fall through to the next unread thread and mark an entire inbox read.
  const selectedConversation = visibleConversations.find((c) => c.id === activeId) ??
    (filter === "unread" && !query.trim() ? myConversations.find((c) => c.id === activeId && archivedIds.includes(c.id) === showArchived) : undefined);
  useEffect(() => {
    if (isWideWeb && !activeId && filter === "all" && !query.trim() && !showArchived && myConversations[0]) setActiveId(myConversations[0].id);
  }, [isWideWeb, activeId, filter, query, showArchived, myConversations]);
  const selectedId = isWideWeb ? selectedConversation?.id : undefined;
  const draft = selectedId ? drafts[selectedId] ?? "" : "";
  const setDraft = (value: string | ((previous: string) => string)) => {
    if (!selectedId) return;
    setDrafts((previous) => ({ ...previous, [selectedId]: typeof value === "function" ? value(previous[selectedId] ?? "") : value }));
  };
  const { otherTyping, notifyTyping } = useTypingIndicator(selectedId, currentUser.id);
  const selectedHasUnread = Boolean(selectedId && messages.some((message) => message.conversationId === selectedId && message.receiverId === currentUser.id && !message.read));
  useEffect(() => {
    if (selectedId && selectedHasUnread) markConversationRead(selectedId);
  }, [selectedId, selectedHasUnread, markConversationRead]);
  useEffect(() => {
    deskNearBottomRef.current = true;
    deskScrollRef.current?.scrollToEnd({ animated: false });
  }, [selectedId]);

  if (isWideWeb) {
    const activeConversation = selectedConversation;
    const activeListing = activeConversation ? findListing(activeConversation.listingId) : undefined;
    const activeOtherId = activeConversation?.participantIds.find((id) => id !== currentUser.id);
    const activeClosed = activeConversation?.status !== "open";
    const activeBlocked = activeOtherId ? isUserBlocked(activeOtherId) : false; // masaüstünde de engelleme (mobil paritesi)
    const activeOther = activeOtherId ? findUser(activeOtherId) : undefined;
    // Eskiden yeniye sırala. `messages` dizisi yeni→eski tutulur (başa eklenir);
    // aynı zaman damgasında daha yüksek index = daha eski, o yüzden önce gelir.
    const msgIndex = new Map(messages.map((m, i) => [m.id, i]));
    const activeMessages = activeConversation
      ? messages.filter((m) => m.conversationId === activeConversation.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || ((msgIndex.get(b.id) ?? 0) - (msgIndex.get(a.id) ?? 0)))
      : [];
    const activeContext = activeConversation
      ? (ctxById.get(activeConversation.id) ?? buildConversationContext({ conversation: activeConversation, currentUserId: currentUser.id, findUser, leads, messages, partnerships, sales, t }))
      : undefined;

    const selectConversation = (id: string) => {
      setActiveId(id);
      markConversationRead(id);
    };
    const sendDraft = () => {
      const text = draft.trim();
      if (!activeConversation || !text || sendingDraftRef.current) return;
      sendingDraftRef.current = true;
      setDraft("");
      // Reddedilirse (hız-limiti/askı/kapalı/engel) metni GERİ YÜKLE — mobil sohbette olduğu gibi
      // sessiz kayıp yok (masaüstü regresyonuydu: dönüş değeri yok sayılıp taslak hep temizleniyordu).
      const ok = sendConversationMessage(activeConversation.id, text);
      if (!ok) setDraft(text);
      setTimeout(() => { sendingDraftRef.current = false; }, 250);
      // Snap: onContentSizeChange zaten anlık olarak sona kaydırır (çift/kaymalı jank yok).
    };
    const attachImage = async () => {
      if (!activeConversation || attaching) return;
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      // İzin reddedilirse sessiz no-op yerine nedenini + çözümü söyle.
      if (!perm.granted) { Alert.alert(translateCopy("Fotoğraf izni gerekli", language), translateCopy("Görsel göndermek için ayarlardan fotoğraf erişimine izin ver.", language)); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      setAttaching(true);
      try {
        const url = await uploadMessageAttachment(result.assets[0].uri, currentUser.id);
        // Yükleme başarısız (null) → yerel uri ile gönderme (alıcı yükleyemez, kırık mesaj olur).
        if (!url) { Alert.alert(translateCopy("Görsel gönderilemedi", language), translateCopy("Görsel yüklenemedi. Bağlantını kontrol edip tekrar dene.", language)); return; }
        const ok = sendConversationMessage(activeConversation.id, draft.trim(), { url, type: "image" });
        if (ok) setDraft("");
      } catch {
        Alert.alert(translateCopy("Görsel gönderilemedi", language), translateCopy("Bir sorun oluştu. Lütfen tekrar dene.", language));
      } finally {
        setAttaching(false);
      }
    };
    // Web: Enter gonderir, Shift+Enter yeni satir.
    const onComposerKeyPress = (e: { nativeEvent: { key?: string; shiftKey?: boolean } }) => {
      if (Platform.OS !== "web") return;
      if (e.nativeEvent.key === "Enter" && !e.nativeEvent.shiftKey) {
        (e as unknown as { preventDefault?: () => void }).preventDefault?.();
        sendDraft();
      }
    };
    const insertPriceOffer = () => {
      const base = activeListing ? moneyIn(activeListing.price, activeListing.currency) : "";
      setDraft((d) => (d.trim() ? d : `Fiyat teklifim: ${base ? base.replace(/[0-9.,]+/, "___") : "₺___"} — uygun olur mu?`));
    };

    const filters: Array<{ key: InboxFilter; label: string; count: number }> = [
      { key: "all", label: translateCopy("Tümü", language), count: myConversations.length },
      { key: "buyers", label: translateCopy("Alıcı", language), count: 0 },
      { key: "sellers", label: translateCopy("Satıcı", language), count: 0 },
      { key: "partner", label: translateCopy("Ortaklık", language), count: 0 }
    ];
    const activeIsPartner = Boolean(activeConversation?.partnerId);
    const activePhotoCount = activeListing ? [...new Set([activeListing.image, ...(activeListing.adAssets ?? [])].filter(Boolean))].length : 0;
    const activeListingNo = activeListing ? activeListing.id.replace(/[^0-9]/g, "").slice(-10) || activeListing.id : "";
    const draftRisk = scanMessageRisk(draft);
    const estimatedCommission = activeListing ? commissionAmount(activeListing) : 0;
    const safeDealDraft = activeListing
      ? `Ödeme, teslimat ve komisyon koşullarını OrtakSat mesaj kaydında netleştirelim. İlan: ${displayListingTitle(activeListing.title)} - Fiyat: ${moneyIn(activeListing.price, activeListing.currency)}${estimatedCommission ? ` - Komisyon: ${moneyIn(estimatedCommission, activeListing.currency)}` : ""}.`
      : "Ödeme, teslimat ve komisyon koşullarını OrtakSat mesaj kaydında netleştirelim.";

    const respRate = activeOther?.responseRate ?? 0;
    return (
      <View testID="web-inbox" style={{ backgroundColor: colors.background, flex: 1, gap: 12, paddingHorizontal: 20, paddingVertical: 14, minHeight: 0 }}>
        {/* 3 panel */}
        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flex: 1, flexDirection: "row", marginHorizontal: "auto", maxWidth: 1280, minHeight: 0, overflow: "hidden", width: "100%" }}>
          {/* SOL: liste */}
          <View style={{ borderRightColor: colors.line, borderRightWidth: 1, width: 280 }}>
            <View style={{ gap: 10, padding: 16 }}>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}><Text style={{ color: colors.ink, fontSize: 18, fontWeight: "700", flex: 1 }}>{translateCopy("Mesajlarım", language)}</Text>{unreadMessages.length > 0 ? <Text style={{ backgroundColor: colors.primaryDark, color: "white", borderRadius: 12, paddingHorizontal: 7, paddingVertical: 3, fontSize: 11 }}>{unreadMessages.length}</Text> : null}<Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Okunmamış", language)} accessibilityState={{ selected: filter === "unread" }} onPress={() => { setActiveId(null);setFilter(filter === "unread" ? "all" : "unread"); }} style={{ height: 36, width: 32, alignItems: "center", justifyContent: "center" }}><MaterialCommunityIcons name="email-mark-as-unread" size={18} color={filter === "unread" ? colors.primaryDark : colors.muted}/></Pressable><Link href="/explore" asChild><Pressable accessibilityLabel={translateCopy("Yeni görüşme için ilan bul", language)} style={{ width: 32, height: 36, alignItems: "center", justifyContent: "center" }}><MaterialCommunityIcons name="plus" size={22} color={colors.primaryDark}/></Pressable></Link></View>
              <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 8, paddingHorizontal: 14 }}>
                <MaterialCommunityIcons name="magnify" size={18} color={colors.muted} />
                <TextInput value={query} onChangeText={setQuery} accessibilityLabel={translateCopy("Görüşmelerde ara", language)} placeholder={translateCopy("Görüşmelerde ara", language)} placeholderTextColor={colors.muted} style={{ color: colors.ink, flex: 1, fontSize: 13.5, minHeight: 40, paddingVertical: 6 }} />
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {filters.map((f) => {
                  const on = filter === f.key;
                  return (
                    <Pressable key={f.key} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={f.label} hitSlop={6} onPress={() => { setActiveId(null); setFilter(f.key); }} style={{ alignItems: "center", backgroundColor: on ? colors.primary : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 10, paddingVertical: 8 }}>
                      <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 11, fontWeight: "600" }}>{f.label}</Text>

                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={{ backgroundColor: colors.line, height: 1 }} />
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingBottom: 8 }}>
              {visibleConversations.length === 0 ? (
                // Arama/filtre aktifken "Henüz konuşma yok" YANLIŞ olur (konuşma var, eşleşme yok).
                <View style={{ padding: 16 }}><EmptyState title={showArchived ? translateCopy("Arşiv boş", language) : myConversations.length > 0 && (filter !== "all" || query.trim()) ? t("noResults") : t("noConversation")} body={showArchived ? translateCopy("Arşivlenen görüşme yok.", language) : myConversations.length > 0 && (filter !== "all" || query.trim()) ? t("searchOrFilterAgain") : t("noConversationBody")} /></View>
              ) : null}
              {visibleConversations.map((conversation) => {
                const listing = findListing(conversation.listingId);
                const otherId = conversation.participantIds.find((id) => id !== currentUser.id);
                const otherUser = otherId ? findUser(otherId) : undefined;
                const convMessages = messages.filter((m) => m.conversationId === conversation.id).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
                const last = convMessages[0];
                const unread = convMessages.filter((m) => m.receiverId === currentUser.id && !m.read).length;
                const on = activeConversation?.id === conversation.id;

                return (
                  <Pressable accessibilityRole="button" accessibilityLabel={`${otherUser?.name ?? t("user")} ile sohbet`} accessibilityState={{ selected: on }} key={conversation.id} dataSet={{ vrow: "1" }} onPress={() => selectConversation(conversation.id)} style={({ pressed }) => ({ backgroundColor: on ? colors.primarySoft : pressed ? colors.surfaceAlt : "transparent", borderLeftColor: on ? colors.primary : "transparent", borderLeftWidth: 3, flexDirection: "row", gap: 11, paddingHorizontal: 13, paddingVertical: 12 })}>
                    <UserAvatar uri={otherUser?.avatar} size={42} />
                    <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                      <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
                        <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 13.5, fontWeight: "700" }}>{otherUser?.name ?? t("user")}</Text>
                        <Text style={{ color: colors.subtle, fontSize: 10.5, fontWeight: "700" }}>{last ? inboxTime(last.createdAt) : ""}</Text>
                      </View>
                      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>{conversation.partnerId ? translateCopy("Ortaklık · ", language) : ""}{listing ? displayListingTitle(listing.title) : t("listingConversation")}</Text>
                      <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
                        <Text numberOfLines={1} style={{ color: unread ? colors.ink : colors.muted, flex: 1, fontSize: 12, fontWeight: unread ? "800" : "500" }}>{last ? `${last.senderId === currentUser.id ? translateCopy("Sen: ", language) : ""}${messagePreview(last)}` : t("conversationStarted")}</Text>
                        {unread ? <View style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 999, height: 18, justifyContent: "center", minWidth: 18, paddingHorizontal: 5 }}><Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "700" }}>{unread > 9 ? "9+" : unread}</Text></View> : null}
                      </View>

                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Arşivlenen konuşmaları göster", language)} onPress={() => { setActiveId(null); setShowArchived((v) => !v); }} style={({ pressed }) => ({ alignItems: "center", backgroundColor: pressed ? colors.surfaceAlt : colors.surface, borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 13 })}>
              <MaterialCommunityIcons name={showArchived ? "inbox-arrow-down-outline" : "archive-outline"} size={17} color={colors.muted} />
              <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{showArchived ? translateCopy("Gelen kutusuna dön", language) : translateCopy("Arşivlenen konuşmaları göster", language)}</Text>
            </Pressable>
          </View>

          {/* ORTA: sohbet */}
          <View style={{ backgroundColor: colors.background, flex: 1, minWidth: 0 }}>
            {activeConversation && activeContext ? (
              <>
                <View style={{ alignItems: "center", backgroundColor: colors.surface, borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 12, paddingHorizontal: 18, paddingVertical: 11 }}>
                  <UserAvatar uri={activeOther?.avatar} size={38} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 14, fontWeight: "700" }}>{activeOther?.name ?? t("user")}</Text>
                    {otherTyping ? (
                      <Text numberOfLines={1} style={{ color: colors.primary, fontSize: 12, fontWeight: "800" }}>{translateCopy("yazıyor…", language)}</Text>
                    ) : (
                      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{translateCopy(activeIsPartner ? "Ortaklık görüşmesi" : "İlan görüşmesi", language)}</Text>
                    )}
                  </View>
                  {roomForContextPanel ? <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("İlan ayrıntıları", language)} accessibilityState={{ expanded: showDetails }} onPress={() => setShowDetails((v) => !v)} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: showDetails ? colors.primarySoft : colors.surfaceAlt }}><MaterialCommunityIcons name="information-outline" size={20} color={colors.primaryDark} /></Pressable> : null}
                  {activeOther?.id && activeListing?.contactMethod !== "message" ? (
                    // Telefon feed'de taşınmaz; arama anında (girişli kullanıcı) çekilir.
                    <Pressable accessibilityRole="button" hitSlop={8} accessibilityLabel={translateCopy("Ara", language)} onPress={async () => { const p = activeOther.phone || (await fetchSellerPhone(activeOther.id)); const tel = p.replace(/[^0-9+]/g, ""); if (tel) void openUrlSafe(`tel:${tel}`); }} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, height: 34, justifyContent: "center", width: 34 }}><MaterialCommunityIcons name="phone-outline" size={16} color={colors.muted} /></Pressable>
                  ) : null}
                  <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Sohbet seçenekleri", language)} accessibilityState={{ expanded: showTools }} onPress={() => setShowTools((v) => !v)} style={{ width: 38, height: 38, alignItems: "center", justifyContent: "center" }}><MaterialCommunityIcons name="dots-horizontal" size={21} color={colors.muted}/></Pressable>
                </View>
                {showTools ? <View style={{ backgroundColor: colors.surface, borderBottomColor: colors.line, borderBottomWidth: 1, paddingHorizontal: 18, paddingVertical: 8, flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
                  <Pressable accessibilityRole="button" hitSlop={8} accessibilityLabel={translateCopy("Önemli işaretle", language)} onPress={() => toggleStar(activeConversation.id)} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, height: 34, justifyContent: "center", width: 34 }}><MaterialCommunityIcons name={starred[activeConversation.id] ? "star" : "star-outline"} size={16} color={starred[activeConversation.id] ? colors.gold : colors.muted} /></Pressable>
                  <Pressable accessibilityRole="button" hitSlop={8} accessibilityLabel={translateCopy("Arşivle", language)} onPress={() => toggleArchive(activeConversation.id)} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, height: 34, justifyContent: "center", width: 34 }}><MaterialCommunityIcons name="archive-outline" size={16} color={colors.muted} /></Pressable>
                  {/* Engelle/kaldır — masaüstünde eksikti (mobil paritesi). Engellenince composer banner'a döner. */}
                  {activeOtherId ? (
                    <Pressable accessibilityRole="button" hitSlop={8} accessibilityLabel={activeBlocked ? translateCopy("Engeli kaldır", language) : translateCopy("Kullanıcıyı engelle", language)}
                      onPress={() => {
                        if (!activeOtherId) return;
                        if (activeBlocked) { void unblockUser(activeOtherId); return; }
                        Alert.alert(translateCopy("Kullanıcıyı engelle", language), translateCopy("Bu kişi sana mesaj gönderemez, sen de ona gönderemezsin.", language), [
                          { text: translateCopy("Vazgeç", language), style: "cancel" },
                          { text: translateCopy("Engelle", language), style: "destructive", onPress: () => void blockUser(activeOtherId) }
                        ]);
                      }}
                      style={{ alignItems: "center", backgroundColor: activeBlocked ? colors.accentSoft : colors.surfaceAlt, borderColor: activeBlocked ? colors.accent : colors.line, borderRadius: 999, borderWidth: 1, height: 34, justifyContent: "center", width: 34 }}>
                      <MaterialCommunityIcons name={activeBlocked ? "account-cancel" : "account-cancel-outline"} size={16} color={activeBlocked ? colors.accent : colors.muted} />
                    </Pressable>
                  ) : null}
                </View> : null}
                <ConversationListingStrip listing={activeListing} />

                <ScrollView ref={deskScrollRef} scrollEventThrottle={16} onScroll={(e) => { const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent; deskNearBottomRef.current = contentSize.height - (contentOffset.y + layoutMeasurement.height) < 120; }} onContentSizeChange={() => { if (deskNearBottomRef.current) deskScrollRef.current?.scrollToEnd({ animated: false }); }} showsVerticalScrollIndicator={false} style={{ backgroundColor: colors.background, flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: activeMessages.length === 0 ? "center" : "flex-start", padding: 22 }}>
                  {activeMessages.length === 0 ? <EmptyState title={translateCopy("Henüz mesaj yok", language)} body={translateCopy("İlk mesajı yaz ve konuşmayı başlat.", language)} mascot="mobile" /> : null}
                  {activeMessages.map((m, i) => {
                    const mine = m.senderId === currentUser.id;
                    const showDay = i === 0 || msgDay(m.createdAt) !== msgDay(activeMessages[i - 1].createdAt);
                    const nextM = activeMessages[i + 1];
                    const prevM = activeMessages[i - 1];
                    const grouped = Boolean(prevM) && prevM.senderId === m.senderId && !showDay;
                    const lastOfGroup = !nextM || nextM.senderId !== m.senderId || msgDay(nextM.createdAt) !== msgDay(m.createdAt);
                    return (
                      <View key={m.id} style={{ marginTop: i === 0 ? 0 : showDay ? 6 : grouped ? 2 : 10 }}>
                        {showDay ? (
                          <View style={{ alignItems: "center", marginBottom: 8 }}>
                            <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 3 }}><Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}>{dayHeader(msgDay(m.createdAt))}</Text></View>
                          </View>
                        ) : null}
                        <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 8, justifyContent: mine ? "flex-end" : "flex-start" }}>
                          {!mine ? (
                            lastOfGroup ? (
                              <UserAvatar uri={activeOther?.avatar} size={25} />
                            ) : <View style={{ width: 25 }} />
                          ) : null}
                          {/* Balon + "tekrar dene" DİKEY yığın: eskiden tekrar-dene balonun YANINDA (satırda)
                              duruyordu → uzun mesajda %78 balon + etiket satırı taşırıyordu. */}
                          <View style={{ alignItems: mine ? "flex-end" : "flex-start", flexShrink: 1, maxWidth: "78%", minWidth: 0 }}>
                          <View style={{ backgroundColor: mine ? colors.primary : colors.surface, borderColor: mine ? colors.primary : colors.line, borderTopLeftRadius: 14, borderTopRightRadius: 14, borderBottomLeftRadius: mine ? 14 : 4, borderBottomRightRadius: mine ? 4 : 14, borderWidth: 1, maxWidth: "100%", overflow: "hidden", paddingHorizontal: m.attachmentType === "image" ? 4 : 13, paddingVertical: m.attachmentType === "image" ? 4 : 9 }}>
                            {m.attachmentType === "image" && m.attachmentUrl ? (
                              <Pressable accessibilityRole="imagebutton" accessibilityLabel={translateCopy("Görseli büyüt", language)} onPress={() => m.attachmentUrl && setLightboxUri(m.attachmentUrl)}><SafeRemoteImage uri={m.attachmentUrl} accessibilityLabel={translateCopy("Sohbet görseli", language)} contentFit="cover" style={{ backgroundColor: colors.line, borderRadius: 10, height: 190, maxWidth: "100%", width: 240 }} /></Pressable>
                            ) : null}
                            {m.attachmentType === "file" && m.attachmentUrl ? (
                              <Pressable accessibilityRole="button" accessibilityLabel={`Dosyayı aç: ${m.attachmentName ?? "Dosya"}`} onPress={() => m.attachmentUrl && void openUrlSafe(m.attachmentUrl)} style={{ alignItems: "center", flexDirection: "row", gap: 8, paddingVertical: 2 }}><MaterialCommunityIcons name="file-document-outline" size={22} color={mine ? "#FFFFFF" : colors.primaryDark} /><Text numberOfLines={1} style={{ color: mine ? "#FFFFFF" : colors.ink, flexShrink: 1, fontSize: 12.5, fontWeight: "700", maxWidth: 180 }}>{m.attachmentName ?? "Dosya"}</Text></Pressable>
                            ) : null}
                            {m.body ? <Text style={{ color: mine ? "#FFFFFF" : colors.ink, fontSize: 13.5, fontWeight: "500", lineHeight: 19, paddingHorizontal: m.attachmentType === "image" ? 9 : 0, paddingTop: m.attachmentType === "image" ? 5 : 0 }}>{m.body}</Text> : null}
                            {lastOfGroup ? (
                              <View style={{ alignItems: "center", alignSelf: "flex-end", flexDirection: "row", gap: 3, marginTop: 3, paddingHorizontal: m.attachmentType === "image" ? 9 : 0, paddingBottom: m.attachmentType === "image" ? 4 : 0 }}>
                                <Text style={{ color: mine ? "#DCE7F7" : colors.muted, fontSize: 10, fontWeight: "700" }}>{msgTime(m.createdAt)}</Text>
                                {mine ? (m.status === "failed"
                                  ? <MaterialCommunityIcons name="alert-circle" size={13} color="#FFD9D0" />
                                  : <MaterialCommunityIcons name={m.read ? "check-all" : "check"} size={13} color={m.read ? "#FFFFFF" : "#C7D5EC"} />) : null}
                              </View>
                            ) : null}
                          </View>
                          {mine && m.status === "failed" ? (
                            <Pressable accessibilityRole="button" onPress={() => retryMessage(m.id)} style={({ pressed }) => ({ alignItems: "center", flexDirection: "row", gap: 3, marginTop: 3, opacity: pressed ? 0.7 : 1 })}>
                              <MaterialCommunityIcons name="refresh" size={12} color={colors.accent} />
                              <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "800" }}>{translateCopy("Gönderilemedi · tekrar dene", language)}</Text>
                            </Pressable>
                          ) : null}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                  <ConversationOfferCard key={activeConversation.id} conversation={activeConversation} listing={activeListing} />
                </ScrollView>

                {/* Temiz composer (WhatsApp/Sahibinden tarzı): ekle · yaz · gönder.
                    Hazır cevaplar ve etiket satırları kaldırıldı — mesaj alanı ferah. */}
                <View style={{ backgroundColor: colors.surface, borderTopColor: colors.line, borderTopWidth: 1, gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
                  {draftRisk.hasRisk ? (
                    <View style={{ alignItems: "center", backgroundColor: colors.warningSoft, borderColor: colors.warning, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, paddingHorizontal: 10, paddingVertical: 8 }}>
                      <MaterialCommunityIcons name="shield-alert-outline" size={16} color={colors.warning} />
                      <Text style={{ color: colors.ink, flex: 1, fontSize: 11.5, fontWeight: "700", lineHeight: 16 }}>{translateCopy("Bu mesajda hassas ödeme veya site dışı iletişim ifadesi var. Görüşmeyi kayıtlı mesaj içinde net tutun.", language)}</Text>
                    </View>
                  ) : null}
                  {activeBlocked || activeClosed ? (
                    <View style={{ alignItems: "center", backgroundColor: colors.accentSoft, borderColor: colors.accent, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingVertical: 12 }}>
                      {activeBlocked ? <MaterialCommunityIcons name="account-cancel" size={18} color={colors.accent} /> : <MaterialCommunityIcons name="lock-outline" size={18} color={colors.accent} />}
                      <Text style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "700" }}>{translateCopy(activeBlocked ? "Bu kişiyi engelledin. Mesajlaşma iki yönlü kapalı." : "Bu konuşma kapatılmış. Mesaj geçmişini görüntüleyebilirsin.", language)}</Text>
                      {activeBlocked ? <Pressable accessibilityRole="button" onPress={() => activeOtherId && void unblockUser(activeOtherId)} style={({ pressed }) => ({ backgroundColor: colors.surface, borderColor: colors.accent, borderRadius: 999, borderWidth: 1, opacity: pressed ? 0.8 : 1, paddingHorizontal: 14, paddingVertical: 8 })}>
                        <Text style={{ color: colors.accent, fontSize: 12.5, fontWeight: "700" }}>{translateCopy("Engeli Kaldır", language)}</Text>
                      </Pressable> : null}
                    </View>
                  ) : (
                  <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 8 }}>
                    <Pressable accessibilityRole="button" hitSlop={8} accessibilityLabel={translateCopy("Görsel ekle", language)} onPress={() => void attachImage()} disabled={attaching} style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, height: 44, justifyContent: "center", opacity: pressed ? 0.7 : 1, width: 44 })}><MaterialCommunityIcons name={attaching ? "loading" : "paperclip"} size={20} color={attaching ? colors.primary : colors.muted} /></Pressable>
                    <TextInput testID="message-composer" maxLength={4000} value={draft} onChangeText={(text) => { setDraft(text); notifyTyping(); }} multiline numberOfLines={1} accessibilityLabel={translateCopy("Mesaj yaz…", language)} placeholder={translateCopy("Mesaj yaz…", language)} placeholderTextColor={colors.muted} onKeyPress={onComposerKeyPress} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 22, borderWidth: 1, color: colors.ink, flex: 1, fontSize: 14, maxHeight: 120, minHeight: 44, minWidth: 0, paddingHorizontal: 16, paddingVertical: 12 }} />
                    <Pressable accessibilityRole="button" hitSlop={8} accessibilityLabel={translateCopy("Mesajı gönder", language)} disabled={!draft.trim()} onPress={sendDraft} style={({ pressed }) => ({ alignItems: "center", backgroundColor: draft.trim() ? colors.primary : colors.line, borderRadius: 999, height: 44, justifyContent: "center", opacity: pressed ? 0.8 : 1, width: 44 })}><MaterialCommunityIcons name="send" size={19} color="#FFFFFF" /></Pressable>
                  </View>
                  )}
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 5 }}>
                    <MaterialCommunityIcons name="lock-outline" size={12} color={colors.subtle} />
                    <Text numberOfLines={1} style={{ color: colors.subtle, fontSize: 11, fontWeight: "600" }}>{translateCopy("OrtakSat ödeme/kargo işlemez; taraflar kendi aralarında anlaşır. Kişisel veri paylaşımına dikkat.", language)}</Text>
                  </View>
                </View>
              </>
            ) : (
              <View style={{ alignItems: "center", flex: 1, justifyContent: "center", padding: 24 }}>
                <EmptyState title={myConversations.length ? translateCopy("Soldan bir konuşma seçin", language) : t("noConversation")} body={myConversations.length ? translateCopy("Görüntülemek için sol taraftan bir görüşme seçin.", language) : t("noConversationBody")} />
              </View>
            )}
          </View>

          {/* SAĞ: İlan Detayları */}
          {activeConversation && activeContext && roomForContextPanel && showDetails ? (
            <View testID="conversation-details" style={{ borderLeftColor: colors.line, borderLeftWidth: 1, width: 280 }}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, gap: 14, padding: 16 }} showsVerticalScrollIndicator={false}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                <Text style={{ color: colors.ink, flex: 1, fontSize: 15.5, fontWeight: "700" }}>{translateCopy("İlan bilgileri", language)}</Text>
                {activeListing ? <View style={{ backgroundColor: activeListing.status === "active" ? colors.successSoft : colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}><Text style={{ color: activeListing.status === "active" ? colors.success : colors.muted, fontSize: 10.5, fontWeight: "700" }}>{translateCopy(activeListing.status === "active" ? "Yayında" : "Yayında değil", language)}</Text></View> : null}
              </View>

              {activeListing ? (
                <>
                  <View style={{ borderRadius: 12, overflow: "hidden" }}>
                    <SafeRemoteImage uri={activeListing.image} accessibilityLabel={displayListingTitle(activeListing.title)} contentFit="cover" style={{ backgroundColor: colors.line, height: 150, width: "100%" }} />
                    {activePhotoCount > 1 ? <View style={{ alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 999, bottom: 8, flexDirection: "row", gap: 4, paddingHorizontal: 8, paddingVertical: 3, position: "absolute", right: 8 }}><MaterialCommunityIcons name="camera" size={12} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 10.5, fontWeight: "800" }}>{activePhotoCount}</Text></View> : null}
                  </View>
                  <View style={{ gap: 5 }}>
                    <Text numberOfLines={2} style={{ color: colors.ink, fontSize: 14.5, fontWeight: "700", lineHeight: 19 }}>{displayListingTitle(activeListing.title)}</Text>
                    <Text style={{ color: colors.primaryDark, fontSize: 20, fontWeight: "700" }}>{moneyIn(activeListing.price, activeListing.currency)}</Text>
                    <View style={{ alignItems: "center", flexDirection: "row", gap: 5 }}><MaterialCommunityIcons name="map-marker-outline" size={14} color={colors.muted} /><Text numberOfLines={1} style={{ color: colors.muted, flex: 1, fontSize: 12, fontWeight: "700" }}>{activeListing.location}</Text></View>
                  </View>
                  <ConversationListingActions key={activeConversation.id} listing={activeListing} conversation={activeConversation} />
                  {activeListing.partnershipMode !== "none" ? <ListingCommission listing={activeListing} compact /> : null}

                  {/* Satıcı kartı */}
                  <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 12, borderWidth: 1, gap: 10, padding: 12 }}>
                    <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                      <UserAvatar uri={activeOther?.avatar} size={40} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                          <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 14, fontWeight: "700" }}>{activeOther?.name ?? t("user")}</Text>
                          {activeOther?.verifiedIdentity ? <MaterialCommunityIcons name="check-decagram" size={15} color={colors.success} /> : null}
                        </View>
                        <Text style={{ color: colors.muted, fontSize: 11.5 }}>{activeOther?.rating && activeOther.rating > 0 ? `★ ${activeOther.rating.toFixed(1)} · ${translateCopy("Kullanıcı değerlendirmesi", language)}` : translateCopy("Henüz değerlendirme yok", language)}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", gap: 7 }}>
                      {activeOtherId ? (
                        <Link href={{ pathname: "/store/[id]", params: { id: activeOtherId } }} asChild><Pressable style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 9, flex: 1, paddingVertical: 9 }}><Text style={{ color: "#FFFFFF", fontSize: 11.5, fontWeight: "700" }}>{translateCopy("Profili Gör", language)}</Text></Pressable></Link>
                      ) : null}
                      <Link href={{ pathname: "/listing/[id]", params: { id: activeListing.id } }} asChild><Pressable style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 9, borderWidth: 1, flex: 1, paddingVertical: 9 }}><Text style={{ color: colors.ink, fontSize: 11.5, fontWeight: "700" }}>{translateCopy("İlanı Gör", language)}</Text></Pressable></Link>
                      <Pressable accessibilityRole="button" onPress={() => toggleFollow(activeOtherId ?? "")} style={{ alignItems: "center", backgroundColor: following[activeOtherId ?? ""] ? colors.primarySoft : colors.surface, borderColor: following[activeOtherId ?? ""] ? colors.primary : colors.line, borderRadius: 9, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 9 }}><Text style={{ color: colors.primaryDark, fontSize: 11.5, fontWeight: "700" }}>{following[activeOtherId ?? ""] ? translateCopy("Takipte", language) : translateCopy("+ Takip", language)}</Text></Pressable>
                    </View>
                  </View>

                  {/* Aksiyonlar */}
                  <Accordion title={translateCopy("Diğer işlemler", language)} icon="dots-horizontal">
                    <DeskActionRow icon="handshake-outline" title={translateCopy("Ortaklık öner", language)} sub={translateCopy("Ortaklık için mesaj taslağı hazırla", language)} onPress={() => setDraft(translateCopy("Bu ürün için ortak satış yapmak istiyorum; komisyon ve şartları konuşabilir miyiz?", language))} />
                    <DeskActionRow icon="shield-check-outline" title={translateCopy("Güvenli anlaşma taslağı", language)} sub={translateCopy("Ödeme/teslimat/komisyon şartlarını mesajda netleştir", language)} onPress={() => setDraft(safeDealDraft)} />
                    <DeskActionRow icon="tag-outline" title={translateCopy("Mesajda fiyat öner", language)} sub={translateCopy("Mesaja fiyat önerisi ekle", language)} onPress={insertPriceOffer} />
                    <DeskActionRow icon="archive-outline" title={archivedIds.includes(activeConversation.id) ? translateCopy("Arşivden çıkar", language) : translateCopy("Sohbeti arşivle", language)} sub={translateCopy("Görüşmeyi gelen kutusundan gizle", language)} onPress={() => toggleArchive(activeConversation.id)} />
                    <DeskActionRow icon="flag-outline" title={translateCopy("Şikayet et", language)} sub={translateCopy("Bu ilanı veya kullanıcıyı bildir", language)} href={{ pathname: "/report", params: { listingId: activeListing.id, userId: activeOtherId } } as Href} />
                  </Accordion>
                </>
              ) : (
                <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 12, gap: 6, padding: 14 }}>
                  <MaterialCommunityIcons name="tag-off-outline" size={22} color={colors.muted} />
                  <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{translateCopy("İlan bilgileri görüntülenemiyor", language)}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 16 }}>{translateCopy("İlan ayrıntılarına şu anda ulaşılamıyor. Mesajlaşma geçmişin burada kalır.", language)}</Text>
                </View>
              )}
            </ScrollView>
            </View>
          ) : null}
        </View>
        <Modal visible={lightboxUri !== null} transparent animationType="fade" onRequestClose={() => setLightboxUri(null)}>
          <Pressable onPress={() => setLightboxUri(null)} style={{ alignItems: "center", backgroundColor: "rgba(0,0,0,0.92)", flex: 1, justifyContent: "center", padding: 24 }}>
            {lightboxUri ? <SafeRemoteImage uri={lightboxUri} contentFit="contain" style={{ height: "84%", width: "90%" }} /> : null}
            <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Kapat", language)} onPress={() => setLightboxUri(null)} style={{ position: "absolute", right: 22, top: 22 }}>
              <MaterialCommunityIcons name="close-circle" size={34} color="#FFFFFF" />
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    );
  }

  const mobileFilters: Array<{ key: InboxFilter; label: string; count: number }> = [
    { key: "all", label: translateCopy("Tümü", language), count: 0 },
    { key: "buyers", label: translateCopy("Alıcı", language), count: 0 },
    { key: "sellers", label: translateCopy("Satıcı", language), count: 0 },
    { key: "partner", label: translateCopy("Ortaklık", language), count: 0 }
  ];
  return (
    <View testID="web-inbox" style={{ backgroundColor: colors.background, flex: 1, minHeight: 0 }}>
      <View style={{ backgroundColor: colors.surface, paddingHorizontal: 14, paddingTop: 14, flexDirection: "row", alignItems: "center", gap: 8 }}><Text style={{ color: colors.ink, fontSize: 19, fontWeight: "700", flex: 1 }}>{translateCopy("Mesajlar", language)}</Text><Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Okunmamış", language)} accessibilityState={{ selected: filter === "unread" }} onPress={() => setFilter(filter === "unread" ? "all" : "unread")} style={{ width: 38, height: 38, alignItems: "center", justifyContent: "center" }}><MaterialCommunityIcons name="email-mark-as-unread" size={19} color={filter === "unread" ? colors.primaryDark : colors.muted}/></Pressable><Link href="/explore" asChild><Pressable accessibilityLabel={translateCopy("Yeni görüşme için ilan bul", language)} style={{ width: 38, height: 38, alignItems: "center", justifyContent: "center" }}><MaterialCommunityIcons name="plus" size={22} color={colors.primaryDark}/></Pressable></Link></View>
      {/* Temiz üst başlık: arama + filtre (WhatsApp/Sahibinden mesaj tarzı) */}
      <View style={{ backgroundColor: colors.surface, borderBottomColor: colors.line, borderBottomWidth: 1, gap: 10, paddingBottom: 10, paddingHorizontal: 12, paddingTop: 12 }}>
        <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 8, paddingHorizontal: 14 }}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.muted} />
          <TextInput value={query} onChangeText={setQuery} accessibilityLabel={t("searchMessagesPlaceholder")} placeholder={t("searchMessagesPlaceholder")} placeholderTextColor={colors.muted} style={{ color: colors.ink, flex: 1, fontSize: 14.5, minHeight: 44, paddingVertical: 8 }} />
          {query ? <Pressable onPress={() => setQuery("")} hitSlop={10}><MaterialCommunityIcons name="close-circle" size={19} color={colors.muted} /></Pressable> : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 7 }}>
          {mobileFilters.map((f) => {
            const on = filter === f.key;
            return (
              <Pressable accessibilityRole="button" accessibilityLabel={f.label} accessibilityState={{ selected: on }} key={f.key} onPress={() => { setActiveId(null); setFilter(f.key); }} style={{ alignItems: "center", backgroundColor: on ? colors.primary : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 13, paddingVertical: 7 }}>
                <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12.5, fontWeight: "800" }}>{f.label}</Text>
                {f.count > 0 ? <View style={{ alignItems: "center", backgroundColor: on ? "rgba(255,255,255,0.24)" : colors.primary, borderRadius: 999, justifyContent: "center", minWidth: 17, paddingHorizontal: 4 }}><Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "700" }}>{f.count}</Text></View> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* keyboardShouldPersistTaps: yoksa isimle filtreleyip sonuca basınca İLK dokunuş
          yalnız klavyeyi kapatıyor (çift dokunuş gerekiyordu). seller/favorites'ta zaten var. */}
      <ScrollView keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ flexGrow: 1, paddingBottom: 0 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}>
      {myConversations.length === 0 ? <View style={{ padding: 24 }}><EmptyState title={t("noConversation")} body={t("noConversationBody")} action={{ label: "Ürünleri keşfet", href: "/explore", icon: "compass-outline" }} mascot="mobile" /></View> : null}
      {myConversations.length > 0 && visibleConversations.length === 0 ? <View style={{ padding: 24 }}>{showArchived && filter === "all" && !query.trim() ? <EmptyState title={translateCopy("Arşiv boş", language)} body={translateCopy("Arşivlenen görüşme yok.", language)} /> : <EmptyState title={t("noResults")} body={t("searchOrFilterAgain")} mascot="thinking" />}</View> : null}

      {visibleConversations.map((conversation) => {
        const listing = findListing(conversation.listingId);
        const otherId = conversation.participantIds.find((id) => id !== currentUser.id);
        const otherUser = otherId ? findUser(otherId) : undefined;
        const conversationMessages = messages.filter((item) => item.conversationId === conversation.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const lastMessage = conversationMessages[0];
        const unreadCount = conversationMessages.filter((item) => item.receiverId === currentUser.id && !item.read).length;


        const isPartner = Boolean(conversation.partnerId);

        return (
          <Link key={conversation.id} href={{ pathname: "/chat/[id]", params: { id: conversation.id } }} asChild>
            <Pressable dataSet={{ vrow: "1" }} style={{ alignItems: "center", backgroundColor: colors.surface, borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingVertical: 12 }}>
              <View>
                <UserAvatar uri={otherUser?.avatar} size={44} />
                {isPartner ? (
                  <View style={{ alignItems: "center", backgroundColor: colors.primary, borderColor: colors.surface, borderRadius: 999, borderWidth: 2, bottom: -3, height: 22, justifyContent: "center", position: "absolute", right: -3, width: 22 }}>
                    <MaterialCommunityIcons name="handshake" size={11} color="#FFFFFF" />
                  </View>
                ) : null}
              </View>

              <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
                <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                  <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 14, fontWeight: "700" }}>{otherUser?.name ?? t("user")}</Text>
                  <Text style={{ color: unreadCount ? colors.primary : colors.subtle, fontSize: 11, fontWeight: unreadCount ? "900" : "700" }}>{lastMessage ? inboxTime(lastMessage.createdAt) : ""}</Text>
                </View>
                <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                  <Text numberOfLines={1} style={{ color: unreadCount ? colors.ink : colors.muted, flex: 1, fontSize: 13, fontWeight: unreadCount ? "800" : "500" }}>
                    {lastMessage ? `${lastMessage.senderId === currentUser.id ? t("youPrefix") : ""}${messagePreview(lastMessage)}` : t("conversationStarted")}
                  </Text>
                  {unreadCount > 0 ? (
                    <View style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 999, height: 20, justifyContent: "center", minWidth: 20, paddingHorizontal: 6 }}>
                      <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "700" }}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                    </View>
                  ) : null}
                </View>
                {listing ? (
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                    <MaterialCommunityIcons name="tag-outline" size={12} color={colors.subtle} />
                    <Text numberOfLines={1} style={{ color: colors.subtle, flex: 1, fontSize: 11.5, fontWeight: "700" }}>{displayListingTitle(listing.title)}</Text>

                  </View>
                ) : null}

              </View>
            </Pressable>
          </Link>
        );
      })}
      {/* Arşiv geçişi — dar (mobil/tablet web) düzende YOKTU: masaüstünde arşivlenen görüşmeler
          telefonda erişilemez kalıyor, hepsi arşivliyse liste "sonuç yok" çıkmazına düşüyordu. */}
      {showArchived || myConversations.some((conversation) => archivedIds.includes(conversation.id)) ? (
        <Pressable accessibilityRole="button" accessibilityLabel={showArchived ? translateCopy("Gelen kutusuna dön", language) : translateCopy("Arşivlenen konuşmaları göster", language)} onPress={() => { setActiveId(null); setShowArchived((v) => !v); }} style={{ alignItems: "center", backgroundColor: colors.surface, borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 48, paddingHorizontal: 14 }}>
          <MaterialCommunityIcons name={showArchived ? "inbox-arrow-down-outline" : "archive-outline"} size={17} color={colors.muted} />
          <Text numberOfLines={1} style={{ color: colors.ink, flexShrink: 1, fontSize: 13, fontWeight: "800" }}>{showArchived ? translateCopy("Gelen kutusuna dön", language) : translateCopy("Arşivlenen konuşmaları göster", language)}</Text>
        </Pressable>
      ) : null}
      <CompactFooter />
      </ScrollView>
    </View>
  );
}

function buildConversationContext({
  conversation,
  currentUserId,
  findUser,
  leads,
  messages,
  partnerships,
  sales,
  t
}: {
  conversation: Conversation;
  currentUserId: string;
  findUser: (id: string) => { name: string } | undefined;
  leads: Lead[];
  messages: Message[];
  partnerships: Partnership[];
  sales: Array<{ partnershipId: string; status: string }>;
  t: (key: string) => string;
}) {
  const conversationMessages = messages.filter((item) => item.conversationId === conversation.id);
  const latestMessage = conversationMessages.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const otherId = conversation.participantIds.find((id) => id !== currentUserId);
  const partnership =
    (conversation.partnerId ? partnerships.find((item) => item.id === conversation.partnerId || item.partnerId === conversation.partnerId) : undefined) ??
    partnerships.find((item) => item.listingId === conversation.listingId && (item.partnerId === otherId || item.partnerId === currentUserId));
  const lead = partnership
    ? leads
        .filter((item) => item.partnershipId === partnership.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
    : leads.filter((item) => item.listingId === conversation.listingId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const sale = partnership ? sales.find((item) => item.partnershipId === partnership.id && item.status !== "paid") : undefined;
  const partnerUser = partnership ? findUser(partnership.partnerId) : undefined;
  const status = sale ? saleStatusText(sale.status, t) : lead ? leadStatusText(lead.status, t) : inferMessageStatus(latestMessage?.body, t);
  const source = partnership
    ? `${partnerUser?.name ?? t("partner")} ${t("partnerLink")}`
    : lead
      ? `${sourceLabels[lead.source]} ${t("request")}`
      : t("directProductMessage");
  const channel = lead ? `${t("channel")}: ${sourceLabels[lead.source]}` : `${t("channel")}: ${t("message")}`;
  const needsAction = Boolean(
    conversationMessages.some((item) => item.receiverId === currentUserId && !item.read) ||
      lead?.status === "new" ||
      lead?.status === "interested" ||
      (sale && sale.status !== "paid")
  );

  return { channel, needsAction, source, status };
}

function conversationPriority(
  conversation: Conversation,
  currentUserId: string,
  messages: Message[],
  context: ReturnType<typeof buildConversationContext>
) {
  const unreadCount = messages.filter((item) => item.conversationId === conversation.id && item.receiverId === currentUserId && !item.read).length;
  const recency = new Date(conversation.lastMessageAt).getTime() || 0;
  return unreadCount * 10000000000000 + (context.needsAction ? 5000000000000 : 0) + recency;
}

function leadStatusText(status: Lead["status"], t: (key: string) => string) {
  if (status === "new") return t("leadNew");
  if (status === "contacted") return t("leadContacted");
  if (status === "interested") return t("leadInterested");
  if (status === "converted") return t("leadConverted");
  return t("leadLost");
}

function inferMessageStatus(body: string | undefined, t: (key: string) => string) {
  const key = searchKey(body ?? "");
  if (key.includes("stok")) return t("askedStock");
  if (key.includes("fiyat") || key.includes("ucret")) return t("askedPrice");
  if (key.includes("kargo") || key.includes("teslim")) return t("askedDelivery");
  if (key.includes("odeme") || key.includes("komisyon")) return t("discussingPayment");
  return t("salesConversation");
}

function saleStatusText(status: string, t: (key: string) => string) {
  if (status === "return_pending") return t("returnPending");
  if (status === "approved") return t("commissionApproved");
  if (status === "seller_paid") return t("paymentApprovalPending");
  if (status === "disputed") return t("disputeOpen");
  if (status === "cancelled") return t("saleCancelled");
  return t("salesTracking");
}

function DeskActionRow({ icon, title, sub, onPress, href }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; sub: string; onPress?: () => void; href?: Href }) {
  const inner = (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 11, paddingVertical: 10 }}>
      <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 9, height: 34, justifyContent: "center", width: 34 }}>
        <MaterialCommunityIcons name={icon} size={17} color={colors.primaryDark} />
      </View>
      <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
        <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{title}</Text>
        <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>{sub}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={18} color={colors.subtle} />
    </View>
  );
  if (href) {
    // Link asChild + fonksiyon-style Pressable web anchor'da stili düşürür → PressLink.
    return <PressLink href={href} style={{}} pressedOpacity={0.7}>{inner}</PressLink>;
  }
  return <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>{inner}</Pressable>;
}

export default function MessagesScreen() {
  return isMobileApp ? <MobileMessages /> : <MessagesScreenLegacy />;
}

function MessagesScreenLegacy() {
  const auth = useStore();
  const { language } = useLanguage();
  const mounted = useMounted();
  if (!mounted) return <ScreenSkeleton />; // hidrasyon-gate (#418)
  if (!auth.authReady) return <ScreenSkeleton />; // oturum geri-yüklenene kadar bekle (auth-flash önle)
  if (!auth.isAuthenticated) return <AuthRequired title={translateCopy("Mesajların için giriş yapın", language)} />;
  // Hesap verisi (konuşmalar) yüklenmeden "Henüz mesaj yok" YALANINI flaşlama.
  if (!auth.accountLoaded) return <ScreenSkeleton />;
  return <MessagesScreenInner />;
}

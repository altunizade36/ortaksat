import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Link, useLocalSearchParams, type Href } from "expo-router";

import { SafeRemoteImage } from "@/components/safe-remote-image";
import { useEffect, useRef, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { AuthRequired } from "@/components/auth-gate";
import { EmptyState, StatusPill } from "@/components/ui";
import { commissionAmount, localToday, money } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { uploadMessageAttachment } from "@/lib/live-service";
import { fetchSellerPhone } from "@/lib/supabase-data";
import { useTypingIndicator } from "@/lib/use-typing";
import { useContentWidth, useIsWideWeb } from "@/lib/layout";
import { searchKey, shortDate } from "@/lib/locale";
import { displayText } from "@/lib/text";
import type { Conversation, Lead, Message, Partnership } from "@/lib/types";
import { useStore } from "@/lib/use-store";

const DESK_QUICK_REPLIES = [
  "Merhaba, ilan hâlâ yayında mı?",
  "Fiyat güncel mi?",
  "Teslimat / görüşme için uygun musunuz?",
  "Ödeme ve teslimat koşullarını mesajda netleştirelim.",
  "Ortak satış için detay konuşabilir miyiz?"
];

type InboxFilter = "all" | "unread" | "action" | "sales" | "partner";

// Mesaj zaman damgasi "YYYY-MM-DD HH:MM" formatinda; sadece saati goster.
function msgTime(createdAt: string) {
  const m = /\d{2}:\d{2}/.exec(createdAt);
  return m ? m[0] : "";
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
  const d = new Date(day);
  if (Number.isNaN(d.getTime())) return day;
  return `${String(d.getDate()).padStart(2, "0")} ${["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"][d.getMonth()]} ${d.getFullYear()}`;
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
  const { conversations, currentUser, findListing, findUser, leads, markConversationRead, messages, notifications, partnerships, sales, sendConversationMessage } = useStore();
  const { t } = useLanguage();
  const isWideWeb = useIsWideWeb();
  const contentWidth = useContentWidth();
  // Orta genişlikte (tablet/yatay telefon) 3. panel sohbeti sıkıştırır; ≥1040px'te göster.
  const roomForContextPanel = contentWidth >= 1040;
  const params = useLocalSearchParams<{ c?: string }>();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [activeId, setActiveId] = useState<string | null>(params.c ?? null);
  const [draft, setDraft] = useState("");
  const [attaching, setAttaching] = useState(false);
  const [starred, setStarred] = useState<Record<string, boolean>>({});
  const [following, setFollowing] = useState<Record<string, boolean>>({});
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const deskScrollRef = useRef<ScrollView>(null);
  // Yukarı kaydırıldıysa gelen mesaj/görsel zorla aşağı çekmesin (dibe yakınken in).
  const deskNearBottomRef = useRef(true);

  // Bir ilandan/sohbet bağlantısından gelen konuşmayı seçili aç.
  useEffect(() => {
    if (params.c) {
      setActiveId(params.c);
      markConversationRead(params.c);
    }
  }, [params.c, markConversationRead]);

  // Acik konusmaya realtime yeni mesaj geldiginde otomatik okundu isaretle.
  useEffect(() => {
    if (activeId) markConversationRead(activeId);
  }, [activeId, messages.length, markConversationRead]);

  // Konuşma değişince (masaüstü 3-panel) dibe inmeye izin ver + aşağı kaydır.
  useEffect(() => {
    deskNearBottomRef.current = true;
    deskScrollRef.current?.scrollToEnd({ animated: false });
  }, [activeId]);
  const myConversations = conversations
    .filter((conversation) => conversation.participantIds.includes(currentUser.id))
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));

  // Masaüstünde ilk konuşmayı varsayılan seçili yap ("yazıyor…" ve okundu için).
  useEffect(() => {
    if (isWideWeb && !activeId && myConversations[0]) setActiveId(myConversations[0].id);
  }, [isWideWeb, activeId, myConversations]);

  const { otherTyping, notifyTyping } = useTypingIndicator(activeId ?? undefined, currentUser.id);
  const unreadMessages = messages.filter((item) => item.receiverId === currentUser.id && !item.read);
  const unreadNotifications = notifications.filter((item) => item.userId === currentUser.id && !item.read);
  const tokens = searchKey(query).split(" ").filter(Boolean);

  const visibleConversations = myConversations.filter((conversation) => {
    if (archivedIds.includes(conversation.id) !== showArchived) return false;
    const context = buildConversationContext({ conversation, currentUserId: currentUser.id, findUser, leads, messages, partnerships, sales, t });
    const listing = findListing(conversation.listingId);
    const otherId = conversation.participantIds.find((id) => id !== currentUser.id);
    const otherUser = otherId ? findUser(otherId) : undefined;
    const conversationMessages = messages.filter((item) => item.conversationId === conversation.id);
    const unreadCount = conversationMessages.filter((item) => item.receiverId === currentUser.id && !item.read).length;
    if (filter === "unread" && unreadCount === 0) return false;
    if (filter === "action" && !context.needsAction) return false;
    if (filter === "sales" && conversation.partnerId) return false;
    if (filter === "partner" && !conversation.partnerId) return false;
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
  }).sort((a, b) => conversationPriority(b, currentUser.id, leads, messages, partnerships, sales, findUser, t) - conversationPriority(a, currentUser.id, leads, messages, partnerships, sales, findUser, t));
  const actionCount = myConversations.filter((conversation) => buildConversationContext({ conversation, currentUserId: currentUser.id, findUser, leads, messages, partnerships, sales, t }).needsAction).length;

  if (isWideWeb) {
    const activeConversation = visibleConversations.find((c) => c.id === activeId) ?? visibleConversations[0] ?? myConversations[0];
    const activeListing = activeConversation ? findListing(activeConversation.listingId) : undefined;
    const activeOtherId = activeConversation?.participantIds.find((id) => id !== currentUser.id);
    const activeOther = activeOtherId ? findUser(activeOtherId) : undefined;
    // Eskiden yeniye sırala. `messages` dizisi yeni→eski tutulur (başa eklenir);
    // aynı zaman damgasında daha yüksek index = daha eski, o yüzden önce gelir.
    const msgIndex = new Map(messages.map((m, i) => [m.id, i]));
    const activeMessages = activeConversation
      ? messages.filter((m) => m.conversationId === activeConversation.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || ((msgIndex.get(b.id) ?? 0) - (msgIndex.get(a.id) ?? 0)))
      : [];
    const activeContext = activeConversation
      ? buildConversationContext({ conversation: activeConversation, currentUserId: currentUser.id, findUser, leads, messages, partnerships, sales, t })
      : undefined;

    const selectConversation = (id: string) => {
      setActiveId(id);
      markConversationRead(id);
    };
    const sendDraft = () => {
      if (!activeConversation || !draft.trim()) return;
      sendConversationMessage(activeConversation.id, draft.trim());
      setDraft("");
      // Snap: onContentSizeChange zaten anlık olarak sona kaydırır (çift/kaymalı jank yok).
    };
    const attachImage = async () => {
      if (!activeConversation || attaching) return;
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      setAttaching(true);
      try {
        const url = await uploadMessageAttachment(result.assets[0].uri, currentUser.id);
        sendConversationMessage(activeConversation.id, draft.trim(), { url, type: "image" });
        setDraft("");
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
    const toggleArchive = (cid: string) => setArchivedIds((ids) => (ids.includes(cid) ? ids.filter((x) => x !== cid) : [...ids, cid]));
    const insertPriceOffer = () => {
      const base = activeListing ? money(activeListing.price) : "";
      setDraft((d) => (d.trim() ? d : `Fiyat teklifim: ${base ? base.replace(/[0-9.,]+/, "___") : "₺___"} — uygun olur mu?`));
    };

    const filters: Array<{ key: InboxFilter; label: string; count: number }> = [
      { key: "all", label: "Tümü", count: myConversations.length },
      { key: "unread", label: "Okunmamış", count: unreadMessages.length },
      { key: "action", label: "Yanıt bekleyen", count: actionCount },
      { key: "sales", label: "Satış konuşmaları", count: myConversations.filter((c) => !c.partnerId).length },
      { key: "partner", label: "Ortak satış", count: myConversations.filter((c) => c.partnerId).length }
    ];
    const activeIsPartner = Boolean(activeConversation?.partnerId);
    const activePhotoCount = activeListing ? (activeListing.adAssets?.length ?? 0) + 1 : 0;
    const activeListingNo = activeListing ? activeListing.id.replace(/[^0-9]/g, "").slice(-10) || activeListing.id : "";
    const activeRisk = scanMessageRisk([...activeMessages.map((m) => m.body), draft].filter(Boolean).join(" "));
    const draftRisk = scanMessageRisk(draft);
    const estimatedCommission = activeListing ? commissionAmount(activeListing) : 0;
    const safeDealDraft = activeListing
      ? `Ödeme, teslimat ve komisyon koşullarını OrtakSat mesaj kaydında netleştirelim. İlan: ${displayText(activeListing.title)} - Fiyat: ${money(activeListing.price)}${estimatedCommission ? ` - Tahmini komisyon: ${money(estimatedCommission)}` : ""}.`
      : "Ödeme, teslimat ve komisyon koşullarını OrtakSat mesaj kaydında netleştirelim.";

    const respRate = activeOther?.responseRate ?? 0;
    const respText = respRate >= 80 ? "Bu satıcı mesajlara genellikle hızlı yanıt verir." : respRate >= 50 ? "Bu satıcı mesajlara çoğunlukla yanıt verir." : "Yanıtlar biraz gecikebilir.";
    const statCards = [
      { icon: "email-outline" as const, tint: colors.primarySoft, color: colors.primaryDark, value: unreadMessages.length, label: "Okunmamış", sub: "Yeni mesajınız var" },
      { icon: "clock-outline" as const, tint: colors.goldSoft, color: colors.gold, value: actionCount, label: "Yanıt bekleyen", sub: "Yanıt bekleyen mesajlar" },
      { icon: "message-text-outline" as const, tint: colors.infoSoft, color: colors.info, value: myConversations.filter((c) => !c.partnerId).length, label: "Satış konuşması", sub: "Aktif görüşmeler" },
      { icon: "handshake-outline" as const, tint: colors.primarySoft, color: colors.primaryDark, value: myConversations.filter((c) => c.partnerId).length, label: "Aktif ortak satış", sub: "Devam eden ortaklıklar" }
    ];
    return (
      <View style={{ backgroundColor: colors.background, flex: 1, gap: 14, paddingHorizontal: 20, paddingVertical: 16 }}>
        {/* Üst: 4 istatistik kartı */}
        <View style={{ flexDirection: "row", gap: 12, marginHorizontal: "auto", maxWidth: 1280, width: "100%" }}>
          {statCards.map((s) => (
            <View key={s.label} style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flex: 1, flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 13 }}>
              <View style={{ alignItems: "center", backgroundColor: s.tint, borderRadius: 12, height: 44, justifyContent: "center", width: 44 }}>
                <MaterialCommunityIcons name={s.icon} size={22} color={s.color} />
              </View>
              <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
                <View style={{ alignItems: "baseline", flexDirection: "row", gap: 6 }}>
                  <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>{s.value}</Text>
                  <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "800" }}>{s.label}</Text>
                </View>
                <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>{s.sub}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* 3 panel */}
        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flex: 1, flexDirection: "row", marginHorizontal: "auto", maxWidth: 1280, minHeight: 0, overflow: "hidden", width: "100%" }}>
          {/* SOL: liste */}
          <View style={{ borderRightColor: colors.line, borderRightWidth: 1, width: 320 }}>
            <View style={{ gap: 10, padding: 16 }}>
              <Text style={{ color: colors.ink, fontSize: 21, fontWeight: "900" }}>Mesajlar</Text>
              <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 17 }}>Alıcı, satıcı ve ortak satış görüşmelerini tek yerden yönet.</Text>
              <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 8, paddingHorizontal: 14 }}>
                <MaterialCommunityIcons name="magnify" size={18} color={colors.muted} />
                <TextInput value={query} onChangeText={setQuery} placeholder="Görüşmelerde ara" placeholderTextColor={colors.muted} style={{ color: colors.ink, flex: 1, fontSize: 13.5, minHeight: 40, paddingVertical: 6 }} />
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {filters.map((f) => {
                  const on = filter === f.key;
                  return (
                    <Pressable key={f.key} onPress={() => setFilter(f.key)} style={{ alignItems: "center", backgroundColor: on ? colors.primary : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 11, paddingVertical: 6 }}>
                      <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 11.5, fontWeight: "800" }}>{f.label}</Text>
                      {f.count > 0 ? <View style={{ alignItems: "center", backgroundColor: on ? "rgba(255,255,255,0.24)" : colors.primary, borderRadius: 999, justifyContent: "center", minWidth: 16, paddingHorizontal: 4 }}><Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "900" }}>{f.count}</Text></View> : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={{ backgroundColor: colors.line, height: 1 }} />
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 8 }}>
              {visibleConversations.length === 0 ? (
                <View style={{ padding: 16 }}><EmptyState title={showArchived ? "Arşiv boş" : t("noConversation")} body={showArchived ? "Arşivlenen görüşme yok." : t("noConversationBody")} /></View>
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
                  <Pressable key={conversation.id} onPress={() => selectConversation(conversation.id)} style={({ pressed }) => ({ backgroundColor: on ? colors.primarySoft : pressed ? colors.surfaceAlt : "transparent", borderLeftColor: on ? colors.primary : "transparent", borderLeftWidth: 3, flexDirection: "row", gap: 11, paddingHorizontal: 13, paddingVertical: 12 })}>
                    {listing ? (
                      <SafeRemoteImage uri={listing.image} contentFit="cover" style={{ backgroundColor: colors.line, borderRadius: 10, height: 48, width: 48 }} />
                    ) : (
                      <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 10, height: 48, justifyContent: "center", width: 48 }}><MaterialCommunityIcons name="account" size={22} color={colors.primaryDark} /></View>
                    )}
                    <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                      <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
                        <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 13.5, fontWeight: "900" }}>{listing ? displayText(listing.title) : t("listingConversation")}</Text>
                        <Text style={{ color: colors.subtle, fontSize: 10.5, fontWeight: "700" }}>{last ? msgTime(last.createdAt) || shortDate(last.createdAt) : ""}</Text>
                      </View>
                      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>{otherUser?.name ?? t("user")}</Text>
                      <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
                        <Text numberOfLines={1} style={{ color: unread ? colors.ink : colors.muted, flex: 1, fontSize: 12, fontWeight: unread ? "800" : "500" }}>{last ? `${last.senderId === currentUser.id ? "Sen: " : ""}${messagePreview(last)}` : t("conversationStarted")}</Text>
                        {unread ? <View style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 999, height: 18, justifyContent: "center", minWidth: 18, paddingHorizontal: 5 }}><Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "900" }}>{unread}</Text></View> : null}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable onPress={() => setShowArchived((v) => !v)} style={({ pressed }) => ({ alignItems: "center", backgroundColor: pressed ? colors.surfaceAlt : colors.surface, borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 13 })}>
              <MaterialCommunityIcons name={showArchived ? "inbox-arrow-down-outline" : "archive-outline"} size={17} color={colors.muted} />
              <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{showArchived ? "Gelen kutusuna dön" : "Arşivlenen konuşmaları göster"}</Text>
            </Pressable>
          </View>

          {/* ORTA: sohbet */}
          <View style={{ backgroundColor: colors.background, flex: 1, minWidth: 0 }}>
            {activeConversation && activeContext ? (
              <>
                <View style={{ alignItems: "center", backgroundColor: colors.surface, borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 12, paddingHorizontal: 18, paddingVertical: 11 }}>
                  {activeListing ? <SafeRemoteImage uri={activeListing.image} contentFit="cover" style={{ borderRadius: 10, height: 44, width: 44 }} /> : null}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>{activeListing ? displayText(activeListing.title) : t("listingConversation")}</Text>
                    {otherTyping ? (
                      <Text numberOfLines={1} style={{ color: colors.primary, fontSize: 12, fontWeight: "800" }}>yazıyor…</Text>
                    ) : (
                      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{activeListing ? money(activeListing.price) : ""}{activeOther ? `  ·  ${activeOther.name}` : ""}</Text>
                    )}
                  </View>
                  <View style={{ alignItems: "center", backgroundColor: activeIsPartner ? colors.primarySoft : colors.surfaceAlt, borderColor: activeIsPartner ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 10, paddingVertical: 5 }}>
                    <MaterialCommunityIcons name={activeIsPartner ? "handshake-outline" : "tag-outline"} size={13} color={activeIsPartner ? colors.primaryDark : colors.muted} />
                    <Text style={{ color: activeIsPartner ? colors.primaryDark : colors.muted, fontSize: 11.5, fontWeight: "800" }}>{activeIsPartner ? "Ortak satış" : "Satış konuşması"}</Text>
                  </View>
                  {activeOther?.id ? (
                    // Telefon feed'de taşınmaz; arama anında (girişli kullanıcı) çekilir.
                    <Pressable accessibilityLabel="Ara" onPress={async () => { const p = activeOther.phone || (await fetchSellerPhone(activeOther.id)); const tel = p.replace(/[^0-9+]/g, ""); if (tel) void Linking.openURL(`tel:${tel}`); }} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, height: 34, justifyContent: "center", width: 34 }}><MaterialCommunityIcons name="phone-outline" size={16} color={colors.muted} /></Pressable>
                  ) : null}
                  <Pressable accessibilityLabel="Önemli işaretle" onPress={() => setStarred((s) => ({ ...s, [activeConversation.id]: !s[activeConversation.id] }))} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, height: 34, justifyContent: "center", width: 34 }}><MaterialCommunityIcons name={starred[activeConversation.id] ? "star" : "star-outline"} size={16} color={starred[activeConversation.id] ? colors.gold : colors.muted} /></Pressable>
                  <Pressable accessibilityLabel="Arşivle" onPress={() => toggleArchive(activeConversation.id)} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, height: 34, justifyContent: "center", width: 34 }}><MaterialCommunityIcons name="archive-outline" size={16} color={colors.muted} /></Pressable>
                </View>

                <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 8, paddingHorizontal: 18, paddingVertical: 8 }}>
                  <MaterialCommunityIcons name="lightning-bolt" size={14} color={colors.primaryDark} />
                  <Text numberOfLines={1} style={{ color: colors.primaryDark, flex: 1, fontSize: 12, fontWeight: "700" }}>{respText}</Text>
                  <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "900" }}>%{respRate} yanıt</Text>
                </View>

                <ConversationInsightBar context={activeContext} risk={activeRisk} listingPrice={activeListing ? money(activeListing.price) : undefined} commission={estimatedCommission ? money(estimatedCommission) : undefined} isPartner={activeIsPartner} />

                <ScrollView ref={deskScrollRef} scrollEventThrottle={16} onScroll={(e) => { const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent; deskNearBottomRef.current = contentSize.height - (contentOffset.y + layoutMeasurement.height) < 120; }} onContentSizeChange={() => { if (deskNearBottomRef.current) deskScrollRef.current?.scrollToEnd({ animated: false }); }} showsVerticalScrollIndicator={false} style={{ backgroundColor: colors.background, flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: activeMessages.length === 0 ? "center" : "flex-start", padding: 22 }}>
                  {activeMessages.length === 0 ? <EmptyState title="Henüz mesaj yok" body="İlk mesajı yaz ve konuşmayı başlat." /> : null}
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
                              <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 28, justifyContent: "center", width: 28 }}><MaterialCommunityIcons name="account" size={16} color={colors.primaryDark} /></View>
                            ) : <View style={{ width: 28 }} />
                          ) : null}
                          <View style={{ backgroundColor: mine ? colors.primary : colors.surface, borderColor: mine ? colors.primary : colors.line, borderTopLeftRadius: 14, borderTopRightRadius: 14, borderBottomLeftRadius: mine ? 14 : 4, borderBottomRightRadius: mine ? 4 : 14, borderWidth: 1, maxWidth: "64%", overflow: "hidden", paddingHorizontal: m.attachmentType === "image" ? 4 : 13, paddingVertical: m.attachmentType === "image" ? 4 : 9 }}>
                            {m.attachmentType === "image" && m.attachmentUrl ? (
                              <Pressable accessibilityRole="imagebutton" accessibilityLabel="Görseli büyüt" onPress={() => m.attachmentUrl && void Linking.openURL(m.attachmentUrl)}><SafeRemoteImage uri={m.attachmentUrl} contentFit="cover" style={{ backgroundColor: colors.line, borderRadius: 10, height: 190, width: 240 }} /></Pressable>
                            ) : null}
                            {m.attachmentType === "file" && m.attachmentUrl ? (
                              <Pressable accessibilityRole="button" accessibilityLabel={`Dosyayı aç: ${m.attachmentName ?? "Dosya"}`} onPress={() => m.attachmentUrl && void Linking.openURL(m.attachmentUrl)} style={{ alignItems: "center", flexDirection: "row", gap: 8, paddingVertical: 2 }}><MaterialCommunityIcons name="file-document-outline" size={22} color={mine ? "#FFFFFF" : colors.primary} /><Text numberOfLines={1} style={{ color: mine ? "#FFFFFF" : colors.ink, fontSize: 12.5, fontWeight: "700", maxWidth: 180 }}>{m.attachmentName ?? "Dosya"}</Text></Pressable>
                            ) : null}
                            {m.body ? <Text style={{ color: mine ? "#FFFFFF" : colors.ink, fontSize: 13.5, fontWeight: "500", lineHeight: 19, paddingHorizontal: m.attachmentType === "image" ? 9 : 0, paddingTop: m.attachmentType === "image" ? 5 : 0 }}>{m.body}</Text> : null}
                            {lastOfGroup ? (
                              <View style={{ alignItems: "center", alignSelf: "flex-end", flexDirection: "row", gap: 3, marginTop: 3, paddingHorizontal: m.attachmentType === "image" ? 9 : 0, paddingBottom: m.attachmentType === "image" ? 4 : 0 }}>
                                <Text style={{ color: mine ? "#DFF7EF" : colors.subtle, fontSize: 10, fontWeight: "700" }}>{msgTime(m.createdAt)}</Text>
                                {mine ? <MaterialCommunityIcons name={m.read ? "check-all" : "check"} size={13} color={m.read ? "#DFF7EF" : "rgba(255,255,255,0.7)"} /> : null}
                              </View>
                            ) : null}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>

                <View style={{ backgroundColor: colors.surface, borderTopColor: colors.line, borderTopWidth: 1, gap: 9, paddingHorizontal: 14, paddingVertical: 11 }}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {DESK_QUICK_REPLIES.map((r) => (
                      <Pressable key={r} onPress={() => setDraft(r)} style={({ pressed }) => ({ backgroundColor: pressed ? colors.primarySoft : colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 6 })}><Text style={{ color: colors.ink, fontSize: 11.5, fontWeight: "700" }}>{r}</Text></Pressable>
                    ))}
                    <Pressable onPress={() => setDraft(safeDealDraft)} style={({ pressed }) => ({ backgroundColor: pressed ? colors.primarySoft : colors.successSoft, borderColor: colors.success, borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 6 })}><Text style={{ color: colors.success, fontSize: 11.5, fontWeight: "800" }}>Güvenli işlem notu</Text></Pressable>
                  </View>
                  {draftRisk.hasRisk ? (
                    <View style={{ alignItems: "center", backgroundColor: colors.warningSoft, borderColor: colors.warning, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, paddingHorizontal: 10, paddingVertical: 8 }}>
                      <MaterialCommunityIcons name="shield-alert-outline" size={16} color={colors.warning} />
                      <Text style={{ color: colors.ink, flex: 1, fontSize: 11.5, fontWeight: "700", lineHeight: 16 }}>Bu mesajda hassas ödeme veya site dışı iletişim ifadesi var. Görüşmeyi kayıtlı mesaj içinde net tutun.</Text>
                    </View>
                  ) : null}
                  <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 10 }}>
                    <Pressable accessibilityLabel="Görsel ekle" onPress={() => void attachImage()} disabled={attaching} hitSlop={8}><MaterialCommunityIcons name={attaching ? "loading" : "paperclip"} size={19} color={attaching ? colors.primary : colors.muted} /></Pressable>
                    <TextInput value={draft} onChangeText={(text) => { setDraft(text); notifyTyping(); }} multiline placeholder="Mesajınızı yazınız…" placeholderTextColor={colors.muted} onKeyPress={onComposerKeyPress} style={{ color: colors.ink, flex: 1, fontSize: 14, maxHeight: 110, minHeight: 46, paddingVertical: 12 }} />
                    <Pressable accessibilityLabel="Fiyat teklifi" onPress={insertPriceOffer} style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 11, paddingVertical: 7 }}><MaterialCommunityIcons name="tag-outline" size={14} color={colors.primaryDark} /><Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>Fiyat teklifi</Text></Pressable>
                    <Pressable accessibilityLabel="Mesajı gönder" disabled={!draft.trim()} onPress={sendDraft} style={({ pressed }) => ({ alignItems: "center", backgroundColor: draft.trim() ? colors.primary : colors.line, borderRadius: 999, height: 40, justifyContent: "center", opacity: pressed ? 0.8 : 1, width: 44 })}><MaterialCommunityIcons name="send" size={18} color="#FFFFFF" /></Pressable>
                  </View>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 5 }}>
                    <MaterialCommunityIcons name="lock-outline" size={12} color={colors.subtle} />
                    <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "600" }}>Kişisel verilerin paylaşılmasına dikkat edin. OrtakSat ödeme/kargo işlemez; taraflar kendi aralarında anlaşır.</Text>
                  </View>
                </View>
              </>
            ) : (
              <View style={{ alignItems: "center", flex: 1, justifyContent: "center", padding: 24 }}>
                <EmptyState title={myConversations.length ? "Soldan bir konuşma seçin" : t("noConversation")} body={myConversations.length ? "Görüntülemek için sol taraftan bir görüşme seçin." : t("noConversationBody")} />
              </View>
            )}
          </View>

          {/* SAĞ: İlan Detayları */}
          {activeConversation && activeContext && roomForContextPanel ? (
            <View style={{ borderLeftColor: colors.line, borderLeftWidth: 1, width: 320 }}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 14, padding: 16 }} showsVerticalScrollIndicator={false}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                <Text style={{ color: colors.ink, flex: 1, fontSize: 15.5, fontWeight: "900" }}>İlan Detayları</Text>
                {activeListing ? <View style={{ backgroundColor: colors.successSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}><Text style={{ color: colors.success, fontSize: 10.5, fontWeight: "900" }}>Aktif ilan</Text></View> : null}
              </View>

              {activeListing ? (
                <>
                  <View style={{ borderRadius: 12, overflow: "hidden" }}>
                    <SafeRemoteImage uri={activeListing.image} contentFit="cover" style={{ backgroundColor: colors.line, height: 150, width: "100%" }} />
                    {activePhotoCount > 1 ? <View style={{ alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 999, bottom: 8, flexDirection: "row", gap: 4, paddingHorizontal: 8, paddingVertical: 3, position: "absolute", right: 8 }}><MaterialCommunityIcons name="camera" size={12} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 10.5, fontWeight: "800" }}>{activePhotoCount}</Text></View> : null}
                  </View>
                  <View style={{ gap: 5 }}>
                    <Text numberOfLines={2} style={{ color: colors.ink, fontSize: 14.5, fontWeight: "900", lineHeight: 19 }}>{displayText(activeListing.title)}</Text>
                    <Text style={{ color: colors.primaryDark, fontSize: 20, fontWeight: "900" }}>{money(activeListing.price)}</Text>
                    <View style={{ alignItems: "center", flexDirection: "row", gap: 5 }}><MaterialCommunityIcons name="map-marker-outline" size={14} color={colors.muted} /><Text numberOfLines={1} style={{ color: colors.muted, flex: 1, fontSize: 12, fontWeight: "700" }}>{activeListing.location}</Text></View>
                  </View>
                  <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 12, gap: 7, padding: 12 }}>
                    <DeskInfoRow label="İlan No" value={activeListingNo || "-"} />
                    <DeskInfoRow label="İlan Tarihi" value={longDateTr(activeListing.createdAt)} />
                    <DeskInfoRow label="Kategori" value={displayText(activeListing.category)} />
                    <DeskInfoRow label="Stok" value={`${activeListing.stockCount} adet`} />
                    <DeskInfoRow label="Görüşme tipi" value={activeIsPartner ? "Ortak satış" : "Satış"} />
                    {estimatedCommission ? <DeskInfoRow label="Tahmini komisyon" value={money(estimatedCommission)} /> : null}
                  </View>

                  <ConversationTrustCard context={activeContext} risk={activeRisk} responseRate={respRate} isPartner={activeIsPartner} />

                  {/* Satıcı kartı */}
                  <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 12, borderWidth: 1, gap: 10, padding: 12 }}>
                    <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                      {activeOther?.avatar && isImageAvatar(activeOther.avatar) ? (
                        <Image source={{ uri: activeOther.avatar }} contentFit="cover" style={{ borderRadius: 999, height: 40, width: 40 }} />
                      ) : (
                        <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 40, justifyContent: "center", width: 40 }}><MaterialCommunityIcons name="account" size={22} color={colors.primaryDark} /></View>
                      )}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                          <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 14, fontWeight: "900" }}>{activeOther?.name ?? t("user")}</Text>
                          {activeOther?.verifiedIdentity ? <MaterialCommunityIcons name="check-decagram" size={15} color={colors.success} /> : null}
                        </View>
                        <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>%{respRate} yanıt oranı</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", gap: 7 }}>
                      {activeOtherId ? (
                        <Link href={{ pathname: "/store/[id]", params: { id: activeOtherId } }} asChild><Pressable style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 9, flex: 1, paddingVertical: 9 }}><Text style={{ color: "#FFFFFF", fontSize: 11.5, fontWeight: "900" }}>Profili Gör</Text></Pressable></Link>
                      ) : null}
                      <Link href={{ pathname: "/listing/[id]", params: { id: activeListing.id } }} asChild><Pressable style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 9, borderWidth: 1, flex: 1, paddingVertical: 9 }}><Text style={{ color: colors.ink, fontSize: 11.5, fontWeight: "900" }}>İlanı Gör</Text></Pressable></Link>
                      <Pressable onPress={() => setFollowing((s) => ({ ...s, [activeOtherId ?? ""]: !s[activeOtherId ?? ""] }))} style={{ alignItems: "center", backgroundColor: following[activeOtherId ?? ""] ? colors.primarySoft : colors.surface, borderColor: following[activeOtherId ?? ""] ? colors.primary : colors.line, borderRadius: 9, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 9 }}><Text style={{ color: colors.primaryDark, fontSize: 11.5, fontWeight: "900" }}>{following[activeOtherId ?? ""] ? "Takipte" : "+ Takip"}</Text></Pressable>
                    </View>
                  </View>

                  {/* Aksiyonlar */}
                  <View style={{ gap: 2 }}>
                    <DeskActionRow icon="handshake-outline" title="Ortaklık öner" sub="Bu ilan için ortaklık teklifi gönder" onPress={() => setDraft("Bu ürün için ortak satış yapmak istiyorum; komisyon ve şartları konuşabilir miyiz?")} />
                    <DeskActionRow icon="tag-outline" title="Fiyat teklifi gönder" sub="Composer'a teklif taslağı ekler" onPress={insertPriceOffer} />
                    <DeskActionRow icon="archive-outline" title={archivedIds.includes(activeConversation.id) ? "Arşivden çıkar" : "Sohbeti arşivle"} sub="Görüşmeyi gelen kutusundan gizle" onPress={() => toggleArchive(activeConversation.id)} />
                    <DeskActionRow icon="flag-outline" title="Şikayet et" sub="Bu ilanı veya kullanıcıyı bildir" href="/trust" />
                  </View>
                </>
              ) : (
                <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 12, gap: 6, padding: 14 }}>
                  <MaterialCommunityIcons name="tag-off-outline" size={22} color={colors.muted} />
                  <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>İlan yayından kaldırıldı</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 16 }}>Bu görüşmenin ilanı artık yayında değil, ancak mesajlaşma geçmişin burada kalır.</Text>
                </View>
              )}
            </ScrollView>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  const mobileFilters: Array<{ key: InboxFilter; label: string; count: number }> = [
    { key: "all", label: t("all"), count: myConversations.length },
    { key: "unread", label: t("unread"), count: unreadMessages.length },
    { key: "action", label: t("followUp"), count: actionCount }
  ];
  return (
    <View style={{ backgroundColor: colors.background, flex: 1 }}>
      {/* Temiz üst başlık: arama + filtre (WhatsApp/Sahibinden mesaj tarzı) */}
      <View style={{ backgroundColor: colors.surface, borderBottomColor: colors.line, borderBottomWidth: 1, gap: 10, paddingBottom: 10, paddingHorizontal: 12, paddingTop: 12 }}>
        <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 8, paddingHorizontal: 14 }}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.muted} />
          <TextInput value={query} onChangeText={setQuery} placeholder={t("searchMessagesPlaceholder")} placeholderTextColor={colors.muted} style={{ color: colors.ink, flex: 1, fontSize: 14.5, minHeight: 44, paddingVertical: 8 }} />
          {query ? <Pressable onPress={() => setQuery("")} hitSlop={10}><MaterialCommunityIcons name="close-circle" size={19} color={colors.muted} /></Pressable> : null}
        </View>
        <View style={{ flexDirection: "row", gap: 7 }}>
          {mobileFilters.map((f) => {
            const on = filter === f.key;
            return (
              <Pressable key={f.key} onPress={() => setFilter(f.key)} style={{ alignItems: "center", backgroundColor: on ? colors.primary : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 13, paddingVertical: 7 }}>
                <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12.5, fontWeight: "800" }}>{f.label}</Text>
                {f.count > 0 ? <View style={{ alignItems: "center", backgroundColor: on ? "rgba(255,255,255,0.24)" : colors.primary, borderRadius: 999, justifyContent: "center", minWidth: 17, paddingHorizontal: 4 }}><Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "900" }}>{f.count}</Text></View> : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 28 : 96 }}>
      {myConversations.length === 0 ? <View style={{ padding: 24 }}><EmptyState title={t("noConversation")} body={t("noConversationBody")} /></View> : null}
      {myConversations.length > 0 && visibleConversations.length === 0 ? <View style={{ padding: 24 }}><EmptyState title={t("noResults")} body={t("searchOrFilterAgain")} /></View> : null}

      {visibleConversations.map((conversation) => {
        const listing = findListing(conversation.listingId);
        const otherId = conversation.participantIds.find((id) => id !== currentUser.id);
        const otherUser = otherId ? findUser(otherId) : undefined;
        const conversationMessages = messages.filter((item) => item.conversationId === conversation.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const lastMessage = conversationMessages[0];
        const unreadCount = conversationMessages.filter((item) => item.receiverId === currentUser.id && !item.read).length;
        const rowRisk = scanMessageRisk(conversationMessages.map((item) => item.body).join(" "));

        const isPartner = Boolean(conversation.partnerId);
        return (
          <Link key={conversation.id} href={{ pathname: "/chat/[id]", params: { id: conversation.id } }} asChild>
            <Pressable style={({ pressed }) => ({ alignItems: "center", backgroundColor: pressed ? colors.surfaceAlt : colors.surface, borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingVertical: 12 })}>
              <View>
                {listing ? (
                  <SafeRemoteImage uri={listing.image} contentFit="cover" style={{ backgroundColor: colors.line, borderRadius: 12, height: 56, width: 56 }} />
                ) : (
                  <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 12, height: 56, justifyContent: "center", width: 56 }}>
                    <MaterialCommunityIcons name="account" size={26} color={colors.primaryDark} />
                  </View>
                )}
                {isPartner ? (
                  <View style={{ alignItems: "center", backgroundColor: colors.primary, borderColor: colors.surface, borderRadius: 999, borderWidth: 2, bottom: -3, height: 22, justifyContent: "center", position: "absolute", right: -3, width: 22 }}>
                    <MaterialCommunityIcons name="handshake" size={11} color="#FFFFFF" />
                  </View>
                ) : null}
              </View>

              <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
                <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                  <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 15, fontWeight: "900" }}>{otherUser?.name ?? t("user")}</Text>
                  <Text style={{ color: unreadCount ? colors.primary : colors.subtle, fontSize: 11, fontWeight: unreadCount ? "900" : "700" }}>{lastMessage ? msgTime(lastMessage.createdAt) || shortDate(lastMessage.createdAt) : ""}</Text>
                </View>
                <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                  <Text numberOfLines={1} style={{ color: unreadCount ? colors.ink : colors.muted, flex: 1, fontSize: 13, fontWeight: unreadCount ? "800" : "500" }}>
                    {lastMessage ? `${lastMessage.senderId === currentUser.id ? t("youPrefix") : ""}${messagePreview(lastMessage)}` : t("conversationStarted")}
                  </Text>
                  {unreadCount > 0 ? (
                    <View style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 999, height: 20, justifyContent: "center", minWidth: 20, paddingHorizontal: 6 }}>
                      <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "900" }}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                    </View>
                  ) : null}
                </View>
                {listing ? (
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                    <MaterialCommunityIcons name="tag-outline" size={12} color={colors.subtle} />
                    <Text numberOfLines={1} style={{ color: colors.subtle, flex: 1, fontSize: 11.5, fontWeight: "700" }}>{displayText(listing.title)}</Text>
                    {rowRisk.hasRisk ? <MaterialCommunityIcons name="shield-alert-outline" size={13} color={colors.warning} /> : null}
                  </View>
                ) : null}
              </View>
            </Pressable>
          </Link>
        );
      })}
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
  leads: Lead[],
  messages: Message[],
  partnerships: Partnership[],
  sales: Array<{ partnershipId: string; status: string }>,
  findUser: (id: string) => { name: string } | undefined,
  t: (key: string) => string
) {
  const context = buildConversationContext({ conversation, currentUserId, findUser, leads, messages, partnerships, sales, t });
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

function DeskInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "space-between" }}>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{label}</Text>
      <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 12, fontWeight: "800", textAlign: "right" }}>{value}</Text>
    </View>
  );
}

function ConversationInsightBar({
  commission,
  context,
  isPartner,
  listingPrice,
  risk
}: {
  commission?: string;
  context: { channel: string; source: string; status: string };
  isPartner: boolean;
  listingPrice?: string;
  risk: { hasRisk: boolean; matches: string[] };
}) {
  return (
    <View style={{ backgroundColor: risk.hasRisk ? colors.warningSoft : colors.surface, borderBottomColor: colors.line, borderBottomWidth: 1, gap: 8, paddingHorizontal: 18, paddingVertical: 10 }}>
      <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
        <MiniSignal icon={risk.hasRisk ? "shield-alert-outline" : "shield-check-outline"} label={risk.hasRisk ? "Kontrol gerekli" : "Kayıtlı görüşme"} tone={risk.hasRisk ? "warn" : "ok"} />
        <MiniSignal icon={isPartner ? "handshake-outline" : "tag-outline"} label={isPartner ? "Ortak satış" : "Satış"} />
        <MiniSignal icon="source-branch" label={context.source} />
        <MiniSignal icon="clipboard-text-outline" label={context.status} />
        {listingPrice ? <MiniSignal icon="cash" label={listingPrice} /> : null}
        {commission ? <MiniSignal icon="percent-outline" label={`Komisyon ${commission}`} /> : null}
      </View>
      {risk.hasRisk ? (
        <Text style={{ color: colors.ink, fontSize: 11.5, fontWeight: "700", lineHeight: 16 }}>
          Hassas ifade algılandı: {risk.matches.join(", ")}. Ödeme, teslimat ve anlaşma şartlarını OrtakSat mesaj kaydında netleştirin.
        </Text>
      ) : null}
    </View>
  );
}

function ConversationTrustCard({
  context,
  isPartner,
  responseRate,
  risk
}: {
  context: { channel: string; needsAction: boolean; source: string; status: string };
  isPartner: boolean;
  responseRate: number;
  risk: { hasRisk: boolean; matches: string[] };
}) {
  const rows = [
    { icon: "message-lock-outline" as const, label: "Mesaj kaydı", value: "Platform içinde" },
    { icon: "account-check-outline" as const, label: "Yanıt oranı", value: `%${responseRate}` },
    { icon: isPartner ? ("handshake-outline" as const) : ("tag-outline" as const), label: "Görüşme tipi", value: isPartner ? "Ortak satış" : "Satış" },
    { icon: "source-branch" as const, label: "Kaynak", value: context.channel },
    { icon: risk.hasRisk ? ("shield-alert-outline" as const) : ("shield-check-outline" as const), label: "Güven kontrolü", value: risk.hasRisk ? risk.matches.join(", ") : "Risk sinyali yok" }
  ];
  return (
    <View style={{ backgroundColor: risk.hasRisk ? colors.warningSoft : colors.successSoft, borderColor: risk.hasRisk ? colors.warning : colors.success, borderRadius: 12, borderWidth: 1, gap: 10, padding: 12 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <MaterialCommunityIcons name={risk.hasRisk ? "shield-alert-outline" : "shield-check-outline"} size={18} color={risk.hasRisk ? colors.warning : colors.success} />
        <Text style={{ color: colors.ink, flex: 1, fontSize: 13.5, fontWeight: "900" }}>Görüşme güveni</Text>
      </View>
      <View style={{ gap: 7 }}>
        {rows.map((row) => (
          <View key={row.label} style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <MaterialCommunityIcons name={row.icon} size={14} color={colors.muted} />
            <Text style={{ color: colors.muted, flex: 1, fontSize: 11.5, fontWeight: "700" }}>{row.label}</Text>
            <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 11.5, fontWeight: "900", textAlign: "right" }}>{row.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function MiniSignal({ icon, label, tone }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; tone?: "ok" | "warn" }) {
  const tint = tone === "warn" ? colors.warningSoft : tone === "ok" ? colors.successSoft : colors.surfaceAlt;
  const color = tone === "warn" ? colors.warning : tone === "ok" ? colors.success : colors.muted;
  return (
    <View style={{ alignItems: "center", backgroundColor: tint, borderColor: tone ? color : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, minHeight: 28, paddingHorizontal: 9 }}>
      <MaterialCommunityIcons name={icon} size={13} color={color} />
      <Text numberOfLines={1} style={{ color: tone ? color : colors.ink, fontSize: 11.5, fontWeight: "800", maxWidth: 150 }}>{label}</Text>
    </View>
  );
}

function isImageAvatar(value: string) {
  return value.startsWith("http://") || value.startsWith("https://") || value.startsWith("file:");
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
    return <Link href={href} asChild><Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>{inner}</Pressable></Link>;
  }
  return <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>{inner}</Pressable>;
}

export default function MessagesScreen() {
  const auth = useStore();
  if (!auth.isAuthenticated) return <AuthRequired title="Mesajların için giriş yapın" />;
  return <MessagesScreenInner />;
}

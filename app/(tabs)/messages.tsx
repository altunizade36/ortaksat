import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Link, useLocalSearchParams } from "expo-router";

import { SafeRemoteImage } from "@/components/safe-remote-image";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { AuthRequired } from "@/components/auth-gate";
import { EmptyState, StatusPill } from "@/components/ui";
import { money } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useIsWideWeb } from "@/lib/layout";
import { searchKey, shortDate } from "@/lib/locale";
import { displayText } from "@/lib/text";
import type { Conversation, Lead, Message, Partnership } from "@/lib/types";
import { useStore } from "@/lib/use-store";

const DESK_QUICK_REPLIES = [
  "Merhaba, ilan hâlâ yayında mı?",
  "Fiyat güncel mi?",
  "Teslimat / görüşme için uygun musunuz?",
  "Ortak satış için detay konuşabilir miyiz?"
];

type InboxFilter = "all" | "unread" | "action" | "sales" | "partner";

// Mesaj zaman damgasi "YYYY-MM-DD HH:MM" formatinda; sadece saati goster.
function msgTime(createdAt: string) {
  const m = /\d{2}:\d{2}/.exec(createdAt);
  return m ? m[0] : "";
}
function msgDay(createdAt: string) {
  return createdAt.slice(0, 10);
}
function dayHeader(day: string) {
  const today = new Date().toISOString().slice(0, 10);
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

function MessagesScreenInner() {
  const { conversations, currentUser, findListing, findUser, leads, markConversationRead, messages, notifications, partnerships, sales, sendConversationMessage } = useStore();
  const { t } = useLanguage();
  const isWideWeb = useIsWideWeb();
  const params = useLocalSearchParams<{ c?: string }>();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [activeId, setActiveId] = useState<string | null>(params.c ?? null);
  const [draft, setDraft] = useState("");
  const deskScrollRef = useRef<ScrollView>(null);

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
  const myConversations = conversations
    .filter((conversation) => conversation.participantIds.includes(currentUser.id))
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  const unreadMessages = messages.filter((item) => item.receiverId === currentUser.id && !item.read);
  const unreadNotifications = notifications.filter((item) => item.userId === currentUser.id && !item.read);
  const tokens = searchKey(query).split(" ").filter(Boolean);

  const visibleConversations = myConversations.filter((conversation) => {
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
    const activeMessages = activeConversation
      ? messages.filter((m) => m.conversationId === activeConversation.id).slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt))
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
      requestAnimationFrame(() => deskScrollRef.current?.scrollToEnd({ animated: true }));
    };
    // Web: Enter gonderir, Shift+Enter yeni satir.
    const onComposerKeyPress = (e: { nativeEvent: { key?: string; shiftKey?: boolean } }) => {
      if (Platform.OS !== "web") return;
      if (e.nativeEvent.key === "Enter" && !e.nativeEvent.shiftKey) {
        (e as unknown as { preventDefault?: () => void }).preventDefault?.();
        sendDraft();
      }
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

    return (
      <View style={{ backgroundColor: colors.background, flex: 1, gap: 12, paddingHorizontal: 20, paddingVertical: 16 }}>
        <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 12, marginHorizontal: "auto", maxWidth: 1200, width: "100%" }}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: colors.ink, fontSize: 24, fontWeight: "900" }}>Mesajlar</Text>
            <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600" }}>Alıcı, satıcı ve ortaklarınla tüm görüşmeleri tek ekrandan yönet.</Text>
          </View>
          <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 14, paddingHorizontal: 14, paddingVertical: 8 }}>
            <DeskInboxStat icon="email-alert-outline" label="Okunmamış" value={unreadMessages.length} />
            <View style={{ backgroundColor: colors.line, height: 26, width: 1 }} />
            <DeskInboxStat icon="alert-circle-outline" label="Yanıt bekleyen" value={actionCount} />
            <View style={{ backgroundColor: colors.line, height: 26, width: 1 }} />
            <DeskInboxStat icon="message-text-outline" label="Satış konuşması" value={myConversations.filter((c) => !c.partnerId).length} />
          </View>
        </View>

        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 12, borderWidth: 1, flex: 1, flexDirection: "row", marginHorizontal: "auto", maxWidth: 1200, minHeight: 0, overflow: "hidden", width: "100%" }}>
          {/* Column 1: conversation list */}
          <View style={{ backgroundColor: colors.surface, borderRightColor: colors.line, borderRightWidth: 1, maxWidth: 320, minWidth: 280, width: 300 }}>
            <View style={{ gap: 9, padding: 12 }}>
              <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, paddingHorizontal: 12 }}>
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
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }}>
              {visibleConversations.length === 0 ? (
                <View style={{ padding: 16 }}>
                  <EmptyState title={t("noConversation")} body={t("noConversationBody")} />
                </View>
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
                  <Pressable key={conversation.id} onPress={() => selectConversation(conversation.id)} style={({ pressed }) => ({ backgroundColor: on ? colors.primarySoft : pressed ? colors.surfaceAlt : "transparent", borderBottomColor: colors.line, borderBottomWidth: 1, borderLeftColor: on ? colors.primary : "transparent", borderLeftWidth: 3, flexDirection: "row", gap: 10, paddingHorizontal: 13, paddingVertical: 11 })}>
                    {listing ? (
                      <SafeRemoteImage uri={listing.image} contentFit="cover" style={{ backgroundColor: colors.line, borderRadius: 9, height: 50, width: 50 }} />
                    ) : (
                      <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 9, height: 50, justifyContent: "center", width: 50 }}>
                        <MaterialCommunityIcons name="account" size={22} color={colors.primaryDark} />
                      </View>
                    )}
                    <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
                      <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
                        <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "900" }}>{listing ? displayText(listing.title) : t("listingConversation")}</Text>
                        <Text style={{ color: colors.subtle, fontSize: 10.5, fontWeight: "700" }}>{last ? msgTime(last.createdAt) || shortDate(last.createdAt) : ""}</Text>
                      </View>
                      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>{otherUser?.name ?? t("user")}</Text>
                      <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
                        <Text numberOfLines={1} style={{ color: unread ? colors.ink : colors.muted, flex: 1, fontSize: 12, fontWeight: unread ? "800" : "500" }}>
                          {last ? `${last.senderId === currentUser.id ? "Sen: " : ""}${last.body}` : t("conversationStarted")}
                        </Text>
                        {unread ? <View style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 999, height: 18, justifyContent: "center", minWidth: 18, paddingHorizontal: 5 }}><Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "900" }}>{unread}</Text></View> : null}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Column 2: active thread */}
          <View style={{ backgroundColor: colors.background, flex: 1, minWidth: 0 }}>
            {activeConversation && activeContext ? (
              <>
                <View style={{ alignItems: "center", backgroundColor: colors.surface, borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 12, paddingHorizontal: 18, paddingVertical: 11 }}>
                  {activeListing ? <SafeRemoteImage uri={activeListing.image} contentFit="cover" style={{ borderRadius: 9, height: 44, width: 44 }} /> : null}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>{activeListing ? displayText(activeListing.title) : t("listingConversation")}</Text>
                    <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
                      {activeListing ? `${money(activeListing.price)}` : ""}{activeListingNo ? `  ·  #${activeListingNo}` : ""}{activeOther ? `  ·  ${activeOther.name}` : ""}
                    </Text>
                  </View>
                  <View style={{ alignItems: "center", backgroundColor: activeIsPartner ? colors.primarySoft : colors.surfaceAlt, borderColor: activeIsPartner ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 10, paddingVertical: 5 }}>
                    <MaterialCommunityIcons name={activeIsPartner ? "handshake-outline" : "tag-outline"} size={13} color={activeIsPartner ? colors.primaryDark : colors.muted} />
                    <Text style={{ color: activeIsPartner ? colors.primaryDark : colors.muted, fontSize: 11.5, fontWeight: "800" }}>{activeIsPartner ? "Ortak satış" : "Satış konuşması"}</Text>
                  </View>
                </View>

                <ScrollView ref={deskScrollRef} onContentSizeChange={() => deskScrollRef.current?.scrollToEnd({ animated: false })} showsVerticalScrollIndicator={false} style={{ backgroundColor: colors.background, flex: 1 }} contentContainerStyle={{ gap: 8, padding: 22 }}>
                  {activeMessages.length === 0 ? (
                    <EmptyState title="Henüz mesaj yok" body="İlk mesajı yaz ve konuşmayı başlat." />
                  ) : null}
                  {activeMessages.map((m, i) => {
                    const mine = m.senderId === currentUser.id;
                    const showDay = i === 0 || msgDay(m.createdAt) !== msgDay(activeMessages[i - 1].createdAt);
                    return (
                      <View key={m.id} style={{ gap: 8 }}>
                        {showDay ? (
                          <View style={{ alignItems: "center", marginVertical: 4 }}>
                            <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 3 }}>
                              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}>{dayHeader(msgDay(m.createdAt))}</Text>
                            </View>
                          </View>
                        ) : null}
                        <View style={{ alignItems: mine ? "flex-end" : "flex-start" }}>
                          <View style={{ backgroundColor: mine ? colors.primary : colors.surface, borderColor: mine ? colors.primary : colors.line, borderTopLeftRadius: 14, borderTopRightRadius: 14, borderBottomLeftRadius: mine ? 14 : 4, borderBottomRightRadius: mine ? 4 : 14, borderWidth: 1, maxWidth: "68%", paddingHorizontal: 13, paddingVertical: 9 }}>
                            <Text style={{ color: mine ? "#FFFFFF" : colors.ink, fontSize: 13.5, fontWeight: "500", lineHeight: 19 }}>{m.body}</Text>
                            <View style={{ alignItems: "center", alignSelf: "flex-end", flexDirection: "row", gap: 3, marginTop: 3 }}>
                              <Text style={{ color: mine ? "#DFF7EF" : colors.subtle, fontSize: 10, fontWeight: "700" }}>{msgTime(m.createdAt)}</Text>
                              {mine ? <MaterialCommunityIcons name={m.read ? "check-all" : "check"} size={13} color={m.read ? "#DFF7EF" : "rgba(255,255,255,0.7)"} /> : null}
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>

                <View style={{ backgroundColor: colors.surface, borderTopColor: colors.line, borderTopWidth: 1, gap: 9, paddingHorizontal: 14, paddingVertical: 11 }}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {DESK_QUICK_REPLIES.map((r) => (
                      <Pressable key={r} onPress={() => setDraft(r)} style={({ pressed }) => ({ backgroundColor: pressed ? colors.primarySoft : colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 6 })}>
                        <Text style={{ color: colors.ink, fontSize: 11.5, fontWeight: "700" }}>{r}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 8, paddingHorizontal: 12 }}>
                    <TextInput value={draft} onChangeText={setDraft} multiline placeholder="Mesajınızı yazınız" placeholderTextColor={colors.muted} onKeyPress={onComposerKeyPress} style={{ color: colors.ink, flex: 1, fontSize: 14, maxHeight: 110, minHeight: 46, paddingVertical: 12 }} />
                    <MaterialCommunityIcons name="paperclip" size={19} color={colors.muted} />
                    <MaterialCommunityIcons name="emoticon-happy-outline" size={19} color={colors.muted} />
                    <Pressable disabled={!draft.trim()} onPress={sendDraft} style={({ pressed }) => ({ alignItems: "center", backgroundColor: draft.trim() ? colors.primary : colors.line, borderRadius: 10, height: 36, justifyContent: "center", opacity: pressed ? 0.8 : 1, width: 40 })}>
                      <MaterialCommunityIcons name="send" size={17} color="#FFFFFF" />
                    </Pressable>
                  </View>
                  <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "600" }}>Kişisel verilerin paylaşılmasına dikkat edin. OrtakSat ödeme/kargo işlemez; taraflar kendi aralarında anlaşır.</Text>
                </View>
              </>
            ) : (
              <View style={{ alignItems: "center", flex: 1, justifyContent: "center", padding: 24 }}>
                <EmptyState title={myConversations.length ? "Soldan bir konuşma seçin" : t("noConversation")} body={myConversations.length ? "Görüntülemek için sol taraftan bir görüşme seçin." : t("noConversationBody")} />
              </View>
            )}
          </View>

          {/* Column 3: listing + seller panel */}
          {activeConversation && activeContext ? (
            <ScrollView style={{ backgroundColor: colors.surface, borderLeftColor: colors.line, borderLeftWidth: 1, maxWidth: 320, minWidth: 280, width: 300 }} contentContainerStyle={{ gap: 14, padding: 16 }} showsVerticalScrollIndicator={false}>
              {/* Seller header */}
              <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                {activeOther?.avatar ? (
                  <Image source={{ uri: activeOther.avatar }} contentFit="cover" style={{ borderRadius: 999, height: 40, width: 40 }} />
                ) : (
                  <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 40, justifyContent: "center", width: 40 }}>
                    <MaterialCommunityIcons name="account" size={22} color={colors.primaryDark} />
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                    <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 14.5, fontWeight: "900" }}>{activeOther?.name ?? t("user")}</Text>
                    {activeOther?.verifiedIdentity ? <MaterialCommunityIcons name="check-decagram" size={15} color={colors.success} /> : null}
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>{activeOther?.verifiedIdentity ? "Güvenilir Satıcı" : "Satıcı"}</Text>
                </View>
                {activeOtherId ? (
                  <Link href={{ pathname: "/store/[id]", params: { id: activeOtherId } }} asChild>
                    <Pressable style={({ pressed }) => ({ backgroundColor: pressed ? colors.surfaceAlt : colors.surface, borderColor: colors.line, borderRadius: 9, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 })}>
                      <Text style={{ color: colors.ink, fontSize: 11.5, fontWeight: "800" }}>Profili görüntüle</Text>
                    </Pressable>
                  </Link>
                ) : null}
              </View>

              {activeListing ? (
                <>
                  <View style={{ borderRadius: 10, overflow: "hidden" }}>
                    <SafeRemoteImage uri={activeListing.image} contentFit="cover" style={{ backgroundColor: colors.line, height: 150, width: "100%" }} />
                    {activePhotoCount > 1 ? (
                      <View style={{ alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 999, bottom: 8, flexDirection: "row", gap: 4, paddingHorizontal: 8, paddingVertical: 3, position: "absolute", right: 8 }}>
                        <MaterialCommunityIcons name="camera" size={12} color="#FFFFFF" />
                        <Text style={{ color: "#FFFFFF", fontSize: 10.5, fontWeight: "800" }}>{activePhotoCount}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={{ gap: 6 }}>
                    <Text numberOfLines={2} style={{ color: colors.ink, fontSize: 14, fontWeight: "900", lineHeight: 18 }}>{displayText(activeListing.title)}</Text>
                    <Text style={{ color: colors.primaryDark, fontSize: 19, fontWeight: "900" }}>{money(activeListing.price)}</Text>
                    {activeListing.location ? (
                      <View style={{ alignItems: "center", flexDirection: "row", gap: 5 }}>
                        <MaterialCommunityIcons name="map-marker-outline" size={14} color={colors.muted} />
                        <Text numberOfLines={1} style={{ color: colors.muted, flex: 1, fontSize: 12, fontWeight: "700" }}>{activeListing.location}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 10, gap: 7, padding: 12 }}>
                    <DeskInfoRow label="İlan No" value={activeListingNo || "-"} />
                    <DeskInfoRow label="İlan Tarihi" value={longDateTr(activeListing.createdAt)} />
                    <DeskInfoRow label="Kategori" value={displayText(activeListing.category)} />
                    {activeListing.stockCount ? <DeskInfoRow label="Stok" value={`${activeListing.stockCount}`} /> : null}
                    <DeskInfoRow label="Görüşme" value={activeContext.status} />
                  </View>

                  <View style={{ gap: 8 }}>
                    <Link href={{ pathname: "/listing/[id]", params: { id: activeListing.id } }} asChild>
                      <Pressable style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 7, justifyContent: "center", opacity: pressed ? 0.85 : 1, paddingVertical: 11 })}>
                        <MaterialCommunityIcons name="open-in-new" size={16} color="#FFFFFF" />
                        <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>İlanı görüntüle</Text>
                      </Pressable>
                    </Link>
                    <Link href="/partner" asChild>
                      <Pressable style={({ pressed }) => ({ alignItems: "center", backgroundColor: pressed ? colors.primarySoft : colors.surface, borderColor: colors.primary, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 7, justifyContent: "center", paddingVertical: 11 })}>
                        <MaterialCommunityIcons name="handshake-outline" size={16} color={colors.primaryDark} />
                        <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>Ortaklık öner</Text>
                      </Pressable>
                    </Link>
                    <Link href="/trust" asChild>
                      <Pressable style={({ pressed }) => ({ alignItems: "center", backgroundColor: pressed ? colors.surfaceAlt : colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 7, justifyContent: "center", paddingVertical: 11 })}>
                        <MaterialCommunityIcons name="flag-outline" size={16} color={colors.muted} />
                        <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>Şikayet et</Text>
                      </Pressable>
                    </Link>
                  </View>
                </>
              ) : (
                <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 10, gap: 6, padding: 14 }}>
                  <MaterialCommunityIcons name="tag-off-outline" size={22} color={colors.muted} />
                  <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>İlan yayından kaldırıldı</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 16 }}>Bu görüşmenin ilanı artık yayında değil, ancak mesajlaşma geçmişin burada kalır.</Text>
                </View>
              )}
            </ScrollView>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 12, maxWidth: 960, marginHorizontal: "auto", padding: 12, paddingBottom: 96, width: "100%" }}>
      <View style={{ gap: 4 }}>
        <Text selectable style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>
          {t("salesMessages")}
        </Text>
        <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>
          {t("salesMessagesBody")}
        </Text>
      </View>

      <View style={{ backgroundColor: colors.primarySoft, borderColor: "rgba(0,135,111,0.18)", borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 8, padding: 10 }}>
        <MessageTask icon="email-alert-outline" label={t("unread")} value={`${unreadMessages.length}`} />
        <MessageTask icon="alert-circle-outline" label={t("followUp")} value={`${actionCount}`} />
        <MessageTask icon="message-text-outline" label={t("conversation")} value={`${myConversations.length}`} />
      </View>

      <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 10, minHeight: 50, paddingHorizontal: 12 }}>
        <MaterialCommunityIcons name="magnify" size={21} color={colors.primary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("searchMessagesPlaceholder")}
          placeholderTextColor={colors.muted}
          style={{ color: colors.ink, flex: 1, fontSize: 15, minHeight: 48, paddingVertical: 8 }}
        />
        {query ? (
          <Pressable onPress={() => setQuery("")} hitSlop={10}>
            <MaterialCommunityIcons name="close-circle" size={19} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <InboxFilterChip active={filter === "all"} icon="inbox-outline" label={t("all")} onPress={() => setFilter("all")} />
        <InboxFilterChip active={filter === "unread"} icon="email-alert-outline" label={t("unread")} onPress={() => setFilter("unread")} />
        <InboxFilterChip active={filter === "action"} icon="alert-circle-outline" label={t("followUp")} onPress={() => setFilter("action")} />
      </View>

      {myConversations.length === 0 ? <EmptyState title={t("noConversation")} body={t("noConversationBody")} /> : null}
      {myConversations.length > 0 && visibleConversations.length === 0 ? <EmptyState title={t("noResults")} body={t("searchOrFilterAgain")} /> : null}

      {visibleConversations.map((conversation) => {
        const listing = findListing(conversation.listingId);
        const otherId = conversation.participantIds.find((id) => id !== currentUser.id);
        const otherUser = otherId ? findUser(otherId) : undefined;
        const conversationMessages = messages.filter((item) => item.conversationId === conversation.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const lastMessage = conversationMessages[0];
        const unreadCount = conversationMessages.filter((item) => item.receiverId === currentUser.id && !item.read).length;
        const context = buildConversationContext({ conversation, currentUserId: currentUser.id, findUser, leads, messages, partnerships, sales, t });

        return (
          <Link key={conversation.id} href={{ pathname: "/chat/[id]", params: { id: conversation.id } }} asChild>
            <Pressable
              style={({ pressed }) => ({
                backgroundColor: colors.surface,
                borderColor: unreadCount ? colors.primary : colors.line,
                borderRadius: 8,
                borderWidth: 1,
                gap: 12,
                opacity: pressed ? 0.78 : 1,
                padding: 12
              })}
            >
              <View style={{ flexDirection: "row", gap: 10 }}>
                {listing ? <SafeRemoteImage uri={listing.image} contentFit="cover" style={{ backgroundColor: colors.line, borderRadius: 8, height: 58, width: 58 }} /> : (
                  <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 8, height: 58, justifyContent: "center", width: 58 }}>
                    <MaterialCommunityIcons name="message-text-outline" size={24} color={colors.primary} />
                  </View>
                )}
                <View style={{ flex: 1, gap: 5 }}>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                    <Text selectable numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 15, fontWeight: "900" }}>
                      {otherUser?.name ?? t("user")}
                    </Text>
                    {unreadCount > 0 ? <StatusPill label={`${unreadCount} ${t("newCount")}`} tone="warning" /> : null}
                  </View>
                  <Text selectable numberOfLines={1} style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>
                    {listing?.title ?? t("listingConversation")}
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    <StatusPill label={`${t("status")}: ${context.status}`} tone={context.needsAction ? "warning" : "info"} />
                    <StatusPill label={context.channel} tone="info" />
                  </View>
                </View>
              </View>

              <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, gap: 5, padding: 10 }}>
                <Text selectable numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "900" }}>
                  {t("source")}: {context.source}
                </Text>
                <Text selectable numberOfLines={2} style={{ color: lastMessage?.senderId === currentUser.id ? colors.muted : colors.ink, fontSize: 13, fontWeight: unreadCount ? "900" : "700", lineHeight: 18 }}>
                  {lastMessage ? `${lastMessage.senderId === currentUser.id ? t("youPrefix") : ""}${lastMessage.body}` : t("conversationStarted")}
                </Text>
              </View>
            </Pressable>
          </Link>
        );
      })}
    </ScrollView>
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

function InboxFilterChip({ active, icon, label, onPress }: { active?: boolean; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void }) {
  const { language } = useLanguage();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: active ? colors.primary : colors.surface,
        borderColor: active ? colors.primary : colors.line,
        borderRadius: 999,
        borderWidth: 1,
        flex: 1,
        flexDirection: "row",
        gap: 7,
        justifyContent: "center",
        minHeight: 40,
        opacity: pressed ? 0.72 : 1,
        paddingHorizontal: 10
      })}
    >
      <MaterialCommunityIcons name={icon} size={16} color={active ? "#FFFFFF" : colors.primary} />
      <Text adjustsFontSizeToFit minimumFontScale={0.84} numberOfLines={1} style={{ color: active ? "#FFFFFF" : colors.ink, fontSize: 13, fontWeight: "900" }}>
        {translateCopy(label, language)}
      </Text>
    </Pressable>
  );
}

function DeskInboxStat({ icon, label, value }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: number }) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
      <MaterialCommunityIcons name={icon} size={17} color={colors.primary} />
      <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>{value}</Text>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

function DeskInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "space-between" }}>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{label}</Text>
      <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 12, fontWeight: "800", textAlign: "right" }}>{value}</Text>
    </View>
  );
}

function MessageTask({ icon, label, value }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string }) {
  const { language } = useLanguage();

  return (
    <View style={{ alignItems: "center", backgroundColor: colors.surface, borderRadius: 8, flex: 1, gap: 4, minHeight: 64, padding: 8 }}>
      <MaterialCommunityIcons name={icon} size={18} color={colors.primary} />
      <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={{ color: colors.ink, fontSize: 16, fontVariant: ["tabular-nums"], fontWeight: "900" }}>
        {value}
      </Text>
      <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={{ color: colors.muted, fontSize: 10, fontWeight: "800" }}>
        {translateCopy(label, language)}
      </Text>
    </View>
  );
}

function InboxStat({ icon, label, value }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string }) {
  const { language } = useLanguage();

  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flex: 1, gap: 5, padding: 10 }}>
      <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
      <Text ellipsizeMode="tail" numberOfLines={1} selectable style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}>
        {translateCopy(label, language)}
      </Text>
      <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} selectable style={{ color: colors.ink, fontSize: 18, fontVariant: ["tabular-nums"], fontWeight: "900" }}>
        {value}
      </Text>
    </View>
  );
}

export default function MessagesScreen() {
  const auth = useStore();
  if (!auth.isAuthenticated) return <AuthRequired title="Mesajların için giriş yapın" />;
  return <MessagesScreenInner />;
}

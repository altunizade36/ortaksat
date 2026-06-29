import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { EmptyState, StatusPill } from "@/components/ui";
import { money } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useIsWideWeb } from "@/lib/layout";
import { searchKey, shortDate } from "@/lib/locale";
import { displayText } from "@/lib/text";
import type { Conversation, Lead, Message, Partnership } from "@/lib/types";
import { useStore } from "@/lib/use-store";

const DESK_QUICK_REPLIES = [
  "Merhaba, nasıl yardımcı olabilirim?",
  "Ürün stoğu güncel, hemen gönderebiliriz.",
  "Fiyat ve komisyon ilanda güncel.",
  "Talebinizi panelden takip ediyorum."
];

type InboxFilter = "all" | "unread" | "action";

const sourceLabels: Record<Lead["source"], string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  web: "Web form",
  phone: "Telefon"
};

export default function MessagesScreen() {
  const { conversations, currentUser, findListing, findUser, leads, markConversationRead, messages, notifications, partnerships, sales, sendConversationMessage } = useStore();
  const { t } = useLanguage();
  const isWideWeb = useIsWideWeb();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
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
    };

    const filters: Array<{ key: InboxFilter; label: string; count: number }> = [
      { key: "all", label: "Tümü", count: myConversations.length },
      { key: "unread", label: "Okunmamış", count: unreadMessages.length },
      { key: "action", label: "Yanıt bekleyen", count: actionCount }
    ];

    return (
      <View style={{ backgroundColor: colors.background, flex: 1, gap: 14, paddingHorizontal: 20, paddingVertical: 16 }}>
        <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: colors.ink, fontSize: 26, fontWeight: "900" }}>Mesajlar</Text>
            <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>Alıcı, satıcı ve ortaklarınla tüm görüşmeleri tek ekrandan yönet.</Text>
          </View>
          <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 14, paddingHorizontal: 14, paddingVertical: 8 }}>
            <DeskInboxStat icon="email-alert-outline" label="Okunmamış" value={unreadMessages.length} />
            <View style={{ backgroundColor: colors.line, height: 26, width: 1 }} />
            <DeskInboxStat icon="alert-circle-outline" label="Yanıt bekleyen" value={actionCount} />
            <View style={{ backgroundColor: colors.line, height: 26, width: 1 }} />
            <DeskInboxStat icon="message-text-outline" label="Görüşme" value={myConversations.length} />
          </View>
        </View>

        <View style={{ borderColor: colors.line, borderRadius: 18, borderWidth: 1, flex: 1, flexDirection: "row", minHeight: 0, overflow: "hidden" }}>
          {/* Column 1: conversation list */}
          <View style={{ backgroundColor: colors.surface, borderRightColor: colors.line, borderRightWidth: 1, width: 320 }}>
            <View style={{ gap: 10, padding: 14 }}>
              <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, paddingHorizontal: 12 }}>
                <MaterialCommunityIcons name="magnify" size={18} color={colors.muted} />
                <TextInput value={query} onChangeText={setQuery} placeholder="Görüşmelerde ara" placeholderTextColor={colors.muted} style={{ color: colors.ink, flex: 1, fontSize: 13.5, minHeight: 40, paddingVertical: 6 }} />
              </View>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {filters.map((f) => {
                  const on = filter === f.key;
                  return (
                    <Pressable key={f.key} onPress={() => setFilter(f.key)} style={{ alignItems: "center", backgroundColor: on ? colors.primary : colors.surfaceAlt, borderRadius: 999, flex: 1, paddingVertical: 7 }}>
                      <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 11.5, fontWeight: "800" }}>{f.label} ({f.count})</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
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
                  <Pressable key={conversation.id} onPress={() => selectConversation(conversation.id)} style={{ backgroundColor: on ? colors.primarySoft + "66" : "transparent", borderLeftColor: on ? colors.primary : "transparent", borderLeftWidth: 3, flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingVertical: 12 }}>
                    {listing ? (
                      <Image source={{ uri: listing.image }} contentFit="cover" style={{ backgroundColor: colors.line, borderRadius: 10, height: 46, width: 46 }} />
                    ) : (
                      <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 10, height: 46, justifyContent: "center", width: 46 }}>
                        <MaterialCommunityIcons name="account" size={22} color={colors.primaryDark} />
                      </View>
                    )}
                    <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                      <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
                        <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 13.5, fontWeight: "900" }}>{otherUser?.name ?? t("user")}</Text>
                        <Text style={{ color: colors.subtle, fontSize: 10.5, fontWeight: "700" }}>{last ? shortDate(last.createdAt) : ""}</Text>
                      </View>
                      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>{listing ? displayText(listing.title) : t("listingConversation")}</Text>
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
                <View style={{ alignItems: "center", backgroundColor: colors.surface, borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 12, paddingHorizontal: 18, paddingVertical: 12 }}>
                  {activeListing ? <Image source={{ uri: activeListing.image }} contentFit="cover" style={{ borderRadius: 10, height: 42, width: 42 }} /> : null}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>{activeOther?.name ?? t("user")}</Text>
                    <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{activeListing ? displayText(activeListing.title) : t("listingConversation")}</Text>
                  </View>
                  <StatusPill label={`${t("status")}: ${activeContext.status}`} tone={activeContext.needsAction ? "warning" : "info"} />
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ gap: 10, padding: 20 }}>
                  {activeMessages.length === 0 ? (
                    <EmptyState title="Henüz mesaj yok" body="İlk mesajı yaz ve konuşmayı başlat." />
                  ) : null}
                  {activeMessages.map((m) => {
                    const mine = m.senderId === currentUser.id;
                    return (
                      <View key={m.id} style={{ alignItems: mine ? "flex-end" : "flex-start" }}>
                        <View style={{ backgroundColor: mine ? colors.primary : colors.surface, borderColor: mine ? colors.primary : colors.line, borderRadius: 14, borderWidth: 1, maxWidth: "72%", paddingHorizontal: 14, paddingVertical: 10 }}>
                          <Text style={{ color: mine ? "#FFFFFF" : colors.ink, fontSize: 14, fontWeight: "600", lineHeight: 20 }}>{m.body}</Text>
                          <Text style={{ color: mine ? "#DFF7EF" : colors.subtle, fontSize: 10, fontWeight: "700", marginTop: 4, textAlign: "right" }}>{shortDate(m.createdAt)}</Text>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>

                <View style={{ backgroundColor: colors.surface, borderTopColor: colors.line, borderTopWidth: 1, gap: 10, paddingHorizontal: 16, paddingVertical: 12 }}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                    {DESK_QUICK_REPLIES.map((r) => (
                      <Pressable key={r} onPress={() => setDraft(r)} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 }}>
                        <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "700" }}>{r}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 10 }}>
                    <TextInput value={draft} onChangeText={setDraft} multiline placeholder="Mesaj yaz…" placeholderTextColor={colors.muted} onSubmitEditing={sendDraft} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 12, borderWidth: 1, color: colors.ink, flex: 1, fontSize: 14, maxHeight: 120, minHeight: 46, paddingHorizontal: 14, paddingVertical: 12 }} />
                    <Pressable disabled={!draft.trim()} onPress={sendDraft} style={({ pressed }) => ({ alignItems: "center", backgroundColor: draft.trim() ? colors.primary : colors.line, borderRadius: 12, flexDirection: "row", gap: 6, height: 46, justifyContent: "center", opacity: pressed ? 0.8 : 1, paddingHorizontal: 18 })}>
                      <MaterialCommunityIcons name="send" size={18} color="#FFFFFF" />
                      <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>Gönder</Text>
                    </Pressable>
                  </View>
                </View>
              </>
            ) : (
              <View style={{ alignItems: "center", flex: 1, justifyContent: "center", padding: 24 }}>
                <EmptyState title={t("noConversation")} body={t("noConversationBody")} />
              </View>
            )}
          </View>

          {/* Column 3: context panel */}
          {activeConversation && activeContext ? (
            <View style={{ backgroundColor: colors.surface, borderLeftColor: colors.line, borderLeftWidth: 1, gap: 16, padding: 18, width: 280 }}>
              <View style={{ alignItems: "center", gap: 8 }}>
                {activeOther?.avatar ? (
                  <Image source={{ uri: activeOther.avatar }} contentFit="cover" style={{ borderRadius: 999, height: 64, width: 64 }} />
                ) : (
                  <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 64, justifyContent: "center", width: 64 }}>
                    <MaterialCommunityIcons name="account" size={32} color={colors.primaryDark} />
                  </View>
                )}
                <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{activeOther?.name ?? t("user")}</Text>
                <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                  <MaterialCommunityIcons name="star" size={15} color={colors.gold} />
                  <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{(activeOther?.rating ?? 4.8).toFixed(1)}</Text>
                  {activeOther?.verifiedIdentity ? <View style={{ alignItems: "center", backgroundColor: colors.successSoft, borderRadius: 999, flexDirection: "row", gap: 3, marginLeft: 4, paddingHorizontal: 7, paddingVertical: 2 }}><MaterialCommunityIcons name="check-decagram" size={12} color={colors.success} /><Text style={{ color: colors.success, fontSize: 10.5, fontWeight: "800" }}>Onaylı</Text></View> : null}
                </View>
              </View>

              {activeListing ? (
                <Link href={{ pathname: "/listing/[id]", params: { id: activeListing.id } }} asChild>
                  <Pressable style={({ pressed }) => ({ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 8, opacity: pressed ? 0.85 : 1, padding: 10 })}>
                    <Image source={{ uri: activeListing.image }} contentFit="cover" style={{ backgroundColor: colors.line, borderRadius: 10, height: 120, width: "100%" }} />
                    <Text numberOfLines={2} style={{ color: colors.ink, fontSize: 13, fontWeight: "800", lineHeight: 17 }}>{displayText(activeListing.title)}</Text>
                    <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ color: colors.primaryDark, fontSize: 15, fontWeight: "900" }}>{money(activeListing.price)}</Text>
                      <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>İlanı gör →</Text>
                    </View>
                  </Pressable>
                </Link>
              ) : null}

              <View style={{ gap: 8 }}>
                <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.4, textTransform: "uppercase" }}>Görüşme bilgisi</Text>
                <DeskInfoRow label="Kanal" value={activeContext.channel.replace(/^Kanal:\s*/i, "")} />
                <DeskInfoRow label="Kaynak" value={activeContext.source} />
                <DeskInfoRow label="Durum" value={activeContext.status} />
              </View>

              <View style={{ gap: 8 }}>
                <Pressable style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 10, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 11 }}>
                  <MaterialCommunityIcons name="handshake-outline" size={17} color={colors.primaryDark} />
                  <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>Ortaklık öner</Text>
                </Pressable>
                <Pressable style={{ alignItems: "center", borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 11 }}>
                  <MaterialCommunityIcons name="flag-outline" size={17} color={colors.muted} />
                  <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>Şikayet et</Text>
                </Pressable>
              </View>
            </View>
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
                {listing ? <Image source={{ uri: listing.image }} contentFit="cover" style={{ backgroundColor: colors.line, borderRadius: 8, height: 58, width: 58 }} /> : (
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

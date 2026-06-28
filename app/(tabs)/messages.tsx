import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { EmptyState, StatusPill } from "@/components/ui";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { searchKey } from "@/lib/locale";
import type { Conversation, Lead, Message, Partnership } from "@/lib/types";
import { useStore } from "@/lib/use-store";

type InboxFilter = "all" | "unread" | "action";

const sourceLabels: Record<Lead["source"], string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  web: "Web form",
  phone: "Telefon"
};

export default function MessagesScreen() {
  const { conversations, currentUser, findListing, findUser, leads, messages, notifications, partnerships, sales } = useStore();
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<InboxFilter>("all");
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

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 12, padding: 12, paddingBottom: 96 }}>
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

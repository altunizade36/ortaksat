import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { AuthRequired } from "@/components/auth-gate";
import { colors } from "@/components/colors";
import { EmptyState, Metric, PrimaryButton, StatusPill } from "@/components/ui";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { searchKey, shortDate } from "@/lib/locale";
import type { Conversation, Lead, Message, Partnership, Sale, User } from "@/lib/types";
import { useStore } from "@/lib/use-store";

export default function ChatScreen() {
  const { isAuthenticated } = useStore();
  if (!isAuthenticated) {
    return <AuthRequired title="Mesajlarını görmek için giriş yap" body="Konuşmaların yalnızca sana özeldir; görmek için ücretsiz bir hesapla giriş yapman gerekir." />;
  }
  return <ChatScreenInner />;
}

function ChatScreenInner() {
  const { language } = useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser, findConversation, findListing, findUser, leads, markConversationRead, messages, partnerships, sales, sendConversationMessage } = useStore();
  const [body, setBody] = useState("");
  const conversation = findConversation(id);

  useEffect(() => {
    if (conversation) markConversationRead(conversation.id);
  }, [conversation?.id, markConversationRead]);

  const listing = conversation ? findListing(conversation.listingId) : undefined;
  const otherId = conversation?.participantIds.find((item) => item !== currentUser.id);
  const otherUser = otherId ? findUser(otherId) : undefined;
  const conversationMessages = useMemo(
    () => messages.filter((item) => item.conversationId === id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [id, messages]
  );

  if (!conversation) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 12 }}>
        <EmptyState title={language === "en" ? "Conversation not found" : "Konuşma bulunamadı"} body={language === "en" ? "This conversation may have been deleted or you may not have access." : "Bu konuşma silinmiş veya erişim yetkin olmayabilir."} />
      </ScrollView>
    );
  }

  const currentConversation = conversation;
  const context = buildChatContext({
    conversation: currentConversation,
    currentUserId: currentUser.id,
    findUser,
    leads,
    messages,
    partnerships,
    sales,
    language
  });
  const quickReplies = buildQuickReplies(contextSeedForReplies(conversationMessages));

  function send() {
    if (!body.trim()) return;
    sendConversationMessage(currentConversation.id, body.trim());
    setBody("");
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ backgroundColor: colors.background, flex: 1 }}>
      <View style={{ backgroundColor: colors.surface, borderBottomColor: colors.line, borderBottomWidth: 1, padding: 12 }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
          {listing ? <Image source={{ uri: listing.image }} contentFit="cover" style={{ borderRadius: 8, height: 46, width: 46 }} /> : null}
          <View style={{ flex: 1, gap: 3 }}>
            <Text selectable numberOfLines={1} style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>
              {otherUser?.name ?? translateCopy("Kullanıcı", language)}
            </Text>
            <Text selectable numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>
              {listing?.title ?? translateCopy("İlan konuşması", language)}
            </Text>
          </View>
          <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 34, justifyContent: "center", width: 34 }}>
            <MaterialCommunityIcons name="shield-check-outline" size={18} color={colors.primaryDark} />
          </View>
        </View>
        <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 8, borderWidth: 1, gap: 8, marginTop: 10, padding: 10 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <StatusPill label={context.roleLabel} tone="success" />
            <StatusPill label={context.otherRoleLabel} tone="info" />
            <StatusPill label={`${translateCopy("Durum", language)}: ${context.status}`} tone={context.needsAction ? "warning" : "info"} />
            <StatusPill label={context.channel} tone="info" />
          </View>
          <Text selectable numberOfLines={2} style={{ color: colors.muted, fontSize: 12, fontWeight: "900", lineHeight: 17 }}>
            {translateCopy("Kaynak", language)}: {context.source}
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Metric label={translateCopy("Talep", language)} value={`${context.leadCount}`} />
            <Metric label={translateCopy("Satış", language)} value={`${context.saleCount}`} />
            <Metric label={translateCopy("Açık komisyon", language)} value={`${context.openCommission}`} />
          </View>
          {listing ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <PrimaryButton href={`/listing/${listing.id}`} tone="secondary" icon="tag-outline">
                  {translateCopy("Ürün Detayı", language)}
                </PrimaryButton>
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton tone="soft" icon="reply-outline" onPress={() => setBody(quickReplies[0] ?? "")}>
                  {translateCopy("Hızlı Yanıt", language)}
                </PrimaryButton>
              </View>
            </View>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1, gap: 8, justifyContent: conversationMessages.length === 0 ? "center" : "flex-start", padding: 12, paddingBottom: 16 }}>
        {conversationMessages.length === 0 ? (
          <EmptyState title={language === "en" ? "No messages yet" : "Henüz mesaj yok"} body={language === "en" ? "Write the first message and start the conversation." : "İlk mesajı yaz ve konuşmayı başlat."} />
        ) : null}
        {conversationMessages.map((message) => {
          const mine = message.senderId === currentUser.id;
          return (
            <View key={message.id} style={{ alignItems: mine ? "flex-end" : "flex-start" }}>
              <View style={{ backgroundColor: mine ? colors.primary : colors.surface, borderColor: mine ? colors.primary : colors.line, borderRadius: 8, borderWidth: 1, maxWidth: "82%", padding: 10 }}>
                <Text selectable style={{ color: mine ? "#FFFFFF" : colors.ink, fontSize: 14, fontWeight: "700", lineHeight: 20 }}>
                  {message.body}
                </Text>
                <Text selectable style={{ color: mine ? "#DFF7EF" : colors.muted, fontSize: 10, fontWeight: "800", marginTop: 5, textAlign: "right" }}>
                  {shortDate(message.createdAt)}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {quickReplies.length > 0 ? (
        <View style={{ backgroundColor: colors.surface, borderTopColor: colors.line, borderTopWidth: 1, paddingHorizontal: 10, paddingTop: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 10 }}>
            {quickReplies.map((reply) => (
              <Pressable
                key={reply}
                onPress={() => setBody(reply)}
                style={({ pressed }) => ({
                  backgroundColor: colors.surfaceAlt,
                  borderColor: colors.line,
                  borderRadius: 999,
                  borderWidth: 1,
                  justifyContent: "center",
                  minHeight: 36,
                  opacity: pressed ? 0.72 : 1,
                  paddingHorizontal: 12
                })}
              >
                <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12, fontWeight: "900" }}>
                  {translateCopy(reply, language)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={{ backgroundColor: colors.surface, borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 8, padding: 10 }}>
        <TextInput
          value={body}
          onChangeText={setBody}
          multiline
          placeholder={translateCopy("Mesaj yaz", language)}
          placeholderTextColor={colors.muted}
          style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 8, borderWidth: 1, color: colors.ink, flex: 1, maxHeight: 110, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10 }}
        />
        <Pressable disabled={!body.trim()} onPress={send} style={({ pressed }) => ({ alignItems: "center", backgroundColor: body.trim() ? colors.primary : colors.line, borderRadius: 8, height: 44, justifyContent: "center", opacity: pressed ? 0.75 : 1, width: 44 })}>
          <MaterialCommunityIcons name="send" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function buildChatContext({
  conversation,
  currentUserId,
  findUser,
  leads,
  messages,
  partnerships,
  sales,
  language
}: {
  conversation: Conversation;
  currentUserId: string;
  findUser: (id: string) => User | undefined;
  leads: Lead[];
  messages: Message[];
  partnerships: Partnership[];
  sales: Sale[];
  language: "tr" | "en";
}) {
  const conversationMessages = messages.filter((item) => item.conversationId === conversation.id);
  const latestMessage = conversationMessages.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const otherId = conversation.participantIds.find((item) => item !== currentUserId);
  const partnership =
    (conversation.partnerId ? partnerships.find((item) => item.id === conversation.partnerId || item.partnerId === conversation.partnerId) : undefined) ??
    partnerships.find((item) => item.listingId === conversation.listingId && (item.partnerId === otherId || item.partnerId === currentUserId));
  const relatedLeads = partnership ? leads.filter((item) => item.partnershipId === partnership.id) : leads.filter((item) => item.listingId === conversation.listingId);
  const lead = relatedLeads.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const relatedSales = partnership ? sales.filter((item) => item.partnershipId === partnership.id) : sales.filter((item) => item.listingId === conversation.listingId);
  const openSales = relatedSales.filter((item) => item.status !== "paid" && item.status !== "cancelled");
  const partnerUser = partnership ? findUser(partnership.partnerId) : undefined;
  const status = translateCopy(openSales[0] ? saleStatusText(openSales[0].status) : lead ? leadStatusText(lead.status) : inferMessageStatus(latestMessage?.body), language);
  const source = partnership
    ? `${partnerUser?.name ?? translateCopy("Ortak", language)} ${language === "en" ? "partner link" : "ortak bağlantısı"}`
    : lead
      ? `${leadSourceText(lead.source)} ${language === "en" ? "request" : "talebi"}`
      : translateCopy("Doğrudan ürün mesajı", language);
  const channel = lead ? `${translateCopy("Kanal", language)}: ${leadSourceText(lead.source)}` : `${translateCopy("Kanal", language)}: ${translateCopy("Mesaj", language)}`;
  const currentRole = currentUserId === conversation.sellerId ? "Satıcı" : partnership?.partnerId === currentUserId ? "Ortak" : "Alıcı";
  const otherRole = otherId === conversation.sellerId ? "Satıcı" : partnership?.partnerId === otherId ? "Ortak" : "Alıcı";
  const roleLabel = translateCopy(currentRole === "Satıcı" ? "Satıcı görüşmesi" : currentRole === "Ortak" ? "Ortak görüşmesi" : "Alıcı görüşmesi", language);
  const otherRoleLabel = `${translateCopy(otherRole, language)}: ${findUser(otherId ?? "")?.name ?? translateCopy("Kullanıcı", language)}`;
  const needsAction = Boolean(
    conversationMessages.some((item) => item.receiverId === currentUserId && !item.read) ||
      lead?.status === "new" ||
      lead?.status === "interested" ||
      openSales.length > 0
  );

  return {
    channel,
    leadCount: relatedLeads.length,
    needsAction,
    openCommission: openSales.length,
    otherRoleLabel,
    roleLabel,
    saleCount: relatedSales.length,
    source,
    status
  };
}

function leadStatusText(status: string) {
  if (status === "new") return "Yeni talep";
  if (status === "contacted") return "Arandı";
  if (status === "interested") return "İlgileniyor";
  if (status === "converted") return "Satışa döndü";
  if (status === "lost") return "Kayıp";
  return "Talep takibi";
}

function leadSourceText(source: string) {
  if (source === "whatsapp") return "WhatsApp";
  if (source === "instagram") return "Instagram";
  if (source === "web") return "Web form";
  if (source === "phone") return "Telefon";
  return "Mesaj";
}

function inferMessageStatus(body?: string) {
  const key = searchKey(body ?? "");
  if (key.includes("stok")) return "Stok sordu";
  if (key.includes("fiyat") || key.includes("ucret")) return "Fiyat sordu";
  if (key.includes("kargo") || key.includes("teslim")) return "Teslimat sordu";
  if (key.includes("odeme") || key.includes("komisyon")) return "Ödeme konuşuluyor";
  return "Satış konuşması";
}

function saleStatusText(status: string) {
  if (status === "return_pending") return "İade süresi bekleniyor";
  if (status === "approved") return "Komisyon onaylandı";
  if (status === "seller_paid") return "Ödeme onayı bekliyor";
  if (status === "disputed") return "Anlaşmazlık var";
  if (status === "cancelled") return "Satış iptal";
  return "Satış takibi";
}

function contextSeedForReplies(messages: Message[]) {
  const last = messages[messages.length - 1]?.body ?? "";
  const key = searchKey(last);
  if (key.includes("stok")) return "stock";
  if (key.includes("fiyat") || key.includes("ucret")) return "price";
  if (key.includes("kargo") || key.includes("teslim")) return "delivery";
  if (key.includes("komisyon") || key.includes("odeme")) return "payment";
  return "general";
}

function buildQuickReplies(seed: "stock" | "price" | "delivery" | "payment" | "general") {
  if (seed === "stock") return ["Stok bugün güncel.", "Kaç adet düşünüyorsunuz?", "Ürün için hızlı dönüş yapıyorum."];
  if (seed === "price") return ["Fiyat ve komisyon bilgisi ilanda güncel.", "İsterseniz detayları hemen paylaşayım.", "Toplu adet için satıcıyla netleştireyim."];
  if (seed === "delivery") return ["Teslimat bilgisini satıcıyla netleştiriyorum.", "Kargo süresini kontrol edip yazacağım.", "Adres ve teslim notunu paylaşır mısınız?"];
  if (seed === "payment") return ["Komisyon kaydı panelde takip edilecek.", "Ödeme durumu güncellenince haber vereceğim.", "İade süresi bittikten sonra komisyon netleşir."];
  return ["Merhaba, nasıl yardımcı olabilirim?", "Ürünle ilgili detayları hemen paylaşayım.", "Talebi satıcı panelinde takip ediyorum."];
}


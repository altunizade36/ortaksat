import { MaterialCommunityIcons } from "@/components/icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthRequired } from "@/components/auth-gate";
import { colors } from "@/components/colors";
import { Alert } from "@/lib/alert";
import { openUrlSafe } from "@/lib/link";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { EmptyState } from "@/components/ui";
import { localToday, money } from "@/lib/format";
import { displayText } from "@/lib/text";
import { uploadMessageAttachment } from "@/lib/live-service";
import { useTypingIndicator } from "@/lib/use-typing";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useIsWideWeb, useMounted } from "@/lib/layout";
import { useKeyboardInset } from "@/lib/use-keyboard-inset";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import { searchKey, shortDate } from "@/lib/locale";
import type { Message } from "@/lib/types";
import { useStore } from "@/lib/use-store";

const CHAT_RISK_WORDS = [
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
  "kart bilgisi"
];

function scanChatRisk(text: string) {
  const key = searchKey(text);
  const matches = CHAT_RISK_WORDS.filter((word) => key.includes(searchKey(word)));
  return { hasRisk: matches.length > 0, matches: Array.from(new Set(matches)).slice(0, 3) };
}

export default function ChatScreen() {
  const { isAuthenticated } = useStore();
  const { language } = useLanguage();
  const mounted = useMounted();
  // SSG (giriş yok) → client (giriş var) uyuşmazlığını (#418) mount-gate ile giderir.
  if (!mounted) return <ScreenSkeleton />;
  if (!isAuthenticated) {
    return <AuthRequired title={translateCopy("Mesajlarını görmek için giriş yap", language)} body={translateCopy("Konuşmaların yalnızca sana özeldir; görmek için ücretsiz bir hesapla giriş yapman gerekir.", language)} />;
  }
  return <ChatScreenInner />;
}

function ChatScreenInner() {
  const { language } = useLanguage();
  const isWideWeb = useIsWideWeb();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser, findConversation, findListing, findUser, markConversationRead, messages, reportUser, sendConversationMessage, retryMessage, isUserBlocked, blockUser, unblockUser } = useStore();
  const [body, setBody] = useState("");
  const [attaching, setAttaching] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  // Sohbet gövde-kaydırması OLMAYAN sabit bir düzen; mobil web'de klavye composer'ı
  // örtmesin diye SADECE bu ekrana klavye inset'i uygulanır (genel kök değil → başka
  // sayfalarda "ekran komple kayıyor" olmaz).
  const kbInset = useKeyboardInset();
  const scrollRef = useRef<ScrollView>(null);
  // Kullanıcı geçmişi okumak için yukarı kaydırdıysa, gelen mesaj/görsel yüklenmesi
  // onu zorla aşağı çekmesin. Yalnızca dibe yakınken otomatik aşağı in.
  const nearBottomRef = useRef(true);
  const sendingRef = useRef(false); // çift-gönderim (hızlı Enter) koruması
  const conversation = findConversation(id);
  const { otherTyping, notifyTyping } = useTypingIndicator(conversation?.id, currentUser.id);

  useEffect(() => {
    if (conversation) markConversationRead(conversation.id);
  }, [conversation?.id, messages.length, markConversationRead]);

  // Masaüstünde tek başına sohbet ekranı yerine 3-panelli mesaj kutusunu kullan
  // (Sahibinden benzeri). Konuşmayı seçili açacak şekilde yönlendir.
  useEffect(() => {
    if (isWideWeb && id) {
      router.replace({ pathname: "/(tabs)/messages", params: { c: id } });
    }
  }, [isWideWeb, id, router]);

  const listing = conversation ? findListing(conversation.listingId) : undefined;
  const otherId = conversation?.participantIds.find((item) => item !== currentUser.id);
  const otherUser = otherId ? findUser(otherId) : undefined;
  const blockedHere = otherId ? isUserBlocked(otherId) : false;
  const conversationMessages = useMemo(() => {
    // messages dizisi yeni→eski (başa eklenir); aynı zaman damgasında yüksek index
    // = daha eski, bu yüzden önce gelir (eskiden yeniye doğru thread).
    const idx = new Map(messages.map((m, i) => [m.id, i]));
    return messages
      .filter((item) => item.conversationId === id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || ((idx.get(b.id) ?? 0) - (idx.get(a.id) ?? 0)));
  }, [id, messages]);

  if (isWideWeb) {
    return (
      <View style={{ alignItems: "center", backgroundColor: colors.background, flex: 1, justifyContent: "center", padding: 24 }}>
        <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "700" }}>{translateCopy("Mesajlara yönlendiriliyor…", language)}</Text>
      </View>
    );
  }

  if (!conversation) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 12 }}>
        <EmptyState title={language === "en" ? "Conversation not found" : "Konuşma bulunamadı"} body={language === "en" ? "This conversation may have been deleted or you may not have access." : "Bu konuşma silinmiş veya erişim yetkin olmayabilir."} />
      </ScrollView>
    );
  }

  const currentConversation = conversation;
  const quickReplies = buildQuickReplies(contextSeedForReplies(conversationMessages));
  const conversationRisk = scanChatRisk([...conversationMessages.map((item) => item.body), body].filter(Boolean).join(" "));
  const draftRisk = scanChatRisk(body);
  const safeDealDraft = listing
    ? `Ödeme ve teslimat koşullarını OrtakSat mesaj kaydında netleştirelim. İlan: ${listing.title} - Fiyat: ${money(listing.price)}.`
    : "Ödeme ve teslimat koşullarını OrtakSat mesaj kaydında netleştirelim.";

  function send() {
    const text = body.trim();
    // Metni önce yakala + kutuyu hemen temizle: hızlı çift Enter/tık (web keypress)
    // aynı mesajı iki kez göndermesin.
    if (!text || sendingRef.current) return;
    sendingRef.current = true;
    setBody("");
    sendConversationMessage(currentConversation.id, text);
    setTimeout(() => { sendingRef.current = false; }, 250);
    // onContentSizeChange sona kaydırır; kaymalı çift-scroll jank'i olmasın.
  }

  async function attachImage() {
    if (attaching) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setAttaching(true);
    try {
      const url = await uploadMessageAttachment(result.assets[0].uri, currentUser.id);
      sendConversationMessage(currentConversation.id, body.trim(), { url, type: "image" });
      setBody("");
    } finally {
      setAttaching(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined}
      keyboardVerticalOffset={0}
      style={{ backgroundColor: colors.background, flex: 1, paddingBottom: kbInset }}
    >
      {/* Kompakt sohbet başlığı (WhatsApp/Sahibinden benzeri): geri · avatar ·
          isim/durum · ilana git. Pazaryeri arama çubuğu YOK → dikey alan mesajlara. */}
      <View style={{ backgroundColor: colors.surface, borderBottomColor: colors.line, borderBottomWidth: 1, paddingTop: insets.top }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 8, paddingHorizontal: 8, paddingVertical: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={translateCopy("Geri", language)}
            hitSlop={8}
            onPress={() => { if (router.canGoBack()) router.back(); else router.replace("/(tabs)/messages"); }}
            style={({ pressed }) => ({ alignItems: "center", height: 38, justifyContent: "center", opacity: pressed ? 0.6 : 1, width: 34 })}
          >
            <MaterialCommunityIcons name="chevron-left" size={28} color={colors.primaryDark} />
          </Pressable>
          <Pressable
            onPress={() => otherId && router.push({ pathname: "/store/[id]", params: { id: otherId } })}
            style={{ alignItems: "center", flex: 1, flexDirection: "row", gap: 9, minWidth: 0 }}
          >
            {listing?.image ? (
              <Image source={{ uri: listing.image }} contentFit="cover" style={{ borderRadius: 999, height: 40, width: 40 }} />
            ) : (
              <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 40, justifyContent: "center", width: 40 }}>
                <MaterialCommunityIcons name="account" size={22} color={colors.primaryDark} />
              </View>
            )}
            <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
              <Text selectable numberOfLines={1} style={{ color: colors.ink, fontSize: 15.5, fontWeight: "900" }}>
                {otherUser?.name ?? translateCopy("Kullanıcı", language)}
              </Text>
              {otherTyping ? (
                <Text numberOfLines={1} style={{ color: colors.primary, fontSize: 12, fontWeight: "800" }}>{translateCopy("yazıyor…", language)}</Text>
              ) : (
                <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                  <MaterialCommunityIcons name={conversation?.partnerId ? "handshake-outline" : "tag-outline"} size={12} color={colors.muted} />
                  <Text selectable numberOfLines={1} style={{ color: colors.muted, flex: 1, fontSize: 12, fontWeight: "700" }}>
                    {conversation?.partnerId ? translateCopy("Ortak satış görüşmesi", language) : translateCopy("Satış görüşmesi", language)}
                  </Text>
                </View>
              )}
            </View>
          </Pressable>
          {listing ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={translateCopy("İlanı görüntüle", language)}
              hitSlop={8}
              onPress={() => router.push(`/listing/${listing.id}`)}
              style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, height: 38, justifyContent: "center", opacity: pressed ? 0.7 : 1, width: 38 })}
            >
              <MaterialCommunityIcons name="open-in-new" size={18} color={colors.primaryDark} />
            </Pressable>
          ) : null}
          {/* Engelle / engel kaldır */}
          {otherId ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isUserBlocked(otherId) ? translateCopy("Engeli kaldır", language) : translateCopy("Kullanıcıyı engelle", language)}
              hitSlop={8}
              onPress={() => {
                const blocked = isUserBlocked(otherId);
                if (blocked) { void unblockUser(otherId); return; }
                Alert.alert(translateCopy("Kullanıcıyı engelle", language), translateCopy("Bu kullanıcı sana mesaj gönderemeyecek. Dilediğinde engeli kaldırabilirsin.", language), [
                  { text: translateCopy("Vazgeç", language), style: "cancel" },
                  { text: translateCopy("Engelle", language), style: "destructive", onPress: () => void blockUser(otherId) }
                ]);
              }}
              style={({ pressed }) => ({ alignItems: "center", backgroundColor: isUserBlocked(otherId) ? colors.accentSoft : colors.surfaceAlt, borderColor: isUserBlocked(otherId) ? colors.accent : colors.line, borderRadius: 999, borderWidth: 1, height: 38, justifyContent: "center", opacity: pressed ? 0.7 : 1, width: 38 })}
            >
              <MaterialCommunityIcons name={isUserBlocked(otherId) ? "account-cancel" : "account-cancel-outline"} size={17} color={isUserBlocked(otherId) ? colors.accent : colors.muted} />
            </Pressable>
          ) : null}
          {/* Şikayet — mobil chat'te de kullanıcıyı bildir (masaüstü inbox parity). */}
          {otherId ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={translateCopy("Kullanıcıyı bildir", language)}
              hitSlop={8}
              onPress={() => {
                Alert.alert(translateCopy("Kullanıcıyı bildir", language), translateCopy("Bu kullanıcıyı uygunsuz davranış için ekibimize bildirmek istiyor musun?", language), [
                  { text: translateCopy("Vazgeç", language), style: "cancel" },
                  { text: translateCopy("Bildir", language), style: "destructive", onPress: () => { void (async () => { const ok = await reportUser(otherId, translateCopy("Kullanıcı bildirimi", language), translateCopy("Mesajlaşmadan bildirildi.", language)); Alert.alert(translateCopy(ok ? "Bildirim alındı" : "Bildirilemedi", language), translateCopy(ok ? "Ekibimiz inceleyecek. Teşekkürler." : "Lütfen tekrar dene.", language)); })(); } }
                ]);
              }}
              style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, height: 38, justifyContent: "center", opacity: pressed ? 0.7 : 1, width: 38 })}
            >
              <MaterialCommunityIcons name="flag-outline" size={17} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
        {/* Slim ilan şeridi: ürün + fiyat tek satır (tıklayınca ilana gider). */}
        {listing ? (
          <Pressable
            onPress={() => router.push(`/listing/${listing.id}`)}
            style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.surfaceAlt, borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 8, opacity: pressed ? 0.85 : 1, paddingHorizontal: 12, paddingVertical: 7 })}
          >
            <MaterialCommunityIcons name="tag-outline" size={14} color={colors.primaryDark} />
            <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "800", minWidth: 0 }}>{listing.title}</Text>
            <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{money(listing.price)}</Text>
          </Pressable>
        ) : (
          <View style={{ backgroundColor: colors.surfaceAlt, borderTopColor: colors.line, borderTopWidth: 1, paddingHorizontal: 12, paddingVertical: 7 }}>
            <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{translateCopy("İlan yayından kaldırıldı — mesaj geçmişin burada kalır.", language)}</Text>
          </View>
        )}
        {conversationRisk.hasRisk ? (
          <View style={{ alignItems: "center", backgroundColor: colors.warningSoft, borderTopColor: colors.warning, borderTopWidth: 1, flexDirection: "row", gap: 7, paddingHorizontal: 12, paddingVertical: 6 }}>
            <MaterialCommunityIcons name="shield-alert-outline" size={14} color={colors.warning} />
            <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 11, fontWeight: "800" }}>
              {`Dikkat: ${conversationRisk.matches.join(", ")} — anlaşmayı mesajda tutun.`}
            </Text>
          </View>
        ) : null}
      </View>

      <ScrollView
        ref={scrollRef}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          nearBottomRef.current = contentSize.height - (contentOffset.y + layoutMeasurement.height) < 120;
        }}
        onContentSizeChange={() => { if (nearBottomRef.current) scrollRef.current?.scrollToEnd({ animated: false }); }}
        style={{ flex: 1 }}
        contentContainerStyle={{ backgroundColor: colors.background, flexGrow: 1, justifyContent: conversationMessages.length === 0 ? "center" : "flex-start", padding: 12, paddingBottom: 16 }}
      >
        {conversationMessages.length === 0 ? (
          <EmptyState title={language === "en" ? "No messages yet" : "Henüz mesaj yok"} body={language === "en" ? "Write the first message and start the conversation." : "İlk mesajı yaz ve konuşmayı başlat."} mascot="mobile" />
        ) : null}
        {conversationMessages.map((message, i) => {
          const mine = message.senderId === currentUser.id;
          const showDay = i === 0 || chatMsgDay(message.createdAt) !== chatMsgDay(conversationMessages[i - 1].createdAt);
          const nextMsg = conversationMessages[i + 1];
          const prevMsg = conversationMessages[i - 1];
          const grouped = Boolean(prevMsg) && prevMsg.senderId === message.senderId && !showDay;
          const lastOfGroup = !nextMsg || nextMsg.senderId !== message.senderId || chatMsgDay(nextMsg.createdAt) !== chatMsgDay(message.createdAt);
          return (
            <View key={message.id} style={{ gap: 6, marginTop: i === 0 ? 0 : showDay ? 6 : grouped ? 2 : 10 }}>
              {showDay ? (
                <View style={{ alignItems: "center", marginVertical: 3 }}>
                  <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 3 }}>
                    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}>{chatDayHeader(chatMsgDay(message.createdAt), language)}</Text>
                  </View>
                </View>
              ) : null}
              <View style={{ alignItems: mine ? "flex-end" : "flex-start" }}>
                <View style={{ backgroundColor: mine ? colors.primary : colors.surface, borderColor: mine ? colors.primary : colors.line, borderTopLeftRadius: 14, borderTopRightRadius: 14, borderBottomLeftRadius: mine ? 14 : 4, borderBottomRightRadius: mine ? 4 : 14, borderWidth: 1, maxWidth: "82%", overflow: "hidden", paddingHorizontal: message.attachmentType === "image" ? 4 : 12, paddingVertical: message.attachmentType === "image" ? 4 : 8 }}>
                  {message.attachmentType === "image" && message.attachmentUrl ? (
                    <Pressable accessibilityRole="imagebutton" accessibilityLabel={translateCopy("Görseli büyüt", language)} onPress={() => message.attachmentUrl && setLightboxUri(message.attachmentUrl)}>
                      <SafeRemoteImage uri={message.attachmentUrl} contentFit="cover" style={{ backgroundColor: colors.line, borderRadius: 10, height: 180, width: 220 }} />
                    </Pressable>
                  ) : null}
                  {message.attachmentType === "file" && message.attachmentUrl ? (
                    <View style={{ alignItems: "center", flexDirection: "row", gap: 8, paddingVertical: 2 }}>
                      <MaterialCommunityIcons name="file-document-outline" size={22} color={mine ? "#FFFFFF" : colors.primary} />
                      <Text numberOfLines={1} style={{ color: mine ? "#FFFFFF" : colors.ink, fontSize: 12.5, fontWeight: "700", maxWidth: 170 }}>{message.attachmentName ?? "Dosya"}</Text>
                    </View>
                  ) : null}
                  {message.body ? (
                    <Text selectable style={{ color: mine ? "#FFFFFF" : colors.ink, fontSize: 14, fontWeight: "500", lineHeight: 20, paddingHorizontal: message.attachmentType === "image" ? 8 : 0, paddingTop: message.attachmentType === "image" ? 5 : 0 }}>
                      {message.body}
                    </Text>
                  ) : null}
                  {lastOfGroup ? (
                    <View style={{ alignItems: "center", alignSelf: "flex-end", flexDirection: "row", gap: 3, marginTop: 3, paddingHorizontal: message.attachmentType === "image" ? 8 : 0, paddingBottom: message.attachmentType === "image" ? 4 : 0 }}>
                      <Text selectable style={{ color: mine ? "#E6FBF7" : colors.subtle, fontSize: 10, fontWeight: "700" }}>
                        {chatMsgTime(message.createdAt) || shortDate(message.createdAt)}
                      </Text>
                      {mine ? (message.status === "failed"
                        ? <MaterialCommunityIcons name="alert-circle" size={13} color="#FFD9D0" />
                        : <MaterialCommunityIcons name={message.read ? "check-all" : "check"} size={13} color={message.read ? "#E6FBF7" : "rgba(255,255,255,0.7)"} />) : null}
                    </View>
                  ) : null}
                </View>
                {mine && message.status === "failed" ? (
                  <Pressable accessibilityRole="button" onPress={() => retryMessage(message.id)} style={({ pressed }) => ({ alignItems: "center", flexDirection: "row", gap: 3, marginTop: 3, opacity: pressed ? 0.7 : 1 })}>
                    <MaterialCommunityIcons name="refresh" size={12} color={colors.accent} />
                    <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "800" }}>{translateCopy("Gönderilemedi · tekrar dene", language)}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}
      </ScrollView>


      {draftRisk.hasRisk ? (
        <View style={{ alignItems: "center", backgroundColor: colors.warningSoft, borderTopColor: colors.warning, borderTopWidth: 1, flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
          <MaterialCommunityIcons name="shield-alert-outline" size={16} color={colors.warning} />
          <Text style={{ color: colors.ink, flex: 1, fontSize: 11.5, fontWeight: "700", lineHeight: 16 }}>{translateCopy("Hassas ödeme veya site dışı iletişim ifadesi algılandı. Şartları mesaj içinde netleştir.", language)}</Text>
        </View>
      ) : null}

      {/* Hızlı yanıt önerileri — kutu boşken ve odak yokken. Odaklanınca gizlenir ki
          yazmaya başlayınca ekran "zıplamasın" (kayma tek seferde klavye açılışına biner). */}
      {!blockedHere && !inputFocused && !body.trim() ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6, paddingHorizontal: 10, paddingVertical: 8 }} style={{ backgroundColor: colors.surface, borderTopColor: colors.line, borderTopWidth: 1, maxHeight: 52 }}>
          <Pressable onPress={() => setBody(translateCopy("Bu ürün için ortak satış yapmak istiyorum; komisyon ve şartları konuşabilir miyiz?", language))} style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderColor: colors.primary, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 12, paddingVertical: 7 }}>
            <MaterialCommunityIcons name="handshake-outline" size={13} color={colors.primaryDark} />
            <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>{translateCopy("Ortaklık öner", language)}</Text>
          </Pressable>
          <Pressable onPress={() => setBody(listing ? `${displayText(listing.title)} için fiyat teklifim: ₺___ (liste: ${money(listing.price)}). Uygun olur mu?` : translateCopy("Fiyat teklifim: ₺___ — uygun olur mu?", language))} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 12, paddingVertical: 7 }}>
            <MaterialCommunityIcons name="tag-outline" size={13} color={colors.primaryDark} />
            <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "700" }}>{translateCopy("Fiyat teklifi", language)}</Text>
          </Pressable>
          <Pressable onPress={() => setBody(safeDealDraft)} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 12, paddingVertical: 7 }}>
            <MaterialCommunityIcons name="shield-check-outline" size={13} color={colors.primaryDark} />
            <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "700" }}>{translateCopy("Güvenli anlaşma", language)}</Text>
          </Pressable>
          {quickReplies.map((reply) => (
            <Pressable key={reply} onPress={() => setBody(reply)} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 }}>
              <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "700" }}>{translateCopy(reply, language)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {blockedHere ? (
        <View style={{ alignItems: "center", backgroundColor: colors.surface, borderTopColor: colors.line, borderTopWidth: 1, gap: 8, paddingBottom: insets.bottom > 0 ? insets.bottom : 14, paddingHorizontal: 16, paddingTop: 14 }}>
          <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700", textAlign: "center" }}>{translateCopy("Bu kullanıcıyı engelledin. Mesajlaşmak için engeli kaldır.", language)}</Text>
          <Pressable accessibilityRole="button" onPress={() => otherId && void unblockUser(otherId)} style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, opacity: pressed ? 0.85 : 1, paddingHorizontal: 18, paddingVertical: 10 })}>
            <Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" }}>{translateCopy("Engeli kaldır", language)}</Text>
          </Pressable>
        </View>
      ) : (
      <View style={{ alignItems: "flex-end", backgroundColor: colors.surface, borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 8, paddingBottom: insets.bottom > 0 ? insets.bottom : 10, paddingHorizontal: 10, paddingTop: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Görsel ekle", language)} disabled={attaching} onPress={() => void attachImage()} style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, height: 44, justifyContent: "center", opacity: pressed ? 0.7 : 1, width: 44 })}>
          <MaterialCommunityIcons name={attaching ? "loading" : "paperclip"} size={20} color={attaching ? colors.primary : colors.muted} />
        </Pressable>
        <TextInput
          value={body}
          onChangeText={(t) => { setBody(t); notifyTyping(); }}
          multiline
          onFocus={() => { setInputFocused(true); setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 120); }}
          onBlur={() => setInputFocused(false)}
          placeholder={translateCopy("Mesaj yaz…", language)}
          placeholderTextColor={colors.muted}
          onKeyPress={(e) => {
            const ev = e.nativeEvent as { key?: string; shiftKey?: boolean };
            if (Platform.OS === "web" && ev.key === "Enter" && !ev.shiftKey) {
              (e as unknown as { preventDefault?: () => void }).preventDefault?.();
              send();
            }
          }}
          style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 22, borderWidth: 1, color: colors.ink, flex: 1, fontSize: 14.5, maxHeight: 120, minHeight: 44, paddingHorizontal: 16, paddingVertical: 11 }}
        />
        <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Gönder", language)} disabled={!body.trim()} onPress={send} style={({ pressed }) => ({ alignItems: "center", backgroundColor: body.trim() ? colors.primary : colors.line, borderRadius: 999, height: 44, justifyContent: "center", opacity: pressed ? 0.75 : 1, width: 44 })}>
          <MaterialCommunityIcons name="send" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
      )}

      {/* Görsel lightbox: sohbetteki görsele dokununca uygulama içinde tam ekran aç (tarayıcıya atmadan). */}
      <Modal visible={lightboxUri !== null} transparent animationType="fade" onRequestClose={() => setLightboxUri(null)}>
        <Pressable onPress={() => setLightboxUri(null)} style={{ alignItems: "center", backgroundColor: "rgba(0,0,0,0.92)", flex: 1, justifyContent: "center", padding: 16 }}>
          {lightboxUri ? <SafeRemoteImage uri={lightboxUri} contentFit="contain" style={{ height: "82%", width: "100%" }} /> : null}
          <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Kapat", language)} onPress={() => setLightboxUri(null)} style={{ position: "absolute", right: 18, top: 44 }}>
            <MaterialCommunityIcons name="close-circle" size={34} color="#FFFFFF" />
          </Pressable>
          {lightboxUri ? (
            <Pressable accessibilityRole="button" onPress={() => lightboxUri && void openUrlSafe(lightboxUri)} style={({ pressed }) => ({ alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999, bottom: 34, flexDirection: "row", gap: 6, opacity: pressed ? 0.7 : 1, paddingHorizontal: 16, paddingVertical: 9, position: "absolute" })}>
              <MaterialCommunityIcons name="download" size={16} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>{translateCopy("Tam boyut / indir", language)}</Text>
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function chatMsgTime(createdAt: string) {
  const m = /\d{2}:\d{2}/.exec(createdAt);
  return m ? m[0] : "";
}
function chatMsgDay(createdAt: string) {
  return createdAt.slice(0, 10);
}
function chatDayHeader(day: string, language: "tr" | "en") {
  const today = localToday();
  if (day === today) return language === "en" ? "Today" : "Bugün";
  const d = new Date(day);
  if (Number.isNaN(d.getTime())) return day;
  const months = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  return `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]} ${d.getFullYear()}`;
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

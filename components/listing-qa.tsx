import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { Alert } from "@/lib/alert";

import { colors } from "@/components/colors";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { answerQuestionLive, askQuestionLive } from "@/lib/live-service";
import { loadListingQuestions, type ListingQuestion } from "@/lib/supabase-data";
import { useStore } from "@/lib/use-store";

/** İlan Soru-Cevap: alıcılar herkese açık soru sorar, ilan sahibi cevaplar. */
export function ListingQA({ listingId, isOwner, isDemo }: { listingId: string; isOwner: boolean; isDemo: boolean }) {
  const { language } = useLanguage();
  const { currentUser, isAuthenticated } = useStore();
  const [items, setItems] = useState<ListingQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});

  async function refresh() {
    const rows = await loadListingQuestions(listingId);
    setItems(rows);
    setLoading(false);
  }
  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [listingId]);

  async function ask() {
    if (isDemo) { Alert.alert(translateCopy("Örnek ilan", language), translateCopy("Bu örnek ilanda soru sorulamaz.", language)); return; }
    if (!isAuthenticated) { Alert.alert(translateCopy("Giriş gerekli", language), translateCopy("Soru sormak için giriş yapmalısın.", language)); return; }
    const q = draft.trim();
    if (q.length < 5) { Alert.alert(translateCopy("Kısa soru", language), translateCopy("Lütfen sorunu biraz daha açık yaz.", language)); return; }
    setSending(true);
    const res = await askQuestionLive(listingId, currentUser.id, currentUser.name, q);
    setSending(false);
    if (!res.ok) { Alert.alert(translateCopy("Gönderilemedi", language), res.error ?? translateCopy("Soru gönderilemedi.", language)); return; }
    setDraft("");
    void refresh();
  }

  async function answer(id: string) {
    const a = (answerDrafts[id] ?? "").trim();
    if (a.length < 2) return;
    const res = await answerQuestionLive(id, a);
    if (!res.ok) { Alert.alert(translateCopy("Kaydedilemedi", language), res.error ?? translateCopy("Cevap kaydedilemedi.", language)); return; }
    setAnswerDrafts((s) => ({ ...s, [id]: "" }));
    void refresh();
  }

  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 14, padding: 18 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <MaterialCommunityIcons name="comment-question-outline" size={20} color={colors.primaryDark} />
        <Text style={{ color: colors.ink, flex: 1, fontSize: 17, fontWeight: "900" }}>{translateCopy("Soru & Cevap", language)}</Text>
        <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{items.length}</Text>
      </View>

      {/* Soru sor (sahip değilse) */}
      {!isOwner ? (
        <View style={{ gap: 8 }}>
          <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 8 }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              multiline
              placeholder={isDemo ? translateCopy("Örnek ilanda soru kapalı", language) : translateCopy("Satıcıya herkese açık bir soru sor…", language)}
              placeholderTextColor={colors.subtle}
              editable={!isDemo}
              style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 11, borderWidth: 1, color: colors.ink, flex: 1, fontSize: 13.5, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, textAlignVertical: "top" }}
            />
            <Pressable disabled={sending || isDemo} onPress={() => void ask()} style={{ alignItems: "center", backgroundColor: isDemo ? colors.line : colors.primary, borderRadius: 11, flexDirection: "row", gap: 6, opacity: sending ? 0.6 : 1, paddingHorizontal: 16, paddingVertical: 12 }}>
              <MaterialCommunityIcons name="send" size={15} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: "900" }}>{sending ? "…" : translateCopy("Sor", language)}</Text>
            </Pressable>
          </View>
          <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "600" }}>{translateCopy("Sorular ve cevaplar herkese açıktır. Kişisel bilgi paylaşma.", language)}</Text>
        </View>
      ) : null}

      {/* Liste */}
      {loading ? (
        <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>{translateCopy("Yükleniyor…", language)}</Text>
      ) : items.length === 0 ? (
        <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>{translateCopy("Henüz soru yok. İlk soruyu sen sor.", language)}</Text>
      ) : (
        <View style={{ gap: 12 }}>
          {items.map((it) => (
            <View key={it.id} style={{ borderTopColor: colors.line, borderTopWidth: 1, gap: 8, paddingTop: 12 }}>
              <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 8 }}>
                <MaterialCommunityIcons name="account-question-outline" size={16} color={colors.info} style={{ marginTop: 2 }} />
                <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
                  <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "700", lineHeight: 19 }}>{it.question}</Text>
                  <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "700" }}>{it.askerName} · {(it.createdAt || "").slice(0, 10)}</Text>
                </View>
              </View>
              {it.answer ? (
                <View style={{ alignItems: "flex-start", backgroundColor: colors.primarySoft, borderRadius: 10, flexDirection: "row", gap: 8, marginLeft: 24, padding: 10 }}>
                  <MaterialCommunityIcons name="check-decagram" size={16} color={colors.primaryDark} style={{ marginTop: 1 }} />
                  <Text style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "600", lineHeight: 18 }}>{it.answer}</Text>
                </View>
              ) : isOwner ? (
                <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 8, marginLeft: 24 }}>
                  <TextInput
                    value={answerDrafts[it.id] ?? ""}
                    onChangeText={(v) => setAnswerDrafts((s) => ({ ...s, [it.id]: v }))}
                    multiline
                    placeholder={translateCopy("Cevapla…", language)}
                    placeholderTextColor={colors.subtle}
                    style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, flex: 1, fontSize: 13, minHeight: 40, paddingHorizontal: 10, paddingVertical: 8, textAlignVertical: "top" }}
                  />
                  <Pressable onPress={() => void answer(it.id)} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }}>
                    <Text style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: "900" }}>{translateCopy("Gönder", language)}</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={{ color: colors.subtle, fontSize: 12, fontWeight: "600", marginLeft: 24 }}>{translateCopy("Satıcı henüz cevaplamadı.", language)}</Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

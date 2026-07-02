import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { answerQuestionLive, askQuestionLive } from "@/lib/live-service";
import { loadListingQuestions, type ListingQuestion } from "@/lib/supabase-data";
import { useStore } from "@/lib/use-store";

/** İlan Soru-Cevap: alıcılar herkese açık soru sorar, ilan sahibi cevaplar. */
export function ListingQA({ listingId, isOwner, isDemo }: { listingId: string; isOwner: boolean; isDemo: boolean }) {
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
    if (isDemo) { Alert.alert("Örnek ilan", "Bu örnek ilanda soru sorulamaz."); return; }
    if (!isAuthenticated) { Alert.alert("Giriş gerekli", "Soru sormak için giriş yapmalısın."); return; }
    const q = draft.trim();
    if (q.length < 5) { Alert.alert("Kısa soru", "Lütfen sorunu biraz daha açık yaz."); return; }
    setSending(true);
    const res = await askQuestionLive(listingId, currentUser.id, currentUser.name, q);
    setSending(false);
    if (!res.ok) { Alert.alert("Gönderilemedi", res.error ?? "Soru gönderilemedi."); return; }
    setDraft("");
    void refresh();
  }

  async function answer(id: string) {
    const a = (answerDrafts[id] ?? "").trim();
    if (a.length < 2) return;
    const res = await answerQuestionLive(id, a);
    if (!res.ok) { Alert.alert("Kaydedilemedi", res.error ?? "Cevap kaydedilemedi."); return; }
    setAnswerDrafts((s) => ({ ...s, [id]: "" }));
    void refresh();
  }

  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 14, padding: 18 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <MaterialCommunityIcons name="comment-question-outline" size={20} color={colors.primaryDark} />
        <Text style={{ color: colors.ink, flex: 1, fontSize: 17, fontWeight: "900" }}>Soru & Cevap</Text>
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
              placeholder={isDemo ? "Örnek ilanda soru kapalı" : "Satıcıya herkese açık bir soru sor…"}
              placeholderTextColor={colors.subtle}
              editable={!isDemo}
              style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 11, borderWidth: 1, color: colors.ink, flex: 1, fontSize: 13.5, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, textAlignVertical: "top" }}
            />
            <Pressable disabled={sending || isDemo} onPress={() => void ask()} style={{ alignItems: "center", backgroundColor: isDemo ? colors.line : colors.primary, borderRadius: 11, flexDirection: "row", gap: 6, opacity: sending ? 0.6 : 1, paddingHorizontal: 16, paddingVertical: 12 }}>
              <MaterialCommunityIcons name="send" size={15} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: "900" }}>{sending ? "…" : "Sor"}</Text>
            </Pressable>
          </View>
          <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "600" }}>Sorular ve cevaplar herkese açıktır. Kişisel bilgi paylaşma.</Text>
        </View>
      ) : null}

      {/* Liste */}
      {loading ? (
        <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>Yükleniyor…</Text>
      ) : items.length === 0 ? (
        <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>Henüz soru yok. İlk soruyu sen sor.</Text>
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
                    placeholder="Cevapla…"
                    placeholderTextColor={colors.subtle}
                    style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, flex: 1, fontSize: 13, minHeight: 40, paddingHorizontal: 10, paddingVertical: 8, textAlignVertical: "top" }}
                  />
                  <Pressable onPress={() => void answer(it.id)} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }}>
                    <Text style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: "900" }}>Gönder</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={{ color: colors.subtle, fontSize: 12, fontWeight: "600", marginLeft: 24 }}>Satıcı henüz cevaplamadı.</Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

import { MaterialCommunityIcons } from "@/components/icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { Alert } from "@/lib/alert";
import { colors } from "@/components/colors";
import { StarRatingInput } from "@/components/star-rating-input";
import { translateCopy } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";
import { shortDate } from "@/lib/locale";
import { displayText } from "@/lib/text";
import { replyToReviewLive, toggleReviewHelpfulLive } from "@/lib/live-service";
import type { Review } from "@/lib/types";

/*
 * Yorum kartı — TEK kaynak. Eskiden yalnız mağaza sayfasının içinde yerel bir
 * fonksiyondu; ilan detayı kendi salt-okunur kopyasını çiziyordu. Sonuç: aynı yorum
 * mağazada düzenlenebilir/silinebilir/yanıtlanabilirken ilan sayfasında hiçbiri
 * yapılamıyordu. Buraya çıkarıldı, iki sayfa da bunu kullanıyor.
 */
// Yorum kartı: puan/yorum + satıcı yanıtı (yalnız satıcı yazar) + "Faydalı" oyu (girişli kullanıcı).
export function ReviewCard({ review, reviewerName, isSeller, authed, onPatch, onRemove, isMine, onEdit, onDelete, onReport, language }: { review: Review; reviewerName?: string; isSeller: boolean; authed?: boolean; onPatch?: (id: string, patch: Partial<Review>) => void; onRemove?: (id: string) => void; isMine?: boolean; onEdit?: (id: string, rating: number, comment: string) => Promise<boolean>; onDelete?: (id: string) => Promise<boolean>; onReport?: (review: Review, details?: string) => Promise<boolean>; language: "tr" | "en" }) {
  const router = useRouter();
  const [savedReply, setSavedReply] = useState(review.sellerReply);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(review.sellerReply ?? "");
  const [saving, setSaving] = useState(false);
  const [helpful, setHelpful] = useState(review.helpfulCount ?? 0);
  const [voting, setVoting] = useState(false);
  const [voteErr, setVoteErr] = useState(false);
  // Kendi yorumunu düzenleme + şikayet durumları
  const [editingOwn, setEditingOwn] = useState(false);
  const [ownRating, setOwnRating] = useState(review.rating);
  const [ownComment, setOwnComment] = useState(review.comment);
  const [ownBusy, setOwnBusy] = useState(false);
  const [reported, setReported] = useState(false);
  const saveOwnEdit = async () => {
    if (ownBusy || !onEdit || !ownComment.trim()) return;
    setOwnBusy(true);
    const ok = await onEdit(review.id, ownRating, ownComment.trim());
    setOwnBusy(false);
    if (ok) { onPatch?.(review.id, { rating: ownRating, comment: ownComment.trim() }); setEditingOwn(false); }
  };
  const deleteOwn = async () => {
    if (ownBusy || !onDelete) return;
    setOwnBusy(true);
    const ok = await onDelete(review.id);
    setOwnBusy(false);
    if (ok) onRemove?.(review.id);
  };
  const reportOne = async () => {
    if (reported || !onReport) return;
    const ok = await onReport(review);
    if (ok) setReported(true);
  };
  // Kaynak prop güncellenince (onPatch sonrası / yeniden fetch) yerel durumu senkronize et —
  // tab değişip geri dönünce (remount) stale değer seed'lenmesin.
  useEffect(() => { setSavedReply(review.sellerReply); }, [review.sellerReply]);
  useEffect(() => { setHelpful(review.helpfulCount ?? 0); }, [review.helpfulCount]);

  const submitReply = async () => {
    if (saving) return;
    setSaving(true);
    const text = draft.trim();
    const ok = await replyToReviewLive(review.id, text);
    setSaving(false);
    if (ok) { setSavedReply(text || undefined); setEditing(false); onPatch?.(review.id, { sellerReply: text || undefined }); }
  };
  const vote = async () => {
    if (voting) return;
    // Girişsizse doğrudan girişe yönlendir (RPC'yi çağırıp null'ı "giriş yok" sanmak yerine).
    if (authed === false) { router.push("/auth"); return; }
    setVoting(true);
    setVoteErr(false);
    const n = await toggleReviewHelpfulLive(review.id);
    setVoting(false);
    if (n == null) { setVoteErr(true); return; } // GEÇİCİ hata (ağ/RPC) — girişli kullanıcıyı /auth'a ATMA
    setHelpful(n);
    onPatch?.(review.id, { helpfulCount: n });
  };

  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 8, padding: 16 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
        <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 38, justifyContent: "center", width: 38 }}>
          <MaterialCommunityIcons name="account" size={20} color={colors.primaryDark} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "800" }}>{reviewerName ?? translateCopy("Kullanıcı", language)}</Text>
            {review.saleId ? (
              <View style={{ alignItems: "center", backgroundColor: colors.successSoft, borderRadius: 999, flexDirection: "row", gap: 3, paddingHorizontal: 7, paddingVertical: 2 }}>
                <MaterialCommunityIcons name="check-decagram" size={12} color={colors.success} />
                <Text style={{ color: colors.success, fontSize: 10.5, fontWeight: "900" }}>{translateCopy("Doğrulanmış satış", language)}</Text>
              </View>
            ) : null}
          </View>
          <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{shortDate(review.createdAt)}</Text>
        </View>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 2 }}>
          {[1, 2, 3, 4, 5].map((n) => <MaterialCommunityIcons key={n} name={n <= review.rating ? "star" : "star-outline"} size={15} color={colors.gold} />)}
        </View>
      </View>
      {editingOwn && isMine ? (
        <View style={{ gap: 8 }}>
          <StarRatingInput value={ownRating} onChange={setOwnRating} size={26} />
          <TextInput value={ownComment} onChangeText={setOwnComment} multiline placeholder={translateCopy("Yorumun…", language)} placeholderTextColor={colors.subtle} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 13.5, minHeight: 64, padding: 10, textAlignVertical: "top" }} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={saveOwnEdit} accessibilityRole="button" style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, opacity: pressed ? 0.85 : 1, paddingHorizontal: 16, paddingVertical: 9 })}>
              <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{ownBusy ? translateCopy("Kaydediliyor…", language) : translateCopy("Kaydet", language)}</Text>
            </Pressable>
            <Pressable onPress={() => { setEditingOwn(false); setOwnRating(review.rating); setOwnComment(review.comment); }} accessibilityRole="button" style={({ pressed }) => ({ alignItems: "center", borderColor: colors.line, borderRadius: 10, borderWidth: 1, opacity: pressed ? 0.85 : 1, paddingHorizontal: 14, paddingVertical: 9 })}>
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>{translateCopy("Vazgeç", language)}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "500", lineHeight: 20 }}>{review.comment}</Text>
      )}

      {savedReply ? (
        <View style={{ backgroundColor: colors.primarySoft, borderRadius: 12, borderLeftColor: colors.primary, borderLeftWidth: 3, gap: 3, marginTop: 2, padding: 11 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 5 }}>
            <MaterialCommunityIcons name="storefront-outline" size={13} color={colors.primaryDark} />
            <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "900" }}>{translateCopy("Satıcı yanıtı", language)}</Text>
          </View>
          <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "500", lineHeight: 19 }}>{savedReply}</Text>
        </View>
      ) : null}

      <View style={{ alignItems: "center", flexDirection: "row", gap: 8, marginTop: 2 }}>
        <Pressable onPress={vote} accessibilityRole="button" style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, opacity: pressed ? 0.7 : 1, paddingHorizontal: 11, paddingVertical: 6 })}>
          <MaterialCommunityIcons name="thumb-up-outline" size={14} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{translateCopy("Faydalı", language)}{helpful > 0 ? ` · ${helpful}` : ""}</Text>
        </Pressable>
        {isSeller ? (
          <Pressable onPress={() => { setDraft(savedReply ?? ""); setEditing((e) => !e); }} accessibilityRole="button" style={({ pressed }) => ({ alignItems: "center", flexDirection: "row", gap: 5, opacity: pressed ? 0.7 : 1, paddingHorizontal: 4, paddingVertical: 6 })}>
            <MaterialCommunityIcons name="reply-outline" size={15} color={colors.primaryDark} />
            <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>{savedReply ? translateCopy("Yanıtı düzenle", language) : translateCopy("Yanıtla", language)}</Text>
          </Pressable>
        ) : null}
        {isMine ? (
          <>
            <Pressable onPress={() => { setEditingOwn((e) => !e); setOwnRating(review.rating); setOwnComment(review.comment); }} accessibilityRole="button" style={({ pressed }) => ({ alignItems: "center", flexDirection: "row", gap: 4, opacity: pressed ? 0.7 : 1, paddingHorizontal: 4, paddingVertical: 6 })}>
              <MaterialCommunityIcons name="pencil-outline" size={15} color={colors.muted} />
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{translateCopy("Düzenle", language)}</Text>
            </Pressable>
            <Pressable onPress={deleteOwn} accessibilityRole="button" style={({ pressed }) => ({ alignItems: "center", flexDirection: "row", gap: 4, opacity: pressed ? 0.7 : 1, paddingHorizontal: 4, paddingVertical: 6 })}>
              <MaterialCommunityIcons name="trash-can-outline" size={15} color={colors.accent} />
              <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "800" }}>{ownBusy ? "…" : translateCopy("Sil", language)}</Text>
            </Pressable>
          </>
        ) : authed ? (
          <Pressable onPress={reportOne} disabled={reported} accessibilityRole="button" style={({ pressed }) => ({ alignItems: "center", flexDirection: "row", gap: 4, marginLeft: "auto", opacity: pressed ? 0.7 : 1, paddingHorizontal: 4, paddingVertical: 6 })}>
            <MaterialCommunityIcons name={reported ? "flag-checkered" : "flag-outline"} size={15} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{reported ? translateCopy("Bildirildi", language) : translateCopy("Şikayet et", language)}</Text>
          </Pressable>
        ) : null}
        {voteErr ? <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "700" }}>{translateCopy("Şu an yapılamadı, tekrar dene", language)}</Text> : null}
      </View>

      {editing && isSeller ? (
        <View style={{ gap: 8, marginTop: 2 }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            multiline
            placeholder={translateCopy("Yanıtın… (nazik ve yapıcı olun)", language)}
            placeholderTextColor={colors.subtle}
            style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 13, minHeight: 64, padding: 10, textAlignVertical: "top" }}
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={submitReply} accessibilityRole="button" style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, opacity: pressed ? 0.85 : 1, paddingHorizontal: 16, paddingVertical: 9 })}>
              <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{saving ? translateCopy("Kaydediliyor…", language) : translateCopy("Yanıtı kaydet", language)}</Text>
            </Pressable>
            <Pressable onPress={() => setEditing(false)} accessibilityRole="button" style={({ pressed }) => ({ alignItems: "center", borderColor: colors.line, borderRadius: 10, borderWidth: 1, opacity: pressed ? 0.85 : 1, paddingHorizontal: 14, paddingVertical: 9 })}>
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>{translateCopy("Vazgeç", language)}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

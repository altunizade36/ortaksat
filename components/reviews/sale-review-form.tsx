import { useRef, useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { StarRatingInput } from "@/components/star-rating-input";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { REVIEW_MAX_LENGTH, REVIEW_MIN_LENGTH, validateReviewDraft } from "@/lib/reviews";
import { showToast } from "@/lib/toast";

/**
 * Satış sonrası değerlendirme formu — TEK kaynak (ilan detayı, satıcı paneli, ortak paneli).
 *
 * Üç ekranda da ayrı ayrı yazılmış küçük formların ortak eksikleri burada kapatıldı:
 *  • Puan önceden 5 yıldız SEÇİLİ geliyordu (puanları yukarı çeker) → artık boş, seçmek zorunlu.
 *  • Gönder'e iki kez basınca ikinci istek de gidiyordu → ref kilidi + devre dışı düğme.
 *  • Hata/başarı geri bildirimi yoktu (createSaleReview'in sonucu yok sayılıyordu) → hata
 *    formun içinde, başarı toast ile; hata olursa yazılan metin korunur.
 *  • Karakter sayacı + en az 10 karakter kuralı + Türkçe doğrulama mesajı.
 */
export function SaleReviewForm({
  saleId,
  title,
  placeholder,
  createSaleReview,
  canReviewSale,
  onDone
}: {
  saleId: string;
  title: string;
  placeholder?: string;
  /** Mağaza eylemi (store.createSaleReview). Başarıda yorum nesnesi, başarısızlıkta undefined döner. */
  createSaleReview: (saleId: string, rating: number, comment: string) => unknown;
  canReviewSale?: (saleId: string) => boolean;
  onDone?: () => void;
}) {
  const { language } = useLanguage();
  const t = (value: string) => translateCopy(value, language);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const length = comment.trim().length;

  async function submit() {
    if (lock.current) return;
    const problem = validateReviewDraft(rating, comment);
    if (problem) { setError(problem); return; }
    lock.current = true;
    setBusy(true);
    setError("");
    let created: unknown;
    try { created = await createSaleReview(saleId, rating, comment.trim()); } catch { created = undefined; }
    lock.current = false;
    setBusy(false);
    if (!created) { setError("Değerlendirme kaydedilemedi. Yazdıkların duruyor; tekrar dene."); return; }
    setComment("");
    setRating(0);
    showToast(t("Değerlendirmen kaydedildi."));
    onDone?.();
  }

  if (canReviewSale && !canReviewSale(saleId) && !busy) return null;

  return (
    <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 12, gap: 8, padding: 12 }}>
      <Text selectable style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>{title}</Text>
      <StarRatingInput value={rating} onChange={(v) => { setRating(v); if (error) setError(""); }} disabled={busy} />
      <TextInput
        value={comment}
        onChangeText={(v) => { setComment(v); if (error) setError(""); }}
        multiline
        editable={!busy}
        maxLength={REVIEW_MAX_LENGTH}
        accessibilityLabel={t("Yorumun")}
        placeholder={placeholder ?? t("Deneyimini birkaç cümleyle anlat…")}
        placeholderTextColor={colors.subtle}
        style={{ backgroundColor: colors.surface, borderColor: error ? colors.accent : colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: Platform.OS === "web" ? 16 : 14, minHeight: 92, padding: 10, textAlignVertical: "top" }}
      />
      <View style={{ flexDirection: "row", gap: 8, justifyContent: "space-between" }}>
        <Text style={{ color: colors.muted, flex: 1, fontSize: 11.5, fontWeight: "600" }}>
          {length < REVIEW_MIN_LENGTH ? `${t("En az")} ${REVIEW_MIN_LENGTH} ${t("karakter")}` : ""}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{length}/{REVIEW_MAX_LENGTH}</Text>
      </View>
      {error ? <Text accessibilityRole="alert" style={{ color: colors.accent, fontSize: 12.5, fontWeight: "700" }}>{t(error)}</Text> : null}
      <Pressable
        onPress={() => { void submit(); }}
        disabled={busy}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy, busy }}
        style={({ pressed }) => ({ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 10, justifyContent: "center", minHeight: 44, opacity: busy ? 0.6 : pressed ? 0.85 : 1, paddingHorizontal: 18 })}
      >
        <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>{busy ? t("Gönderiliyor…") : t("Yorumu kaydet")}</Text>
      </Pressable>
    </View>
  );
}

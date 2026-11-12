import { UserAvatar } from "@/components/user-avatar";
import { MaterialCommunityIcons } from "@/components/icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { StarRatingInput } from "@/components/star-rating-input";
import { translateCopy } from "@/lib/i18n";
import { replyToReviewLive, toggleReviewHelpfulLive } from "@/lib/live-service";
import { REVIEW_MAX_LENGTH, REVIEW_REPLY_MAX_LENGTH, clampRating, ensureHelpfulVoteKnown, reviewRelativeDate, setHelpfulVoted, useHelpfulVoted, validateReviewDraft } from "@/lib/reviews";
import { showToast } from "@/lib/toast";
import { useStore } from "@/lib/use-store";
import type { Review } from "@/lib/types";
import { EvidenceGallery } from "@/components/mobile/evidence";

/*
 * Yorum kartı — TEK kaynak (ilan detayı, mağaza, mobil mağaza, mobil ilan yorumları).
 *
 * Kartın kendi içinde çözdüğü şeyler (çağıran sayfa bir şey yapmak zorunda kalmasın):
 *  • Yanıt düğmesi yalnız yorumun HAKKINDA olduğu kişiye — hakkında-kişi yoksa (ürün yorumu)
 *    ilan sahibine — görünür; sunucudaki reply_to_review ile AYNI kural. Eskiden ilan sahibi
 *    her yorumda "Yanıtla" görüyor, ortağa yazılmış yorumda kaydet sessizce başarısız oluyordu.
 *  • "Faydalı" oyu: oy verilmişse dolu ikon; iyimser güncellenir, hata olursa geri alınır;
 *    kişi KENDİ yorumuna oy veremez.
 *  • Silme iki adımlı (kart içi onay) — tek dokunuşla geri dönüşsüz silme yoktu.
 *  • Düzenle / yanıtla / şikayet: çift gönderim kilidi + hata mesajı + toast.
 *  • Engellenen kullanıcının yorumu varsayılan gizli.
 *  • Silinen yorum, çağıran onRemove vermese bile karttan kalkar.
 */
const INPUT_FONT = Platform.OS === "web" ? 16 : 14; // iOS Safari 16px altında odakta zoom yapar
const REPORT_REASONS = ["Spam veya sahte yorum", "Hakaret / uygunsuz dil", "Konuyla ilgisiz", "Kişisel bilgi içeriyor"];
const CLAMP_LINES = 5;

type Props = {
  review: Review;
  reviewerName?: string;
  /** Sayfayı görüntüleyen, bu sayfanın sahibi (mağaza sahibi / ilan sahibi) mi? */
  isSeller: boolean;
  authed?: boolean;
  onPatch?: (id: string, patch: Partial<Review>) => void;
  onRemove?: (id: string) => void;
  isMine?: boolean;
  onEdit?: (id: string, rating: number, comment: string) => Promise<boolean>;
  onDelete?: (id: string) => Promise<boolean>;
  onReport?: (review: Review, details?: string) => Promise<boolean>;
  language: "tr" | "en";
};

function ActionButton({ icon, label, onPress, color = colors.muted, disabled, accessibilityLabel }: { icon: ComponentProps<typeof MaterialCommunityIcons>["name"]; label: string; onPress: () => void; color?: string; disabled?: boolean; accessibilityLabel?: string }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled: !!disabled }} style={({ pressed }) => ({ alignItems: "center", flexDirection: "row", gap: 4, minHeight: 40, opacity: disabled ? 0.5 : pressed ? 0.7 : 1, paddingHorizontal: 6 })}>
      <MaterialCommunityIcons name={icon} size={16} color={color} />
      <Text style={{ color, fontSize: 12.5, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

function SolidButton({ label, onPress, busy, danger }: { label: string; onPress: () => void; busy?: boolean; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={busy} accessibilityRole="button" accessibilityState={{ disabled: !!busy, busy: !!busy }} style={({ pressed }) => ({ alignItems: "center", backgroundColor: danger ? colors.accent : colors.primary, borderRadius: 10, justifyContent: "center", minHeight: 40, opacity: busy ? 0.6 : pressed ? 0.85 : 1, paddingHorizontal: 16 })}>
      <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{label}</Text>
    </Pressable>
  );
}

function GhostButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ alignItems: "center", borderColor: colors.line, borderRadius: 10, borderWidth: 1, justifyContent: "center", minHeight: 40, opacity: pressed ? 0.85 : 1, paddingHorizontal: 14 })}>
      <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

const inputStyle = { backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: INPUT_FONT, minHeight: 84, padding: 10, textAlignVertical: "top" as const };

export function ReviewCard({ review, reviewerName, isSeller, authed, onPatch, onRemove, isMine, onEdit, onDelete, onReport, language }: Props) {
  const router = useRouter();
  const store = useStore();
  const me = store.currentUser?.id;
  const t = (value: string) => translateCopy(value, language);

  // Görüntülenen puan/yorum: kaynak prop + (çağıran onPatch vermediyse) yerel düzeltme.
  const [override, setOverride] = useState<{ rating: number; comment: string } | null>(null);
  const [removed, setRemoved] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [revealBlocked, setRevealBlocked] = useState(false);
  // Satıcı/ortak yanıtı
  const [savedReply, setSavedReply] = useState(review.sellerReply);
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState(review.sellerReply ?? "");
  const [saving, setSaving] = useState(false);
  const [replyErr, setReplyErr] = useState("");
  // Faydalı oyu
  const [helpful, setHelpful] = useState(review.helpfulCount ?? 0);
  const [voteErr, setVoteErr] = useState(false);
  // Kendi yorumunu düzenleme / silme
  const [editingOwn, setEditingOwn] = useState(false);
  const [ownRating, setOwnRating] = useState(clampRating(review.rating));
  const [ownComment, setOwnComment] = useState(review.comment);
  const [ownBusy, setOwnBusy] = useState(false);
  const [ownErr, setOwnErr] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Şikayet
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportedNow, setReportedNow] = useState(false);
  // State güncellemesi render'ı beklerken gelen ikinci dokunuşu ref kilitler (çift gönderim).
  const lock = useRef(false);
  const voteLock = useRef(false);

  const mine = isMine ?? (!!me && review.reviewerId === me);
  const voted = useHelpfulVoted(review.id, me, authed === true && !mine);

  // Kaynak prop güncellenince (onPatch sonrası / yeniden fetch) yerel durumu senkronize et —
  // tab değişip geri dönünce (remount) stale değer seed'lenmesin.
  useEffect(() => { setSavedReply(review.sellerReply); }, [review.sellerReply]);
  useEffect(() => { setHelpful(review.helpfulCount ?? 0); }, [review.helpfulCount]);
  useEffect(() => { setOverride(null); }, [review.rating, review.comment]);

  const rating = clampRating(override?.rating ?? review.rating);
  const comment = override?.comment ?? review.comment ?? "";
  // Yanıt hakkı: yalnız yorumun hakkında olduğu kişi (reply_to_review ile AYNI kural).
  // Hakkında-kişi belli değilse (ürün yorumu) yanıt hakkı ilan sahibinindir: coalesce(reviewed_user_id, ilan sahibi).
  const reviewListingOwner = store.listings.find((l) => l.id === review.listingId)?.ownerId;
  const canReply = !!me && (review.reviewedUserId ? review.reviewedUserId === me : isSeller && (!reviewListingOwner || reviewListingOwner === me));
  const replyTitle = review.type === "partner" ? t("Ortak yanıtı") : t("Satıcı yanıtı");
  const verified = !!review.saleId && review.type !== "product";
  const kind = review.type === "partner" ? t("Ortak değerlendirmesi") : review.type === "seller" ? t("Satıcı değerlendirmesi") : t("Ürün yorumu");
  const alreadyReported = reportedNow || (!!me && store.reports.some((r) => r.reporterId === me && (r.details ?? "").startsWith(`review=${review.id}:`)));
  const long = comment.length > 280 || comment.split("\n").length > CLAMP_LINES;
  const blocked = !mine && !!review.reviewerId && store.isUserBlocked(review.reviewerId);

  const saveOwnEdit = async () => {
    if (lock.current || !onEdit) return;
    const text = ownComment.trim();
    const problem = validateReviewDraft(ownRating, text);
    if (problem) { setOwnErr(problem); return; }
    lock.current = true;
    setOwnBusy(true);
    setOwnErr("");
    let ok = false;
    try { ok = await onEdit(review.id, ownRating, text); } catch { ok = false; }
    lock.current = false;
    setOwnBusy(false);
    if (!ok) { setOwnErr("Yorum güncellenemedi. Yazdıkların duruyor; tekrar dene."); return; }
    setOverride({ rating: ownRating, comment: text });
    onPatch?.(review.id, { rating: ownRating, comment: text });
    setEditingOwn(false);
    showToast(t("Yorumun güncellendi."));
  };

  const deleteOwn = async () => {
    if (lock.current || !onDelete) return;
    lock.current = true;
    setOwnBusy(true);
    setOwnErr("");
    let ok = false;
    try { ok = await onDelete(review.id); } catch { ok = false; }
    lock.current = false;
    setOwnBusy(false);
    if (!ok) { setConfirmDelete(false); setOwnErr("Yorum silinemedi. Tekrar dene."); return; }
    showToast(t("Yorumun silindi."));
    setRemoved(true);
    onRemove?.(review.id);
  };

  const submitReport = async () => {
    if (lock.current || !onReport || alreadyReported) return;
    if (!reportReason) return;
    lock.current = true;
    setReportBusy(true);
    let ok = false;
    try { ok = await onReport(review, reportReason); } catch { ok = false; }
    lock.current = false;
    setReportBusy(false);
    if (!ok) { showToast(t("Şikayet gönderilemedi. Tekrar dene."), "info"); return; }
    setReportedNow(true);
    setReportOpen(false);
    showToast(t("Şikayetin alındı. İnceleyeceğiz."));
  };

  const submitReply = async () => {
    if (lock.current) return;
    const text = draft.trim();
    if (!text && !savedReply) { setReplyErr("Yanıt boş olamaz."); return; }
    if (text.length > REVIEW_REPLY_MAX_LENGTH) { setReplyErr(`Yanıt en fazla ${REVIEW_REPLY_MAX_LENGTH} karakter olabilir.`); return; }
    lock.current = true;
    setSaving(true);
    setReplyErr("");
    let ok = false;
    try { ok = await replyToReviewLive(review.id, text); } catch { ok = false; }
    lock.current = false;
    setSaving(false);
    if (!ok) { setReplyErr("Yanıt kaydedilemedi. Yazdıkların duruyor; tekrar dene."); return; }
    setSavedReply(text || undefined);
    setReplying(false);
    onPatch?.(review.id, { sellerReply: text || undefined });
    showToast(t(text ? "Yanıtın yayınlandı." : "Yanıtın kaldırıldı."));
  };

  const vote = async () => {
    if (voteLock.current || mine) return;
    // Girişsizse doğrudan girişe yönlendir (RPC'yi çağırıp null'ı "giriş yok" sanmak yerine).
    if (authed === false) { router.push("/auth"); return; }
    voteLock.current = true;
    setVoteErr(false);
    // Sunucu RPC'si AÇ/KAPAT'tır → mevcut oy durumu KESİN bilinmeden gönderilmez (bilinmezken
    // "oy yok" varsayılırsa önceki oy silinir ama kart "oy verildi" gösterir, sonra hep ters kalır).
    const current = await ensureHelpfulVoteKnown(review.id, me);
    if (!current.known) { voteLock.current = false; setVoteErr(true); return; }
    // İyimser güncelleme; sunucu yetkili sayıyı döndürür, hata olursa geri alınır.
    const before = { helpful, voted: current.voted };
    const nextVoted = !current.voted;
    setHelpfulVoted(review.id, nextVoted);
    setHelpful(Math.max(0, helpful + (nextVoted ? 1 : -1)));
    let n: number | null = null;
    try { n = await toggleReviewHelpfulLive(review.id); } catch { n = null; }
    voteLock.current = false;
    if (n == null) { // GEÇİCİ hata (ağ/RPC) — girişli kullanıcıyı /auth'a ATMA
      setHelpfulVoted(review.id, before.voted);
      setHelpful(before.helpful);
      setVoteErr(true);
      return;
    }
    setHelpful(n);
    onPatch?.(review.id, { helpfulCount: n });
  };

  if (removed) return null;

  if (blocked && !revealBlocked) {
    return (
      <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 16, borderWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 14, paddingVertical: 6 }}>
        <MaterialCommunityIcons name="eye-off-outline" size={16} color={colors.muted} />
        <Text style={{ color: colors.muted, flex: 1, fontSize: 12.5, fontWeight: "600", minWidth: 140 }}>{t("Engellediğin bir kullanıcının yorumu gizlendi.")}</Text>
        <ActionButton icon="eye-outline" label={t("Göster")} color={colors.primary} onPress={() => setRevealBlocked(true)} />
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 8, padding: 14 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
        <UserAvatar uri={review.reviewerAvatar} size={38} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 13.5, fontWeight: "800" }}>{reviewerName ?? t("Kullanıcı")}</Text>
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{reviewRelativeDate(review.createdAt, language)} · {kind}</Text>
        </View>
        <View accessibilityRole="image" accessibilityLabel={`5 ${t("üzerinden")} ${rating} ${t("yıldız")}`} style={{ alignItems: "center", flexDirection: "row", gap: 1 }}>
          {[1, 2, 3, 4, 5].map((n) => <MaterialCommunityIcons key={n} name={n <= rating ? "star" : "star-outline"} size={15} color={colors.gold} />)}
        </View>
      </View>

      {verified ? (
        <View style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primarySoft, borderRadius: 999, flexDirection: "row", gap: 4, paddingHorizontal: 8, paddingVertical: 3 }}>
          <MaterialCommunityIcons name="check-decagram" size={13} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "900" }}>{t("Doğrulanmış satış")}</Text>
        </View>
      ) : null}

      {editingOwn && mine ? (
        <View style={{ gap: 8 }}>
          <StarRatingInput value={ownRating} onChange={setOwnRating} size={28} disabled={ownBusy} />
          <TextInput value={ownComment} onChangeText={(v) => { setOwnComment(v); if (ownErr) setOwnErr(""); }} multiline maxLength={REVIEW_MAX_LENGTH} editable={!ownBusy} accessibilityLabel={t("Yorumun")} placeholder={t("Yorumun…")} placeholderTextColor={colors.subtle} style={inputStyle} />
          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600", textAlign: "right" }}>{ownComment.trim().length}/{REVIEW_MAX_LENGTH}</Text>
          {ownErr ? <Text accessibilityRole="alert" style={{ color: colors.accent, fontSize: 12.5, fontWeight: "700" }}>{t(ownErr)}</Text> : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <SolidButton label={ownBusy ? t("Kaydediliyor…") : t("Kaydet")} busy={ownBusy} onPress={() => { void saveOwnEdit(); }} />
            <GhostButton label={t("Vazgeç")} onPress={() => { setEditingOwn(false); setOwnErr(""); setOwnRating(rating); setOwnComment(comment); }} />
          </View>
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          <Text selectable numberOfLines={long && !expanded ? CLAMP_LINES : undefined} style={{ color: colors.ink, fontSize: 14, fontWeight: "500", lineHeight: 21 }}>{comment}</Text>
          {long ? (
            <Pressable onPress={() => setExpanded((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded }} style={{ alignSelf: "flex-start", justifyContent: "center", minHeight: 40 }}>
              <Text style={{ color: colors.primary, fontSize: 12.5, fontWeight: "800" }}>{expanded ? t("Daha az göster") : t("Devamını oku")}</Text>
            </Pressable>
          ) : null}
          {review.experienceTags?.length ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
              {review.experienceTags.map((tag) => (
                <View key={tag} style={{ backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: colors.primaryDark, fontSize: 11, fontWeight: "700" }}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {review.mediaPaths?.length ? <EvidenceGallery paths={review.mediaPaths} bucket="review-media" /> : null}
        </View>
      )}

      {savedReply && !replying ? (
        <View style={{ backgroundColor: colors.primarySoft, borderLeftColor: colors.primary, borderLeftWidth: 3, borderRadius: 12, gap: 3, marginLeft: 12, marginTop: 2, padding: 11 }}>
          <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
            <MaterialCommunityIcons name={review.type === "partner" ? "handshake-outline" : "storefront-outline"} size={14} color={colors.primaryDark} />
            <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "900" }}>{replyTitle}</Text>
            {review.sellerReplyAt ? <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>· {reviewRelativeDate(review.sellerReplyAt, language)}</Text> : null}
          </View>
          <Text selectable style={{ color: colors.ink, fontSize: 13.5, fontWeight: "500", lineHeight: 20 }}>{savedReply}</Text>
        </View>
      ) : null}

      {replying && canReply ? (
        <View style={{ gap: 8, marginLeft: 12, marginTop: 2 }}>
          <TextInput value={draft} onChangeText={(v) => { setDraft(v); if (replyErr) setReplyErr(""); }} multiline maxLength={REVIEW_REPLY_MAX_LENGTH} editable={!saving} accessibilityLabel={t("Yanıtın")} placeholder={t("Yanıtın… (nazik ve yapıcı olun)")} placeholderTextColor={colors.subtle} style={inputStyle} />
          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600", textAlign: "right" }}>{draft.trim().length}/{REVIEW_REPLY_MAX_LENGTH}</Text>
          {replyErr ? <Text accessibilityRole="alert" style={{ color: colors.accent, fontSize: 12.5, fontWeight: "700" }}>{t(replyErr)}</Text> : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <SolidButton label={saving ? t("Kaydediliyor…") : savedReply && !draft.trim() ? t("Yanıtı kaldır") : t("Yanıtı kaydet")} busy={saving} onPress={() => { void submitReply(); }} />
            <GhostButton label={t("Vazgeç")} onPress={() => { setReplying(false); setReplyErr(""); }} />
          </View>
        </View>
      ) : null}

      {confirmDelete && mine ? (
        <View style={{ backgroundColor: colors.accentSoft, borderRadius: 12, gap: 8, padding: 11 }}>
          <Text accessibilityRole="alert" style={{ color: colors.ink, fontSize: 13, fontWeight: "700", lineHeight: 19 }}>{t("Yorumun silinsin mi? Bu işlem geri alınamaz.")}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <SolidButton danger label={ownBusy ? t("Siliniyor…") : t("Evet, sil")} busy={ownBusy} onPress={() => { void deleteOwn(); }} />
            <GhostButton label={t("Vazgeç")} onPress={() => setConfirmDelete(false)} />
          </View>
        </View>
      ) : null}

      {reportOpen && !mine && !alreadyReported ? (
        <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 12, gap: 8, padding: 11 }}>
          <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{t("Bu yorumu neden şikayet ediyorsun?")}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {REPORT_REASONS.map((reason) => {
              const on = reportReason === reason;
              return (
                <Pressable key={reason} onPress={() => setReportReason(reason)} accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on} style={({ pressed }) => ({ backgroundColor: on ? colors.primary : colors.surface, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, justifyContent: "center", minHeight: 40, opacity: pressed ? 0.8 : 1, paddingHorizontal: 12 })}>
                  <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12.5, fontWeight: "700" }}>{t(reason)}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <SolidButton label={reportBusy ? t("Gönderiliyor…") : t("Şikayeti gönder")} busy={reportBusy || !reportReason} onPress={() => { void submitReport(); }} />
            <GhostButton label={t("Vazgeç")} onPress={() => setReportOpen(false)} />
          </View>
        </View>
      ) : null}

      <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", columnGap: 4, rowGap: 0 }}>
        {mine ? (
          // Kendi yorumuna oy verilmez — yalnız aldığı oy sayısı gösterilir.
          helpful > 0 ? (
            <View style={{ alignItems: "center", flexDirection: "row", gap: 5, minHeight: 40, paddingHorizontal: 6 }}>
              <MaterialCommunityIcons name="thumb-up-outline" size={15} color={colors.muted} />
              <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>{helpful} {t("kişi faydalı buldu")}</Text>
            </View>
          ) : null
        ) : (
          <Pressable onPress={() => { void vote(); }} accessibilityRole="button" accessibilityLabel={`${t("Faydalı")}${helpful > 0 ? ` (${helpful})` : ""}`} accessibilityState={{ selected: voted }} style={({ pressed }) => ({ alignItems: "center", backgroundColor: voted ? colors.primarySoft : colors.surfaceAlt, borderColor: voted ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, minHeight: 40, opacity: pressed ? 0.7 : 1, paddingHorizontal: 13 })}>
            <MaterialCommunityIcons name={voted ? "thumb-up" : "thumb-up-outline"} size={15} color={voted ? colors.primary : colors.muted} />
            <Text style={{ color: voted ? colors.primary : colors.muted, fontSize: 12.5, fontWeight: "800" }}>{t("Faydalı")}{helpful > 0 ? ` · ${helpful}` : ""}</Text>
          </Pressable>
        )}
        {canReply ? (
          <ActionButton icon="reply-outline" color={colors.primary} label={savedReply ? t("Yanıtı düzenle") : t("Yanıtla")} onPress={() => { setDraft(savedReply ?? ""); setReplyErr(""); setReplying((v) => !v); }} />
        ) : null}
        {mine && onEdit ? (
          <ActionButton icon="pencil-outline" label={t("Düzenle")} disabled={ownBusy} onPress={() => { setConfirmDelete(false); setOwnErr(""); setOwnRating(rating); setOwnComment(comment); setEditingOwn((v) => !v); }} />
        ) : null}
        {mine && onDelete ? (
          <ActionButton icon="trash-can-outline" color={colors.accent} label={t("Sil")} disabled={ownBusy} onPress={() => { setEditingOwn(false); setOwnErr(""); setConfirmDelete((v) => !v); }} />
        ) : null}
        {!mine && authed && onReport ? (
          <View style={{ marginLeft: "auto" }}>
            <ActionButton icon={alreadyReported ? "flag-checkered" : "flag-outline"} label={alreadyReported ? t("Bildirildi") : t("Şikayet et")} disabled={alreadyReported} onPress={() => setReportOpen((v) => !v)} />
          </View>
        ) : null}
      </View>
      {voteErr ? <Text accessibilityRole="alert" style={{ color: colors.accent, fontSize: 12, fontWeight: "700" }}>{t("Şu an yapılamadı, tekrar dene")}</Text> : null}
      {ownErr && !editingOwn ? <Text accessibilityRole="alert" style={{ color: colors.accent, fontSize: 12, fontWeight: "700" }}>{t(ownErr)}</Text> : null}
    </View>
  );
}

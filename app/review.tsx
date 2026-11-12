import { makeUuid } from "@/lib/live-service";
import { useUnsavedForm } from "@/lib/use-unsaved-form";
import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AuthRequired } from "@/components/auth-gate";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import { StarRatingInput } from "@/components/star-rating-input";
import { UserAvatar } from "@/components/user-avatar";
import { EvidencePicker } from "@/components/mobile/evidence";
import { MobileBottomNav, MobileButton, MobileCard, MobileChip, MobileField, MobileScreen, MobileSelect, ms } from "@/components/mobile/ui";
import { shortDate } from "@/lib/locale";
import { REVIEW_MAX_LENGTH, REVIEW_MIN_LENGTH, validateReviewDraft } from "@/lib/reviews";
import { useStore } from "@/lib/use-store";
import { uploadEvidence, type EvidencePhoto } from "@/lib/mobile-evidence";
import { showToast } from "@/lib/toast";

const tags = ["Hızlı iletişim", "Güvenilir", "Ürün anlatıldığı gibi", "Nazik ve ilgili", "Sorunsuz alışveriş", "Tavsiye ederim", "Zamanında teslimat", "Tekrar alışveriş yaparım"];

export default function ReviewScreen() {
  const store = useStore();
  if (!store.authReady || (store.isAuthenticated && !store.accountLoaded)) return <ScreenSkeleton />;
  if (!store.isAuthenticated) return <AuthRequired title="Yorum yapmak için giriş yap" />;
  return <ReviewForm key={store.currentUser.id} />;
}

function ReviewForm() {
  const { userId, saleId } = useLocalSearchParams<{ userId?: string; saleId?: string }>();
  const store = useStore();
  const router = useRouter();
  const me = store.currentUser.id;

  // Değerlendirilebilir satışlar: tarafı olduğum, tamamlanmış ve henüz yorumlamadığım.
  const eligible = store.sales.filter((s) => store.canReviewSale(s.id)).filter((s) => {
    const l = store.listings.find((item) => item.id === s.listingId);
    const p = store.partnerships.find((item) => item.id === s.partnershipId);
    return !userId || l?.ownerId === userId || p?.partnerId === userId;
  });
  // Seçim etiketleri: ilan başlığı + satış tarihi (eskiden ham UUID gösteriliyordu).
  const options = eligible.map((s, index) => {
    const title = store.listings.find((l) => l.id === s.listingId)?.title || "Satış";
    const when = s.approvedAt || s.createdAt;
    return { id: s.id, label: `${index + 1}. ${title}${when ? ` · ${shortDate(when)}` : ""}` };
  });

  const [selected, setSelected] = useState(eligible.find((s) => s.id === saleId)?.id || eligible[0]?.id || "");
  const [rating, setRating] = useState(0); // önceden 5 SEÇİLİ gelmez — puanları yukarı çekerdi
  const [comment, setComment] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [photos, setPhotos] = useState<EvidencePhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Satış başına sabit istek kimliği: ağ kopup tekrar denenince aynı yorum İKİ KEZ yazılmaz.
  const requestIds = useRef(new Map<string, string>());
  const locked = useRef(false);
  const uploaded = useRef(new Map<string, string>());
  const allowLeave = useUnsavedForm(!!comment || chosen.length > 0 || photos.length > 0, busy);

  // Geçerli seçim HER render'da türetilir: `selected` yalnız mount'ta tohumlanıyordu → form boş
  // listeyle açılıp "İşlemlerimi Yenile" (ya da realtime) ile satış SONRADAN gelince seçim ""
  // kalıyor, tek satışta seçici de çizilmediği için gönderim hep "satış kaydı gerekli" hatasına
  // düşüyordu. Seçili satış artık uygun değilse (yorumlandı / listeden çıktı) ilk uygun satışa düşer.
  const selectedId = eligible.some((s) => s.id === selected) ? selected : eligible[0]?.id ?? "";

  // Kim değerlendiriliyor? Satıcıysam ortağı, ortaksam satıcıyı.
  const sale = eligible.find((s) => s.id === selectedId);
  const saleListing = sale ? store.listings.find((l) => l.id === sale.listingId) : undefined;
  const salePartnership = sale ? store.partnerships.find((p) => p.id === sale.partnershipId) : undefined;
  const iAmSeller = !!saleListing && saleListing.ownerId === me;
  const counterpartId = sale ? (iAmSeller ? salePartnership?.partnerId : saleListing?.ownerId) : userId;
  const person = store.findUser(counterpartId || userId || "");
  const length = comment.trim().length;

  async function send() {
    if (locked.current) return;
    const saleKey = selectedId;
    if (!saleKey || !store.canReviewSale(saleKey)) { setError("Değerlendirme için tamamlanmış bir satış kaydı ve kullanılmamış yorum hakkı gerekli."); return; }
    const problem = validateReviewDraft(rating, comment);
    if (problem) { setError(problem); return; }
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const paths: string[] = [];
      for (const photo of photos) {
        let path = uploaded.current.get(photo.uri);
        if (!path) {
          try { path = await uploadEvidence(photo, me, "review-media"); }
          catch { setError("Fotoğraf yüklenemedi. Görseli çıkarıp tekrar dene; yazdıkların duruyor."); return; }
          uploaded.current.set(photo.uri, path);
        }
        paths.push(path);
      }
      let id = requestIds.current.get(saleKey);
      if (!id) { id = makeUuid(); requestIds.current.set(saleKey, id); }
      const result = await store.createSaleReview(saleKey, rating, comment.trim(), { id, experienceTags: chosen, mediaPaths: paths });
      if (!result) throw new Error();
      showToast("Değerlendirmen kaydedildi.");
      allowLeave();
      router.replace(`/store/${result.reviewedUserId || counterpartId || userId}` as never);
    } catch {
      setError("Yorum kaydedilemedi. Yazdıkların korunuyor; tekrar dene.");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  return (
    <MobileScreen title="Yorum Yap ve Değerlendir" bottom={<MobileBottomNav />}>
      <MobileCard>
        <View style={ms.row}>
          <UserAvatar uri={person?.avatar} size={62} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={ms.section}>{person?.name || "Satış deneyimini değerlendir"}</Text>
            <Text style={ms.muted}>{sale ? (iAmSeller ? "Bu satıştaki ortağını değerlendiriyorsun." : "Bu satıştaki satıcıyı değerlendiriyorsun.") : "Tamamlanmış işlemine dayalı yorumunu paylaş."}</Text>
          </View>
        </View>
      </MobileCard>
      {!eligible.length ? (
        <MobileCard>
          <Text style={ms.section}>Değerlendirilebilir satış bulunamadı</Text>
          <Text style={ms.muted}>Yalnızca tarafı olduğun tamamlanmış satışları bir kez değerlendirebilirsin. Devam eden veya iptal edilmiş işlem için yorum gönderilemez.</Text>
          <MobileButton secondary onPress={() => { void store.refreshUserData(); }}>İşlemlerimi Yenile</MobileButton>
        </MobileCard>
      ) : (
        <View style={{ gap: 19 }}>
          <Text style={ms.section}>Değerlendirme Puanı *</Text>
          <StarRatingInput value={rating} onChange={(v) => { setRating(v); if (error) setError(""); }} size={40} align="center" disabled={busy} />
          {options.length > 1 ? (
            <MobileSelect label="İlgili Satış *" value={options.find((o) => o.id === selectedId)?.label} options={options.map((o) => o.label)} onChange={(value) => setSelected(options.find((o) => o.label === value)?.id || "")} disabled={busy} />
          ) : (
            <Text style={ms.muted}>İlgili satış: {saleListing?.title || "Satış"}{sale && (sale.approvedAt || sale.createdAt) ? ` · ${shortDate(sale.approvedAt || sale.createdAt || "")}` : ""}</Text>
          )}
          <View style={{ gap: 4 }}>
            <MobileField label="Yorumunuz" required value={comment} onChange={(v) => { setComment(v); if (error) setError(""); }} multiline maxLength={REVIEW_MAX_LENGTH} placeholder="Deneyimini birkaç cümleyle anlat…" />
            {length < REVIEW_MIN_LENGTH ? <Text style={ms.muted}>En az {REVIEW_MIN_LENGTH} karakter yaz ({length}/{REVIEW_MIN_LENGTH}).</Text> : null}
          </View>
          <Text style={ms.section}>Deneyim Etiketleri (İsteğe Bağlı)</Text>
          <View style={ms.wrap}>
            {tags.map((tag) => (
              <MobileChip key={tag} label={tag} selected={chosen.includes(tag)} icon={chosen.includes(tag) ? "check-circle" : "plus-circle-outline"} onPress={() => setChosen((old) => (old.includes(tag) ? old.filter((t) => t !== tag) : [...old, tag]))} />
            ))}
          </View>
          <EvidencePicker publicReview photos={photos} onChange={setPhotos} disabled={busy} />
          {error ? <Text accessibilityRole="alert" style={ms.error}>{error}</Text> : null}
          <MobileButton icon="send" disabled={busy} onPress={() => void send()}>{busy ? "Gönderiliyor…" : "Yorumu Gönder"}</MobileButton>
        </View>
      )}
    </MobileScreen>
  );
}

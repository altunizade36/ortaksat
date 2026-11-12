import { createElement, useEffect, useRef, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";

import { colors } from "@/components/colors";
import { MaterialCommunityIcons } from "@/components/icons";
import { translateCopy, useLanguage } from "@/lib/i18n";
import {
  LISTING_VIDEO_HELP,
  chooseWebVideoFile,
  deleteListingVideo,
  formatVideoDuration,
  formatVideoSize,
  inspectWebVideoFile,
  pickNativeListingVideo,
  pruneOrphanListingVideos,
  uploadListingVideo,
  type ListingVideoCandidate,
  type ListingVideoValue
} from "@/lib/listing-video";

export type ListingVideoStatus = "idle" | "uploading" | "error";

type Pending = { candidate: ListingVideoCandidate; progress: number; error?: string };

/**
 * İlan videosu alanı — "Video (isteğe bağlı)". İlan başına TEK video: seç → sınır doğrulaması
 * (30 sn / 25 MB / MP4-WebM-MOV) → anında yükle (ilerleme çubuğu) → değiştir / kaldır.
 * `value` yalnız YÜKLENMİŞ videonun herkese açık URL'sini taşır (blob: URL asla dışarı çıkmaz),
 * bu yüzden taslaklara güvenle yazılabilir. Yükleme sürerken/başarısızken `onStatus` ile bildirir;
 * yayın akışı bu duruma göre bekletir ve başarısız videoyu sessizce düşürmez.
 */
export function ListingVideoField({ value, onChange, userId, canUpload, disabled = false, keepUrl, onStatus }: {
  value: ListingVideoValue | null;
  onChange: (next: ListingVideoValue | null) => void;
  /** Yükleyen hesabın kimliği (depolama klasörü). */
  userId?: string;
  /** Canlı ve girişli hesap mı? Değilse alan pasif kalır ve nedenini söyler. */
  canUpload: boolean;
  disabled?: boolean;
  /** Kayıtlı ilanın ya da kayıtlı taslağın videosu: burada depodan SİLİNMEZ (ebeveyn, uygun anda siler). */
  keepUrl?: string | null;
  onStatus?: (status: ListingVideoStatus) => void;
}) {
  const { language } = useLanguage();
  const t = (text: string) => translateCopy(text, language);
  const [pending, setPending] = useState<Pending | null>(null);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const alive = useRef(true);
  const lock = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;
  const statusRef = useRef(onStatus);
  statusRef.current = onStatus;
  const pendingUri = useRef<string | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      releaseLocal(pendingUri.current);
    };
  }, []);

  // Yarıda bırakılmış taslaklardan kalan sahipsiz videoları (taslak ömründen eski, hiçbir ilanda yok) temizle.
  // Formdaki ve korunan (kayıtlı ilan / kayıtlı taslak) video her durumda süpürme dışında tutulur.
  const keepRef = useRef(keepUrl);
  keepRef.current = keepUrl;
  useEffect(() => {
    if (canUpload && userId) void pruneOrphanListingVideos(userId, [valueRef.current?.url, keepRef.current]);
  }, [canUpload, userId]);

  const uploading = !!pending && !pending.error;
  const busy = uploading || checking;
  const blocked = disabled || !canUpload || !userId;

  function report(status: ListingVideoStatus) { statusRef.current?.(status); }

  async function start(candidate: ListingVideoCandidate) {
    if (!userId || lock.current) return;
    lock.current = true;
    pendingUri.current = candidate.uri;
    setMessage(null);
    setPending({ candidate, progress: 0 });
    report("uploading");
    try {
      const url = await uploadListingVideo(candidate.blob ?? candidate.uri, userId, (fraction) => {
        if (alive.current) setPending((current) => (current && current.candidate === candidate ? { ...current, progress: fraction } : current));
      }, { mimeType: candidate.mimeType, fileName: candidate.fileName, sizeBytes: candidate.sizeBytes });
      if (!alive.current) { void deleteListingVideo(url, userId); return; }
      const previous = valueRef.current?.url;
      onChange({ url, durationSec: candidate.durationSec, sizeBytes: candidate.sizeBytes });
      // TEK video kuralı: yenisi yüklenince eskisi listeden çıkar; bu oturumda yüklenmişse depodan da silinir.
      // `keepRef` (GÜNCEL değer): yükleme sürerken korunan URL değişmiş olabilir (ör. taslak kaydedildi).
      if (previous && previous !== url && previous !== keepRef.current) void deleteListingVideo(previous, userId);
      releaseLocal(candidate.uri);
      pendingUri.current = null;
      setPending(null);
      report("idle");
    } catch (error) {
      if (!alive.current) return;
      setPending({ candidate, progress: 0, error: (error as Error)?.message || "Video yüklenemedi. Bağlantını kontrol edip tekrar dene." });
      report("error");
    } finally {
      lock.current = false;
    }
  }

  async function pick() {
    if (blocked || busy || lock.current) return;
    setMessage(null);
    try {
      let candidate: ListingVideoCandidate | null = null;
      if (Platform.OS === "web") {
        const file = await chooseWebVideoFile();
        if (!file || !alive.current) return;
        setChecking(true);
        candidate = await inspectWebVideoFile(file);
      } else {
        setChecking(true);
        candidate = await pickNativeListingVideo();
      }
      if (!alive.current) { releaseLocal(candidate?.uri); return; }
      setChecking(false);
      if (!candidate) return;
      // Başarısız kalmış önceki denemeyi bırak (yerine yenisi geçiyor).
      if (pending?.error) releaseLocal(pending.candidate.uri);
      await start(candidate);
    } catch (error) {
      if (!alive.current) return;
      // Reddedilen dosya hiçbir şeyi değiştirmez: mevcut video (varsa) yerinde kalır.
      setMessage((error as Error)?.message || "Video okunamadı.");
    } finally {
      if (alive.current) setChecking(false);
    }
  }

  function discardPending() {
    if (!pending) return;
    releaseLocal(pending.candidate.uri);
    pendingUri.current = null;
    setPending(null);
    setMessage(null);
    report("idle");
  }

  function remove() {
    if (busy || disabled) return;
    const previous = value?.url;
    setMessage(null);
    onChange(null);
    if (previous && userId && previous !== keepUrl) void deleteListingVideo(previous, userId);
  }

  const shown = pending ? { uri: pending.candidate.uri, durationSec: pending.candidate.durationSec, sizeBytes: pending.candidate.sizeBytes } : value ? { uri: value.url, durationSec: value.durationSec, sizeBytes: value.sizeBytes } : null;
  const meta = shown ? [formatVideoDuration(shown.durationSec), formatVideoSize(shown.sizeBytes)].filter(Boolean).join(" · ") : "";
  const percent = pending ? Math.round(pending.progress * 100) : 0;

  return (
    <View testID="listing-video-field" dataSet={{ field: "video" }} style={{ borderTopColor: colors.line, borderTopWidth: 1, gap: 10, minWidth: 0, paddingTop: 14 }}>
      <View style={{ gap: 3 }}>
        <Text style={{ color: colors.ink, fontSize: 14.5, fontWeight: "900" }}>{t("Video")} <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>({t("isteğe bağlı")})</Text></Text>
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 17 }}>{t("İlanına tek bir kısa video ekleyebilirsin.")} {t(LISTING_VIDEO_HELP)}</Text>
      </View>

      {shown ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <View style={{ backgroundColor: "#0B1220", borderRadius: 10, height: 96, overflow: "hidden", width: 144 }}>
            <VideoPreview key={shown.uri} uri={shown.uri} label={t("İlan videosu önizlemesi")} />
          </View>
          <View style={{ flexBasis: 150, flexGrow: 1, flexShrink: 1, gap: 8, minWidth: 0 }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
              <MaterialCommunityIcons name={pending?.error ? "alert-circle-outline" : uploading ? "cloud-upload-outline" : "check-circle"} size={16} color={pending?.error ? colors.accent : colors.primary} />
              <Text testID="listing-video-state" style={{ color: pending?.error ? colors.accent : colors.ink, flex: 1, fontSize: 12.5, fontWeight: "800", minWidth: 0 }}>
                {pending?.error ? t("Video yüklenemedi") : uploading ? `${t("Yükleniyor…")} ${language === "en" ? `${percent}%` : `%${percent}`}` : t("Video eklendi")}
              </Text>
            </View>
            {meta ? <Text testID="listing-video-meta" style={{ color: colors.muted, fontSize: 12, fontVariant: ["tabular-nums"], fontWeight: "700" }}>{meta}</Text> : null}
            {uploading ? (
              <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }} style={{ backgroundColor: colors.surfaceAlt, borderRadius: 999, height: 6, overflow: "hidden" }}>
                <View style={{ backgroundColor: colors.primary, borderRadius: 999, height: "100%", width: `${Math.max(4, percent)}%` }} />
              </View>
            ) : null}
            {pending?.error ? <Text accessibilityRole="alert" style={{ color: colors.accent, fontSize: 12, fontWeight: "700", lineHeight: 17 }}>{t(pending.error)}</Text> : null}
            {uploading ? null : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {pending?.error ? (
                  <>
                    <SmallButton testID="listing-video-retry" icon="refresh" label={t("Tekrar dene")} primary onPress={() => void start(pending.candidate)} />
                    <SmallButton testID="listing-video-skip" icon="close" label={t(value ? "Vazgeç" : "Videosuz devam et")} onPress={discardPending} />
                  </>
                ) : (
                  <>
                    <SmallButton testID="listing-video-replace" icon="swap-horizontal" label={t("Değiştir")} disabled={blocked || busy} onPress={() => void pick()} />
                    <SmallButton testID="listing-video-remove" icon="trash-can-outline" label={t("Kaldır")} disabled={disabled || busy} onPress={remove} />
                  </>
                )}
              </View>
            )}
          </View>
        </View>
      ) : (
        <Pressable
          testID="listing-video-add"
          accessibilityRole="button"
          accessibilityLabel={t("Video ekle")}
          accessibilityState={{ disabled: blocked || busy, busy }}
          disabled={blocked || busy}
          onPress={() => void pick()}
          style={({ pressed }) => ({ alignItems: "center", alignSelf: "flex-start", backgroundColor: pressed ? colors.primarySoft : colors.surface, borderColor: colors.primary, borderRadius: 11, borderStyle: "dashed", borderWidth: 1.5, flexDirection: "row", gap: 8, maxWidth: "100%", minHeight: 48, opacity: blocked || busy ? 0.55 : 1, paddingHorizontal: 14, paddingVertical: 10 })}
        >
          <MaterialCommunityIcons name="video-plus-outline" size={19} color={colors.primary} />
          <Text style={{ color: colors.primaryDark, flexShrink: 1, fontSize: 13, fontWeight: "800" }}>{checking ? t("Video kontrol ediliyor…") : t("Video ekle")}</Text>
        </Pressable>
      )}

      {shown && checking ? <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{t("Video kontrol ediliyor…")}</Text> : null}
      {message ? (
        <View testID="listing-video-error" accessibilityRole="alert" style={{ alignItems: "flex-start", backgroundColor: colors.accentSoft, borderRadius: 10, flexDirection: "row", gap: 7, padding: 10 }}>
          <MaterialCommunityIcons name="alert-circle-outline" size={16} color={colors.accent} style={{ marginTop: 1 }} />
          <Text style={{ color: colors.accent, flex: 1, fontSize: 12.5, fontWeight: "700", lineHeight: 17, minWidth: 0 }}>{t(message)}</Text>
        </View>
      ) : null}
      {!canUpload || !userId ? (
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700", lineHeight: 17 }}>{t("Video eklemek için giriş yapmış olmalısın. Fotoğraf ve diğer bilgileri şimdi girebilir, videoyu girişten sonra ekleyebilirsin.")}</Text>
      ) : null}
    </View>
  );
}

function releaseLocal(uri?: string | null) {
  if (uri && uri.startsWith("blob:") && typeof URL !== "undefined") {
    try { URL.revokeObjectURL(uri); } catch { /* yoksay */ }
  }
}

function SmallButton({ icon, label, onPress, primary = false, disabled = false, testID }: { icon: "refresh" | "close" | "swap-horizontal" | "trash-can-outline"; label: string; onPress: () => void; primary?: boolean; disabled?: boolean; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => ({ alignItems: "center", backgroundColor: primary ? colors.primary : colors.surface, borderColor: primary ? colors.primary : colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 6, minHeight: 44, opacity: disabled ? 0.5 : pressed ? 0.85 : 1, paddingHorizontal: 12 })}>
      <MaterialCommunityIcons name={icon} size={15} color={primary ? "#FFFFFF" : colors.primaryDark} />
      <Text style={{ color: primary ? "#FFFFFF" : colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

/** Küçük önizleme: SESSİZ, otomatik oynatma YOK, yalnız metadata ön-yüklenir, kontroller açık. */
export function VideoPreview({ uri, label }: { uri: string; label?: string }) {
  if (Platform.OS === "web") {
    // Uzak dosyada ilk kareyi poster olarak göstermek için medya parçası (#t) — indirme tetiklemez.
    const src = uri.startsWith("blob:") || uri.includes("#") ? uri : `${uri}#t=0.1`;
    return createElement("video", {
      src,
      muted: true,
      controls: true,
      playsInline: true,
      preload: "metadata",
      "aria-label": label,
      "data-testid": "listing-video-preview",
      style: { backgroundColor: "#0B1220", display: "block", height: "100%", objectFit: "contain", width: "100%" }
    });
  }
  return <NativeVideoPreview uri={uri} />;
}

function NativeVideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.muted = true;
    instance.loop = false;
  });
  return <VideoView player={player} nativeControls contentFit="contain" style={{ height: "100%", width: "100%" }} />;
}

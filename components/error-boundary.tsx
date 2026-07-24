import { MaterialCommunityIcons } from "@/components/icons";
import { Link } from "expo-router";
import { useEffect } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { translateCopy, useLanguage } from "@/lib/i18n";

/**
 * Markalı hata ekranı. Hem expo-router ErrorBoundary fallback'i (render
 * sırasında bir hata fırlatılırsa) hem de manuel "bir şeyler ters gitti"
 * durumları için kullanılır. Kullanıcı asla boş beyaz ekran görmez.
 */
export function ErrorScreen({
  title = "Bir şeyler ters gitti",
  body = "Beklenmeyen bir hata oluştu. İnternet bağlantını kontrol edip tekrar deneyebilirsin.",
  detail,
  onRetry,
  retryLabel = "Tekrar dene",
  onHardReset
}: {
  title?: string;
  body?: string;
  detail?: string;
  onRetry?: () => void;
  retryLabel?: string;
  onHardReset?: () => void;
}) {
  const { language } = useLanguage();
  return (
    <ScrollView
      contentContainerStyle={{ alignItems: "center", backgroundColor: colors.background, flexGrow: 1, justifyContent: "center", padding: 24 }}
      style={{ backgroundColor: colors.background }}
    >
      <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 20, borderWidth: 1, gap: 14, maxWidth: 440, padding: 30, width: "100%" }}>
        <View style={{ alignItems: "center", backgroundColor: colors.accentSoft, borderRadius: 999, height: 64, justifyContent: "center", width: 64 }}>
          <MaterialCommunityIcons name="alert-circle-outline" size={32} color={colors.accent} />
        </View>
        <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "900", textAlign: "center" }}>{translateCopy(title, language)}</Text>
        <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600", lineHeight: 20, textAlign: "center" }}>{translateCopy(body, language)}</Text>
        {detail ? (
          <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "600", textAlign: "center" }} numberOfLines={3}>
            {detail}
          </Text>
        ) : null}
        {onRetry ? (
          <Pressable
            onPress={onRetry}
            style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 12, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 13, width: "100%" }}
          >
            <MaterialCommunityIcons name="refresh" size={18} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>{translateCopy(retryLabel, language)}</Text>
          </Pressable>
        ) : null}
        {/* KESİN KURTARMA: bayat yerel durum (eski kategori kaydı, bozuk taslak, silinmiş
            ilan referansı…) render'ı bozduğunda tek dokunuşta temizler. Hangi bileşenin
            bozulduğunu bilmeye gerek kalmadan kullanıcı kurtulur. */}
        {onHardReset ? (
          <Pressable
            onPress={onHardReset}
            style={{ alignItems: "center", borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 12, width: "100%" }}
          >
            <MaterialCommunityIcons name="broom" size={17} color={colors.muted} />
            <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "800" }}>{translateCopy("Verileri temizle ve yenile", language)}</Text>
          </Pressable>
        ) : null}
        <Link href="/" asChild>
          <Pressable style={{ alignItems: "center", paddingVertical: 4 }}>
            <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>{translateCopy("Ana sayfaya dön →", language)}</Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}

/** expo-router bir route segmentinde render hatası yakalarsa bunu gösterir. */
export function RouteErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  // asyncRoutes (kod-bölme) tuzağı: lazy chunk fetch'i başarısız olursa React.lazy reddi
  // ÖNBELLEKLER → retry() aynı hatayı tekrar fırlatır, kullanıcı döngüde kalır. Chunk
  // hatasında tek gerçek kurtuluş sayfayı yeniden yüklemek (chunk yeniden çekilir).
  const msg = String(error?.message || error || "");
  const isChunkError = /Loading chunk|ChunkLoadError|Failed to fetch dynamically|error loading dynamically imported|importing a module script failed/i.test(msg);
  const canReload = typeof window !== "undefined" && typeof window.location?.reload === "function";

  // Bayat yerel durumu (eski kategori kaydı / bozuk taslak / silinmiş referans) temizler ve
  // yeniler. Hangi bileşenin `undefined` olduğunu bilmeye gerek yok — çökme yerel duruma
  // bağlıysa KESİN çözer. Supabase oturum anahtarları (`sb-*`) KORUNUR → çıkış yapılmaz.
  const hardReset = canReload
    ? () => {
        try {
          const keep: Array<[string, string]> = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && (k.startsWith("sb-") || k.includes("supabase"))) { const v = localStorage.getItem(k); if (v != null) keep.push([k, v]); }
          }
          localStorage.clear();
          sessionStorage.clear();
          for (const [k, v] of keep) localStorage.setItem(k, v);
        } catch { /* özel mod */ }
        window.location.href = "/";
      }
    : undefined;

  // OTO-KURTARMA (deploy'lar sonrası "bir şeyler ters gitti" tekrarını kırar):
  // • CHUNK hatası → her zaman bir kez reload (yeni chunk çekilir).
  // • CHUNK-DIŞI render hatası (React #130 gibi) → KADEMELİ:
  //   1. kez: sessiz reload (veri kaybı YOK; geçici/AdBlock/timing çökmesini yakalar).
  //   2. kez (reload çözmedi): oto HARD-RESET (bayat yerel durum temizle) — draft kaybı
  //      kabul, çünkü uygulama zaten kullanılamaz durumda.
  //   3. kez: dur, ekranı göster (sonsuz döngü koruması). Pencere 30 sn.
  useEffect(() => {
    if (!canReload) return;
    try {
      const now = Date.now();
      if (isChunkError) {
        const last = Number(sessionStorage.getItem("chunk-reload-at") || 0);
        if (now - last < 30_000) return;
        sessionStorage.setItem("chunk-reload-at", String(now));
        window.location.reload();
        return;
      }
      const KEY = "render-error-recovery";
      let st: { at: number; n: number } = { at: 0, n: 0 };
      try { st = JSON.parse(sessionStorage.getItem(KEY) || "") ?? st; } catch { /* ilk kez */ }
      if (now - st.at > 30_000) st = { at: now, n: 0 }; // pencere sıfırla
      st.n += 1; st.at = now;
      sessionStorage.setItem(KEY, JSON.stringify(st));
      if (st.n === 1) { window.location.reload(); }          // sessiz reload
      else if (st.n === 2 && hardReset) { hardReset(); }      // bayat durumu temizle
      // st.n >= 3 → ekranı göster (aşağıdaki ErrorScreen)
    } catch { /* sessionStorage kapalı → ekranı göster */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isChunkError, canReload]);

  return (
    <ErrorScreen
      title={isChunkError ? "Sayfa yüklenemedi" : "Bir şeyler ters gitti"}
      body={isChunkError ? "Bağlantın kesildiği için sayfa yüklenemedi. Yeniden dene." : undefined}
      // Hata mesajını ARTIK canlıda da göster (kısa) → tekrarlarsa kullanıcı ekran görüntüsüyle
      // tam nedeni iletebilir. React #130 vb. minified olsa da hangi hata olduğu görünür.
      detail={msg ? msg.slice(0, 160) : undefined}
      onRetry={() => {
        if (isChunkError && canReload) { window.location.reload(); return; }
        void retry();
      }}
      onHardReset={!isChunkError ? hardReset : undefined}
    />
  );
}

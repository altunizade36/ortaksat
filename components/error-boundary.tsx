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

  // BAYAT CHUNK OTO-KURTARMA: her yeni deploy'da chunk dosya adları değişir; kullanıcının
  // AÇIK sekmesi artık var olmayan bir chunk'ı isteyince route render'ı patlar ve site
  // "rastgele yerlerde bozuluyor" gibi görünür. Kullanıcıdan "Tekrar dene"ye basmasını
  // beklemek yerine BİR KEZ otomatik yeniden yükle (sessionStorage ile döngü koruması).
  useEffect(() => {
    if (!isChunkError || !canReload) return;
    try {
      const KEY = "chunk-reload-at";
      const last = Number(sessionStorage.getItem(KEY) || 0);
      // 30 sn içinde ikinci kez olduysa gerçek bir sorun var → ekranı göster, döngüye girme.
      if (Date.now() - last < 30_000) return;
      sessionStorage.setItem(KEY, String(Date.now()));
      window.location.reload();
    } catch {
      /* sessionStorage kapalıysa sessizce ekranı göster */
    }
  }, [isChunkError, canReload]);

  // Bayat yerel durumu (eski kategori kaydı / bozuk taslak / silinmiş referans) tek dokunuşta
  // temizler ve yeniler. Hangi bileşenin `undefined` olduğunu bilmeye gerek yok — çökme yerel
  // duruma bağlıysa bu KESİN çözer. (Oturum çerezine dokunmaz; yalnız uygulama önbellekleri.)
  const hardReset = canReload
    ? () => {
        try {
          // Supabase oturum anahtarları (`sb-*`) KORUNUR → kullanıcı çıkış yapmaz; yalnız
          // uygulama önbellekleri (recent/compare/saved/draft…) temizlenir.
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

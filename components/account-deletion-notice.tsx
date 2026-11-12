import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link, usePathname, useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/components/colors";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { fetchMyAccountDeletionLive, type AccountDeletionState } from "@/lib/live-service";
import { isMobileApp } from "@/lib/mobile-app";
import { showToast } from "@/lib/toast";
import { useStore } from "@/lib/use-store";

/** Kalıcı silme tarihini okunur Türkçe/İngilizce biçimde verir; tarih yoksa boş döner. */
export function formatDeletionDate(iso: string | undefined, language: "tr" | "en"): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return date.toLocaleDateString(language === "en" ? "en-GB" : "tr-TR", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
}

/**
 * Bekleyen hesap silme talebi paneli: kalıcı silme tarihi + "Silme talebini iptal et" + "Çıkış yap".
 * Hem tam ekran bildirimde (AccountDeletionGate) hem /hesap-silme sayfasında kullanılır.
 */
export function PendingDeletionPanel({ scheduledFor, onCancelled }: { scheduledFor?: string; onCancelled?: () => void }) {
  const store = useStore();
  const router = useRouter();
  const { language } = useLanguage();
  const t = (text: string) => translateCopy(text, language);
  const [busy, setBusy] = useState<"cancel" | "signout" | null>(null);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const when = formatDeletionDate(scheduledFor, language);

  async function cancel() {
    if (lock.current) return;
    lock.current = true; setBusy("cancel"); setError("");
    try {
      if (!await store.cancelAccountDeletion()) { setError(t("Silme talebi iptal edilemedi. Bağlantını kontrol edip tekrar dene.")); return; }
      // Hesap yeniden aktif: sunucunun geri açtığı ilanlar ve hesap verileri tazelensin.
      await Promise.all([store.refreshMarketplace(), store.refreshUserData()]).catch(() => undefined);
      showToast(t("Silme talebin iptal edildi. Hesabın yeniden aktif."));
      onCancelled?.();
    } catch {
      setError(t("Silme talebi iptal edilemedi. Bağlantını kontrol edip tekrar dene."));
    } finally {
      lock.current = false; setBusy(null);
    }
  }

  async function signOut() {
    if (lock.current) return;
    lock.current = true; setBusy("signout"); setError("");
    try {
      await store.signOut();
      router.replace(isMobileApp ? "/auth" : "/");
    } catch {
      setError(t("Çıkış yapılamadı. Tekrar dene."));
    } finally {
      lock.current = false; setBusy(null);
    }
  }

  return (
    <View style={{ alignSelf: "center", backgroundColor: colors.surface, borderColor: colors.accent, borderRadius: 18, borderWidth: 1, gap: 14, maxWidth: 520, padding: 20, width: "100%" }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
        <View style={{ alignItems: "center", backgroundColor: colors.accentSoft, borderRadius: 14, height: 48, justifyContent: "center", width: 48 }}>
          <Icon name="account-clock-outline" size={26} color={colors.accent} />
        </View>
        <Text accessibilityRole="header" style={{ color: colors.ink, flex: 1, fontSize: 20, fontWeight: "900", lineHeight: 26, minWidth: 0 }}>{t("Hesabın silinmek üzere")}</Text>
      </View>
      <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "700", lineHeight: 21 }}>
        {when
          ? language === "en"
            ? `Your account will be permanently deleted on ${when}.`
            : `Hesabın ${when} tarihinde kalıcı olarak silinecek.`
          : t("Hesabın 30 günlük sürenin sonunda kalıcı olarak silinecek.")}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>
        {t("Bu süre boyunca hesabın askıda: ilanların yayında değil; ilan verme, mesajlaşma ve ortaklık işlemleri kapalı. Vazgeçersen talebi şimdi iptal edebilirsin; hesabın ve talep nedeniyle duraklatılan ilanların geri açılır.")}
      </Text>
      {error ? <Text accessibilityRole="alert" style={{ color: colors.accent, fontSize: 13, fontWeight: "700", lineHeight: 19 }}>{error}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={t("Silme talebini iptal et")} accessibilityState={{ disabled: busy !== null, busy: busy === "cancel" }} disabled={busy !== null} onPress={() => void cancel()} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 12, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 48, opacity: busy !== null ? 0.6 : 1, paddingHorizontal: 14, paddingVertical: 12 }}>
        <Icon name="account-reactivate-outline" size={20} color="#FFFFFF" />
        <Text style={{ color: "#FFFFFF", flexShrink: 1, fontSize: 14.5, fontWeight: "900", textAlign: "center" }}>{busy === "cancel" ? t("İptal ediliyor…") : t("Silme talebini iptal et")}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t("Çıkış yap")} accessibilityState={{ disabled: busy !== null, busy: busy === "signout" }} disabled={busy !== null} onPress={() => void signOut()} style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 48, opacity: busy !== null ? 0.6 : 1, paddingHorizontal: 14, paddingVertical: 12 }}>
        <Icon name="logout" size={20} color={colors.ink} />
        <Text style={{ color: colors.ink, flexShrink: 1, fontSize: 14.5, fontWeight: "800", textAlign: "center" }}>{busy === "signout" ? t("Çıkış yapılıyor…") : t("Çıkış yap")}</Text>
      </Pressable>
    </View>
  );
}

// Bildirim açıkken de okunabilmesi gereken herkese açık bilgi sayfaları (panel bu sayfalara bağlanır).
const OPEN_ROUTES = /^\/(hesap-silme|auth|iletisim|kvkk|gizlilik-politikasi|kullanim-sartlari)(\/|$)/;

/**
 * TAM EKRAN "hesabın silinmek üzere" bildirimi (root layout'ta bir kez bağlanır).
 *
 * Yalnız kullanıcının KENDİ silme talebi beklerken (my_account_deletion → pending) görünür.
 * Yönetici askıya alması (pending=false, status=suspended) BU bildirimi tetiklemez; orada
 * mevcut davranış (üst şeritteki "Hesabın askıya alındı" uyarısı) aynen sürer.
 */
export function AccountDeletionGate() {
  const store = useStore();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const [state, setState] = useState<AccountDeletionState | null>(null);
  const account = store.authReady && store.isAuthenticated ? store.currentUser.id : "";
  const suspended = store.currentUser.status === "suspended";

  useEffect(() => {
    let alive = true;
    if (!account || !suspended) { setState(null); return; }
    void fetchMyAccountDeletionLive().then((next) => { if (alive) setState(next); });
    return () => { alive = false; };
  }, [account, suspended]);

  if (!account || !suspended || !state?.pending || OPEN_ROUTES.test(pathname)) return null;

  return (
    <View accessibilityViewIsModal style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, zIndex: 9000 }]}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingBottom: insets.bottom + 24, paddingHorizontal: 16, paddingTop: insets.top + 24 }}>
        <PendingDeletionPanel scheduledFor={state.scheduledFor} onCancelled={() => setState({ pending: false })} />
        <Link href={"/hesap-silme" as Href} asChild>
          <Pressable accessibilityRole="link" style={{ alignSelf: "center", justifyContent: "center", marginTop: 6, minHeight: 44, paddingHorizontal: 12 }}>
            <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "700", textAlign: "center" }}>{translateCopy("Hesap silme hakkında bilgi", language)}</Text>
          </Pressable>
        </Link>
      </ScrollView>
    </View>
  );
}

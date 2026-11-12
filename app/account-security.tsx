import { useCallback, useRef, useState } from "react";
import { Platform, Text, TextInput, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { AuthRequired } from "@/components/auth-gate";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import { PasswordStrengthMeter } from "@/components/password-strength-meter";
import { MobileBottomNav, MobileButton, MobileCard, MobileScreen, mobile, ms } from "@/components/mobile/ui";
import { useIsWideWeb } from "@/lib/layout";
import { useStore } from "@/lib/use-store";
import { supabase } from "@/lib/supabase";
import { changePasswordLive, reauthenticateLive } from "@/lib/live-service";
import { actionLabel, fetchLoginHistory, type LoginEvent } from "@/lib/security-history";
import { isValidEmail, passwordStrength } from "@/lib/validation";
import { useUnsavedForm } from "@/lib/use-unsaved-form";
import { Alert } from "@/lib/alert";

// Mobil web (iOS Safari) 16px altı input'a odaklanınca sayfayı yakınlaştırır → web'de 16px.
const inputFont = Platform.OS === "web" ? { fontSize: 16 } : null;

export default function AccountSecurity() {
  const store = useStore();
  if (!store.authReady || store.isAuthenticated && !store.accountLoaded) return <ScreenSkeleton/>;
  if (!store.isAuthenticated) return <AuthRequired title="Güvenlik ayarları için giriş yap"/>;
  return <Security key={store.currentUser.id}/>;
}
function Security() {
  const store = useStore(), router = useRouter(), account = store.currentUser.id;
  const [email, setEmail] = useState(""), [pendingEmail, setPendingEmail] = useState(""), [passwordIdentity, setPasswordIdentity] = useState(false), [nextEmail, setNextEmail] = useState(""), [current, setCurrent] = useState(""), [password, setPassword] = useState(""), [repeat, setRepeat] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState(""), [history, setHistory] = useState<LoginEvent[]>([]), [historyError, setHistoryError] = useState(false), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0);
  const lock = useRef(false);
  // Masaüstü web: site başlığı görünsün, telefon alt-gezinmesi çıkmasın (TrustPage ile aynı desen).
  const wide = useIsWideWeb();
  const allowLeave = useUnsavedForm(!!current || !!password || !!repeat || !!nextEmail, busy);
  useFocusEffect(useCallback(() => {
    let alive = true; setLoading(true); setHistoryError(false); setError("");
    // Supabase yapılandırılmamışsa (ön izleme) `supabase!` çökmesin: dürüst hata göster.
    if (!supabase) { setError("Hesap bilgileri yüklenemedi."); setLoading(false); return () => { alive = false; }; }
    void supabase.auth.getUser().then(({ data, error }) => { if (!alive) return; if (error || !data.user || data.user.id !== account) { setError("Hesap bilgileri doğrulanamadı. Tekrar yükle."); return; } setEmail(data.user.email || ""); setPendingEmail(data.user.new_email || ""); setPasswordIdentity(!!data.user.identities?.some(i => i.provider === "email")); }).catch(() => { if (alive) setError("Hesap bilgileri yüklenemedi."); });
    void fetchLoginHistory(account, 30, true).then(rows => { if (alive) setHistory(rows); }).catch(() => { if (alive) setHistoryError(true); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [account, retry]));
  async function run(action: () => Promise<void>) { if (lock.current) return; lock.current = true; setBusy(true); setError(""); setMessage(""); try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "İşlem tamamlanamadı. Tekrar dene."); } finally { lock.current = false; setBusy(false); } }
  async function savePassword() {
    if (!current) { setError("Mevcut şifreni gir."); return; }
    if (!passwordStrength(password).ok || password.length > 72) { setError("Yeni şifre için aşağıdaki güvenlik koşullarını tamamla; en fazla 72 karakter kullan."); return; }
    if (password !== repeat || password === current) { setError("Yeni şifreler aynı olmalı ve mevcut şifreden farklı olmalı."); return; }
    await run(async () => { const result = await changePasswordLive(password, current); if (!result.ok) throw Error(result.error || "Şifre güncellenemedi."); setCurrent(""); setPassword(""); setRepeat(""); setMessage("Şifren güncellendi. Sonraki girişinde yeni şifreni kullan."); });
  }
  async function saveEmail() {
    const value = nextEmail.trim().toLowerCase();
    if (!isValidEmail(value) || value === email.toLowerCase()) { setError("Mevcut adresinden farklı, geçerli bir e-posta adresi gir."); return; }
    if (passwordIdentity && !current) { setError("E-posta değişikliği için mevcut şifreni gir."); return; }
    await run(async () => {
      if (passwordIdentity && !await reauthenticateLive(current)) throw Error("Mevcut şifre doğrulanamadı. E-posta değişmedi.");
      const verified = await supabase!.auth.getUser(); if (verified.error || verified.data.user?.id !== account) throw Error("Oturum doğrulanamadı; tekrar giriş yap.");
      const { data, error } = await supabase!.auth.updateUser({ email: value }); if (error) throw Error(error.status===429?"Çok sık deneme yapıldı. Bir süre sonra tekrar dene.":"E-posta değişikliği başlatılamadı. Adresi ve bağlantını kontrol edip tekrar dene; bilgilerin korunuyor.");
      setPendingEmail(data.user?.new_email || ""); setEmail(data.user?.email || email); setNextEmail(""); setCurrent("");
      setMessage(data.user?.new_email ? "E-posta değişikliği için mevcut ve yeni adresine gelen doğrulama adımlarını tamamla. Ardından hesap bilgilerini yenile." : "Hesabının e-posta bilgisi güncellendi.");
    });
  }
  function passwordField(label: string, value: string, change: (v: string) => void, fresh = false) { return <View style={{ gap: 6 }}><Text style={ms.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={change} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete={fresh ? "new-password" : "current-password"} maxLength={72} style={[ms.input, inputFont]}/></View>; }
  return <MobileScreen title="Hesap Güvenliği" headerShown={wide} bottom={wide ? undefined : <MobileBottomNav active="profile"/>}>
    {/* Tablet/masaüstünde form kenardan kenara gerilmesin: okunur genişlikte ortala. */}
    <View style={{ alignSelf: "center", maxWidth: 760, width: "100%" }}>
    <MobileCard><Text style={ms.section}>E-posta Adresin</Text><Text selectable style={ms.muted}>{email || "Yüklenemedi"}</Text>{pendingEmail ? <Text selectable style={{ color: mobile.teal, fontSize: 12, lineHeight: 18 }}>Doğrulama bekleyen adres: {pendingEmail}</Text> : null}<MobileButton secondary disabled={busy} onPress={() => setRetry(v => v + 1)}>Hesap Bilgilerini Yenile</MobileButton></MobileCard>
    <MobileCard><Text style={ms.section}>Mevcut Şifreyle Doğrula</Text><Text style={ms.muted}>{passwordIdentity ? "Şifre ve e-posta değişikliği öncesinde mevcut şifren doğrulanır." : "Google gibi bir sağlayıcıyla giriş yaptıysan sağlayıcının güvenlik ayarlarından şifreni yönetebilirsin."}</Text>{passwordField("Mevcut Şifre", current, setCurrent)}</MobileCard>
    <MobileCard><Text style={ms.section}>Şifreni Değiştir</Text>{passwordField("Yeni Şifre", password, setPassword, true)}<PasswordStrengthMeter password={password}/>{passwordField("Yeni Şifre Tekrar", repeat, setRepeat, true)}<MobileButton disabled={busy || !passwordIdentity} onPress={() => void savePassword()}>{busy ? "İşlem Sürüyor…" : "Şifreyi Güncelle"}</MobileButton></MobileCard>
    <MobileCard><Text style={ms.section}>E-posta Adresini Değiştir</Text><View style={{ gap: 6 }}><Text style={ms.label}>Yeni E-posta</Text><TextInput accessibilityLabel="Yeni E-posta" value={nextEmail} onChangeText={setNextEmail} keyboardType="email-address" inputMode="email" autoCapitalize="none" autoCorrect={false} autoComplete="email" maxLength={254} style={[ms.input, inputFont]}/></View><Text style={ms.muted}>Doğrulama tamamlanmadan adres değişmiş olarak gösterilmez. E-posta adresin herkese açık profilinde yayınlanmaz.</Text><MobileButton secondary disabled={busy || !email} onPress={() => Alert.alert("E-posta Değişikliği", "Yeni adres için doğrulama işlemi başlatılsın mı?", [{ text: "Vazgeç", style: "cancel" }, { text: "Başlat", onPress: () => void saveEmail() }])}>E-posta Değişikliğini Başlat</MobileButton></MobileCard>
    {error ? <MobileCard><Text accessibilityRole="alert" style={ms.error}>{error}</Text></MobileCard> : null}{message ? <MobileCard><Text accessibilityRole="alert" style={{ color: mobile.teal, fontSize: 13, lineHeight: 19 }}>{message}</Text></MobileCard> : null}
    <MobileCard><Text style={ms.section}>Giriş Geçmişin</Text><Text style={ms.muted}>Son 30 giriş ve hesap olayı. Bu liste aktif cihaz oturumlarının listesi değildir.</Text>{loading && <Text style={ms.muted}>Yükleniyor…</Text>}{historyError ? <><Text style={ms.error}>Giriş geçmişi yüklenemedi.</Text><MobileButton secondary onPress={() => setRetry(v => v + 1)}>Geçmişi Tekrar Yükle</MobileButton></> : history.map(event => <View key={event.id} style={{ gap: 4, borderBottomWidth: 1, borderColor: mobile.line, paddingVertical: 10 }}><Text style={ms.label}>{actionLabel(event.action)}</Text><Text style={ms.muted}>{event.browser} · {event.os}</Text><Text style={ms.muted}>{new Date(event.when).toLocaleString("tr-TR")}</Text></View>)}{!loading && !historyError && !history.length && <Text style={ms.muted}>Kaydedilmiş giriş olayı bulunmuyor.</Text>}</MobileCard>
    <View style={{ gap: 12, marginVertical: 14 }}><MobileButton secondary disabled={busy} onPress={() => Alert.alert("Tüm Cihazlardan Çıkış", "Bu cihaz dahil tüm hesap oturumlarını kapatma işlemi başlatılsın mı? Bazı mevcut erişimlerin kapanması süre alabilir.", [{ text: "Vazgeç", style: "cancel" }, { text: "Çıkış Yap", onPress: () => void run(async () => { if (!await store.signOutAllDevices()) throw Error("Tüm oturumlar kapatılamadı. Tekrar dene."); allowLeave(); router.replace("/auth"); }) }])}>Tüm Cihazlardan Çıkış Yap</MobileButton><MobileButton secondary onPress={() => router.push("/engellenenler")}>Engellediğim Kullanıcılar</MobileButton><MobileButton secondary icon="trash-can-outline" onPress={() => router.push("/hesap-silme" as never)}>Hesabımı Sil</MobileButton></View>
    </View>
  </MobileScreen>;
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Platform, Pressable, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { colors } from "@/components/colors";
import { UserAvatar } from "@/components/user-avatar";
import { AuthRequired } from "@/components/auth-gate";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import { INTRO_SOUND_ENABLED, INTRO_SOUND_OFF_KEY } from "@/components/intro-splash";
import { MobileBottomNav, MobileButton, MobileCard, MobileScreen, mobile, ms, type MobileIcon } from "@/components/mobile/ui";
import { useStore } from "@/lib/use-store";
import { useIsWideWeb } from "@/lib/layout";
import { showToast } from "@/lib/toast";
import { Alert } from "@/lib/alert";

// RN-web Switch: açıkken başparmak rengi `thumbColor`'ı DEĞİL `activeThumbColor`'ı kullanır;
// verilmezse varsayılan #009688 (turkuaz) çıkar. Web'e özel prop → tip dışı yayılır.
const webSwitchProps = Platform.OS === "web" ? ({ activeThumbColor: "#FFFFFF" } as object) : {};

export default function AccountSettingsScreen() {
  const store = useStore();
  if (!store.authReady) return <ScreenSkeleton />;
  if (!store.isAuthenticated) return <AuthRequired title="Hesap ayarları için giriş yap" />;
  if (!store.accountLoaded) return <ScreenSkeleton />;
  return <AccountSettings />;
}
function AccountSettings() {
  const store = useStore(), router = useRouter(), user = store.currentUser;
  // Masaüstü web: site başlığı görünsün, telefon alt-gezinmesi çıkmasın (TrustPage ile aynı desen).
  const wide = useIsWideWeb();
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  // Açılış sesi tercihi cihazda tutulur (girişsiz kullanıcı için de geçerli).
  const [introSound, setIntroSound] = useState(true);
  useEffect(() => { void AsyncStorage.getItem(INTRO_SOUND_OFF_KEY).then((value) => setIntroSound(value !== "1")).catch(() => {}); }, []);
  const advanced = (section: string) => router.push({ pathname: "/profile-edit", params: { view: "advanced", section } } as never);
  const row = (label: string, detail: string, icon: MobileIcon, action: () => void, danger = false, last = false) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={action} style={[ms.row, { minHeight: 63, borderBottomWidth: last ? 0 : 1, borderColor: mobile.line }]}><Icon name={icon} size={23} color={danger ? colors.accent : mobile.ink} /><View style={{ flex: 1, gap: 3, minWidth: 0 }}><Text style={{ color: danger ? colors.accent : mobile.ink, fontWeight: "600", fontSize: 14 }}>{label}</Text><Text style={ms.muted}>{detail}</Text></View><Icon name="chevron-right" size={20} color={mobile.muted} /></Pressable>;
  async function email(next: boolean) { if (busy) return; setBusy(true); try { if (!await store.setEmailNotifications(next)) showToast("Bildirim tercihi kaydedilemedi. Tekrar dene."); } catch { showToast("Bildirim tercihi kaydedilemedi."); } finally { setBusy(false); } }
  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try { await store.signOut(); router.replace("/auth"); }
    catch { showToast("Çıkış yapılamadı. Tekrar dene."); setSigningOut(false); }
  }
  return <MobileScreen title="Hesap Ayarları" headerShown={wide} bottom={wide ? undefined : <MobileBottomNav active="profile" />}>
    {/* Tablet/masaüstünde satırlar kenardan kenara gerilmesin: okunur genişlikte ortala. */}
    <View style={{ alignSelf: "center", maxWidth: 760, width: "100%" }}>
    <MobileCard><View style={ms.row}><UserAvatar uri={user.avatar} size={70} /><View style={{ flex: 1, gap: 5, minWidth: 0 }}><Text numberOfLines={2} style={ms.section}>{user.name}</Text>{user.city ? <Text style={ms.muted}>⌖ {user.city}</Text> : null}{user.createdAt ? <Text style={ms.muted}>Üyelik: {new Date(user.createdAt).toLocaleDateString("tr-TR")}</Text> : null}</View></View><MobileButton secondary icon="pencil" onPress={() => router.push("/profile-edit")}>Profili Düzenle</MobileButton></MobileCard>
    <Text style={[ms.section, { marginVertical: 10 }]}>Hesap İşlemleri</Text><MobileCard>
      {row("Kişisel Bilgiler", "Ad, telefon, fotoğraf ve hakkında", "account-outline", () => router.push("/profile-edit"))}
      {row("Şifre Değiştir", "Hesap şifreni güvenle güncelle", "lock-outline", () => router.push("/account-security" as never))}
      {row("Doğrulama İşlemleri", user.verifiedIdentity ? "Kimliğin doğrulanmış durumda" : "Doğrulama durumunu ve başvurunu yönet", "shield-check-outline", () => advanced("verification"))}
      {row("Mağaza ve Uzmanlık", "Mağaza bilgileri ve uzmanlık alanları", "storefront-outline", () => advanced("store"), false, true)}
    </MobileCard>
    <Text style={[ms.section, { marginVertical: 10 }]}>Bildirim Ayarları</Text><MobileCard><View style={[ms.row, { borderBottomWidth: 1, borderColor: mobile.line, minHeight: 63 }]}><Icon name="email-outline" size={23} color={mobile.ink} /><View style={{ flex: 1, gap: 3, minWidth: 0 }}><Text style={{ color: mobile.ink, fontWeight: "600", fontSize: 14 }}>E-posta Bildirimleri</Text><Text style={ms.muted}>Hesabının e-posta bildirim tercihi</Text></View><Switch accessibilityLabel="E-posta Bildirimleri" disabled={busy} value={user.emailNotifications ?? true} onValueChange={value => void email(value)} trackColor={{ false: colors.line, true: mobile.teal }} thumbColor="#FFFFFF" {...webSwitchProps} /></View>{row("Bildirim ve Uygulama Tercihleri", "Mesaj, ortaklık, ilan ve sistem bildirimleri", "bell-outline", () => router.push("/notification-settings" as never), false, true)}{Platform.OS !== "web" && INTRO_SOUND_ENABLED ? <View style={[ms.row, { borderTopWidth: 1, borderColor: mobile.line, minHeight: 63 }]}><Icon name="music-note-outline" size={23} color={mobile.ink} /><View style={{ flex: 1, gap: 3, minWidth: 0 }}><Text style={{ color: mobile.ink, fontWeight: "600", fontSize: 14 }}>Açılış Sesi</Text><Text style={ms.muted}>Uygulama açılırken kısa melodi çalsın</Text></View><Switch accessibilityLabel="Açılış Sesi" value={introSound} onValueChange={(value) => { setIntroSound(value); void AsyncStorage.setItem(INTRO_SOUND_OFF_KEY, value ? "0" : "1").catch(() => {}); }} trackColor={{ false: colors.line, true: mobile.teal }} thumbColor="#FFFFFF" /></View> : null}</MobileCard>
    <Text style={[ms.section, { marginVertical: 10 }]}>Gizlilik ve Güvenlik</Text><MobileCard>
      {row("Engellediğim Kullanıcılar", `${store.blockedUserIds.length} engellenen kullanıcı`, "account-cancel-outline", () => router.push("/engellenenler"))}
      {row("Hesap Güvenliği", "Giriş geçmişi, şifre ve oturum işlemleri", "shield-lock-outline", () => router.push("/account-security" as never))}
      {row("Verilerim ve Yasal Metinler", "Gizlilik metinleri ve veri talepleri", "file-document-outline", () => router.push("/legal"), false, true)}
    </MobileCard>
    <Text style={[ms.section, { marginVertical: 10 }]}>Diğer</Text><MobileCard>
      {row("Yardım Merkezi", "Sık sorulan sorular ve destek", "help-circle-outline", () => router.push("/sss"))}
      {row("Destek Taleplerim", "Taleplerini ve durumlarını takip et", "headset", () => router.push("/support"))}
      {row("Şikâyetlerim", "Gönderdiğin şikâyetlerin durumunu takip et", "flag-outline", () => router.push("/reports" as never))}
      {row("Kullanım Koşulları", "Şartlar ve politikalar", "file-outline", () => router.push("/kullanim-sartlari"))}
      {row("Hesaptan Çıkış Yap", signingOut ? "Çıkış yapılıyor…" : "Bu cihazdaki oturumu kapat", "logout", () => Alert.alert("Çıkış Yap", "Bu cihazdaki oturum kapatılsın mı?", [{ text: "Vazgeç", style: "cancel" }, { text: "Çıkış Yap", style: "destructive", onPress: () => void signOut() }]), false, true)}
    </MobileCard><MobileCard style={{ borderColor: colors.accentSoft, backgroundColor: "#FFF7F8" }}>{row("Hesabımı Sil", "Hesabını ve kişisel verilerini sil; 30 gün içinde geri alabilirsin", "trash-can-outline", () => router.push("/hesap-silme" as never), true, true)}</MobileCard>
    </View>
  </MobileScreen>;
}

import { useEffect, useRef, useState } from "react";
import { Linking, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { PendingDeletionPanel, formatDeletionDate } from "@/components/account-deletion-notice";
import { colors } from "@/components/colors";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { InformationPage } from "@/components/information-page";
import { Alert } from "@/lib/alert";
import { SUPPORT_EMAIL, SUPPORT_EMAIL_MAILTO } from "@/lib/contact";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useMounted } from "@/lib/layout";
import { fetchMyAccountDeletionLive, reauthenticateLive } from "@/lib/live-service";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/lib/toast";
import { useStore } from "@/lib/use-store";

/**
 * HESAP SİLME — tek ekran, iki görev:
 *  1) Uygulama içi silme akışı (Apple 5.1.1(v)): "Hesabımı Sil" girişlerinin hepsi buraya gelir.
 *  2) Herkese açık web sayfası (Google Play "hesap silme URL'si"): giriş yapmadan neyin silindiğini,
 *     neyin saklandığını, 30 günlük süreyi ve talebin nasıl açılacağını anlatır.
 *
 * Talep sunucuda işlenir (request_account_deletion): hesap askıya alınır, ilanlar duraklatılır,
 * 30 gün içinde iptal edilebilir, sonra kalıcı olarak anonimleştirilir. Şifre yalnız e-posta/şifre
 * kimliği olan hesaplardan istenir; Google gibi sağlayıcıyla açılan hesaplar "SİL" yazarak onaylar.
 */

const DELETED = [
  "Ad, telefon, profil fotoğrafı, hakkında yazısı ve kullanıcı adı gibi profil bilgilerin.",
  "Giriş bilgilerin: e-posta adresin, bağlı Google hesabın ve tüm oturumların. Aynı hesapla yeniden giriş yapılamaz.",
  "İlanların yayından kaldırılır ve arşivlenir; yeni mesaj, teklif veya ortaklık talebi alamazsın.",
  "Bu cihazlara gönderilen bildirim kayıtların."
];
const KEPT = [
  "Mali kayıtlar: tamamlanmış satış, sipariş ve komisyon kayıtları, yasal saklama yükümlülükleri ve karşı tarafın hakları nedeniyle anonim bir profile bağlı olarak saklanır.",
  "Karşı tarafın mesaj geçmişi: yazıştığın kişiler kendi sohbet geçmişlerini görmeye devam eder; mesajların anonim bir kullanıcıya ait görünür.",
  "Şikâyet, itiraz ve güvenlik kayıtları yasal süre boyunca saklanır."
];
const WINDOW = [
  "Talebi gönderdiğin anda hesabın askıya alınır, yayındaki ilanların duraklatılır ve oturumun kapatılır.",
  "30 gün içinde yeniden giriş yapıp “Silme talebini iptal et” seçeneğiyle vazgeçebilirsin; hesabın ve talep nedeniyle duraklatılan ilanların geri açılır.",
  "30 günün sonunda hesabın kalıcı olarak silinir. Bu aşamadan sonra işlem geri alınamaz."
];

type Check = { status: "idle" | "loading" | "ready" | "error"; hasPassword: boolean; pending: boolean; scheduledFor?: string };
const IDLE: Check = { status: "idle", hasPassword: false, pending: false };

function isTypedConfirmation(value: string): boolean {
  // "SİL" — İ harfi olmayan klavyeler için noktasız/küçük yazımlar da kabul edilir.
  return ["SİL", "SIL", "sil", "Sil", "sİl"].includes(value.trim());
}

const inputStyle = { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: Platform.OS === "web" ? 16 : 14, minHeight: 46, paddingHorizontal: 12, paddingVertical: 10 } as const;

export default function AccountDeletionScreen() {
  const store = useStore();
  const router = useRouter();
  const mounted = useMounted();
  const { language } = useLanguage();
  const t = (text: string) => translateCopy(text, language);

  const sessionReady = mounted && store.authReady;
  const account = sessionReady && store.isAuthenticated ? store.currentUser.id : "";
  const isLive = store.backendMode === "supabase" && account.includes("-");

  const [check, setCheck] = useState<Check>(IDLE);
  const [retry, setRetry] = useState(0);
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    let alive = true;
    if (!account || !isLive || !supabase) { setCheck(IDLE); return; }
    setCheck({ ...IDLE, status: "loading" });
    void Promise.all([supabase.auth.getUser(), fetchMyAccountDeletionLive()]).then(([result, state]) => {
      if (!alive) return;
      const user = result.data.user;
      if (result.error || !user || user.id !== account || !state) { setCheck({ ...IDLE, status: "error" }); return; }
      setCheck({ status: "ready", hasPassword: !!user.identities?.some((identity) => identity.provider === "email"), pending: state.pending, scheduledFor: state.scheduledFor });
    }).catch(() => { if (alive) setCheck({ ...IDLE, status: "error" }); });
    return () => { alive = false; };
  }, [account, isLive, retry]);

  async function confirmed() {
    if (lock.current || check.status !== "ready") return;
    lock.current = true; setBusy(true); setError("");
    try {
      if (check.hasPassword && !await reauthenticateLive(password)) {
        setError(t("Şifre doğrulanamadı. Hesabın silinmedi; şifreni kontrol edip tekrar dene."));
        return;
      }
      if (!await store.requestAccountDeletion(reason.trim() || "Kullanıcı hesap silme ekranından talep oluşturdu.")) {
        setError(t("Silme talebi oluşturulamadı. Hesabın değişmedi; bağlantını kontrol edip tekrar dene."));
        return;
      }
      const state = await fetchMyAccountDeletionLive();
      const scheduledFor = state?.scheduledFor ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      setDone(scheduledFor);
      setCheck((current) => ({ ...current, pending: true, scheduledFor }));
      setPassword(""); setConfirmText(""); setReason("");
      // Talep alındı: bu cihazdaki oturumu kapat. Kapanamazsa bekleyen-talep paneli (iptal / çıkış) görünür.
      try { await store.signOut(); } catch { showToast(t("Çıkış yapılamadı. Tekrar dene.")); }
    } catch {
      setError(t("Silme talebi oluşturulamadı. Hesabın değişmedi; bağlantını kontrol edip tekrar dene."));
    } finally {
      lock.current = false; setBusy(false);
    }
  }

  function submit() {
    if (busy || check.status !== "ready") return;
    if (check.hasPassword ? !password : !isTypedConfirmation(confirmText)) {
      setError(t(check.hasPassword ? "Devam etmek için hesap şifreni gir." : "Onaylamak için kutuya SİL yaz."));
      return;
    }
    setError("");
    Alert.alert(
      t("Hesabını sil"),
      t("Hesabın hemen askıya alınacak ve 30 gün sonra kalıcı olarak silinecek. Devam edilsin mi?"),
      [
        { text: t("Vazgeç"), style: "cancel" },
        { text: t("Hesabımı Sil"), style: "destructive", onPress: () => void confirmed() }
      ]
    );
  }

  const doneDate = formatDeletionDate(done ?? undefined, language);

  return (
    <InformationPage
      title="Hesap Silme"
      path="/hesap-silme"
      icon="account-remove-outline"
      seoTitle="Hesap Silme | OrtakSat"
      intro="OrtakSat hesabını ve kişisel verilerini nasıl sileceğini, nelerin silinip nelerin saklandığını ve 30 günlük geri alma süresini bu sayfada bulabilirsin."
    >
      {done ? (
        <View accessibilityRole="alert" style={{ backgroundColor: colors.primarySoft, borderColor: colors.primary, borderRadius: 16, borderWidth: 1, gap: 8, padding: 16 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 9 }}>
            <Icon name="check-circle-outline" size={22} color={colors.primary} />
            <Text style={{ color: colors.ink, flex: 1, fontSize: 16, fontWeight: "900", minWidth: 0 }}>{t("Hesap silme talebin alındı")}</Text>
          </View>
          <Text style={{ color: colors.ink, fontSize: 13.5, lineHeight: 21 }}>
            {language === "en"
              ? `Your account is now suspended and will be permanently deleted on ${doneDate}. If you change your mind, sign in before that date and cancel the request.`
              : `Hesabın askıya alındı ve ${doneDate} tarihinde kalıcı olarak silinecek. Vazgeçersen bu tarihten önce giriş yapıp silme talebini iptal edebilirsin.`}
          </Text>
        </View>
      ) : null}

      <Section icon="delete-outline" title={t("Neler silinir?")} items={DELETED.map(t)} />
      <Section icon="archive-lock-outline" title={t("Neler saklanır?")} items={KEPT.map(t)} />
      <Section icon="calendar-clock" title={t("30 günlük geri alma süresi")} items={WINDOW.map(t)} />

      <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 16 }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 9 }}>
          <Icon name="account-remove-outline" size={22} color={colors.accent} />
          <Text accessibilityRole="header" style={{ color: colors.ink, flex: 1, fontSize: 17, fontWeight: "900", minWidth: 0 }}>{t("Hesabımı silmek istiyorum")}</Text>
        </View>

        {!sessionReady ? (
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>{t("Oturum kontrol ediliyor…")}</Text>
        ) : !account ? (
          <>
            <Text style={{ color: colors.muted, fontSize: 13.5, lineHeight: 21 }}>
              {t("Talebi açmak için silmek istediğin hesaba giriş yap; form bu sayfada açılır. Uygulamada aynı ekrana Hesap Ayarları › Hesabımı Sil yolundan ulaşabilirsin.")}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t("Giriş yap ve hesabımı sil")} onPress={() => router.push({ pathname: "/auth", params: { redirect: "/hesap-silme" } } as unknown as Href)} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 12, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 48, paddingHorizontal: 14, paddingVertical: 12 }}>
              <Icon name="login" size={20} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", flexShrink: 1, fontSize: 14.5, fontWeight: "900", textAlign: "center" }}>{t("Giriş yap ve hesabımı sil")}</Text>
            </Pressable>
            <Text style={{ color: colors.muted, fontSize: 13.5, lineHeight: 21 }}>
              {language === "en"
                ? `Can't sign in? Email ${SUPPORT_EMAIL} from the address registered on your account with the subject "Account deletion request". We process the request after verifying that the account is yours.`
                : `Giriş yapamıyor musun? Hesabına kayıtlı e-posta adresinden ${SUPPORT_EMAIL} adresine “Hesap silme talebi” konulu bir e-posta gönder. Hesabın sana ait olduğunu doğruladıktan sonra talebini işleme alırız.`}
            </Text>
            <Pressable accessibilityRole="link" accessibilityLabel={SUPPORT_EMAIL} onPress={() => { void Linking.openURL(`${SUPPORT_EMAIL_MAILTO}?subject=${encodeURIComponent("Hesap silme talebi")}`).catch(() => showToast(`${t("E-posta uygulaması açılamadı. Adres:")} ${SUPPORT_EMAIL}`)); }} style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 48, paddingHorizontal: 14, paddingVertical: 12 }}>
              <Icon name="email-outline" size={20} color={colors.primaryDark} />
              <Text style={{ color: colors.primaryDark, flexShrink: 1, fontSize: 14.5, fontWeight: "800", textAlign: "center" }}>{SUPPORT_EMAIL}</Text>
            </Pressable>
          </>
        ) : !isLive ? (
          <Text style={{ color: colors.muted, fontSize: 13.5, lineHeight: 21 }}>{t("Hesap silme yalnızca canlı hesaplarda geçerlidir.")}</Text>
        ) : check.status === "error" ? (
          <>
            <Text accessibilityRole="alert" style={{ color: colors.accent, fontSize: 13.5, fontWeight: "700", lineHeight: 20 }}>{t("Hesap bilgileri doğrulanamadı. Bağlantını kontrol edip tekrar dene.")}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t("Tekrar dene")} onPress={() => setRetry((value) => value + 1)} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 12, borderWidth: 1, justifyContent: "center", minHeight: 46, paddingHorizontal: 14 }}>
              <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "800" }}>{t("Tekrar dene")}</Text>
            </Pressable>
          </>
        ) : check.status !== "ready" ? (
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>{t("Hesap bilgileri doğrulanıyor…")}</Text>
        ) : check.pending ? (
          <PendingDeletionPanel scheduledFor={check.scheduledFor} onCancelled={() => { setDone(null); setRetry((value) => value + 1); }} />
        ) : (
          <>
            <Text style={{ color: colors.muted, fontSize: 13.5, lineHeight: 21 }}>
              {t("Silinecek hesap:")} <Text style={{ color: colors.ink, fontWeight: "900" }}>{store.currentUser.name}</Text>
            </Text>
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{t("Ayrılma nedenin (isteğe bağlı)")}</Text>
              <TextInput accessibilityLabel={t("Ayrılma nedenin (isteğe bağlı)")} editable={!busy} value={reason} onChangeText={setReason} multiline maxLength={500} placeholder={t("Bize kısaca anlatabilirsin")} placeholderTextColor={colors.subtle} textAlignVertical="top" style={[inputStyle, { minHeight: 84 }]} />
            </View>
            {check.hasPassword ? (
              <View style={{ gap: 6 }}>
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{t("Hesap şifren")}</Text>
                <TextInput accessibilityLabel={t("Hesap şifren")} editable={!busy} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="current-password" maxLength={72} style={inputStyle} />
                <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{t("Hesabın senin olduğunu doğrulamak için şifreni istiyoruz.")}</Text>
              </View>
            ) : (
              <View style={{ gap: 6 }}>
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{t("Onaylamak için SİL yaz")}</Text>
                <TextInput accessibilityLabel={t("Onaylamak için SİL yaz")} editable={!busy} value={confirmText} onChangeText={setConfirmText} autoCapitalize="characters" autoCorrect={false} maxLength={8} placeholder="SİL" placeholderTextColor={colors.subtle} style={inputStyle} />
                <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{t("Bu hesapta şifre yok (Google gibi bir sağlayıcıyla giriş yapıyorsun); bu yüzden yazılı onay istiyoruz.")}</Text>
              </View>
            )}
            {error ? <Text accessibilityRole="alert" style={{ color: colors.accent, fontSize: 13, fontWeight: "700", lineHeight: 19 }}>{error}</Text> : null}
            <Pressable accessibilityRole="button" accessibilityLabel={t("Hesabımı Sil")} accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={submit} style={{ alignItems: "center", backgroundColor: colors.accent, borderRadius: 12, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 48, opacity: busy ? 0.6 : 1, paddingHorizontal: 14, paddingVertical: 12 }}>
              <Icon name="trash-can-outline" size={20} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", flexShrink: 1, fontSize: 14.5, fontWeight: "900", textAlign: "center" }}>{busy ? t("İşleniyor…") : t("Hesabımı Sil")}</Text>
            </Pressable>
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{t("Talep gönderilince bu cihazdaki oturumun kapatılır. 30 gün içinde giriş yapıp talebi iptal edebilirsin.")}</Text>
          </>
        )}
      </View>
    </InformationPage>
  );
}

function Section({ icon, title, items }: { icon: keyof typeof Icon.glyphMap; title: string; items: string[] }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 10, padding: 16 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 9 }}>
        <Icon name={icon} size={22} color={colors.primary} />
        <Text accessibilityRole="header" style={{ color: colors.ink, flex: 1, fontSize: 16, fontWeight: "900", minWidth: 0 }}>{title}</Text>
      </View>
      {items.map((item) => (
        <View key={item} style={{ alignItems: "flex-start", flexDirection: "row", gap: 9 }}>
          <View style={{ backgroundColor: colors.primary, borderRadius: 3, height: 6, marginTop: 8, width: 6 }} />
          <Text style={{ color: colors.muted, flex: 1, fontSize: 13.5, lineHeight: 21, minWidth: 0 }}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

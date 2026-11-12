import { requiresMobileAccount, safeAuthRedirect, useMobileAccess } from "@/lib/mobile-access";
import { isMobileApp } from "@/lib/mobile-app";
import { MaterialCommunityIcons } from "@/components/icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Alert } from "@/lib/alert";
import { showToast } from "@/lib/toast";


import { MobileAuthLanding } from "@/components/mobile-auth-landing";
import { colors } from "@/components/colors";
import { Seo } from "@/components/seo";
import { PasswordStrengthMeter } from "@/components/password-strength-meter";
import { PrimaryButton } from "@/components/ui";
import { LegalConsentModal } from "@/components/legal-consent-modal";
import { LEGAL_DOCS } from "@/lib/legal-content";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { metaTrack } from "@/lib/meta-pixel";
import { hasSeenWelcome, markWelcomeSeen } from "@/lib/onboarding";
import { setRememberSession } from "@/lib/supabase";
import { useStore } from "@/lib/use-store";
import { passwordStrength } from "@/lib/validation";

type AuthMode = "login" | "register" | "reset";

export default function AuthScreen() {
  const { language } = useLanguage();
  const router = useRouter();
  const mobileAccess = useMobileAccess();
  const params = useLocalSearchParams<{ redirect?: string; mode?: string }>();
  const { authAttempt, authError, currentUser, isAuthenticated, pendingVerifyEmail, clearPendingVerify, verifyEmailCode, resendEmailCode, resetPasswordWithEmail, resetPasswordWithCode, signInWithEmail, signInWithGoogle, signUpWithEmail } = useStore();
  const [mode, setMode] = useState<AuthMode>("login");
  useEffect(() => { if (params.mode === "register" || params.mode === "login" || params.mode === "reset") setMode(params.mode); }, [params.mode]);
  // E-posta + şifre alanları HER platformda doğrudan görünür (eskiden uygulamada önce "E-posta ile devam et"e
  // basmak gerekiyordu; kullanıcı giriş alanlarını, "Şifremi unuttum"u ve hesap oluşturmayı bulamıyordu).
  const [emailFormOpen, setEmailFormOpen] = useState(true);
  // Kayıt: Ad ve Soyad ayrı alanlar (e-ticaret standardı); birleştirilip saklanır.
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  // Sade onay: tek toplu kutu (metinler mavi altı-çizili link, 18 yaş dahil).
  const [acceptedAll, setAcceptedAll] = useState(false);
  const [consentHint, setConsentHint] = useState(false);
  const consentRef = useRef<View>(null);
  const [openDocKey, setOpenDocKey] = useState<keyof typeof LEGAL_DOCS | null>(null);
  const allAccepted = acceptedAll;
  const [loading, setLoading] = useState(false);
  const authOperation = useRef(false);
  const codeOperation = useRef(false);
  const [resending, setResending] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [resendRemaining, setResendRemaining] = useState(0);
  useEffect(() => {
    if (!resendAvailableAt) { setResendRemaining(0); return; }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000));
      setResendRemaining(remaining);
      if (!remaining) clearInterval(timer);
    };
    const timer = setInterval(tick, 1000);
    tick();
    return () => clearInterval(timer);
  }, [resendAvailableAt]);
  useEffect(() => { setVerifyError(null); setResendAvailableAt(0); }, [pendingVerifyEmail]);
  // Web'de Alert.alert çoğu tarayıcıda no-op olduğundan, boş-alan/doğrulama
  // uyarılarını satır-içi (inline) de gösteririz. Böylece "boş bırakıp Giriş'e
  // basınca tepki yok" sorunu ortadan kalkar.
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  // Şifremi unuttum akışı: önce e-postaya kod gönder, sonra kod + yeni şifre.
  const [resetSent, setResetSent] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword;

  // Güvenli iç yönlendirme hedefi (yalnız uygulama-içi "/..." yolları; açık yönlendirme engeli).
  const safeRedirect = safeAuthRedirect(params.redirect);
  // "Geç" hedefi (native): giriş duvarına takılan hedef HERKESE AÇIK bir sayfaysa (ör. paylaşılan
  // ilan linki) misafir oraya gider; hesap gerektiren hedefte ya da web'de eskisi gibi ana sayfa.
  const skipTarget = isMobileApp && safeRedirect && !requiresMobileAccount(safeRedirect.split("?")[0]) ? safeRedirect : undefined;

  async function sendResetCode() {
    if (loading || authOperation.current) return;
    setFormError(null);
    if (!cleanEmail) {
      const msg = language === "en" ? "Enter your email address." : "Lütfen e-posta adresini gir.";
      setFormError(msg);
      Alert.alert(language === "en" ? "Email required" : "E-posta gerekli", msg);
      return;
    }
    authOperation.current = true;
    setLoading(true);
    try {
      const { ok, error } = await authAttempt(() => resetPasswordWithEmail(cleanEmail));
      if (ok) { setResetSent(true); showToast(translateCopy("Kod e-postana gönderildi", language)); }
      else { const m = error ?? translateCopy("Geçerli bir e-posta gir ve tekrar dene.", language); setFormError(m); Alert.alert(translateCopy("Gönderilemedi", language), translateCopy(m, language)); }
    } catch {
      const m = translateCopy("Bağlantı hatası. Lütfen tekrar dene.", language);
      setFormError(m); Alert.alert(translateCopy("Gönderilemedi", language), m);
    } finally {
      authOperation.current = false;
      setLoading(false);
    }
  }
  async function doResetWithCode() {
    if (loading || authOperation.current) return;
    setFormError(null);
    // Sıfırlama, KAYIT ile AYNI güç kuralını zorlar (eskiden sunucu ≥6 istiyor, kayıt ≥8+karmaşıklık
    // → çelişkili ölü-uç: istemci "6 yeterli" derken sunucu reddediyordu).
    const strength = passwordStrength(newPassword);
    if (!strength.ok) {
      const missing = strength.checks.filter((c) => !c.ok).map((c) => c.label.toLocaleLowerCase("tr-TR")).join(", ");
      const msg = `Yeni şifre yeterince güçlü değil. Şu kuralları da karşıla: ${missing}.`;
      setFormError(msg);
      Alert.alert(translateCopy("Şifre yeterince güçlü değil", language), `Şu kuralları da karşıla: ${missing}.`);
      return;
    }
    authOperation.current = true;
    setLoading(true);
    try {
      const { ok, error } = await authAttempt(() => resetPasswordWithCode(cleanEmail, resetCode, newPassword));
      if (ok) { setResetSent(false); setResetCode(""); setNewPassword(""); setMode("login"); showToast(translateCopy("Şifren güncellendi — yeni şifrenle giriş yap", language)); }
      else { const m = error ?? translateCopy("Kod hatalı/süresi dolmuş olabilir ya da şifre çok kısa.", language); setFormError(m); Alert.alert(translateCopy("Güncellenemedi", language), translateCopy(m, language)); }
    } catch {
      const m = translateCopy("Bağlantı hatası. Lütfen tekrar dene.", language);
      setFormError(m); Alert.alert(translateCopy("Güncellenemedi", language), m);
    } finally {
      authOperation.current = false;
      setLoading(false);
    }
  }

  async function submitVerifyCode() {
    if (!pendingVerifyEmail || codeOperation.current) return;
    if (!/^\d{6}$/.test(verifyCode)) {
      setVerifyError(translateCopy("E-postana gelen 6 haneli kodu eksiksiz gir.", language));
      return;
    }
    codeOperation.current = true;
    setVerifying(true); setVerifyError(null);
    try {
      const ok = await verifyEmailCode(pendingVerifyEmail, verifyCode);
      if (ok) setVerifyCode("");
      else setVerifyError(translateCopy("Kod doğrulanamadı. Kodu kontrol edip tekrar dene veya yeni kod iste.", language));
    } catch {
      setVerifyError(translateCopy("Bağlantı hatası. Kodun silinmedi; tekrar deneyebilirsin.", language));
    } finally {
      codeOperation.current = false; setVerifying(false);
    }
  }

  async function resendCode() {
    if (!pendingVerifyEmail || codeOperation.current || Date.now() < resendAvailableAt) return;
    codeOperation.current = true; setResending(true); setVerifyError(null);
    try {
      const ok = await resendEmailCode(pendingVerifyEmail);
      if (!ok) { setVerifyError(translateCopy("Kod gönderilemedi. Biraz sonra tekrar dene.", language)); return; }
      setResendAvailableAt(Date.now() + 60_000);
      showToast(translateCopy("Yeni doğrulama kodu e-postana gönderildi", language));
    } catch {
      setVerifyError(translateCopy("Bağlantı hatası. Kod gönderilemedi; tekrar deneyebilirsin.", language));
    } finally { codeOperation.current = false; setResending(false); }
  }

  const cleanEmail = email.trim().toLowerCase();

  // Sekme (giriş/kayıt/sıfırlama) değişince satır-içi doğrulama uyarısını temizle.
  useEffect(() => { setFormError(null); setConsentHint(false); }, [mode]);

  // ANDROID donanım geri tuşu: e-posta formu / şifre sıfırlama açıkken ekrandaki "Diğer giriş
  // seçenekleri" bağlantısıyla AYNI işi yapsın (seçeneklere dön). Eskiden geri tuşu tüm giriş
  // ekranını kapatıyor, giriş ekranı yığındaki tek ekransa uygulamadan çıkıyordu.
  useEffect(() => {
    // Form artık hep açık: geri tuşu yalnız şifre sıfırlama adımında "girişe dön" yapar;
    // giriş/kayıt sekmesindeyken sistemin olağan geri davranışı çalışır.
    if (Platform.OS !== "android" || pendingVerifyEmail || mode !== "reset") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      setMode("login");
      return true;
    });
    return () => subscription.remove();
  }, [mode, pendingVerifyEmail]);

  // Giriş başarılı olunca: yeni üye ilk kez /hosgeldin rehberine (rol seçimi),
  // önceden görmüşse doğrudan ana sayfaya. Herhangi bir hata olursa güvenle "/".
  useEffect(() => {
    if (!isAuthenticated) return;
    if (isMobileApp) {
      // Yığında auth'un altında ekran varken (ör. [(tabs), auth]) `replace("/")`, auth'u YENİ bir
      // (tabs) navigatörüyle değiştirip iki sekme ağacı bırakıyordu (Android geri tuşu eski ana
      // sayfaya dönüyordu). dismissTo hedef yığındaysa ona kadar POP eder, değilse auth'un yerine koyar.
      const target = (safeRedirect ?? "/") as never;
      if (router.canDismiss()) router.dismissTo(target);
      else router.replace(target);
      return;
    }
    const uid = currentUser?.id;
    // AÇIK NİYET ÖNCELİĞİ: redirect varsa (ör. anonim "İlan Ver" → kayıt), kullanıcıyı welcome
    // detour'una sokma; hedefine gönder. /create'te taslağı "devam et?" ile bekliyor = en iyi
    // onboarding (rol seçici zaten menüden erişilebilir). Redirect'siz yeni üye /hosgeldin görür.
    if (safeRedirect) {
      if (uid) { try { markWelcomeSeen(uid); } catch { /* yut */ } }
      router.replace(safeRedirect as never);
      return;
    }
    try {
      if (uid && !hasSeenWelcome(uid)) {
        markWelcomeSeen(uid);
        router.replace("/hosgeldin");
        return;
      }
    } catch {
      // yut — aşağıda geri dönülür
    }
    // Giriş öncesi kullanıcının gitmek istediği sayfaya (son ziyaret) geri dön.
    router.replace((safeRedirect ?? "/") as never);
  }, [isAuthenticated, currentUser, router, safeRedirect]);

  async function loginWithGoogle() {
    if (loading || authOperation.current) return;
    if (!acceptedAll) {
      setFormError(null);
      setConsentHint(true);
      return;
    }
    setConsentHint(false);
    setFormError(null);
    setRememberSession(true);
    authOperation.current = true;
    setLoading(true);
    try {
      const { ok, error } = await authAttempt(() => signInWithGoogle(acceptedAll));
      // Başarılıysa tarayıcı Google'a yönlenir (geri dönüş otomatik). Başarısızsa hata authError'da.
      if (!ok && error) {
        Alert.alert(language === "en" ? "Could not continue with Google" : "Google ile giriş yapılamadı", translateCopy(error, language));
      }
    } catch {
      const m = translateCopy("Google ile bağlantı kurulamadı. Lütfen tekrar dene.", language);
      setFormError(m); Alert.alert(translateCopy("Google ile giriş yapılamadı", language), m);
    } finally {
      authOperation.current = false;
      setLoading(false);
    }
  }

  async function login() {
    if (loading || authOperation.current) return; // çift-dokunuş koruması (reset/verify handler'larıyla parite)
    setFormError(null);
    if (!cleanEmail || password.length < 1) {
      const msg = !cleanEmail
        ? (language === "en" ? "Enter your email address." : "Lütfen e-posta adresini gir.")
        : (language === "en" ? "Enter your password." : "Lütfen şifreni gir.");
      setFormError(msg);
      Alert.alert(language === "en" ? "Missing information" : "Eksik bilgi", msg);
      return;
    }

    // "Beni Hatırla" — girişten ÖNCE depoyu ayarla ki oturum doğru yere yazılsın.
    setRememberSession(rememberMe);
    authOperation.current = true;
    setLoading(true);
    try {
      const { ok, error } = await authAttempt(() => signInWithEmail(cleanEmail, password));
      // Başarılıysa yukarıdaki effect ana sayfaya yönlendirir. Hata varsa göster.
      if (!ok) {
        const m = error ?? (language === "en" ? "Could not sign in. Please try again." : "Giriş yapılamadı. Lütfen tekrar dene.");
        setFormError(m); Alert.alert(language === "en" ? "Could not sign in" : "Giriş yapılamadı", translateCopy(m, language));
      }
    } catch {
      const m = language === "en" ? "Connection error. Please try again." : "Bağlantı hatası. Lütfen tekrar dene.";
      setFormError(m); Alert.alert(language === "en" ? "Could not sign in" : "Giriş yapılamadı", m);
    } finally {
      authOperation.current = false;
      setLoading(false);
    }
  }

  async function register() {
    if (loading || authOperation.current) return; // çift-dokunuş koruması → iki signUp çağrısı + "zaten hesap var" flaşı önlenir
    setFormError(null);
    if (!firstName.trim() || !lastName.trim() || !cleanEmail) {
      // Yalnızca GERÇEKTEN eksik alanları söyle (eskiden e-posta dolu olsa bile
      // "Ad, soyad ve e-posta gerekli" diyordu → kullanıcı "ama e-postayı yazdım" diye şaşırıyordu).
      const missing: string[] = [];
      if (!firstName.trim()) missing.push(language === "en" ? "first name" : "ad");
      if (!lastName.trim()) missing.push(language === "en" ? "last name" : "soyad");
      if (!cleanEmail) missing.push(language === "en" ? "email" : "e-posta");
      const joined = missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(", ")}${language === "en" ? " and " : " ve "}${missing[missing.length - 1]}`;
      const cap = joined.charAt(0).toUpperCase() + joined.slice(1);
      const msg = language === "en" ? `${cap} required.` : `${cap} gerekli.`;
      setFormError(msg);
      Alert.alert(language === "en" ? "Missing information" : "Eksik bilgi", msg);
      return;
    }
    const strength = passwordStrength(password);
    if (!strength.ok) {
      const missing = strength.checks.filter((c) => !c.ok).map((c) => c.label.toLocaleLowerCase("tr-TR")).join(", ");
      const msg = `Şifre yeterince güçlü değil. Şu kuralları da karşıla: ${missing}.`;
      setFormError(msg);
      Alert.alert(translateCopy("Şifre yeterince güçlü değil", language), `Şu kuralları da karşıla: ${missing}.`);
      return;
    }
    if (password !== confirmPassword) {
      const msg = translateCopy("Şifre ve şifre tekrar alanları aynı olmalı.", language);
      setFormError(msg);
      Alert.alert(translateCopy("Şifreler uyuşmuyor", language), msg);
      return;
    }
    if (!allAccepted) {
      const msg = language === "en" ? "You must accept KVKK, privacy, terms of use, and seller/partner rules." : "KVKK, gizlilik, kullanım şartları ve satıcı/ortak kurallarını kabul etmelisin.";
      setFormError(msg);
      Alert.alert(language === "en" ? "Legal approval required" : "Yasal onay gerekli", msg);
      return;
    }

    // Yeni kayıtta oturum kalıcı olsun (kullanıcı yeni geldi).
    setRememberSession(true);
    authOperation.current = true;
    setLoading(true);
    try {
      const { ok, error } = await authAttempt(() => signUpWithEmail({ email: cleanEmail, password, name: fullName, legalAccepted: acceptedAll }));
      // Akış kendini yönetir: oturum açıldıysa (doğrulama kapalı) effect /hosgeldin'e
      // yönlendirir; kod gerekiyorsa pendingVerifyEmail set olur ve kod ekranı gelir.
      // Başarısızsa authError formda gösterilir; hiçbir mesaj yoksa da net bir uyarı ver.
      if (!ok) {
        const m = error ?? (language === "en" ? "Registration failed. Please try again." : "Kayıt yapılamadı. Lütfen tekrar dene.");
        setFormError(m); Alert.alert(language === "en" ? "Registration failed" : "Kayıt yapılamadı", translateCopy(m, language));
      } else {
        setPassword(""); setConfirmPassword("");
        // Meta Pixel: kayıt tamamlandı (reklam dönüşümü). fbq yoksa sessiz no-op.
        metaTrack("CompleteRegistration", { content_name: "email_signup", status: true });
      }
    } catch {
      const m = language === "en" ? "Connection error. Please try again." : "Bağlantı hatası. Lütfen tekrar dene.";
      setFormError(m); Alert.alert(language === "en" ? "Registration failed" : "Kayıt yapılamadı", m);
    } finally {
      authOperation.current = false;
      setLoading(false);
    }
  }

  // Mavi altı-çizili link stili (yasal metinler için) — tek yerde.
  const linkStyle = { color: colors.primaryDark, fontWeight: "800" as const, textDecorationLine: "underline" as const };

  // Sade TOPLU onay (sahibinden tarzı): tek kutu, metinler mavi altı-çizili link,
  // 18 yaş dahil. Linke dokununca ilgili metin okuma için açılır.
  const legalChecks = (
    <View ref={consentRef} collapsable={false} style={{ gap: 8, padding: 9, borderWidth: 1, borderRadius: 12, borderColor: consentHint ? colors.primary : "transparent", backgroundColor: consentHint ? colors.primarySoft : "transparent" }}>
      <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 9 }}>
      <Pressable onPress={() => { setAcceptedAll((v) => !v); setConsentHint(false); }} hitSlop={6} accessibilityRole="checkbox" accessibilityLabel={translateCopy("Yasal metinleri kabul ediyorum", language)} accessibilityState={{ checked: acceptedAll }} {...({ role: "checkbox", "aria-checked": acceptedAll, "aria-label": translateCopy("Yasal metinleri kabul ediyorum", language) } as Record<string, unknown>)} style={{ paddingTop: 1 }}>
        <MaterialCommunityIcons name={acceptedAll ? "checkbox-marked" : "checkbox-blank-outline"} size={22} color={acceptedAll ? colors.primary : colors.muted} />
      </Pressable>
      <Text style={{ color: colors.muted, flex: 1, fontSize: 12.5, lineHeight: 19 }}>
        <Text onPress={() => setOpenDocKey("kullanim")} style={linkStyle}>{translateCopy("Kullanım Şartları", language)}</Text>,{" "}
        <Text onPress={() => setOpenDocKey("kvkk")} style={linkStyle}>{translateCopy("KVKK Aydınlatma Metni", language)}</Text> {translateCopy("ve", language)}{" "}
        <Text onPress={() => setOpenDocKey("gizlilik")} style={linkStyle}>{translateCopy("Gizlilik Politikası", language)}</Text>, <Text onPress={() => setOpenDocKey("ilan")} style={linkStyle}>{translateCopy("İlan Kuralları", language)}</Text>{translateCopy(" metinlerini okudum, kabul ediyorum ve 18 yaşından büyüğüm.", language)}
      </Text>
      </View>
      {consentHint && <Text accessibilityLiveRegion="polite" style={{ color: colors.primaryDark, fontSize: 12, lineHeight: 18, fontWeight: "700" }}>{translateCopy("Devam etmek için önce bu kutuyu işaretle.", language)}</Text>}
    </View>
  );
  const legalModal = (
    <LegalConsentModal
      doc={openDocKey ? LEGAL_DOCS[openDocKey] : null}
      visible={!!openDocKey}
      onClose={() => setOpenDocKey(null)}
      onApprove={() => setOpenDocKey(null)}
    />
  );

  // Temiz alt sözleşme satırı (sahibinden'deki gibi): mavi altı-çizili linkler.
  const legalFooter = (
    <Text style={{ color: colors.subtle, fontSize: 11.5, lineHeight: 17, textAlign: "center" }}>
      <Text onPress={() => setOpenDocKey("kullanim")} style={linkStyle}>{translateCopy("Kullanım Şartları", language)}</Text>
      {"   ·   "}
      <Text onPress={() => setOpenDocKey("kvkk")} style={linkStyle}>{translateCopy("KVKK Aydınlatma Metni", language)}</Text>
      {"   ·   "}
      <Text onPress={() => setOpenDocKey("gizlilik")} style={linkStyle}>{translateCopy("Gizlilik Politikası", language)}</Text>
    </Text>
  );

  // Beni Hatırla (giriş): işaretli değilse tarayıcı kapanınca oturum silinir.
  const rememberCheck = (
    <Pressable onPress={() => setRememberMe((v) => !v)} accessibilityRole="checkbox" accessibilityLabel={translateCopy("Beni hatırla", language)} accessibilityState={{ checked: rememberMe }} {...({ role: "checkbox", "aria-checked": rememberMe, "aria-label": translateCopy("Beni hatırla", language) } as Record<string, unknown>)} style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
      <MaterialCommunityIcons name={rememberMe ? "checkbox-marked" : "checkbox-blank-outline"} size={19} color={rememberMe ? colors.primary : colors.muted} />
      <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>{translateCopy("Beni hatırla", language)}</Text>
    </Pressable>
  );


  // Giriş/kayıt ekranı arama sonuçlarında çıkmasın (ince içerik + kişisel akış).
  const seoHead = (
    <Seo
      title={translateCopy("Giriş yap veya ücretsiz üye ol | OrtakSat", language)}
      description={translateCopy("OrtakSat hesabına giriş yap ya da saniyeler içinde ücretsiz üye ol; ilan ver, ortak ol, kazanmaya başla.", language)}
      path="/auth"
      noindex
    />
  );

  // Kayıt olup e-posta kodunu bekleyen kullanıcı: link/uygulama-değiştirme yok,
  // aynı ekranda 6 haneli kodu girer. (Supabase "Confirm signup" şablonu {{ .Token }} ile.)

  if (pendingVerifyEmail) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.background }}>
        {seoHead}
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 20 }}>
          <View style={{ alignSelf: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 18, borderWidth: 1, gap: 14, maxWidth: 420, padding: 24, width: "100%" }}>
            <View style={{ alignItems: "center", gap: 8 }}>
              <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 14, height: 56, justifyContent: "center", width: 56 }}>
                <MaterialCommunityIcons name="email-check-outline" size={30} color={colors.primaryDark} />
              </View>
              <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "900", textAlign: "center" }}>{translateCopy("E-postanı doğrula", language)}</Text>
              <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600", lineHeight: 19, textAlign: "center" }}>
                <Text style={{ fontWeight: "900", color: colors.ink }}>{pendingVerifyEmail}</Text>{translateCopy(" adresine 6 haneli bir kod gönderdik. Aşağıya gir; giriş otomatik açılır.", language)}
              </Text>
            </View>
            <TextInput
              value={verifyCode}
              onChangeText={(v) => { setVerifyCode(v.replace(/\D/g, "").slice(0, 6)); setVerifyError(null); }}
              editable={!verifying && !resending}
              keyboardType="number-pad"
              autoComplete="sms-otp"
              textContentType="oneTimeCode"
              accessibilityLabel={translateCopy("E-postana gelen 6 haneli doğrulama kodu", language)}
              {...({ inputMode: "numeric", autoComplete: "one-time-code", "aria-label": translateCopy("6 haneli doğrulama kodu", language), pattern: "[0-9]*" } as Record<string, unknown>)}
              onSubmitEditing={submitVerifyCode}
              returnKeyType="go"
              placeholder="______"
              placeholderTextColor={colors.subtle}
              maxLength={6}
              style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 12, borderWidth: 1, color: colors.ink, fontSize: 26, fontWeight: "900", letterSpacing: 8, paddingVertical: 14, textAlign: "center" }}
            />
            {verifyError || authError ? <Text accessibilityRole="alert" style={{ color: colors.accent, fontSize: 12.5, textAlign: "center" }}>{verifyError || authError}</Text> : null}
            <PrimaryButton disabled={verifying || resending} onPress={() => void submitVerifyCode()}>{verifying ? translateCopy("Doğrulanıyor…", language) : translateCopy("Doğrula ve giriş yap", language)}</PrimaryButton>
            <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
              <Pressable accessibilityRole="button" disabled={verifying || resending || resendRemaining > 0} accessibilityState={{ disabled: verifying || resending || resendRemaining > 0 }} onPress={() => void resendCode()} style={{ minHeight: 44, justifyContent: "center", opacity: verifying || resending || resendRemaining > 0 ? 0.55 : 1 }}><Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>{resending ? translateCopy("Gönderiliyor…", language) : resendRemaining > 0 ? `${translateCopy("Tekrar gönder", language)} (${resendRemaining} sn)` : translateCopy("Kodu tekrar gönder", language)}</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={verifying || resending} onPress={() => { clearPendingVerify(); setVerifyCode(""); setMode("login"); }}><Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>{translateCopy("Vazgeç", language)}</Text></Pressable>
            </View>
            <Text style={{ color: colors.subtle, fontSize: 11.5, lineHeight: 16, textAlign: "center" }}>{translateCopy("Kod gelmediyse spam klasörünü kontrol et. Yeni kod istediğinde e-postana gelen en son kodu kullan.", language)}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  const emailForm = <>
    {mode === "register" ? <View style={{ flexDirection: "row", gap: 12 }}>
      <View style={{ flex: 1, minWidth: 0 }}><Field label="Ad" value={firstName} onChangeText={setFirstName} placeholder="Ayşe" /></View>
      <View style={{ flex: 1, minWidth: 0 }}><Field label="Soyad" value={lastName} onChangeText={setLastName} placeholder="Demir" /></View>
    </View> : null}
    <Field label="E-posta" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="ornek@eposta.com" />
    {mode !== "reset" ? <Field label="Şifre" value={password} onChangeText={setPassword} secureTextEntry placeholder={mode === "register" ? "Güçlü bir şifre oluştur" : "Şifreni gir"} toggleSecure secureVisible={showPassword} onToggleSecure={() => setShowPassword(v => !v)} onSubmitEditing={mode === "login" ? login : undefined} passwordAutoComplete={mode === "register" ? "new-password" : "current-password"} /> : null}
    {mode === "register" && password.length > 0 ? <PasswordStrengthMeter password={password}/> : null}
    {mode === "register" ? <>
      <Field label="Şifre Tekrar" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="Şifreni tekrar gir" secureVisible={showPassword} onSubmitEditing={register} passwordAutoComplete="new-password" />
      {!passwordsMatch ? <Text style={{ color: colors.accent, fontSize: 12 }}>{translateCopy("Şifreler uyuşmuyor.", language)}</Text> : null}
      {legalChecks}
    </> : null}
    {mode === "login" ? <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>{rememberCheck}<Pressable accessibilityRole="button" disabled={loading} onPress={() => setMode("reset")} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "600" }}>{translateCopy("Şifremi unuttum", language)}</Text></Pressable></View> : null}
    {mode === "reset" && resetSent ? <>
      <Field label="E-postana gelen 6 haneli kod" value={resetCode} onChangeText={v => setResetCode(v.replace(/\D/g, "").slice(0, 6))} placeholder="______" code onSubmitEditing={doResetWithCode}/>
      <Field label="Yeni şifre" value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="Güçlü bir şifre oluştur" toggleSecure secureVisible={showPassword} onToggleSecure={() => setShowPassword(v => !v)} passwordAutoComplete="new-password"/>
      <PasswordStrengthMeter password={newPassword}/>
    </> : null}
    {formError || authError ? <Text accessibilityRole="alert" style={{ color: colors.accent, fontSize: 13, lineHeight: 19 }}>{formError || authError}</Text> : null}
    <PrimaryButton disabled={loading} onPress={mode === "login" ? login : mode === "register" ? register : resetSent ? doResetWithCode : sendResetCode}>{translateCopy(loading ? "Lütfen bekle…" : mode === "login" ? (Platform.OS === "web" ? "E-posta ile giriş yap" : "Giriş Yap") : mode === "register" ? (Platform.OS === "web" ? "Kayıt ol" : "Hesap Oluştur") : resetSent ? "Kodu doğrula ve şifreyi güncelle" : "Sıfırlama kodu gönder", language)}</PrimaryButton>
    {mode === "reset" && resetSent ? <PrimaryButton disabled={loading} tone="secondary" onPress={sendResetCode}>{translateCopy("Kodu tekrar gönder", language)}</PrimaryButton> : null}
    {Platform.OS === "web" && mode !== "reset" ? <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 16 }}>
      {mode === "login" ? legalChecks : null}
      <PrimaryButton tone="secondary" disabled={loading} onPress={loginWithGoogle}>Google ile devam et</PrimaryButton>
      {consentHint ? <Text accessibilityRole="alert" style={{ color: colors.accent, fontSize: 13 }}>Google ile devam etmek için yasal onay kutusunu işaretle.</Text> : null}
    </View> : null}
    {/* Uygulamada aynı bağlantılar Google onay satırında zaten var → alt satır yalnız web'de. */}
    {Platform.OS === "web" ? <View style={{ marginTop: 8 }}>{legalFooter}</View> : null}
  </>;
  // Android: "height" davranışı klavye kapandıktan sonra altta boş bir şerit bırakıyordu (gerçek cihazda görüldü) → "padding".
  return <KeyboardAvoidingView behavior={Platform.OS === "web" ? undefined : "padding"} style={{ flex: 1 }}>
    {seoHead}
    <MobileAuthLanding mode={mode === "register" ? "register" : "login"} onModeChange={setMode} onEmail={() => setEmailFormOpen(true)} onGoogle={loginWithGoogle} onSkip={() => mobileAccess.skip(skipTarget)} consent={legalChecks} accepted={acceptedAll} busy={loading} error={formError || authError}
      form={emailFormOpen || mode === "reset" ? emailForm : undefined} formTitle={mode === "reset" ? "Şifreni yenile" : Platform.OS === "web" && emailFormOpen ? mode === "register" ? "Hesabını oluştur" : "E-posta ile giriş yap" : undefined} showTabs={mode !== "reset"}
      onBack={mode === "reset" ? () => setMode("login") : undefined}/>
    {legalModal}
  </KeyboardAvoidingView>;
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  secureTextEntry,
  toggleSecure,
  secureVisible,
  onToggleSecure,
  onSubmitEditing,
  code,
  passwordAutoComplete
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address";
  secureTextEntry?: boolean;
  toggleSecure?: boolean;
  secureVisible?: boolean;
  onToggleSecure?: () => void;
  onSubmitEditing?: () => void;
  code?: boolean;
  passwordAutoComplete?: "current-password" | "new-password";
}) {
  const { language } = useLanguage();
  const hidden = secureTextEntry && !secureVisible;
  const isEmail = keyboardType === "email-address";
  const pwAc = passwordAutoComplete ?? "current-password";
  return (
    <View style={{ gap: 6 }}>
      <Text selectable style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>
        {translateCopy(label, language)}
      </Text>
      <View style={{ alignItems: "center", backgroundColor: "#FAFBFC", borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexDirection: "row" }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType={code ? "number-pad" : keyboardType}
          autoCapitalize={isEmail || secureTextEntry || code ? "none" : "words"}
          autoCorrect={!isEmail && !code && !secureTextEntry}
          autoComplete={code ? "sms-otp" : isEmail ? "email" : secureTextEntry ? (pwAc === "new-password" ? "password-new" : "password") : "off"}
          textContentType={code ? "oneTimeCode" : isEmail ? "emailAddress" : secureTextEntry ? (pwAc === "new-password" ? "newPassword" : "password") : "none"}
          accessibilityLabel={translateCopy(label, language)}
          maxLength={code ? 6 : undefined}
          {...({ name: code ? "one-time-code" : isEmail ? "email" : secureTextEntry ? pwAc : "text", "aria-label": translateCopy(label, language), inputMode: isEmail ? "email" : code ? "numeric" : undefined, autoComplete: code ? "one-time-code" : isEmail ? "email" : secureTextEntry ? pwAc : label === "Ad" ? "given-name" : label === "Soyad" ? "family-name" : "off", pattern: code ? "[0-9]*" : undefined } as Record<string, unknown>)}
          secureTextEntry={hidden}
          placeholder={placeholder ? translateCopy(placeholder, language) : undefined}
          placeholderTextColor={colors.muted}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={onSubmitEditing ? "go" : "done"}
          style={{ color: colors.ink, flex: 1, minWidth: 0, fontSize: 16, minHeight: 50, padding: 14 }}
        />
        {toggleSecure ? (
          <Pressable onPress={onToggleSecure} hitSlop={10} accessibilityRole="button" accessibilityLabel={secureVisible ? translateCopy("Şifreyi gizle", language) : translateCopy("Şifreyi göster", language)} style={{ paddingHorizontal: 14, minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" }}>
            <MaterialCommunityIcons name={secureVisible ? "eye-off-outline" : "eye-outline"} size={20} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}


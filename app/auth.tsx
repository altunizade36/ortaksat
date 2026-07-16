import { MaterialCommunityIcons } from "@/components/icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Alert } from "@/lib/alert";

import { Link } from "expo-router";

import { BrandMark } from "@/components/brand/brand-mark";
import { Mascot } from "@/components/brand/Mascot";
import { colors } from "@/components/colors";
import { Seo } from "@/components/seo";
import { PasswordStrengthMeter } from "@/components/password-strength-meter";
import { Card, PrimaryButton } from "@/components/ui";
import { LegalConsentModal } from "@/components/legal-consent-modal";
import { LEGAL_DOCS } from "@/lib/legal-content";
import { WebFooter } from "@/components/web-landing";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useIsWideWeb } from "@/lib/layout";
import { hasSeenWelcome, markWelcomeSeen } from "@/lib/onboarding";
import { setRememberSession } from "@/lib/supabase";
import { useStore } from "@/lib/use-store";
import { passwordStrength } from "@/lib/validation";

type AuthMode = "login" | "register" | "reset";

export default function AuthScreen() {
  const { language } = useLanguage();
  const router = useRouter();
  const params = useLocalSearchParams<{ redirect?: string; mode?: string }>();
  const { authError, currentUser, isAuthenticated, pendingVerifyEmail, clearPendingVerify, verifyEmailCode, resendEmailCode, resetPasswordWithEmail, resetPasswordWithCode, signInWithEmail, signInWithGoogle, signUpWithEmail } = useStore();
  const [mode, setMode] = useState<AuthMode>(params.mode === "register" ? "register" : "login");
  // Kayıt: Ad ve Soyad ayrı alanlar (e-ticaret standardı); birleştirilip saklanır.
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  // Sade onay: tek toplu kutu (metinler mavi altı-çizili link, 18 yaş dahil).
  const [acceptedAll, setAcceptedAll] = useState(false);
  const [openDocKey, setOpenDocKey] = useState<keyof typeof LEGAL_DOCS | null>(null);
  const allAccepted = acceptedAll;
  const [loading, setLoading] = useState(false);
  // Web'de Alert.alert çoğu tarayıcıda no-op olduğundan, boş-alan/doğrulama
  // uyarılarını satır-içi (inline) de gösteririz. Böylece "boş bırakıp Giriş'e
  // basınca tepki yok" sorunu ortadan kalkar.
  const [formError, setFormError] = useState<string | null>(null);
  const isWideWeb = useIsWideWeb();
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
  const safeRedirect = typeof params.redirect === "string" && params.redirect.startsWith("/") && !params.redirect.startsWith("//") ? params.redirect : null;

  async function sendResetCode() {
    if (loading) return;
    setFormError(null);
    if (!cleanEmail) {
      const msg = language === "en" ? "Enter your email address." : "Lütfen e-posta adresini gir.";
      setFormError(msg);
      Alert.alert(language === "en" ? "Email required" : "E-posta gerekli", msg);
      return;
    }
    setLoading(true);
    try {
      const ok = await resetPasswordWithEmail(cleanEmail);
      if (ok) { setResetSent(true); Alert.alert(translateCopy("Kod gönderildi", language), translateCopy("E-postana 6 haneli şifre sıfırlama kodu gönderdik. Kodu ve yeni şifreni aşağıya gir.", language)); }
      else { const m = authError ?? translateCopy("Geçerli bir e-posta gir ve tekrar dene.", language); setFormError(m); Alert.alert(translateCopy("Gönderilemedi", language), translateCopy(m, language)); }
    } catch {
      const m = translateCopy("Bağlantı hatası. Lütfen tekrar dene.", language);
      setFormError(m); Alert.alert(translateCopy("Gönderilemedi", language), m);
    } finally {
      setLoading(false);
    }
  }
  async function doResetWithCode() {
    if (loading) return;
    setFormError(null);
    setLoading(true);
    try {
      const ok = await resetPasswordWithCode(cleanEmail, resetCode, newPassword);
      if (ok) { setResetSent(false); setResetCode(""); setNewPassword(""); setMode("login"); Alert.alert(translateCopy("Şifren güncellendi", language), translateCopy("Yeni şifrenle giriş yapabilirsin.", language)); }
      else { const m = authError ?? translateCopy("Kod hatalı/süresi dolmuş olabilir ya da şifre çok kısa.", language); setFormError(m); Alert.alert(translateCopy("Güncellenemedi", language), translateCopy(m, language)); }
    } catch {
      const m = translateCopy("Bağlantı hatası. Lütfen tekrar dene.", language);
      setFormError(m); Alert.alert(translateCopy("Güncellenemedi", language), m);
    } finally {
      setLoading(false);
    }
  }

  async function submitVerifyCode() {
    if (!pendingVerifyEmail || verifying) return;
    setVerifying(true);
    try {
      const ok = await verifyEmailCode(pendingVerifyEmail, verifyCode);
      if (ok) {
        setVerifyCode("");
        // Oturum açıldı; yukarıdaki effect /hosgeldin veya "/" yönlendirir.
      } else {
        Alert.alert(translateCopy("Kod doğrulanamadı", language), translateCopy(authError ?? "Kod hatalı veya süresi dolmuş olabilir. Tekrar dene ya da kodu yeniden gönder.", language));
      }
    } catch {
      Alert.alert(translateCopy("Kod doğrulanamadı", language), translateCopy("Bağlantı hatası. Lütfen tekrar dene.", language));
    } finally {
      setVerifying(false);
    }
  }

  async function resendCode() {
    if (!pendingVerifyEmail) return;
    const ok = await resendEmailCode(pendingVerifyEmail);
    Alert.alert(translateCopy(ok ? "Kod gönderildi" : "Gönderilemedi", language), translateCopy(ok ? "Yeni doğrulama kodu e-postana gönderildi." : (authError ?? "Kod gönderilemedi, biraz sonra tekrar dene."), language));
  }

  const cleanEmail = email.trim().toLowerCase();

  // Sekme (giriş/kayıt/sıfırlama) değişince satır-içi doğrulama uyarısını temizle.
  useEffect(() => { setFormError(null); }, [mode]);

  // Giriş başarılı olunca: yeni üye ilk kez /hosgeldin rehberine (rol seçimi),
  // önceden görmüşse doğrudan ana sayfaya. Herhangi bir hata olursa güvenle "/".
  useEffect(() => {
    if (!isAuthenticated) return;
    const uid = currentUser?.id;
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
    // Global standart: tıkla → Google → biter. Yasal onay, butonun altındaki
    // "Google ile devam ederek ... kabul etmiş olursun" bilgilendirmesiyle zımnen
    // verilir; ilk girişte onay kaydı otomatik atılır (recordGoogleConsentOnce).
    setLoading(true);
    try {
      const ok = await signInWithGoogle();
      // Başarılıysa tarayıcı Google'a yönlenir (geri dönüş otomatik). Başarısızsa hata authError'da.
      if (!ok && authError) {
        Alert.alert(language === "en" ? "Could not continue with Google" : "Google ile giriş yapılamadı", translateCopy(authError, language));
      }
    } catch {
      const m = translateCopy("Google ile bağlantı kurulamadı. Lütfen tekrar dene.", language);
      setFormError(m); Alert.alert(translateCopy("Google ile giriş yapılamadı", language), m);
    } finally {
      setLoading(false);
    }
  }

  async function login() {
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
    setLoading(true);
    try {
      const ok = await signInWithEmail(cleanEmail, password);
      // Başarılıysa yukarıdaki effect ana sayfaya yönlendirir. Hata varsa göster.
      if (!ok) {
        const m = authError ?? (language === "en" ? "Could not sign in. Please try again." : "Giriş yapılamadı. Lütfen tekrar dene.");
        setFormError(m); Alert.alert(language === "en" ? "Could not sign in" : "Giriş yapılamadı", translateCopy(m, language));
      }
    } catch {
      const m = language === "en" ? "Connection error. Please try again." : "Bağlantı hatası. Lütfen tekrar dene.";
      setFormError(m); Alert.alert(language === "en" ? "Could not sign in" : "Giriş yapılamadı", m);
    } finally {
      setLoading(false);
    }
  }

  async function register() {
    setFormError(null);
    if (!firstName.trim() || !lastName.trim() || !cleanEmail) {
      const msg = translateCopy("Ad, soyad ve e-posta gerekli.", language);
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
    setLoading(true);
    try {
      const ok = await signUpWithEmail({ email: cleanEmail, password, name: fullName });
      // Akış kendini yönetir: oturum açıldıysa (doğrulama kapalı) effect /hosgeldin'e
      // yönlendirir; kod gerekiyorsa pendingVerifyEmail set olur ve kod ekranı gelir.
      // Başarısızsa authError formda gösterilir; hiçbir mesaj yoksa da net bir uyarı ver.
      if (!ok) {
        const m = authError ?? (language === "en" ? "Registration failed. Please try again." : "Kayıt yapılamadı. Lütfen tekrar dene.");
        setFormError(m); Alert.alert(language === "en" ? "Registration failed" : "Kayıt yapılamadı", translateCopy(m, language));
      }
    } catch {
      const m = language === "en" ? "Connection error. Please try again." : "Bağlantı hatası. Lütfen tekrar dene.";
      setFormError(m); Alert.alert(language === "en" ? "Registration failed" : "Kayıt yapılamadı", m);
    } finally {
      setLoading(false);
    }
  }

  // Mavi altı-çizili link stili (yasal metinler için) — tek yerde.
  const linkStyle = { color: colors.primaryDark, fontWeight: "800" as const, textDecorationLine: "underline" as const };

  // Sade TOPLU onay (sahibinden tarzı): tek kutu, metinler mavi altı-çizili link,
  // 18 yaş dahil. Linke dokununca ilgili metin okuma için açılır.
  const legalChecks = (
    <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 9 }}>
      <Pressable onPress={() => setAcceptedAll((v) => !v)} hitSlop={6} accessibilityRole="checkbox" accessibilityLabel={translateCopy("Yasal metinleri kabul ediyorum", language)} accessibilityState={{ checked: acceptedAll }} {...({ role: "checkbox", "aria-checked": acceptedAll, "aria-label": translateCopy("Yasal metinleri kabul ediyorum", language) } as Record<string, unknown>)} style={{ paddingTop: 1 }}>
        <MaterialCommunityIcons name={acceptedAll ? "checkbox-marked" : "checkbox-blank-outline"} size={22} color={acceptedAll ? colors.primary : colors.muted} />
      </Pressable>
      <Text style={{ color: colors.muted, flex: 1, fontSize: 12.5, lineHeight: 19 }}>
        <Text onPress={() => setOpenDocKey("kullanim")} style={linkStyle}>{translateCopy("Kullanım Şartları", language)}</Text>,{" "}
        <Text onPress={() => setOpenDocKey("kvkk")} style={linkStyle}>{translateCopy("KVKK Aydınlatma Metni", language)}</Text> {translateCopy("ve", language)}{" "}
        <Text onPress={() => setOpenDocKey("gizlilik")} style={linkStyle}>{translateCopy("Gizlilik Politikası", language)}</Text>{translateCopy("'nı okudum, kabul ediyorum ve 18 yaşından büyüğüm.", language)}
      </Text>
    </View>
  );
  const legalModal = (
    <LegalConsentModal
      doc={openDocKey ? LEGAL_DOCS[openDocKey] : null}
      visible={!!openDocKey}
      onClose={() => setOpenDocKey(null)}
      onApprove={() => { setAcceptedAll(true); setOpenDocKey(null); }}
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

  // Google butonunun altındaki zımni yasal onay bilgilendirmesi (global standart).
  const googleNote = (
    <Text style={{ color: colors.subtle, fontSize: 11, lineHeight: 16, textAlign: "center" }}>
      {translateCopy("Google ile devam ederek", language)}{" "}
      <Text onPress={() => setOpenDocKey("kullanim")} style={linkStyle}>{translateCopy("Kullanım Şartları", language)}</Text>,{" "}
      <Text onPress={() => setOpenDocKey("kvkk")} style={linkStyle}>{translateCopy("KVKK Aydınlatma Metni", language)}</Text> {translateCopy("ve", language)}{" "}
      <Text onPress={() => setOpenDocKey("gizlilik")} style={linkStyle}>{translateCopy("Gizlilik Politikası", language)}</Text>{translateCopy("'nı kabul etmiş olursun.", language)}
    </Text>
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
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 20 }}>
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
              onChangeText={(v) => setVerifyCode(v.replace(/\D/g, "").slice(0, 6))}
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
            {authError ? <Text style={{ color: colors.accent, fontSize: 12.5, textAlign: "center" }}>{authError}</Text> : null}
            <PrimaryButton onPress={() => void submitVerifyCode()}>{verifying ? translateCopy("Doğrulanıyor…", language) : translateCopy("Doğrula ve giriş yap", language)}</PrimaryButton>
            <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
              <Pressable onPress={() => void resendCode()}><Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>{translateCopy("Kodu tekrar gönder", language)}</Text></Pressable>
              <Pressable onPress={() => { clearPendingVerify(); setMode("login"); }}><Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>{translateCopy("Vazgeç", language)}</Text></Pressable>
            </View>
            <Text style={{ color: colors.subtle, fontSize: 11.5, lineHeight: 16, textAlign: "center" }}>{translateCopy("Kod gelmediyse spam klasörünü kontrol et. Kodu şimdi girmeden de giriş yapıp daha sonra doğrulayabilirsin.", language)}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (isWideWeb) {
    const tabs: Array<{ key: AuthMode; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string }> = [
      { key: "login", icon: "login", label: translateCopy("Giriş Yap", language) },
      { key: "register", icon: "account-plus-outline", label: translateCopy("Kayıt Ol", language) },
      { key: "reset", icon: "lock-reset", label: translateCopy("Şifremi Unuttum", language) }
    ];
    const security: Array<{ icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; sub: string; tint: string; color: string }> = [
      { icon: "email-check-outline", title: translateCopy("E-posta doğrulama", language), sub: translateCopy("Hesabınızı doğrulayan güvenli e-posta doğrulama sistemi.", language), tint: colors.infoSoft, color: colors.info },
      { icon: "shield-alert-outline", title: translateCopy("Dolandırıcılık koruması", language), sub: translateCopy("Şüpheli işlem tespiti ve yapay zekâ destekli koruma mekanizmaları.", language), tint: colors.successSoft, color: colors.success },
      { icon: "lock-outline", title: translateCopy("Güvenli oturum", language), sub: translateCopy("Tüm oturumlarınız şifrelenir ve düzenli olarak izlenir.", language), tint: colors.violetSoft, color: colors.violet },
      { icon: "history", title: translateCopy("Oturum ve etkinlik takibi", language), sub: translateCopy("Hesabınızdaki tüm hareketleri görüntüleyin ve kontrol edin.", language), tint: colors.goldSoft, color: colors.gold },
      { icon: "headset", title: translateCopy("Destek her zaman yanınızda", language), sub: translateCopy("Sorularınız için 7/24 destek ekibimiz hizmetinizde.", language), tint: colors.accentSoft, color: colors.accent }
    ];
    const strip: Array<{ icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string }> = [
      { icon: "lock-check", label: translateCopy("256-Bit SSL ile korunur", language) },
      { icon: "database-check", label: translateCopy("Güvenli veri altyapısı", language) },
      { icon: "shield-account", label: translateCopy("KVKK uyumlu", language) },
      { icon: "map-marker-check", label: translateCopy("Türkiye'de barındırılır", language) }
    ];

    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, flexGrow: 1, paddingBottom: 0 }} style={{ backgroundColor: colors.background }}>
        {seoHead}
        <View style={{ gap: 16, marginHorizontal: "auto", maxWidth: 1100, paddingHorizontal: 20, paddingTop: 24, width: "100%" }}>
          {/* Dedicated auth top bar (site nav gizli) */}
          <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
            <Link href="/" asChild>
              <Pressable style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                {/* Gerçek marka logosu (eskiden jenerik vektör "handshake" ikonuydu). */}
                <BrandMark size={38} />
                <Text style={{ color: colors.primaryDark, fontSize: 18, fontWeight: "900" }}>ortaksat</Text>
              </Pressable>
            </Link>
            <Link href="/" asChild>
              <Pressable style={{ alignItems: "center", borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 8 }}>
                <MaterialCommunityIcons name="arrow-left" size={16} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>{translateCopy("Ana sayfa", language)}</Text>
              </Pressable>
            </Link>
          </View>
          {/* Branded hero */}
          <View style={{ backgroundColor: colors.primaryDark, borderRadius: 20, flexDirection: "row", gap: 18, overflow: "hidden", paddingHorizontal: 28, paddingVertical: 24 }}>
            <View style={{ flex: 1, gap: 8, justifyContent: "center", minWidth: 0 }}>
              <Text style={{ color: "#FFFFFF", fontSize: 24, fontWeight: "900" }}>{translateCopy("OrtakSat'a hoş geldin", language)}</Text>
              <Text style={{ color: "rgba(255,255,255,0.88)", fontSize: 14.5, fontWeight: "600", lineHeight: 21, maxWidth: 560 }}>{translateCopy("Ücretsiz hesap aç; ilan ver, ortak satışla kazan, alıcılarla güvenle iletişim kur. Gezmek için giriş gerekmez — hesabını sadece işlem yaparken kullanırsın.", language)}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                {[
                  { i: "check-decagram" as const, t: translateCopy("Ücretsiz üyelik", language) },
                  { i: "shield-lock" as const, t: translateCopy("Güvenli giriş", language) },
                  { i: "account-check" as const, t: translateCopy("Doğrulanmış satıcılar", language) }
                ].map((b) => (
                  <View key={b.t} style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999, flexDirection: "row", gap: 6, paddingHorizontal: 11, paddingVertical: 6 }}>
                    <MaterialCommunityIcons name={b.i} size={14} color="#FFFFFF" />
                    <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "800" }}>{b.t}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={{ alignItems: "center", justifyContent: "center", width: 108 }}>
              <Mascot name="success" size={104} panel panelColor="#F0FDFF" />
            </View>
          </View>

          <View style={{ alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: 20 }}>
            {/* Left: auth card */}
            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 18, borderWidth: 1, flexBasis: 420, flexGrow: 1, minWidth: 0, padding: 26 }}>
              {/* Marka logosu — giriş/kayıt formunun başı (klasik "logo + form" deseni). */}
              <View style={{ alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, gap: 6, marginBottom: 16, paddingBottom: 14 }}>
                <BrandMark size={52} />
                <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900", letterSpacing: 0.2 }}>OrtakSat</Text>
              </View>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 12, marginBottom: 16 }}>
                <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 12, height: 48, justifyContent: "center", width: 48 }}>
                  <MaterialCommunityIcons name="shield-account" size={26} color={colors.primaryDark} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>{translateCopy("Güvenli hesap erişimi", language)}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 17 }}>{translateCopy("Hesabınıza güvenli bir şekilde giriş yapın. E-posta doğrulama, şifreleme ve gelişmiş koruma sistemlerimizle güvendesiniz.", language)}</Text>
                </View>
              </View>

              <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 12, flexDirection: "row", gap: 4, marginBottom: 18, padding: 4 }}>
                {tabs.map((tb) => {
                  const on = mode === tb.key;
                  return (
                    <Pressable key={tb.key} onPress={() => setMode(tb.key)} style={{ alignItems: "center", backgroundColor: on ? colors.surface : "transparent", borderRadius: 9, flex: 1, flexDirection: "row", gap: 6, justifyContent: "center", paddingVertical: 10, ...(on ? { shadowColor: "#101828", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 } : {}) }}>
                      <MaterialCommunityIcons name={tb.icon} size={15} color={on ? colors.primaryDark : colors.muted} />
                      <Text style={{ color: on ? colors.primaryDark : colors.muted, fontSize: 12.5, fontWeight: "800" }}>{tb.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={{ gap: 14 }}>
                {mode === "register" ? (
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <View style={{ flex: 1 }}><DeskAuthField icon="account-outline" label={translateCopy("Ad", language)} value={firstName} onChangeText={setFirstName} placeholder="Ayşe" autoComplete="name" /></View>
                    <View style={{ flex: 1 }}><DeskAuthField icon="account-outline" label={translateCopy("Soyad", language)} value={lastName} onChangeText={setLastName} placeholder="Demir" autoComplete="name" /></View>
                  </View>
                ) : null}
                <DeskAuthField icon="email-outline" label={translateCopy("E-posta", language)} value={email} onChangeText={setEmail} placeholder="ornek@eposta.com" autoComplete="email" />
                {mode !== "reset" ? <DeskAuthField icon="lock-outline" label={translateCopy("Şifre", language)} value={password} onChangeText={setPassword} placeholder={mode === "register" ? translateCopy("Güçlü bir şifre oluştur", language) : translateCopy("Şifreni gir", language)} secure showToggle showPassword={showPassword} onToggle={() => setShowPassword((v) => !v)} onSubmitEditing={mode === "login" ? login : undefined} autoComplete={mode === "register" ? "password-new" : "password"} /> : null}
                {mode === "register" && password.length > 0 ? <PasswordStrengthMeter password={password} /> : null}
                {mode === "register" ? (
                  <View style={{ gap: 6 }}>
                    <DeskAuthField icon="lock-check-outline" label={translateCopy("Şifre Tekrar", language)} value={confirmPassword} onChangeText={setConfirmPassword} placeholder={translateCopy("Şifreni tekrar gir", language)} secure showPassword={showPassword} onSubmitEditing={register} autoComplete="password-new" />
                    {!passwordsMatch ? <Text style={{ color: colors.accent, fontSize: 11.5, fontWeight: "700" }}>{translateCopy("Şifreler uyuşmuyor.", language)}</Text> : null}
                  </View>
                ) : null}
                {mode === "reset" && resetSent ? (
                  <>
                    <DeskAuthField icon="numeric" label={translateCopy("E-postana gelen 6 haneli kod", language)} value={resetCode} onChangeText={(v) => setResetCode(v.replace(/\D/g, "").slice(0, 6))} placeholder="______" />
                    <DeskAuthField icon="lock-reset" label={translateCopy("Yeni şifre", language)} value={newPassword} onChangeText={setNewPassword} placeholder={translateCopy("Güçlü bir şifre oluştur", language)} secure showToggle showPassword={showPassword} onToggle={() => setShowPassword((v) => !v)} />
                    <PasswordStrengthMeter password={newPassword} />
                  </>
                ) : null}

                {mode === "login" ? (
                  <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
                    {rememberCheck}
                    <Pressable onPress={() => setMode("reset")}><Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>{translateCopy("Şifremi unuttunuz?", language)}</Text></Pressable>
                  </View>
                ) : null}

                {mode === "register" ? legalChecks : null}
                {legalModal}

                {mode === "login" ? (
                  <Pressable onPress={login} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 12, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 14 }}>
                    <MaterialCommunityIcons name="lock-outline" size={17} color="#FFFFFF" />
                    <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>{loading ? translateCopy("Giriş yapılıyor…", language) : translateCopy("Giriş Yap", language)}</Text>
                  </Pressable>
                ) : mode === "register" ? (
                  <Pressable onPress={register} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 12, justifyContent: "center", paddingVertical: 14 }}>
                    <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>{loading ? translateCopy("Kayıt açılıyor…", language) : translateCopy("Kayıt Ol", language)}</Text>
                  </Pressable>
                ) : (
                  <View style={{ gap: 10 }}>
                    {!resetSent ? (
                      <Pressable onPress={sendResetCode} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 12, justifyContent: "center", paddingVertical: 14 }}>
                        <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>{loading ? translateCopy("Gönderiliyor…", language) : translateCopy("Sıfırlama kodu gönder", language)}</Text>
                      </Pressable>
                    ) : (
                      <>
                        <Pressable onPress={doResetWithCode} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 12, justifyContent: "center", paddingVertical: 14 }}>
                          <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>{loading ? translateCopy("Güncelleniyor…", language) : translateCopy("Kodu doğrula ve şifreyi güncelle", language)}</Text>
                        </Pressable>
                        <Pressable onPress={sendResetCode} style={{ alignItems: "center", justifyContent: "center", paddingVertical: 8 }}>
                          <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>{translateCopy("Kodu tekrar gönder", language)}</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                )}

                {formError ? <Text style={{ color: colors.accent, fontSize: 12.5, fontWeight: "700" }}>{formError}</Text> : null}
                {authError ? <Text style={{ color: colors.accent, fontSize: 12.5, fontWeight: "600" }}>{authError}</Text> : null}

                {mode !== "reset" ? (
                  <>
                    <View style={{ alignItems: "center", flexDirection: "row", gap: 12, marginVertical: 2 }}>
                      <View style={{ backgroundColor: colors.line, flex: 1, height: 1 }} />
                      <Text style={{ color: colors.subtle, fontSize: 12, fontWeight: "700" }}>{translateCopy("veya", language)}</Text>
                      <View style={{ backgroundColor: colors.line, flex: 1, height: 1 }} />
                    </View>
                    <Pressable onPress={loginWithGoogle} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 12 }}>
                      <MaterialCommunityIcons name="google" size={17} color="#DB4437" />
                      <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Google ile devam et", language)}</Text>
                    </Pressable>
                    {googleNote}
                  </>
                ) : null}

                <Pressable onPress={() => setMode(mode === "login" ? "register" : "login")} style={{ alignItems: "center", paddingTop: 4 }}>
                  <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>{mode === "login" ? translateCopy("Hesabınız yok mu? ", language) : translateCopy("Zaten hesabınız var mı? ", language)}<Text style={{ color: colors.primaryDark, fontWeight: "900" }}>{mode === "login" ? translateCopy("Kayıt olun", language) : translateCopy("Giriş yapın", language)}</Text></Text>
                </Pressable>
              </View>
            </View>

            {/* Right: security panel */}
            <View style={{ flexBasis: 360, flexGrow: 1, gap: 14, minWidth: 0 }}>
              <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{translateCopy("Hesabınız güvende", language)}</Text>
              {security.map((s) => (
                <View key={s.title} style={{ alignItems: "flex-start", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 12, padding: 16 }}>
                  <View style={{ alignItems: "center", backgroundColor: s.tint, borderRadius: 10, height: 40, justifyContent: "center", width: 40 }}>
                    <MaterialCommunityIcons name={s.icon} size={20} color={s.color} />
                  </View>
                  <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                    <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "900" }}>{s.title}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{s.sub}</Text>
                  </View>
                </View>
              ))}
              <View style={{ alignItems: "flex-start", backgroundColor: colors.primarySoft, borderColor: colors.primary, borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 10, padding: 16 }}>
                <MaterialCommunityIcons name="check-decagram" size={22} color={colors.primaryDark} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "900" }}>{translateCopy("OrtakSat ile güvenli alışverişin keyfini çıkarın.", language)}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 17 }}>{translateCopy("Bilgileriniz bizim için değerlidir ve gizli tutulur.", language)}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Trust strip */}
          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 16, padding: 16 }}>
            <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 24, justifyContent: "center" }}>
              {strip.map((s) => (
                <View key={s.label} style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
                  <MaterialCommunityIcons name={s.icon} size={17} color={colors.primary} />
                  <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "700" }}>{s.label}</Text>
                </View>
              ))}
            </View>
            <View style={{ alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 10, paddingTop: 14 }}>
              <MaterialCommunityIcons name="bank-outline" size={20} color={colors.muted} />
              <Text style={{ color: colors.muted, flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 17 }}>{translateCopy("OrtakSat bir aracılık platformudur. Satıcı ile alıcıları bir araya getirir; ödemeleri tutmaz ve taraflar arasında gerçekleşen ürün/hizmet tesliminden veya komisyon ödemesinden sorumlu değildir.", language)}</Text>
              <Link href="/legal" asChild><Pressable><Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>{translateCopy("Detaylar →", language)}</Text></Pressable></Link>
            </View>
          </View>
        </View>

        <View style={{ marginTop: 20 }}><WebFooter /></View>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      {seoHead}
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 14, maxWidth: 720, marginHorizontal: "auto", padding: 16, paddingBottom: 90, width: "100%" }}>
        <Pressable onPress={() => { if (router.canGoBack()) router.back(); else router.replace("/"); }} style={{ alignItems: "center", alignSelf: "flex-start", borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 8 }}>
          <MaterialCommunityIcons name="arrow-left" size={16} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>{translateCopy("Ana sayfa", language)}</Text>
        </Pressable>
        {/* Marka logosu (jenerik handshake ikonu yerine) — giriş/kayıt/şifre ekranlarının başı. */}
        <View style={{ alignItems: "center", gap: 8, paddingVertical: 8 }}>
          <BrandMark size={56} />
          <Text style={{ color: colors.ink, fontSize: 22, fontWeight: "900" }}>{mode === "login" ? translateCopy("Giriş yap", language) : mode === "register" ? translateCopy("Hesap aç", language) : translateCopy("Şifre sıfırla", language)}</Text>
        </View>

        <Card>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <ModeButton active={mode === "login"} label="Giriş" onPress={() => setMode("login")} />
            <ModeButton active={mode === "register"} label="Kayıt" onPress={() => setMode("register")} />
            <ModeButton active={mode === "reset"} label="Şifre" onPress={() => setMode("reset")} />
          </View>

          {mode === "register" ? (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}><Field label="Ad" value={firstName} onChangeText={setFirstName} placeholder="Ayşe" /></View>
              <View style={{ flex: 1 }}><Field label="Soyad" value={lastName} onChangeText={setLastName} placeholder="Demir" /></View>
            </View>
          ) : null}
          <Field label="E-posta" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="ornek@eposta.com" />
          {mode !== "reset" ? <Field label="Şifre" value={password} onChangeText={setPassword} secureTextEntry placeholder={mode === "register" ? "Güçlü bir şifre oluştur" : "Şifreni gir"} toggleSecure secureVisible={showPassword} onToggleSecure={() => setShowPassword((v) => !v)} onSubmitEditing={mode === "login" ? login : undefined} passwordAutoComplete={mode === "register" ? "new-password" : "current-password"} /> : null}
          {mode === "register" && password.length > 0 ? <PasswordStrengthMeter password={password} /> : null}
          {mode === "register" ? (
            <>
              <Field label="Şifre Tekrar" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="Şifreni tekrar gir" secureVisible={showPassword} passwordAutoComplete="new-password" />
              {!passwordsMatch ? <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "700" }}>{translateCopy("Şifreler uyuşmuyor.", language)}</Text> : null}
            </>
          ) : null}
          {mode === "reset" && resetSent ? (
            <>
              <Field label="E-postana gelen 6 haneli kod" value={resetCode} onChangeText={(v) => setResetCode(v.replace(/\D/g, "").slice(0, 6))} placeholder="______" code onSubmitEditing={doResetWithCode} />
              <Field label="Yeni şifre" value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="Güçlü bir şifre oluştur" toggleSecure secureVisible={showPassword} onToggleSecure={() => setShowPassword((v) => !v)} passwordAutoComplete="new-password" />
              <PasswordStrengthMeter password={newPassword} />
            </>
          ) : null}

          {mode === "login" ? <View style={{ alignItems: "flex-start" }}>{rememberCheck}</View> : null}
          {mode === "register" ? legalChecks : null}
          {legalModal}

          {mode === "login" ? (
            <PrimaryButton onPress={login}>{loading ? "Giriş yapılıyor" : "E-posta ile giriş yap"}</PrimaryButton>
          ) : mode === "register" ? (
            <PrimaryButton onPress={register}>{loading ? "Kayıt açılıyor" : "Kayıt ol"}</PrimaryButton>
          ) : (
            <>
              {!resetSent ? (
                <PrimaryButton onPress={sendResetCode}>{loading ? "Gönderiliyor" : "Sıfırlama kodu gönder"}</PrimaryButton>
              ) : (
                <>
                  <PrimaryButton onPress={doResetWithCode}>{loading ? "Güncelleniyor" : "Kodu doğrula ve şifreyi güncelle"}</PrimaryButton>
                  <PrimaryButton tone="secondary" onPress={sendResetCode}>Kodu tekrar gönder</PrimaryButton>
                </>
              )}
            </>
          )}

          {mode !== "reset" ? (
            <>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                <View style={{ backgroundColor: colors.line, flex: 1, height: 1 }} />
                <Text style={{ color: colors.subtle, fontSize: 12, fontWeight: "700" }}>{translateCopy("veya", language)}</Text>
                <View style={{ backgroundColor: colors.line, flex: 1, height: 1 }} />
              </View>
              <Pressable onPress={loginWithGoogle} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 13 }}>
                <MaterialCommunityIcons name="google" size={18} color="#DB4437" />
                <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{translateCopy("Google ile devam et", language)}</Text>
              </Pressable>
              {googleNote}
            </>
          ) : null}

          {formError ? (
            <Text selectable style={{ color: colors.accent, fontSize: 13, fontWeight: "700", lineHeight: 19 }}>
              {formError}
            </Text>
          ) : null}
          {authError ? (
            <Text selectable style={{ color: colors.accent, fontSize: 13, lineHeight: 19 }}>
              {authError}
            </Text>
          ) : null}
        </Card>

        <View style={{ paddingHorizontal: 4, paddingTop: 4 }}>{legalFooter}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function DeskAuthField({ icon, label, value, onChangeText, placeholder, secure, showToggle, showPassword, onToggle, onSubmitEditing, autoComplete }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; secure?: boolean; showToggle?: boolean; showPassword?: boolean; onToggle?: () => void; onSubmitEditing?: () => void; autoComplete?: "email" | "name" | "password" | "password-new" | "off" }) {
  const isEmail = icon === "email-outline";
  const isCode = icon === "numeric"; // e-posta doğrulama / sıfırlama kodu alanı
  // Şifre yöneticileri (password manager) ve autofill için doğru name/autoComplete.
  const ac = autoComplete ?? (isEmail ? "email" : secure ? "password" : "off");
  const nameAttr = isCode ? "one-time-code" : isEmail ? "email" : ac === "password-new" ? "new-password" : secure ? "current-password" : "name";
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{label}</Text>
      <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 11, borderWidth: 1, flexDirection: "row", gap: 9, paddingHorizontal: 12 }}>
        <MaterialCommunityIcons name={icon} size={18} color={colors.muted} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          autoCapitalize={isEmail ? "none" : "sentences"}
          autoCorrect={false}
          keyboardType={isEmail ? "email-address" : isCode ? "number-pad" : "default"}
          autoComplete={isCode ? "sms-otp" : ac}
          textContentType={isCode ? "oneTimeCode" : isEmail ? "emailAddress" : ac === "password-new" ? "newPassword" : secure ? "password" : "name"}
          accessibilityLabel={label}
          maxLength={isCode ? 6 : undefined}
          {...({ name: nameAttr, "aria-label": label, inputMode: isEmail ? "email" : isCode ? "numeric" : undefined, autoComplete: isCode ? "one-time-code" : undefined, pattern: isCode ? "[0-9]*" : undefined } as Record<string, unknown>)}
          secureTextEntry={secure && !showPassword}
          placeholder={placeholder}
          placeholderTextColor={colors.subtle}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={onSubmitEditing ? "go" : "next"}
          style={{ color: colors.ink, flex: 1, fontSize: 14, minHeight: 48, paddingVertical: 10 }}
        />
        {showToggle ? (
          <Pressable onPress={onToggle} hitSlop={8}><MaterialCommunityIcons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={colors.muted} /></Pressable>
        ) : null}
      </View>
    </View>
  );
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
          autoCapitalize={isEmail ? "none" : "words"}
          autoCorrect={!isEmail && !code}
          autoComplete={code ? "sms-otp" : isEmail ? "email" : secureTextEntry ? (pwAc === "new-password" ? "password-new" : "password") : "off"}
          textContentType={code ? "oneTimeCode" : isEmail ? "emailAddress" : secureTextEntry ? (pwAc === "new-password" ? "newPassword" : "password") : "none"}
          accessibilityLabel={translateCopy(label, language)}
          maxLength={code ? 6 : undefined}
          {...({ name: code ? "one-time-code" : isEmail ? "email" : secureTextEntry ? pwAc : "text", "aria-label": translateCopy(label, language), inputMode: isEmail ? "email" : code ? "numeric" : undefined, autoComplete: code ? "one-time-code" : undefined, pattern: code ? "[0-9]*" : undefined } as Record<string, unknown>)}
          secureTextEntry={hidden}
          placeholder={placeholder ? translateCopy(placeholder, language) : undefined}
          placeholderTextColor={colors.muted}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={onSubmitEditing ? "go" : "done"}
          style={{ color: colors.ink, flex: 1, fontSize: 16, minHeight: 50, padding: 14 }}
        />
        {toggleSecure ? (
          <Pressable onPress={onToggleSecure} hitSlop={10} accessibilityRole="button" accessibilityLabel={secureVisible ? translateCopy("Şifreyi gizle", language) : translateCopy("Şifreyi göster", language)} style={{ paddingHorizontal: 14 }}>
            <MaterialCommunityIcons name={secureVisible ? "eye-off-outline" : "eye-outline"} size={20} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function ModeButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const { language } = useLanguage();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: active ? colors.primary : colors.surfaceAlt,
        borderColor: active ? colors.primary : colors.line,
        borderRadius: 999,
        borderWidth: 1,
        flex: 1,
        justifyContent: "center",
        minHeight: 40,
        opacity: pressed ? 0.72 : 1,
        paddingHorizontal: 10
      })}
    >
      <Text adjustsFontSizeToFit numberOfLines={1} selectable style={{ color: active ? "#FFFFFF" : colors.ink, fontSize: 13, fontWeight: "900" }}>
        {translateCopy(label, language)}
      </Text>
    </Pressable>
  );
}


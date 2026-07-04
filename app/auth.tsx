import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Link } from "expo-router";

import { colors } from "@/components/colors";
import { Card, PrimaryButton, SectionTitle, StatusPill } from "@/components/ui";
import { WebFooter } from "@/components/web-landing";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useIsWideWeb } from "@/lib/layout";
import { hasSeenWelcome, markWelcomeSeen } from "@/lib/onboarding";
import { useStore } from "@/lib/use-store";

type AuthMode = "login" | "register" | "reset";

export default function AuthScreen() {
  const { language } = useLanguage();
  const router = useRouter();
  const { authError, currentUser, isAuthenticated, resetPasswordWithEmail, signInWithEmail, signInWithGoogle, signUpWithEmail, updatePasswordWithEmail } = useStore();
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [loading, setLoading] = useState(false);
  const isWideWeb = useIsWideWeb();
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const cleanEmail = email.trim().toLocaleLowerCase("tr-TR");

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
      // yut — aşağıda ana sayfaya düşer
    }
    router.replace("/");
  }, [isAuthenticated, currentUser, router]);

  async function loginWithGoogle() {
    // Google ilk kullanımda hesap oluşturabildiği için yasal onay zorunlu.
    if (!acceptedLegal) {
      setMode("register");
      Alert.alert(
        language === "en" ? "Legal approval required" : "Yasal onay gerekli",
        language === "en" ? "Please tick the box to accept KVKK, privacy and terms before continuing with Google." : "Google ile devam etmeden önce KVKK, gizlilik ve kullanım şartlarını kabul kutucuğunu işaretle."
      );
      return;
    }
    setLoading(true);
    const ok = await signInWithGoogle();
    setLoading(false);
    // Başarılıysa tarayıcı Google'a yönlenir (geri dönüş otomatik). Başarısızsa hata authError'da.
    if (!ok && authError) {
      Alert.alert(language === "en" ? "Could not continue with Google" : "Google ile giriş yapılamadı", translateCopy(authError, language));
    }
  }

  async function login() {
    if (!cleanEmail || password.length < 6) {
      Alert.alert(language === "en" ? "Missing information" : "Eksik bilgi", language === "en" ? "Email and a password of at least 6 characters are required." : "E-posta ve en az 6 karakter şifre gerekli.");
      return;
    }

    setLoading(true);
    const ok = await signInWithEmail(cleanEmail, password);
    setLoading(false);
    // Başarılıysa yukarıdaki effect ana sayfaya yönlendirir. Hata varsa göster.
    if (!ok && authError) {
      Alert.alert(language === "en" ? "Could not sign in" : "Giriş yapılamadı", translateCopy(authError, language));
    }
  }

  async function register() {
    if (!name.trim() || !cleanEmail || password.length < 6) {
      Alert.alert(language === "en" ? "Missing information" : "Eksik bilgi", language === "en" ? "Full name, email, and a password of at least 6 characters are required." : "Ad soyad, e-posta ve en az 6 karakter şifre gerekli.");
      return;
    }
    if (!acceptedLegal) {
      Alert.alert(language === "en" ? "Legal approval required" : "Yasal onay gerekli", language === "en" ? "You must accept KVKK, privacy, terms of use, and seller/partner rules." : "KVKK, gizlilik, kullanım şartları ve satıcı/ortak kurallarını kabul etmelisin.");
      return;
    }

    setLoading(true);
    const ok = await signUpWithEmail({ email: cleanEmail, password, name });
    setLoading(false);
    if (ok) {
      Alert.alert(
        language === "en" ? "Registration received" : "Kayıt alındı",
        language === "en" ? "If Supabase email verification is enabled, confirm the link in your inbox. If disabled, your account can be used immediately." : "Supabase e-posta doğrulama açıksa gelen kutundaki bağlantıyı onayla. Doğrulama kapalıysa hesabın hemen kullanılabilir."
      );
      setMode("login");
    }
  }

  async function resetPassword() {
    if (!cleanEmail) {
      Alert.alert(language === "en" ? "Email required" : "E-posta gerekli", language === "en" ? "Enter your email address to receive a password reset link." : "Şifre sıfırlama bağlantısı göndermek için e-posta adresini yaz.");
      return;
    }

    setLoading(true);
    const ok = await resetPasswordWithEmail(cleanEmail);
    setLoading(false);
    Alert.alert(
      ok ? (language === "en" ? "Email sent" : "E-posta gönderildi") : (language === "en" ? "Could not send" : "Gönderilemedi"),
      ok ? (language === "en" ? "Password reset link was sent to your email address." : "Şifre sıfırlama bağlantısı e-posta adresine gönderildi.") : authError ?? (language === "en" ? "Please try again." : "Lütfen tekrar dene.")
    );
  }

  async function updatePassword() {
    if (newPassword.length < 6) {
      Alert.alert(language === "en" ? "Password missing" : "Şifre eksik", language === "en" ? "New password must be at least 6 characters." : "Yeni şifre en az 6 karakter olmalı.");
      return;
    }

    setLoading(true);
    const ok = await updatePasswordWithEmail(newPassword);
    setLoading(false);
    Alert.alert(
      ok ? (language === "en" ? "Password updated" : "Şifre güncellendi") : (language === "en" ? "Could not update" : "Güncellenemedi"),
      ok ? (language === "en" ? "Your new password was saved. You can now sign in with email and the new password." : "Yeni şifren kaydedildi. Bundan sonra e-posta ve yeni şifrenle giriş yapabilirsin.") : authError ?? (language === "en" ? "Make sure you opened the reset link from the app." : "Sıfırlama bağlantısını uygulamadan açtığından emin ol.")
    );
    if (ok) setMode("login");
  }

  if (isWideWeb) {
    const tabs: Array<{ key: AuthMode; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string }> = [
      { key: "login", icon: "login", label: "Giriş Yap" },
      { key: "register", icon: "account-plus-outline", label: "Kayıt Ol" },
      { key: "reset", icon: "lock-reset", label: "Şifremi Unuttum" }
    ];
    const security: Array<{ icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; sub: string; tint: string; color: string }> = [
      { icon: "email-check-outline", title: "E-posta doğrulama", sub: "Hesabınızı doğrulayan güvenli e-posta doğrulama sistemi.", tint: colors.infoSoft, color: colors.info },
      { icon: "shield-alert-outline", title: "Dolandırıcılık koruması", sub: "Şüpheli işlem tespiti ve yapay zekâ destekli koruma mekanizmaları.", tint: colors.successSoft, color: colors.success },
      { icon: "lock-outline", title: "Güvenli oturum", sub: "Tüm oturumlarınız şifrelenir ve düzenli olarak izlenir.", tint: colors.violetSoft, color: colors.violet },
      { icon: "history", title: "Oturum ve etkinlik takibi", sub: "Hesabınızdaki tüm hareketleri görüntüleyin ve kontrol edin.", tint: colors.goldSoft, color: colors.gold },
      { icon: "headset", title: "Destek her zaman yanınızda", sub: "Sorularınız için 7/24 destek ekibimiz hizmetinizde.", tint: colors.accentSoft, color: colors.accent }
    ];
    const strip: Array<{ icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string }> = [
      { icon: "lock-check", label: "256-Bit SSL ile korunur" },
      { icon: "database-check", label: "Güvenli veri altyapısı" },
      { icon: "shield-account", label: "KVKK uyumlu" },
      { icon: "map-marker-check", label: "Türkiye'de barındırılır" }
    ];

    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, paddingBottom: 0 }} style={{ backgroundColor: colors.background }}>
        <View style={{ gap: 16, marginHorizontal: "auto", maxWidth: 1100, paddingHorizontal: 20, paddingTop: 24, width: "100%" }}>
          {/* Dedicated auth top bar (site nav gizli) */}
          <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
            <Link href="/" asChild>
              <Pressable style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 10, height: 36, justifyContent: "center", width: 36 }}>
                  <MaterialCommunityIcons name="handshake" size={20} color={colors.primaryDark} />
                </View>
                <Text style={{ color: colors.primaryDark, fontSize: 18, fontWeight: "900" }}>ortaksat</Text>
              </Pressable>
            </Link>
            <Link href="/" asChild>
              <Pressable style={{ alignItems: "center", borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 8 }}>
                <MaterialCommunityIcons name="arrow-left" size={16} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>Ana sayfa</Text>
              </Pressable>
            </Link>
          </View>
          {/* Branded hero */}
          <View style={{ backgroundColor: colors.primaryDark, borderRadius: 20, flexDirection: "row", gap: 18, overflow: "hidden", paddingHorizontal: 28, paddingVertical: 24 }}>
            <View style={{ flex: 1, gap: 8, justifyContent: "center", minWidth: 0 }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                <View style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.16)", borderRadius: 12, height: 44, justifyContent: "center", width: 44 }}>
                  <MaterialCommunityIcons name="handshake" size={24} color="#FFFFFF" />
                </View>
                <Text style={{ color: "#FFFFFF", fontSize: 24, fontWeight: "900" }}>OrtakSat'a hoş geldin</Text>
              </View>
              <Text style={{ color: "rgba(255,255,255,0.88)", fontSize: 14.5, fontWeight: "600", lineHeight: 21, maxWidth: 560 }}>Ücretsiz hesap aç; ilan ver, ortak satışla kazan, alıcılarla güvenle iletişim kur. Gezmek için giriş gerekmez — hesabını sadece işlem yaparken kullanırsın.</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                {[
                  { i: "check-decagram" as const, t: "Ücretsiz üyelik" },
                  { i: "shield-lock" as const, t: "Güvenli giriş" },
                  { i: "account-check" as const, t: "Doğrulanmış satıcılar" }
                ].map((b) => (
                  <View key={b.t} style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999, flexDirection: "row", gap: 6, paddingHorizontal: 11, paddingVertical: 6 }}>
                    <MaterialCommunityIcons name={b.i} size={14} color="#FFFFFF" />
                    <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "800" }}>{b.t}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={{ alignItems: "center", justifyContent: "center", width: 96 }}>
              <View style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 999, height: 84, justifyContent: "center", width: 84 }}>
                <MaterialCommunityIcons name="account-circle-outline" size={48} color="#FFFFFF" />
              </View>
            </View>
          </View>

          <View style={{ alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: 20 }}>
            {/* Left: auth card */}
            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 18, borderWidth: 1, flexBasis: 420, flexGrow: 1, minWidth: 0, padding: 26 }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 12, marginBottom: 16 }}>
                <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 12, height: 48, justifyContent: "center", width: 48 }}>
                  <MaterialCommunityIcons name="shield-account" size={26} color={colors.primaryDark} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>Güvenli hesap erişimi</Text>
                  <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 17 }}>Hesabınıza güvenli bir şekilde giriş yapın. E-posta doğrulama, şifreleme ve gelişmiş koruma sistemlerimizle güvendesiniz.</Text>
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
                {mode === "register" ? <DeskAuthField icon="account-outline" label="Ad Soyad" value={name} onChangeText={setName} placeholder="Örn. Ayşe Demir" /> : null}
                <DeskAuthField icon="email-outline" label="E-posta" value={email} onChangeText={setEmail} placeholder="ornek@eposta.com" />
                {mode !== "reset" ? <DeskAuthField icon="lock-outline" label="Şifre" value={password} onChangeText={setPassword} placeholder="En az 6 karakter" secure showToggle showPassword={showPassword} onToggle={() => setShowPassword((v) => !v)} /> : null}
                {mode === "reset" ? <DeskAuthField icon="lock-reset" label="Yeni şifre" value={newPassword} onChangeText={setNewPassword} placeholder="Bağlantıdan geldikten sonra yeni şifre" secure /> : null}

                {mode === "login" ? (
                  <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
                    <Pressable onPress={() => setRemember((v) => !v)} style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
                      <MaterialCommunityIcons name={remember ? "checkbox-marked" : "checkbox-blank-outline"} size={19} color={remember ? colors.primary : colors.muted} />
                      <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "700" }}>Beni hatırla</Text>
                    </Pressable>
                    <Pressable onPress={() => setMode("reset")}><Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>Şifremi unuttunuz?</Text></Pressable>
                  </View>
                ) : null}

                {mode === "register" ? (
                  <Pressable onPress={() => setAcceptedLegal((v) => !v)} style={{ alignItems: "flex-start", flexDirection: "row", gap: 9 }}>
                    <MaterialCommunityIcons name={acceptedLegal ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"} size={20} color={acceptedLegal ? colors.primary : colors.muted} style={{ marginTop: 1 }} />
                    <Text style={{ color: colors.muted, flex: 1, fontSize: 11.5, fontWeight: "600", lineHeight: 17 }}>KVKK aydınlatması, gizlilik politikası ve kullanım şartlarını okudum. Ortaksat'ın aracı bir ilan/iletişim platformu olduğunu; ödeme almadığını, para tutmadığını, komisyon kesmediğini, kargo/teslimat yapmadığını; tüm alışveriş, ödeme ve teslimatın taraflar arasında, kendi sorumluluklarında yapıldığını ve Ortaksat'ın bu işlemlerin tarafı olmadığını kabul ediyorum.</Text>
                  </Pressable>
                ) : null}

                {mode === "login" ? (
                  <Pressable onPress={login} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 12, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 14 }}>
                    <MaterialCommunityIcons name="lock-outline" size={17} color="#FFFFFF" />
                    <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>{loading ? "Giriş yapılıyor…" : "Giriş Yap"}</Text>
                  </Pressable>
                ) : mode === "register" ? (
                  <Pressable onPress={register} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 12, justifyContent: "center", paddingVertical: 14 }}>
                    <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>{loading ? "Kayıt açılıyor…" : "Kayıt Ol"}</Text>
                  </Pressable>
                ) : (
                  <View style={{ gap: 10 }}>
                    <Pressable onPress={resetPassword} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 12, justifyContent: "center", paddingVertical: 14 }}>
                      <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>{loading ? "Gönderiliyor…" : "Sıfırlama e-postası gönder"}</Text>
                    </Pressable>
                    <Pressable onPress={updatePassword} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 12, borderWidth: 1, justifyContent: "center", paddingVertical: 13 }}>
                      <Text style={{ color: colors.primaryDark, fontSize: 13.5, fontWeight: "800" }}>Bağlantıdan geldim, yeni şifreyi kaydet</Text>
                    </Pressable>
                  </View>
                )}

                {authError ? <Text style={{ color: colors.accent, fontSize: 12.5, fontWeight: "600" }}>{authError}</Text> : null}

                {mode !== "reset" ? (
                  <>
                    <View style={{ alignItems: "center", flexDirection: "row", gap: 12, marginVertical: 2 }}>
                      <View style={{ backgroundColor: colors.line, flex: 1, height: 1 }} />
                      <Text style={{ color: colors.subtle, fontSize: 12, fontWeight: "700" }}>veya</Text>
                      <View style={{ backgroundColor: colors.line, flex: 1, height: 1 }} />
                    </View>
                    <Pressable onPress={loginWithGoogle} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 12 }}>
                      <MaterialCommunityIcons name="google" size={17} color="#DB4437" />
                      <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>Google ile devam et</Text>
                    </Pressable>
                  </>
                ) : null}

                <Pressable onPress={() => setMode(mode === "login" ? "register" : "login")} style={{ alignItems: "center", paddingTop: 4 }}>
                  <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>{mode === "login" ? "Hesabınız yok mu? " : "Zaten hesabınız var mı? "}<Text style={{ color: colors.primaryDark, fontWeight: "900" }}>{mode === "login" ? "Kayıt olun" : "Giriş yapın"}</Text></Text>
                </Pressable>
              </View>
            </View>

            {/* Right: security panel */}
            <View style={{ flexBasis: 360, flexGrow: 1, gap: 14, minWidth: 0 }}>
              <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>Hesabınız güvende</Text>
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
                  <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "900" }}>OrtakSat ile güvenli alışverişin keyfini çıkarın.</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 17 }}>Bilgileriniz bizim için değerlidir ve gizli tutulur.</Text>
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
              <Text style={{ color: colors.muted, flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 17 }}>OrtakSat bir aracılık platformudur. Satıcı ile alıcıları bir araya getirir; ödemeleri tutmaz ve taraflar arasında gerçekleşen ürün/hizmet tesliminden veya komisyon ödemesinden sorumlu değildir.</Text>
              <Link href="/legal" asChild><Pressable><Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>Detaylar →</Text></Pressable></Link>
            </View>
          </View>
        </View>

        <View style={{ marginTop: 20 }}><WebFooter /></View>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 14, maxWidth: 720, marginHorizontal: "auto", padding: 16, paddingBottom: 90, width: "100%" }}>
        <Pressable onPress={() => { if (router.canGoBack()) router.back(); else router.replace("/"); }} style={{ alignItems: "center", alignSelf: "flex-start", borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 8 }}>
          <MaterialCommunityIcons name="arrow-left" size={16} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>Ana sayfa</Text>
        </Pressable>
        <Card>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <StatusPill label="E-posta altyapısı" tone="success" />
            <StatusPill label="İlk sürüm" tone="info" />
          </View>
          <Text selectable style={{ color: colors.ink, fontSize: 25, fontWeight: "900", lineHeight: 31 }}>
            {language === "en" ? "Secure account sign-in" : "Güvenli hesap girişi"}
          </Text>
          <Text selectable style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
            {language === "en" ? "For the MVP, registration, sign-in, email verification, and password reset run on secure email infrastructure. Phone verification is left for the next trust phase." : "Başlangıçta kayıt, giriş, e-posta doğrulama ve şifre sıfırlama güvenli e-posta altyapısıyla çalışır. Telefon doğrulama sonraki güven fazına bırakıldı."}
          </Text>
        </Card>

        <Card>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <ModeButton active={mode === "login"} label="Giriş" onPress={() => setMode("login")} />
            <ModeButton active={mode === "register"} label="Kayıt" onPress={() => setMode("register")} />
            <ModeButton active={mode === "reset"} label="Şifre" onPress={() => setMode("reset")} />
          </View>

          <SectionTitle title={mode === "login" ? "Hesabına gir" : mode === "register" ? "Yeni hesap aç" : "Şifre sıfırla"} />

          {mode === "register" ? <Field label="Ad Soyad" value={name} onChangeText={setName} placeholder="Örn. Ayşe Demir" /> : null}
          <Field label="E-posta" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="ornek@eposta.com" />
          {mode !== "reset" ? <Field label="Şifre" value={password} onChangeText={setPassword} secureTextEntry placeholder="En az 6 karakter" /> : null}
          {mode === "reset" ? <Field label="Yeni şifre" value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="Bağlantıdan geldikten sonra yeni şifre" /> : null}

          {mode === "register" ? (
            <Pressable
              onPress={() => setAcceptedLegal((value) => !value)}
              style={({ pressed }) => ({
                alignItems: "flex-start",
                flexDirection: "row",
                gap: 10,
                opacity: pressed ? 0.72 : 1
              })}
            >
              <MaterialCommunityIcons
                name={acceptedLegal ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"}
                size={22}
                color={acceptedLegal ? colors.primary : colors.muted}
              />
              <Text selectable style={{ color: colors.muted, flex: 1, fontSize: 12, lineHeight: 18 }}>
                {language === "en" ? "I have read KVKK notice, privacy policy, terms of use, and seller/partner rules; I accept that Ortaksat is not a party to the sale, but an intermediary listing and tracking platform." : "KVKK aydınlatmasını, gizlilik politikasını, kullanım şartlarını ve satıcı/ortak kurallarını okudum; Ortaksat'ın satışın tarafı değil aracı ilan ve takip platformu olduğunu kabul ediyorum."}
              </Text>
            </Pressable>
          ) : null}

          {mode === "login" ? (
            <PrimaryButton onPress={login}>{loading ? "Giriş yapılıyor" : "E-posta ile giriş yap"}</PrimaryButton>
          ) : mode === "register" ? (
            <PrimaryButton onPress={register}>{loading ? "Kayıt açılıyor" : "Kayıt ol"}</PrimaryButton>
          ) : (
            <>
              <PrimaryButton onPress={resetPassword}>{loading ? "Gönderiliyor" : "Şifre sıfırlama e-postası gönder"}</PrimaryButton>
              <PrimaryButton tone="secondary" onPress={updatePassword}>{loading ? "Kaydediliyor" : "Bağlantıdan geldim, yeni şifreyi kaydet"}</PrimaryButton>
            </>
          )}

          {mode !== "reset" ? (
            <>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                <View style={{ backgroundColor: colors.line, flex: 1, height: 1 }} />
                <Text style={{ color: colors.subtle, fontSize: 12, fontWeight: "700" }}>veya</Text>
                <View style={{ backgroundColor: colors.line, flex: 1, height: 1 }} />
              </View>
              <Pressable onPress={loginWithGoogle} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 13 }}>
                <MaterialCommunityIcons name="google" size={18} color="#DB4437" />
                <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>Google ile devam et</Text>
              </Pressable>
            </>
          ) : null}

          {authError ? (
            <Text selectable style={{ color: colors.accent, fontSize: 13, lineHeight: 19 }}>
              {authError}
            </Text>
          ) : null}
        </Card>

        <Card>
          <SectionTitle title="Hukuki çerçeve" />
          <MiniRule icon="store-search" text={language === "en" ? "Ortaksat does not own products; it provides listing, partnership application, message, and commission tracking infrastructure." : "Ortaksat ürün sahibi değildir; ilan, ortaklık başvurusu, mesaj ve komisyon takip altyapısı sağlar."} />
          <MiniRule icon="account-cash" text={language === "en" ? "Commission payment is handled outside the app between parties in the first version; the app keeps records and confirmations." : "Komisyon ödemesi ilk sürümde taraflar arasında uygulama dışında yapılır; uygulama kayıt ve teyit tutar."} />
          <MiniRule icon="shield-alert" text={language === "en" ? "Misleading listings, fake products, spam sharing, and fraud reports enter moderation." : "Yanıltıcı ilan, sahte ürün, spam paylaşım ve dolandırıcılık şikayetleri moderasyon sürecine alınır."} />
          <PrimaryButton href="/legal" tone="soft">Yasal ve destek merkezini aç</PrimaryButton>
        </Card>

        <Card>
          <SectionTitle title="Geçerli oturum" />
          <Text selectable style={{ color: colors.ink, fontSize: 15, fontWeight: "800" }}>
            {currentUser.name}
          </Text>
          <Text selectable style={{ color: colors.muted, fontSize: 13 }}>
            {currentUser.phone || (language === "en" ? "Email account / preview user" : "E-posta hesabı / ön izleme kullanıcısı")}
          </Text>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function DeskAuthField({ icon, label, value, onChangeText, placeholder, secure, showToggle, showPassword, onToggle }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; secure?: boolean; showToggle?: boolean; showPassword?: boolean; onToggle?: () => void }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{label}</Text>
      <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 11, borderWidth: 1, flexDirection: "row", gap: 9, paddingHorizontal: 12 }}>
        <MaterialCommunityIcons name={icon} size={18} color={colors.muted} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          autoCapitalize={icon === "email-outline" ? "none" : "sentences"}
          autoCorrect={false}
          secureTextEntry={secure && !showPassword}
          placeholder={placeholder}
          placeholderTextColor={colors.subtle}
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
  secureTextEntry
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address";
  secureTextEntry?: boolean;
}) {
  const { language } = useLanguage();
  return (
    <View style={{ gap: 6 }}>
      <Text selectable style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>
        {translateCopy(label, language)}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === "email-address" ? "none" : "words"}
        autoCorrect={keyboardType !== "email-address"}
        secureTextEntry={secureTextEntry}
        placeholder={placeholder ? translateCopy(placeholder, language) : undefined}
        placeholderTextColor={colors.muted}
        returnKeyType="done"
        style={{
          backgroundColor: "#FAFBFC",
          borderColor: colors.line,
          borderRadius: 12,
          borderWidth: 1,
          color: colors.ink,
          fontSize: 16,
          minHeight: 50,
          padding: 14
        }}
      />
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

function MiniRule({ icon, text }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; text: string }) {
  return (
    <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 10 }}>
      <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
      <Text selectable style={{ color: colors.muted, flex: 1, fontSize: 13, lineHeight: 19 }}>
        {text}
      </Text>
    </View>
  );
}

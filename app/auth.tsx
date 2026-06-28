import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { Card, PrimaryButton, SectionTitle, StatusPill } from "@/components/ui";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useStore } from "@/lib/use-store";

type AuthMode = "login" | "register" | "reset";

export default function AuthScreen() {
  const { language } = useLanguage();
  const router = useRouter();
  const { authError, currentUser, resetPasswordWithEmail, signInWithEmail, signUpWithEmail, updatePasswordWithEmail } = useStore();
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [loading, setLoading] = useState(false);

  const cleanEmail = email.trim().toLocaleLowerCase("tr-TR");

  async function login() {
    if (!cleanEmail || password.length < 6) {
      Alert.alert(language === "en" ? "Missing information" : "Eksik bilgi", language === "en" ? "Email and a password of at least 6 characters are required." : "E-posta ve en az 6 karakter şifre gerekli.");
      return;
    }

    setLoading(true);
    const ok = await signInWithEmail(cleanEmail, password);
    setLoading(false);
    if (ok) {
      Alert.alert(language === "en" ? "Signed in" : "Giriş tamam", language === "en" ? "Your live Ortaksat account is active." : "Canlı Ortaksat hesabın aktif.");
      router.replace("/profile");
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

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 14, padding: 16, paddingBottom: 90 }}>
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

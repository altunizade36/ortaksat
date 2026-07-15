import { MaterialCommunityIcons } from "@/components/icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Alert } from "@/lib/alert";

import { colors } from "@/components/colors";
import { AuthRequired } from "@/components/auth-gate";
import { PasswordStrengthMeter } from "@/components/password-strength-meter";
import { Card, PrimaryButton, SectionTitle, StatusPill } from "@/components/ui";
import { WebFooter } from "@/components/web-landing";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useIsWideWeb, useMounted } from "@/lib/layout";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import { changePasswordLive, reauthenticateLive, uploadProfileAvatar } from "@/lib/live-service";
import { actionLabel, fetchLoginHistory, type LoginEvent } from "@/lib/security-history";
import { useStore } from "@/lib/use-store";
import { passwordStrength } from "@/lib/validation";

type SettingsSection = "personal" | "security" | "notifications" | "store" | "verification";

function isImageAvatar(value: string) {
  return value.startsWith("http") || value.startsWith("file");
}

function ProfileEditScreenInner() {
  const { language } = useLanguage();
  const router = useRouter();
  const { authError, backendMode, currentUser, updateProfile, savePreferences, requestAccountDeletion, requestVerification, signOut, signOutAllDevices } = useStore();
  const prefs0 = currentUser.preferences ?? {};
  const isLiveAccount = backendMode === "supabase" && currentUser.id.includes("-");
  const [name, setName] = useState(currentUser.name);
  const [phone, setPhone] = useState(currentUser.phone);
  const [avatar, setAvatar] = useState(currentUser.avatar);
  const [bio, setBio] = useState(currentUser.bio);
  const [saving, setSaving] = useState(false);
  const isWideWeb = useIsWideWeb();
  const [section, setSection] = useState<SettingsSection>("personal");
  const [storeName, setStoreName] = useState(currentUser.name);
  const [iban, setIban] = useState((prefs0.iban as string) ?? "");
  // Şifre değiştir (mevcut şifre + yeni + tekrar). Güvenlik: Supabase mevcut
  // şifreyi ister; ayrıca web'de Alert no-op olduğu için satır-içi mesaj gösteririz.
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwNew2, setPwNew2] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [storeSaving, setStoreSaving] = useState(false);
  // Güvenlik: giriş/oturum geçmişi + tüm cihazlardan çıkış
  const [loginHistory, setLoginHistory] = useState<LoginEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!isLiveAccount) return;
    setHistoryLoading(true);
    const rows = await fetchLoginHistory(currentUser.id);
    setLoginHistory(rows);
    setHistoryLoading(false);
  }, [isLiveAccount, currentUser.id]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  async function signOutEverywhere() {
    if (signingOutAll) return;
    setSigningOutAll(true);
    const ok = await signOutAllDevices();
    setSigningOutAll(false);
    if (ok) { Alert.alert(translateCopy("Tüm cihazlardan çıkıldı", language), translateCopy("Tüm oturumların kapatıldı. Tekrar giriş yapman gerekir.", language)); router.replace("/auth"); }
    else Alert.alert(translateCopy("İşlem tamamlanamadı", language), translateCopy("Oturumlar kapatılamadı, tekrar dene.", language));
  }

  async function changePassword() {
    setPwMsg(null);
    if (!pwCurrent) { const t = translateCopy("Mevcut şifreni gir.", language); setPwMsg({ tone: "err", text: t }); Alert.alert(translateCopy("Mevcut şifre gerekli", language), t); return; }
    const s = passwordStrength(pwNew);
    if (!s.ok) { const miss = s.checks.filter((c) => !c.ok).map((c) => c.label.toLocaleLowerCase("tr-TR")).join(", "); const t = `Yeni şifre yeterince güçlü değil. Ekle: ${miss}.`; setPwMsg({ tone: "err", text: t }); Alert.alert(translateCopy("Şifre yeterince güçlü değil", language), t); return; }
    if (pwNew !== pwNew2) { const t = translateCopy("Yeni şifre ile tekrarı aynı olmalı.", language); setPwMsg({ tone: "err", text: t }); Alert.alert(translateCopy("Şifreler uyuşmuyor", language), t); return; }
    if (pwNew === pwCurrent) { const t = translateCopy("Yeni şifre mevcut şifreden farklı olmalı.", language); setPwMsg({ tone: "err", text: t }); Alert.alert(translateCopy("Aynı şifre", language), t); return; }
    if (!isLiveAccount) { const t = translateCopy("Şifre değişikliği yalnızca canlı hesaplarda geçerlidir.", language); setPwMsg({ tone: "err", text: t }); Alert.alert(translateCopy("Ön izleme hesabı", language), t); return; }
    setPwSaving(true);
    const res = await changePasswordLive(pwNew, pwCurrent);
    setPwSaving(false);
    if (!res.ok) { const t = res.error ?? translateCopy("Şifre güncellenemedi.", language); setPwMsg({ tone: "err", text: t }); Alert.alert(translateCopy("Güncellenemedi", language), t); return; }
    setPwCurrent(""); setPwNew(""); setPwNew2("");
    setPwMsg({ tone: "ok", text: translateCopy("Şifren güncellendi. Bir sonraki girişte yeni şifreni kullan.", language) });
    Alert.alert(translateCopy("Şifre güncellendi", language), translateCopy("Yeni şifren kaydedildi. Bir sonraki girişte bunu kullan.", language));
  }

  async function saveStore() {
    setStoreSaving(true);
    // IBAN profiles kolonunda tutulmaz; preferences JSON'a kalıcı yazılır (komisyon
    // ödeme bilgisi). Önceden yalnız lokal state'teydi ve kaydedilmiyordu.
    const ibanClean = iban.replace(/\s+/g, "").toLocaleUpperCase("tr-TR");
    await savePreferences({ iban: ibanClean });
    const ok = await updateProfile({ name: storeName.trim() || name, phone, avatar, bio });
    setStoreSaving(false);
    Alert.alert(ok ? translateCopy("Kaydedildi", language) : translateCopy("Kaydedilemedi", language), ok ? translateCopy("Mağaza bilgilerin güncellendi.", language) : (authError ?? translateCopy("Bir sorun oluştu.", language)));
  }

  function startVerification(label: string) {
    // Talep notu (staff-görünür report.details): HANGİ doğrulamaların beklediğini + telefonu
    // + kullanıcıyı yaz — eskiden argümansız gönderiliyordu, ekip neyi doğrulayacağını bilmiyordu.
    const pending = [
      !currentUser.verifiedPhone ? "telefon" : null,
      !currentUser.verifiedIdentity ? "kimlik" : null,
      !currentUser.verifiedInstagram ? "Instagram" : null
    ].filter(Boolean).join(", ");
    const note = `Bekleyen doğrulama(lar): ${pending || "genel"}. Telefon: ${currentUser.phone || "—"}. Kullanıcı: ${currentUser.name} (${currentUser.id}).`;
    Alert.alert(
      label,
      translateCopy("Doğrulama, güvenlik gereği ekibimizce yapılır. Talebini şimdi gönder — kimlik/telefon bilgin incelenip uygun bulunursa hesabın doğrulanır. Ek belge gerekirse iletişime geçeriz.", language),
      [
        { text: translateCopy("Kapat", language), style: "cancel" },
        { text: translateCopy("Talebi gönder", language), onPress: () => { void (async () => {
          const ok = await requestVerification(note);
          Alert.alert(
            translateCopy(ok ? "Doğrulama talebin alındı" : "Gönderilemedi", language),
            translateCopy(ok ? "Ekibimiz en kısa sürede inceleyecek. Ek belge gerekirse iletişim üzerinden ulaşırız." : "Lütfen tekrar dene ya da iletişim sayfasından yaz.", language),
            ok ? [{ text: translateCopy("Tamam", language) }, { text: translateCopy("İletişime geç", language), onPress: () => router.push("/iletisim") }] : undefined
          );
        })(); } }
      ]
    );
  }

  // Hesap silme: şifre doğrulaması + 30 gün geri alma bilgisi (soft-delete).
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePw, setDeletePw] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);

  function closeAccount() {
    if (!isLiveAccount) {
      Alert.alert(translateCopy("Ön izleme hesabı", language), translateCopy("Hesap silme yalnızca canlı hesaplarda geçerlidir.", language));
      return;
    }
    setDeletePw("");
    setDeleteReason("");
    setDeleteOpen(true);
  }

  async function confirmDeleteAccount() {
    if (deleting) return;
    if (deletePw.length < 1) { Alert.alert(translateCopy("Şifre gerekli", language), translateCopy("Devam etmek için şifreni gir.", language)); return; }
    setDeleting(true);
    const verified = await reauthenticateLive(deletePw);
    if (!verified) {
      setDeleting(false);
      Alert.alert(translateCopy("Şifre doğrulanamadı", language), translateCopy("Girdiğin şifre hatalı. Hesap silme işlemi güvenlik için iptal edildi.", language));
      return;
    }
    const ok = await requestAccountDeletion(deleteReason.trim() || "Kullanıcı ayarlar ekranından hesap silme talebi oluşturdu.");
    setDeleting(false);
    setDeleteOpen(false);
    if (ok) {
      Alert.alert(
        translateCopy("Hesap silme talebin alındı", language),
        translateCopy("Hesabın 30 gün boyunca askıya alınır; bu süre içinde giriş yaparsan talebini iptal edip hesabını geri alabilirsin. 30 gün sonunda hesabın ve ilişkili verilerin kalıcı olarak silinir.", language),
        [{ text: translateCopy("Anladım", language), onPress: () => void signOut() }]
      );
    } else {
      Alert.alert(translateCopy("Oluşturulamadı", language), authError ?? translateCopy("Talep oluşturulamadı, lütfen tekrar dene.", language));
    }
  }

  async function pickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(translateCopy("İzin gerekli", language), translateCopy("Profil fotoğrafı seçmek için galeri izni vermelisin.", language));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ["images"],
      quality: 0.82
    });

    if (!result.canceled && result.assets[0]?.uri) setAvatar(result.assets[0].uri);
  }

  async function submit() {
    if (!name.trim()) {
      Alert.alert(translateCopy("Ad gerekli", language), translateCopy("Profil adını boş bırakamazsın.", language));
      return;
    }

    setSaving(true);
    const uploadedAvatar = isLiveAccount ? await uploadProfileAvatar(avatar.trim(), currentUser.id) : avatar.trim();
    const ok = await updateProfile({ name, phone, avatar: uploadedAvatar, bio });
    setSaving(false);

    if (!ok) {
      Alert.alert(translateCopy("Kaydedilemedi", language), translateCopy(authError ?? "Profil güncellenemedi.", language));
      return;
    }

    Alert.alert(translateCopy("Profil güncellendi", language), translateCopy(isLiveAccount ? "Değişiklikler canlı profiline kaydedildi." : "Ön izleme profili güncellendi.", language));
    router.back();
  }

  // Hesap silme onay modalı (şifre doğrulaması + 30 gün geri alma) — her iki düzende ortak.
  const deleteModal = (
    <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={() => setDeleteOpen(false)}>
      <View style={{ backgroundColor: "rgba(0,0,0,0.55)", flex: 1, justifyContent: "center", padding: 20 }}>
        <View style={{ alignSelf: "center", backgroundColor: colors.background, borderRadius: 18, gap: 14, maxWidth: 440, padding: 22, width: "100%" }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
            <View style={{ alignItems: "center", backgroundColor: colors.accentSoft, borderRadius: 12, height: 44, justifyContent: "center", width: 44 }}>
              <MaterialCommunityIcons name="account-alert-outline" size={24} color={colors.accent} />
            </View>
            <Text style={{ color: colors.ink, flex: 1, fontSize: 18, fontWeight: "900" }}>{translateCopy("Hesabını sil", language)}</Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", lineHeight: 19 }}>
            {translateCopy("Hesabın", language)} <Text style={{ color: colors.ink, fontWeight: "900" }}>{translateCopy("30 gün", language)}</Text> {translateCopy("boyunca askıya alınır. Bu süre içinde tekrar giriş yaparsan talebini iptal edip hesabını geri alabilirsin. 30 günün sonunda hesabın, ilanların ve ilişkili verilerin kalıcı olarak silinir.", language)}
          </Text>
          <DeskField icon="lock-outline" label={translateCopy("Devam etmek için şifreni gir", language)} secure value={deletePw} onChangeText={setDeletePw} placeholder={translateCopy("Şifren", language)} />
          <DeskField icon="comment-outline" label={translateCopy("Sebep (opsiyonel)", language)} value={deleteReason} onChangeText={setDeleteReason} placeholder={translateCopy("Ayrılma sebebini yazabilirsin", language)} />
          <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end" }}>
            <Pressable onPress={() => setDeleteOpen(false)} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 10, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 11 }}>
              <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{translateCopy("Vazgeç", language)}</Text>
            </Pressable>
            <Pressable onPress={() => void confirmDeleteAccount()} disabled={deleting} style={{ alignItems: "center", backgroundColor: colors.accent, borderRadius: 10, opacity: deleting ? 0.6 : 1, paddingHorizontal: 18, paddingVertical: 11 }}>
              <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{deleting ? translateCopy("İşleniyor…", language) : translateCopy("Hesabımı sil", language)}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (isWideWeb) {
    const navItems: Array<{ key: SettingsSection; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; sub: string }> = [
      { key: "personal", icon: "account-outline", label: translateCopy("Kişisel Bilgiler", language), sub: translateCopy("Ad, telefon, foto, bio", language) },
      { key: "security", icon: "lock-outline", label: translateCopy("Hesap Güvenliği", language), sub: translateCopy("Şifre ve oturumlar", language) },
      { key: "notifications", icon: "bell-outline", label: translateCopy("Bildirim Tercihleri", language), sub: translateCopy("E-posta, SMS, anlık", language) },
      { key: "store", icon: "storefront-outline", label: translateCopy("Mağaza Ayarları", language), sub: translateCopy("Ödeme ve ortaklık", language) },
      { key: "verification", icon: "shield-check-outline", label: translateCopy("Doğrulama Durumu", language), sub: translateCopy("Kimlik ve hesap", language) }
    ];
    const verifications = [
      // Duruma göre etiket: yapılmamışsa emir ("Telefonunu doğrula"), yapılmışsa geçmiş.
      { label: translateCopy(currentUser.verifiedPhone ? "Telefon doğrulandı" : "Telefonunu doğrula", language), done: currentUser.verifiedPhone },
      { label: translateCopy(currentUser.verifiedIdentity ? "Kimlik doğrulandı" : "Kimliğini doğrula", language), done: currentUser.verifiedIdentity },
      { label: translateCopy(currentUser.verifiedInstagram ? "Instagram bağlandı" : "Instagram hesabını bağla", language), done: !!currentUser.verifiedInstagram }
    ];
    const doneCount = verifications.filter((v) => v.done).length;
    const completion = Math.round(((doneCount + (bio ? 1 : 0) + (avatar ? 1 : 0)) / 5) * 100);

    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, flexGrow: 1, paddingBottom: 0 }} style={{ backgroundColor: colors.background }}>
        {deleteModal}
        <View style={{ alignSelf: "center", gap: 16, maxWidth: 1280, paddingHorizontal: 20, paddingTop: 16, width: "100%" }}>
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.ink, fontSize: 26, fontWeight: "900" }}>{translateCopy("Ayarlar", language)}</Text>
          <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>{translateCopy("Hesabını, güvenlik ve bildirim tercihlerini buradan yönet.", language)}</Text>
        </View>

        <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 20 }}>
          {/* Left nav */}
          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 4, padding: 10, width: 270 }}>
            {navItems.map((n) => {
              const on = section === n.key;
              return (
                <Pressable key={n.key} onPress={() => setSection(n.key)} style={{ alignItems: "center", backgroundColor: on ? colors.primarySoft : "transparent", borderRadius: 12, flexDirection: "row", gap: 12, paddingHorizontal: 12, paddingVertical: 11 }}>
                  <MaterialCommunityIcons name={n.icon} size={20} color={on ? colors.primaryDark : colors.muted} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: on ? colors.primaryDark : colors.ink, fontSize: 13.5, fontWeight: "800" }}>{n.label}</Text>
                    <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{n.sub}</Text>
                  </View>
                  {on ? <MaterialCommunityIcons name="chevron-right" size={18} color={colors.primaryDark} /> : null}
                </Pressable>
              );
            })}
          </View>

          {/* Center content */}
          <View style={{ flex: 1, gap: 16, minWidth: 0 }}>
            {section === "personal" ? (
              <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 16, padding: 22 }}>
                <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{translateCopy("Kişisel Bilgiler", language)}</Text>
                <View style={{ alignItems: "center", flexDirection: "row", gap: 16 }}>
                  <View style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 16, height: 80, justifyContent: "center", overflow: "hidden", width: 80 }}>
                    {isImageAvatar(avatar.trim()) ? <Image source={{ uri: avatar.trim() }} contentFit="cover" style={{ height: 80, width: 80 }} /> : <Text style={{ color: "#FFFFFF", fontSize: 26, fontWeight: "900" }}>{avatar.trim() || "OS"}</Text>}
                  </View>
                  <View style={{ gap: 8 }}>
                    <Pressable onPress={() => void pickAvatar()} style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 10, flexDirection: "row", gap: 7, paddingHorizontal: 16, paddingVertical: 10 }}>
                      <MaterialCommunityIcons name="image-plus" size={17} color={colors.primaryDark} />
                      <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>{translateCopy("Fotoğraf yükle", language)}</Text>
                    </Pressable>
                    <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{translateCopy("JPG veya PNG, en fazla 5MB.", language)}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 14 }}>
                  <View style={{ flex: 1 }}><DeskField label={translateCopy("Ad soyad / mağaza adı", language)} value={name} onChangeText={setName} icon="account-outline" /></View>
                  <View style={{ flex: 1 }}><DeskField label={translateCopy("Telefon", language)} value={phone} onChangeText={setPhone} icon="phone-outline" keyboardType="phone-pad" /></View>
                </View>
                <DeskField label={translateCopy("Bio", language)} value={bio} onChangeText={setBio} icon="text-account" multiline />
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 17 }}>{translateCopy("Rol, puan, yanıt oranı ve doğrulama durumu güvenlik nedeniyle elle değiştirilemez.", language)}</Text>
                <Pressable disabled={saving} onPress={() => void submit()} style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 7, paddingHorizontal: 22, paddingVertical: 12 }}>
                  <MaterialCommunityIcons name="content-save-outline" size={17} color="#FFFFFF" />
                  <Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" }}>{saving ? translateCopy("Kaydediliyor…", language) : translateCopy("Değişiklikleri kaydet", language)}</Text>
                </Pressable>
              </View>
            ) : null}

            {section === "security" ? (
              <View style={{ gap: 16 }}>
                <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 14, padding: 22 }}>
                  <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{translateCopy("Şifre değiştir", language)}</Text>
                  <DeskField label={translateCopy("Mevcut şifren", language)} value={pwCurrent} onChangeText={setPwCurrent} icon="lock-outline" secure />
                  <View style={{ flexDirection: "row", gap: 14 }}>
                    <View style={{ flex: 1 }}><DeskField label={translateCopy("Yeni şifre (güçlü olmalı)", language)} value={pwNew} onChangeText={setPwNew} icon="lock-reset" secure /></View>
                    <View style={{ flex: 1 }}><DeskField label={translateCopy("Yeni şifre (tekrar)", language)} value={pwNew2} onChangeText={setPwNew2} icon="lock-check-outline" secure /></View>
                  </View>
                  <PasswordStrengthMeter password={pwNew} />
                  {pwMsg ? <Text style={{ color: pwMsg.tone === "ok" ? colors.success : colors.accent, fontSize: 12.5, fontWeight: "800" }}>{pwMsg.text}</Text> : null}
                  <Pressable disabled={pwSaving} onPress={() => void changePassword()} style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 10, opacity: pwSaving ? 0.6 : 1, paddingHorizontal: 22, paddingVertical: 12 }}>
                    <Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" }}>{pwSaving ? translateCopy("Güncelleniyor…", language) : translateCopy("Şifreyi güncelle", language)}</Text>
                  </Pressable>
                </View>
                <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 22 }}>
                  <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 10 }}>
                    <MaterialCommunityIcons name="shield-check-outline" size={20} color={colors.primary} style={{ marginTop: 1 }} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>{translateCopy("Oturum güvenliği", language)}</Text>
                      <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{translateCopy("Şu an bu cihazda giriş yapılı. Güvenlik için ortak cihazlarda işin bitince “Çıkış Yap” ile oturumunu kapat. Şüpheli bir durumda şifreni hemen değiştir.", language)}</Text>
                    </View>
                  </View>
                  <Pressable onPress={() => void signOut()} style={{ alignItems: "center", alignSelf: "flex-start", borderColor: colors.accent, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 7, paddingHorizontal: 18, paddingVertical: 10 }}>
                    <MaterialCommunityIcons name="logout" size={16} color={colors.accent} />
                    <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "800" }}>{translateCopy("Bu cihazdan çıkış yap", language)}</Text>
                  </Pressable>
                </View>
                <LoginHistoryCard history={loginHistory} loading={historyLoading} isLive={isLiveAccount} onRefresh={() => void loadHistory()} onSignOutAll={() => void signOutEverywhere()} signingOutAll={signingOutAll} />
              </View>
            ) : null}

            {section === "notifications" ? (
              <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 22 }}>
                <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{translateCopy("Bildirimler", language)}</Text>
                <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 10 }}>
                  <MaterialCommunityIcons name="bell-ring-outline" size={20} color={colors.primary} style={{ marginTop: 1 }} />
                  <Text style={{ color: colors.ink, flex: 1, fontSize: 13.5, fontWeight: "600", lineHeight: 20 }}>{translateCopy("Talep, satış, komisyon, ortaklık ve mesaj gibi", language)} <Text style={{ fontWeight: "900" }}>{translateCopy("önemli hareketler uygulama içinde anlık bildirim", language)}</Text> {translateCopy("olarak sana gösterilir — Bildirimler sekmesinden takip edebilirsin.", language)}</Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 17 }}>{translateCopy("E-posta bildirimleri aktif — talep, satış ve mesaj olayları e-postana düşer (Bildirimler sayfasından yönet). SMS/WhatsApp yakında.", language)}</Text>
              </View>
            ) : null}

            {section === "store" ? (
              <View style={{ gap: 16 }}>
                <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 14, padding: 22 }}>
                  <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{translateCopy("Mağaza Bilgileri", language)}</Text>
                  <DeskField label={translateCopy("Mağaza adı", language)} value={storeName} onChangeText={setStoreName} icon="storefront-outline" />
                  <DeskField label={translateCopy("IBAN / ödeme bilgisi (opsiyonel)", language)} value={iban} onChangeText={setIban} icon="bank-outline" placeholder="TR__ ____ ____ ____ ____ __" />
                  <View style={{ alignItems: "flex-start", backgroundColor: colors.infoSoft, borderRadius: 10, flexDirection: "row", gap: 8, padding: 12 }}>
                    <MaterialCommunityIcons name="information-outline" size={17} color={colors.info} style={{ marginTop: 1 }} />
                    <Text style={{ color: colors.muted, flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 17 }}>{translateCopy("Ortaksat ödeme almaz veya tutmaz. Bu bilgiyi yalnızca, ortakların komisyonlarını sana doğrudan öderken kullanabilmesi için isteğe bağlı paylaşırsın.", language)}</Text>
                  </View>
                  <Pressable disabled={storeSaving} onPress={() => void saveStore()} style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 10, opacity: storeSaving ? 0.6 : 1, paddingHorizontal: 22, paddingVertical: 12 }}>
                    <Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" }}>{storeSaving ? translateCopy("Kaydediliyor…", language) : translateCopy("Mağaza ayarlarını kaydet", language)}</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {section === "verification" ? (
              <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 4, padding: 22 }}>
                <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900", marginBottom: 8 }}>{translateCopy("Doğrulama Durumu", language)}</Text>
                {verifications.map((v, i) => (
                  <View key={v.label} style={{ alignItems: "center", borderTopColor: colors.line, borderTopWidth: i === 0 ? 0 : 1, flexDirection: "row", gap: 12, paddingVertical: 14 }}>
                    <View style={{ alignItems: "center", backgroundColor: v.done ? colors.successSoft : colors.surfaceAlt, borderRadius: 10, height: 40, justifyContent: "center", width: 40 }}>
                      <MaterialCommunityIcons name={v.done ? "check-decagram" : "alert-circle-outline"} size={20} color={v.done ? colors.success : colors.warning} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "800" }}>{v.label}</Text>
                      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{v.done ? translateCopy("Onaylandı", language) : translateCopy("Henüz doğrulanmadı", language)}</Text>
                    </View>
                    <View style={{ backgroundColor: v.done ? colors.successSoft : colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
                      <Text style={{ color: v.done ? colors.success : colors.muted, fontSize: 12, fontWeight: "800" }}>{v.done ? translateCopy("Onaylı", language) : translateCopy("Bekliyor", language)}</Text>
                    </View>
                  </View>
                ))}
                <View style={{ alignItems: "flex-start", backgroundColor: colors.infoSoft, borderRadius: 10, flexDirection: "row", gap: 8, marginTop: 6, padding: 12 }}>
                  <MaterialCommunityIcons name="information-outline" size={17} color={colors.info} style={{ marginTop: 1 }} />
                  <Text style={{ color: colors.muted, flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 17 }}>{translateCopy("Doğrulamalar güvenlik gereği ekibimizce, belge/bilgi kontrolüyle yapılır. Aşağıdan talep oluşturabilirsin.", language)}</Text>
                </View>
                <Pressable onPress={() => startVerification(translateCopy("Doğrulama talebi", language))} style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 10, marginTop: 8, paddingHorizontal: 20, paddingVertical: 11 }}>
                  <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{translateCopy("Doğrulama talebi oluştur", language)}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          {/* Right sidebar */}
          <View style={{ gap: 16, width: 280 }}>
            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 18 }}>
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{translateCopy("Hesap gücü", language)}</Text>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
                <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 56, justifyContent: "center", width: 56 }}>
                  <Text style={{ color: colors.primaryDark, fontSize: 17, fontWeight: "900" }}>%{completion}</Text>
                </View>
                <Text style={{ color: colors.muted, flex: 1, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{translateCopy("Eksik adımları tamamlayarak hesabını güçlendir.", language)}</Text>
              </View>
              <View style={{ backgroundColor: colors.line, borderRadius: 999, height: 8, overflow: "hidden" }}>
                <View style={{ backgroundColor: completion >= 75 ? colors.success : colors.warning, borderRadius: 999, height: "100%", width: `${completion}%` }} />
              </View>
              {verifications.map((v) => (
                <View key={v.label} style={{ alignItems: "center", flexDirection: "row", gap: 9 }}>
                  <MaterialCommunityIcons name={v.done ? "check-circle" : "circle-outline"} size={16} color={v.done ? colors.success : colors.subtle} />
                  <Text style={{ color: v.done ? colors.ink : colors.muted, fontSize: 12.5, fontWeight: "700" }}>{v.label}</Text>
                </View>
              ))}
            </View>

            <View style={{ backgroundColor: colors.accentSoft, borderColor: colors.accent, borderRadius: 16, borderWidth: 1, gap: 8, padding: 18 }}>
              <MaterialCommunityIcons name="alert-octagon-outline" size={22} color={colors.accent} />
              <Text style={{ color: colors.ink, fontSize: 14.5, fontWeight: "900" }}>{translateCopy("Tehlikeli bölge", language)}</Text>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 17 }}>{translateCopy("Hesabını kapatırsan ilanların ve komisyon geçmişin kalıcı olarak silinir.", language)}</Text>
              <Pressable onPress={closeAccount} style={{ alignItems: "center", borderColor: colors.accent, borderRadius: 10, borderWidth: 1, marginTop: 2, paddingVertical: 10 }}>
                <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "800" }}>{translateCopy("Hesabı kapat", language)}</Text>
              </Pressable>
            </View>
          </View>
        </View>
        </View>

        <WebFooter />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      {deleteModal}
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 14, padding: 16, paddingBottom: 110 }}>
        <Card>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
            <View style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 8, height: 64, justifyContent: "center", overflow: "hidden", width: 64 }}>
              {isImageAvatar(avatar.trim()) ? (
                <Image source={{ uri: avatar.trim() }} contentFit="cover" style={{ height: 64, width: 64 }} />
              ) : (
                <Text adjustsFontSizeToFit numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "900", paddingHorizontal: 4 }}>
                  {avatar.trim() || "OS"}
                </Text>
              )}
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text selectable style={{ color: colors.ink, fontSize: 21, fontWeight: "900", lineHeight: 26 }}>
                {translateCopy("Profil bilgileri", language)}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                <StatusPill label={isLiveAccount ? translateCopy("Canlı hesap", language) : translateCopy("Ön izleme", language)} tone={isLiveAccount ? "success" : "warning"} />
                <StatusPill label={currentUser.verifiedPhone ? translateCopy("Telefon doğrulandı", language) : translateCopy("Telefon bekliyor", language)} tone={currentUser.verifiedPhone ? "success" : "warning"} />
              </View>
            </View>
          </View>
          <PrimaryButton icon="image-plus" tone="secondary" onPress={() => void pickAvatar()}>{translateCopy("Galeriden fotoğraf seç", language)}</PrimaryButton>
        </Card>

        <Card>
          <SectionTitle title={translateCopy("Genel profil", language)} />
          <Field label="Ad soyad / mağaza adı" value={name} onChangeText={setName} icon="account-outline" />
          <Field label="Telefon" value={phone} onChangeText={setPhone} icon="phone-outline" keyboardType="phone-pad" />
          <Field label="Avatar kısa adı veya görsel adresi" value={avatar} onChangeText={setAvatar} icon="image-outline" />
          <Field label="Bio" value={bio} onChangeText={setBio} icon="text-account" multiline />
          <Text selectable style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
            {translateCopy("Rol, hesap durumu, telefon doğrulama, kimlik doğrulama, puan ve yanıt oranı güvenlik nedeniyle kullanıcı tarafından yükseltilemez.", language)}
          </Text>
        </Card>

        <PrimaryButton icon="content-save-outline" onPress={() => void submit()}>{saving ? translateCopy("Kaydediliyor", language) : translateCopy("Profili kaydet", language)}</PrimaryButton>

        {/* Mobil paritesi: şifre/IBAN/bildirim/doğrulama/hesap web'de vardı, mobilde yoktu. */}
        {isLiveAccount ? (
          <>
            <Card>
              <SectionTitle title={translateCopy("Hesap güvenliği", language)} />
              <DeskField icon="lock-outline" label={translateCopy("Mevcut şifren", language)} secure value={pwCurrent} onChangeText={setPwCurrent} placeholder={translateCopy("Şu anki şifren", language)} />
              <DeskField icon="lock-reset" label={translateCopy("Yeni şifre (güçlü olmalı)", language)} secure value={pwNew} onChangeText={setPwNew} placeholder={translateCopy("Büyük/küçük harf, rakam, özel karakter", language)} />
              <PasswordStrengthMeter password={pwNew} />
              <DeskField icon="lock-check-outline" label={translateCopy("Yeni şifre (tekrar)", language)} secure value={pwNew2} onChangeText={setPwNew2} placeholder={translateCopy("Tekrar", language)} />
              {pwMsg ? <Text style={{ color: pwMsg.tone === "ok" ? colors.success : colors.accent, fontSize: 12.5, fontWeight: "800" }}>{pwMsg.text}</Text> : null}
              <PrimaryButton icon="key-outline" tone="secondary" onPress={() => void changePassword()}>{pwSaving ? translateCopy("Güncelleniyor", language) : translateCopy("Şifreyi güncelle", language)}</PrimaryButton>
            </Card>
            <LoginHistoryCard history={loginHistory} loading={historyLoading} isLive={isLiveAccount} onRefresh={() => void loadHistory()} onSignOutAll={() => void signOutEverywhere()} signingOutAll={signingOutAll} />
          </>
        ) : null}

        <Card>
          <SectionTitle title={translateCopy("Bildirimler", language)} />
          <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "600", lineHeight: 20 }}>{translateCopy("Talep, satış, komisyon, ortaklık ve mesaj gibi", language)} <Text style={{ fontWeight: "900" }}>{translateCopy("önemli hareketler uygulama içinde anlık bildirim", language)}</Text> {translateCopy("olarak gösterilir; Bildirimler sekmesinden takip edebilirsin.", language)}</Text>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 17 }}>{translateCopy("E-posta bildirimleri aktif — talep, satış ve mesaj olayları e-postana düşer (Bildirimler sayfasından yönet). SMS/WhatsApp yakında.", language)}</Text>
        </Card>

        <Card>
          <SectionTitle title={translateCopy("Mağaza & ödeme", language)} />
          <Field label="Mağaza adı" value={storeName} onChangeText={setStoreName} icon="storefront-outline" />
          <DeskField icon="bank-outline" label={translateCopy("IBAN (komisyon tahsilatı için)", language)} value={iban} onChangeText={setIban} placeholder="TR__ ____ ____ ____ ____ __" />
          <PrimaryButton icon="content-save-outline" tone="secondary" onPress={() => void saveStore()}>{storeSaving ? translateCopy("Kaydediliyor", language) : translateCopy("Mağaza & IBAN'ı kaydet", language)}</PrimaryButton>
        </Card>

        <Card>
          <SectionTitle title={translateCopy("Doğrulama durumu", language)} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <StatusPill label={currentUser.verifiedPhone ? translateCopy("Telefon ✓", language) : translateCopy("Telefon —", language)} tone={currentUser.verifiedPhone ? "success" : "warning"} />
            <StatusPill label={currentUser.verifiedIdentity ? translateCopy("Kimlik ✓", language) : translateCopy("Kimlik —", language)} tone={currentUser.verifiedIdentity ? "success" : "warning"} />
            <StatusPill label={currentUser.verifiedInstagram ? translateCopy("Instagram ✓", language) : translateCopy("Instagram —", language)} tone={currentUser.verifiedInstagram ? "success" : "warning"} />
          </View>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{translateCopy("Doğrulamalar güvenlik gereği ekibimizce, belge/bilgi kontrolüyle yapılır.", language)}</Text>
          <PrimaryButton icon="shield-check-outline" tone="secondary" onPress={() => startVerification(translateCopy("Doğrulama talebi", language))}>{translateCopy("Doğrulama talebi oluştur", language)}</PrimaryButton>
        </Card>

        <Card>
          <SectionTitle title={translateCopy("Hesap", language)} />
          <PrimaryButton icon="account-cancel-outline" tone="danger" onPress={closeAccount}>{translateCopy("Hesabı kapat", language)}</PrimaryButton>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

/** Giriş/oturum geçmişi + tüm cihazlardan çıkış kartı (masaüstü ve mobil ortak). */
function LoginHistoryCard({ history, loading, isLive, onRefresh, onSignOutAll, signingOutAll }: { history: LoginEvent[]; loading: boolean; isLive: boolean; onRefresh: () => void; onSignOutAll: () => void; signingOutAll: boolean }) {
  const { language } = useLanguage();
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 22 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <MaterialCommunityIcons name="history" size={20} color={colors.primary} />
        <Text style={{ color: colors.ink, flex: 1, fontSize: 16, fontWeight: "900" }}>{translateCopy("Son giriş etkinliği", language)}</Text>
        <Pressable onPress={onRefresh} hitSlop={8} accessibilityLabel={translateCopy("Yenile", language)}><MaterialCommunityIcons name="refresh" size={18} color={colors.muted} /></Pressable>
      </View>
      {!isLive ? (
        <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{translateCopy("Giriş geçmişi yalnızca canlı hesaplarda görüntülenir.", language)}</Text>
      ) : loading ? (
        <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>{translateCopy("Yükleniyor…", language)}</Text>
      ) : history.length === 0 ? (
        <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>{translateCopy("Henüz kayıtlı giriş etkinliği yok.", language)}</Text>
      ) : (
        <View style={{ gap: 8 }}>
          {history.map((e) => (
            <View key={e.id} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 10, paddingHorizontal: 12, paddingVertical: 10 }}>
              <MaterialCommunityIcons name={e.os === "iOS" || e.os === "Android" ? "cellphone" : "monitor"} size={18} color={colors.muted} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{actionLabel(e.action)} · {e.browser}</Text>
                <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{e.os} · {formatWhen(e.when)}</Text>
              </View>
              {e.isCurrent ? <View style={{ backgroundColor: colors.successSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}><Text style={{ color: colors.success, fontSize: 10.5, fontWeight: "900" }}>{translateCopy("BU CİHAZ", language)}</Text></View> : null}
            </View>
          ))}
        </View>
      )}
      <Pressable onPress={onSignOutAll} disabled={signingOutAll || !isLive} style={{ alignItems: "center", alignSelf: "flex-start", borderColor: colors.accent, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 7, opacity: signingOutAll || !isLive ? 0.6 : 1, paddingHorizontal: 18, paddingVertical: 10 }}>
        <MaterialCommunityIcons name="logout-variant" size={16} color={colors.accent} />
        <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "800" }}>{signingOutAll ? translateCopy("Çıkılıyor…", language) : translateCopy("Tüm cihazlardan çıkış yap", language)}</Text>
      </Pressable>
    </View>
  );
}

function DeskField({ icon, keyboardType, label, multiline, onChangeText, placeholder, secure, value }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; keyboardType?: "default" | "phone-pad" | "email-address"; label: string; multiline?: boolean; onChangeText: (v: string) => void; placeholder?: string; secure?: boolean; value: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{label}</Text>
      <View style={{ alignItems: multiline ? "flex-start" : "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 9, paddingHorizontal: 12 }}>
        <MaterialCommunityIcons name={icon} size={18} color={colors.primary} style={{ marginTop: multiline ? 14 : 0 }} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          multiline={multiline}
          secureTextEntry={secure}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={colors.subtle}
          style={{ color: colors.ink, flex: 1, fontSize: 14, minHeight: multiline ? 90 : 46, paddingVertical: 10, textAlignVertical: multiline ? "top" : "center" }}
        />
      </View>
    </View>
  );
}

function Field({
  icon,
  keyboardType,
  label,
  multiline,
  onChangeText,
  value
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  keyboardType?: "default" | "phone-pad";
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  value: string;
}) {
  const { language } = useLanguage();
  return (
    <View style={{ gap: 6 }}>
      <Text selectable style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>
        {translateCopy(label, language)}
      </Text>
      <View style={{ alignItems: multiline ? "flex-start" : "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 9, paddingHorizontal: 12 }}>
        <MaterialCommunityIcons name={icon} size={19} color={colors.primary} style={{ marginTop: multiline ? 14 : 0 }} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          multiline={multiline}
          placeholderTextColor={colors.muted}
          style={{ color: colors.ink, flex: 1, fontSize: 15, minHeight: multiline ? 96 : 48, paddingVertical: 10, textAlignVertical: multiline ? "top" : "center" }}
        />
      </View>
    </View>
  );
}

export default function ProfileEditScreen() {
  const { language } = useLanguage();
  const auth = useStore();
  const mounted = useMounted();
  if (!mounted) return <ScreenSkeleton />; // hidrasyon-gate (#418)
  if (!auth.isAuthenticated) return <AuthRequired title={translateCopy("Ayarlar için giriş yapın", language)} />;
  return <ProfileEditScreenInner />;
}

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { Card, PrimaryButton, SectionTitle, StatusPill } from "@/components/ui";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useStore } from "@/lib/use-store";

export default function LegalScreen() {
  const { language } = useLanguage();
  const {
    authError,
    backendMode,
    createSupportTicket,
    currentUser,
    recordLegalConsent,
    requestAccountDeletion
  } = useStore();
  const isLiveAccount = backendMode === "supabase" && currentUser.id.includes("-");
  const [subject, setSubject] = useState("Destek talebi");
  const [message, setMessage] = useState("Merhaba, Ortaksat hesabım veya ilan sürecim hakkında destek istiyorum.");
  const [deleteReason, setDeleteReason] = useState("Hesabımı ve kişisel verilerimi silmek istiyorum.");

  async function acceptAll() {
    const results = await Promise.all([
      recordLegalConsent("privacy"),
      recordLegalConsent("terms"),
      recordLegalConsent("kvkk"),
      recordLegalConsent("seller_rules")
    ]);
    Alert.alert(
      translateCopy(results.every(Boolean) ? "Rıza kaydedildi" : "Giriş gerekli", language),
      translateCopy(results.every(Boolean)
        ? "Yasal metin onayların canlı hesaba kaydedildi."
        : "Rıza kaydı için e-posta ile giriş yapmalısın.", language)
    );
  }

  async function sendSupport() {
    const ok = await createSupportTicket(subject, message);
    Alert.alert(translateCopy(ok ? "Destek talebi alındı" : "Gönderilemedi", language), translateCopy(ok ? "Talebin destek kuyruğuna eklendi." : "Canlı hesapla giriş yapıp konu ve mesaj yazmalısın.", language));
  }

  async function requestDeletion() {
    const ok = await requestAccountDeletion(deleteReason);
    Alert.alert(translateCopy(ok ? "Silme talebi alındı" : "Talep açılamadı", language), translateCopy(ok ? "Hesap silme talebin kayıt altına alındı." : "Bu işlem için canlı hesapla giriş yapmalısın.", language));
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 14, padding: 16, paddingBottom: 90 }}>
        <Card>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <StatusPill label="KVKK / Gizlilik" tone="success" />
            <StatusPill label={isLiveAccount ? "Canlı hesap" : "Ön izleme"} tone={isLiveAccount ? "success" : "warning"} />
          </View>
          <Text selectable style={{ color: colors.ink, fontSize: 24, fontWeight: "900", lineHeight: 30 }}>
            {translateCopy("Yasal ve destek merkezi", language)}
          </Text>
          <Text selectable style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
            {language === "en" ? "Ortaksat does not take payments and is not the seller of products in the first version. The app provides intermediary technology infrastructure for listings, partnership applications, messages, leads, and commission tracking records." : "Ortaksat ilk sürümde ödeme almaz ve ürünlerin satıcısı değildir. Uygulama; ilan, ortaklık başvurusu, mesaj, talep ve komisyon takip kayıtları için aracı teknoloji altyapısı sağlar."}
          </Text>
          {authError ? (
            <Text selectable style={{ color: colors.accent, fontSize: 13, lineHeight: 19 }}>
              {authError}
            </Text>
          ) : null}
        </Card>

        <Card>
          <SectionTitle title="Yasal metin özeti" />
          <LegalRow icon="shield-account" title="KVKK aydınlatma" body="E-posta, profil, ilan, ortaklık, talep, mesaj, bildirim, yorum ve komisyon kayıtları hizmeti çalıştırmak, güvenliği sağlamak ve destek vermek için işlenir." />
          <LegalRow icon="file-document-check" title="Aracı platform şartı" body="Ortaksat ürün sahibi, satıcı, ödeme kuruluşu veya teslimat tarafı değildir. Ürün doğruluğu, fiyat, stok, teslimat, iade ve komisyon ödemesi ilgili kullanıcıların sorumluluğundadır." />
          <LegalRow icon="account-cash" title="Komisyon takip modeli" body="İlk sürümde uygulama para tutmaz. Satıcı komisyonu ödediğini, ortak satıcı da aldığını işaretler; anlaşmazlıklar kayıt altına alınıp destek/moderasyon sürecine taşınır." />
          <LegalRow icon="lock-check" title="Gizlilik ve güvenlik" body="Gizli sunucu anahtarları mobil uygulamada tutulmaz. Kullanıcı verileri oturum, yetki ve dosya erişim kurallarıyla korunur." />
          <LegalRow icon="store-check" title="İlan ve paylaşım kuralları" body="Yanıltıcı fiyat, sahte stok, sahte ürün, spam paylaşım, marka ihlali, yasaklı ürün ve dolandırıcılık şüphesi moderasyona taşınır; hesap ve ilan kısıtlanabilir." />
          <PrimaryButton onPress={() => void acceptAll()}>Metinleri Okudum ve Kabul Ediyorum</PrimaryButton>
        </Card>

        <Card>
          <SectionTitle title="Destek talebi" />
          <Field label="Konu" value={subject} onChangeText={setSubject} />
          <Field label="Mesaj" value={message} onChangeText={setMessage} multiline />
          <PrimaryButton onPress={() => void sendSupport()}>Destek Talebi Gönder</PrimaryButton>
        </Card>

        <Card>
          <SectionTitle title="Hesap silme talebi" />
          <Text selectable style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
            {language === "en" ? "Store rules require that users can create an account/data deletion request inside the app. The request enters moderation and support flow." : "Mağaza kuralları gereği kullanıcı uygulama içinden hesap/veri silme talebi oluşturabilmelidir. Talep moderasyon ve destek sürecine düşer."}
          </Text>
          <Field label="Talep nedeni" value={deleteReason} onChangeText={setDeleteReason} multiline />
          <PrimaryButton tone="danger" onPress={() => void requestDeletion()}>Hesap Silme Talebi Aç</PrimaryButton>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function LegalRow({ body, icon, title }: { body: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string }) {
  const { language } = useLanguage();
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text selectable style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>
          {translateCopy(title, language)}
        </Text>
        <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
          {translateCopy(body, language)}
        </Text>
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  multiline
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
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
        multiline={multiline}
        placeholderTextColor={colors.muted}
        style={{
          backgroundColor: "#FAFBFC",
          borderColor: colors.line,
          borderRadius: 12,
          borderWidth: 1,
          color: colors.ink,
          fontSize: 16,
          minHeight: multiline ? 92 : 50,
          padding: 14,
          textAlignVertical: multiline ? "top" : "center"
        }}
      />
    </View>
  );
}


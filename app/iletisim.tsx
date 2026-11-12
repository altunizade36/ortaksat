import { useState } from "react";
import { Link } from "expo-router";
import { Pressable, Text, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { InformationPage } from "@/components/information-page";
import { colors } from "@/components/colors";
import { MobileButton, MobileSelect } from "@/components/mobile/ui";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { openUrlSafe } from "@/lib/link";
import { showToast } from "@/lib/toast";

const topics = ["Genel bilgi", "Hesap ve giriş", "İlan ve ortaklık", "Güvenlik ve şikayet", "Kişisel veri başvurusu"];
export default function ContactScreen() {
  const [topic, setTopic] = useState(topics[0]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function compose() {
    if (message.trim().length < 20) { setError("Konuyu anlayabilmemiz için en az 20 karakter yaz."); return; }
    setError("");
    const ok = await openUrlSafe(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`OrtakSat · ${topic}`)}&body=${encodeURIComponent(message.trim())}`);
    if (ok === false) setError(`E-posta uygulaması açılamadı. ${SUPPORT_EMAIL} adresini kopyalayarak yazabilirsin.`);
  }
  return <InformationPage title="İletişim" path="/iletisim" icon="email-outline" intro="Sorunu doğru kanaldan ilet, yanıtını kolayca takip et. Hesabın ve ilanların için destek talebi oluşturabilir veya bize e-posta yazabilirsin.">
    <View style={{ borderRadius: 16, padding: 18, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, gap: 12 }}><Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: "800", color: colors.ink }}>Uygulama içinden destek</Text><Text style={{ color: colors.muted, lineHeight: 22, fontSize: 14 }}>İlan bağlantısı, sorun açıklaması ve gerekirse ekran görüntüsü ekle. Talebinin durumunu ve yanıtları Destek Taleplerim ekranından takip et.</Text><Link href="/support" asChild><Pressable accessibilityRole="link" style={{ minHeight: 48, paddingHorizontal: 14, backgroundColor: colors.primary, borderRadius: 11, justifyContent: "center", alignItems: "center" }}><Text style={{ color: "white", fontWeight: "700" }}>Destek Taleplerime Git</Text></Pressable></Link></View>
    <View style={{ padding: 18, backgroundColor: "#EAEFFA", borderRadius: 16, gap: 10 }}><Text style={{ color: colors.ink, fontWeight: "800", fontSize: 18 }}>E-posta ile iletişim</Text><Text selectable style={{ color: colors.primaryDark, fontSize: 19, fontWeight: "800" }}>{SUPPORT_EMAIL}</Text><MobileButton secondary icon="content-copy" onPress={() => { void Clipboard.setStringAsync(SUPPORT_EMAIL).then(() => showToast("E-posta adresi kopyalandı.")).catch(() => setError("Adres kopyalanamadı; e-posta adresini basılı tutarak seçebilirsin.")); }}>E-posta Adresini Kopyala</MobileButton></View>
    <View style={{ borderRadius: 16, padding: 18, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, gap: 12 }}><Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: "800", color: colors.ink }}>Mesajını hazırla</Text><MobileSelect label="İletişim konusu" value={topic} options={topics} onChange={setTopic} /><TextInput accessibilityLabel="İletişim mesajı" value={message} onChangeText={setMessage} maxLength={2000} multiline placeholder="Konuyu ve varsa ilgili ilan / talep numarasını yaz. Şifre veya kart bilgisi paylaşma." style={{ minHeight: 140, borderWidth: 1, borderColor: colors.line, borderRadius: 11, padding: 12, color: colors.ink, fontSize: 14, lineHeight: 22, textAlignVertical: "top" }} /><Text style={{ color: colors.muted, textAlign: "right", fontSize: 11 }}>{message.length}/2000</Text>{error && <Text accessibilityRole="alert" style={{ color: colors.accent, lineHeight: 20 }}>{error}</Text>}<MobileButton icon="email-outline" onPress={() => void compose()}>E-posta Taslağını Aç</MobileButton><Text style={{ color: colors.muted, fontSize: 12, lineHeight: 19 }}>Bu düğme e-posta uygulamanda bir taslak açar. Mesaj, e-posta uygulamasında Gönder dediğinde iletilir.</Text></View>
    <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 21 }}>Hesap güvenliği sorunlarında ayrıntıları destek ekibine ilet. Ödeme, teslimat ve komisyon anlaşmazlıklarında ilgili kayıtları koru; ürünün satıcısıyla platform mesajlaşması üzerinden iletişim kur.</Text>
  </InformationPage>;
}

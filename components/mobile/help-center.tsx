import { InformationPage } from "@/components/information-page";
import { useState } from "react";
import { Image } from "expo-image";
import { Linking, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { SUPPORT_EMAIL, SUPPORT_EMAIL_MAILTO } from "@/lib/contact";
import { searchKey } from "@/lib/locale";
import { showToast } from "@/lib/toast";
import { MobileBottomNav, MobileButton, MobileCard, MobileField, MobileScreen, mobile, ms, type MobileIcon } from "./ui";

type Question = { icon: MobileIcon; heading: string; body: string };
const topics: { label: string; icon: MobileIcon; terms: string[] }[] = [
  { label: "İlan Verme", icon: "text-box-outline", terms: ["ilan", "ürün", "satılabilir"] },
  { label: "Ortaklık Sistemi", icon: "account-group-outline", terms: ["ortak", "referans"] },
  { label: "Mesajlaşma", icon: "chat-outline", terms: ["mesaj", "iletişim"] },
  { label: "Güvenlik", icon: "shield-check-outline", terms: ["güven", "bildir", "engelle"] },
  { label: "Komisyon ve Ödeme", icon: "wallet-outline", terms: ["komisyon", "ödeme", "ödüyor", "ödememi"] },
  { label: "Hesap ve Gizlilik", icon: "account-cog-outline", terms: ["hesap", "profil", "gizlilik"] },
  { label: "Sorun Bildirme", icon: "alert-outline", terms: ["sorun", "bildir", "anlaşmazlık"] },
  { label: "Genel Bilgiler", icon: "information-outline", terms: ["kendisi", "nasıl çalışır"] },
];
const additional: Question[] = [
  { icon: "text-box-outline", heading: "İlan nasıl verilir?", body: "Alt menüdeki İlan Ver düğmesini kullan. Hesabına giriş yap, ürününe uygun kategoriyi seç; özellikleri, fiyatı, konumu ve fotoğrafları ekle. Önizlemeden bilgilerini kontrol edip yayın için gönder. İnceleme gerekiyorsa durumunu İlanlarım ekranından görebilirsin." },
  { icon: "chat-outline", heading: "Satıcıya nasıl mesaj gönderirim?", body: "İlan veya satıcı profilindeki Mesaj Gönder düğmesini kullan. Mesajlaşmak için giriş yapmalısın. Kapalı ya da engellenmiş sohbetlerde yeni mesaj gönderilemez." },
  { icon: "shield-check-outline", heading: "Şüpheli kullanıcıyı veya ilanı nasıl bildiririm?", body: "İlgili ilan veya kullanıcı ekranındaki bildirme seçeneğini kullan. Yaşadığın durumu açıkça yaz; paylaşacağın bilgiler incelemeye yardımcı olur. Bildirim yapmak, içeriğin otomatik olarak kaldırılacağı anlamına gelmez." },
  { icon: "account-cancel-outline", heading: "Engellediğim kullanıcıları nereden yönetirim?", body: "Hesap Ayarları içindeki Engellediğim Kullanıcılar bölümünden listeyi açıp engeli kaldırabilirsin. Kullanıcıyı engellemek önceki mesajlarını otomatik olarak silmez." },
  { icon: "headset", heading: "Teknik bir sorunu nasıl iletebilirim?", body: "Destek Taleplerim bölümünden Yeni Talep seç. Kategori, konu ve sorunun ayrıntılarını ekle. Gönderdiğin talebin durumunu aynı bölümden takip edebilirsin." },
  { icon: "account-group-outline", heading: "Ortaklık talebim onaylanınca ne olur?", body: "Aktif ortaklığını Ortak Satış bölümünde görebilirsin. Satıcıyla iletişime geçip ilan için müşteri bulabilirsin. Komisyon ve satış koşullarını önceden netleştir; platform otomatik ödeme veya kazanç garantisi sunmaz." },
];
export function MobileHelpCenter({ questions }: { questions: Question[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const selected = topics.find(t => t.label === topic);
  const shown = [...questions, ...additional].filter(q => searchKey(`${q.heading} ${q.body}`).includes(searchKey(query)) && (!selected || selected.terms.some(term => searchKey(q.heading).includes(searchKey(term)))));
  return <InformationPage title="Yardım Merkezi" path="/sss" icon="lifebuoy" intro="İlan, ortaklık, hesap ve güvenlikle ilgili yanıtları bul; ihtiyacın olursa destek talebi oluştur.">
    <MobileCard style={{ backgroundColor: "#E8EEFB", flexDirection: "row", alignItems: "center" }}>
      <View style={{ flex: 1, gap: 8 }}><Text style={{ fontSize: 26, fontWeight: "800", color: mobile.ink }}>Sana nasıl yardımcı olabiliriz?</Text><Text style={ms.muted}>Merak ettiğin konuları ara, yanıtları incele veya destek talebi oluştur.</Text></View>
      <Image source={require("../../public/assets/mascot/webp-512/success.webp")} contentFit="contain" style={{ width: 105, height: 145 }} accessibilityLabel="OrtakSat kedi maskotu" />
    </MobileCard>
    <MobileField placeholder="Sorularında ara…" value={query} onChange={setQuery} />
    <View style={[ms.row, { justifyContent: "space-between", marginVertical: 16 }]}><Text style={ms.section}>En Çok Sorulan Konular</Text>{topic && <Pressable accessibilityRole="button" accessibilityLabel="Tüm yardım konularını göster" onPress={() => setTopic(null)}><Text style={{ color: mobile.teal }}>Tümü</Text></Pressable>}</View>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{topics.map(t => <Pressable key={t.label} accessibilityRole="button" accessibilityLabel={`Yardım konusu: ${t.label}`} accessibilityState={{ selected: topic === t.label }} onPress={() => { setTopic(topic === t.label ? null : t.label); setExpanded(null); }} style={{ width: "48%", flexGrow: 1, minHeight: 85, alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, borderWidth: 1, borderColor: topic === t.label ? mobile.teal : mobile.line, backgroundColor: topic === t.label ? "#E5ECFA" : "white", padding: 10 }}><Icon name={t.icon} size={27} color={mobile.teal} /><Text style={{ color: mobile.ink, fontSize: 12, textAlign: "center" }}>{t.label}</Text></Pressable>)}</View>
    <Text style={[ms.section, { marginVertical: 16 }]}>Sık Sorulan Sorular</Text>
    {!shown.length && <MobileCard><Text style={ms.muted}>Bu arama için yanıt bulunamadı. Başka bir kelimeyle arayabilir veya destek talebi oluşturabilirsin.</Text><MobileButton secondary onPress={() => { setQuery(""); setTopic(null); }}>Aramayı ve Filtreleri Temizle</MobileButton></MobileCard>}
    {shown.map(q => <MobileCard key={q.heading}><Pressable accessibilityRole="button" accessibilityLabel={q.heading} accessibilityState={{ expanded: expanded === q.heading }} onPress={() => setExpanded(expanded === q.heading ? null : q.heading)} style={[ms.row, { minHeight: 48 }]}><Icon name={q.icon} size={23} color={mobile.teal} /><Text style={{ flex: 1, color: mobile.ink, fontSize: 14, lineHeight: 21, fontWeight: "600" }}>{q.heading}</Text><Icon name={expanded === q.heading ? "chevron-up" : "chevron-down"} size={21} color={mobile.muted} /></Pressable>{expanded === q.heading && <Text style={{ color: mobile.muted, fontSize: 13, lineHeight: 21 }}>{q.body}</Text>}</MobileCard>)}
    <MobileCard><Text style={ms.section}>Destek Taleplerim</Text><Text style={ms.muted}>Hesabın veya ilanlarınla ilgili bir sorun yaşıyorsan bize iletebilirsin.</Text><MobileButton icon="headset" onPress={() => router.push("/support")}>Destek Taleplerime Git</MobileButton></MobileCard>
    <MobileCard><Text style={ms.section}>Bize Ulaş</Text><Text style={ms.muted}>Farklı bir sorun mu var? Destek ekibimize e-posta gönderebilirsin.</Text><MobileButton secondary icon="email-outline" onPress={() => { void Linking.openURL(SUPPORT_EMAIL_MAILTO).catch(() => showToast(`E-posta uygulaması açılamadı. Adres: ${SUPPORT_EMAIL}`)); }}>{SUPPORT_EMAIL}</MobileButton></MobileCard>
  </InformationPage>;
}

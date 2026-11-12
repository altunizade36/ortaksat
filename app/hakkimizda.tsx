import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { ContentPageView } from "@/components/content-page-view";
import { InformationPage } from "@/components/information-page";
import { colors } from "@/components/colors";

export default function AboutScreen() { return <ContentPageView slug="hakkimizda" fallback={<AboutContent />} />; }
function AboutContent() {
  return <InformationPage title="Hakkımızda" path="/hakkimizda" icon="handshake-outline" intro="Ürününü listele, doğru insanlarla buluş. OrtakSat; satıcıları, alıcıları ve satışa katkı sağlayan ortakları bir araya getirir.">
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>{[
      { icon: "storefront-outline" as const, title: "Satıcılar için", body: "İlanını oluştur, fotoğraflarını ve özelliklerini ekle. İstersen komisyon belirleyip ilanını ortaklığa aç.", href: "/create" as const, action: "İlan ver" },
      { icon: "account-group-outline" as const, title: "Satış ortakları için", body: "Ortaklığa açık ilanları keşfet. Koşulları incele, satıcıyla anlaş ve satışa katkı sağla.", href: "/partner" as const, action: "Fırsatları keşfet" },
      { icon: "shopping-outline" as const, title: "Alıcılar için", body: "İlanları karşılaştır, satıcıya sorularını sor. Ürün, ödeme ve teslimat ayrıntılarını birlikte netleştir.", href: "/explore" as const, action: "İlanlara göz at" }
    ].map(item => <View key={item.title} style={{ flexBasis: 250, flexGrow: 1, minWidth: 0, backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 18, gap: 12 }}><Icon name={item.icon} size={30} color={colors.primaryDark} /><Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 18, fontWeight: "800" }}>{item.title}</Text><Text style={{ color: colors.muted, fontSize: 14, lineHeight: 22 }}>{item.body}</Text><Link href={item.href} asChild><Pressable accessibilityRole="link" style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: colors.primaryDark, fontWeight: "700" }}>{item.action} →</Text></Pressable></Link></View>)}</View>
    <View style={{ backgroundColor: "white", borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 18, gap: 16 }}><Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: "800", color: colors.ink }}>Ortak satış nasıl ilerler?</Text>{[
      ["01", "İlanı ve koşulları incele", "Komisyonu, ortaklık kontenjanını ve ürün ayrıntılarını başvurmadan önce kontrol et."],
      ["02", "Satıcıyla anlaş", "Talebin sonucunu takip et; tanıtım, müşteri yönlendirme ve komisyon koşullarını netleştir."],
      ["03", "Satışa katkı sağla", "Sonucu ve anlaşmana bağlı komisyon kaydını panelinden takip et. Kazanç, gerçekleşen satışa bağlıdır."]
    ].map(([number, title, body]) => <View key={number} style={{ flexDirection: "row", gap: 12 }}><Text style={{ color: colors.primaryDark, fontWeight: "900", fontSize: 20 }}>{number}</Text><View style={{ flex: 1, gap: 4 }}><Text style={{ fontSize: 15, color: colors.ink, fontWeight: "700" }}>{title}</Text><Text style={{ color: colors.muted, lineHeight: 21, fontSize: 13 }}>{body}</Text></View></View>)}</View>
    <View style={{ padding: 18, borderRadius: 16, backgroundColor: "#ECFAF5", gap: 8 }}><Text style={{ fontWeight: "800", fontSize: 17, color: colors.ink }}>Şeffaf bir aracı platform</Text><Text style={{ color: colors.muted, fontSize: 14, lineHeight: 22 }}>OrtakSat para tutmaz; ödeme, teslimat ve komisyon ödemesi taraflar arasında gerçekleşir. İlan ve kullanıcı değerlendirmelerini incele, şüpheli durumları bildir ve anlaşma ayrıntılarını mesajlarında kayıt altında tut.</Text><Link href="/sss" asChild><Pressable accessibilityRole="link" style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: colors.primaryDark, fontWeight: "700" }}>Yardım merkezine git →</Text></Pressable></Link></View>
  </InformationPage>;
}

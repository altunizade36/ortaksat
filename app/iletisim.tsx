import { MaterialCommunityIcons } from "@/components/icons";
import { Link } from "expo-router";
import Head from "expo-router/head";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { openUrlSafe } from "@/lib/link";
import { WebFooter } from "@/components/web-landing";
import { SUPPORT_EMAIL, SUPPORT_EMAIL_MAILTO } from "@/lib/contact";
import { translateCopy, useLanguage } from "@/lib/i18n";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const REASONS: Array<{ icon: IconName; title: string; body: string }> = [
  { icon: "flag-outline", title: "Şikayet & bildirim", body: "Bir ilan, satıcı, ortak veya kullanıcı hakkında şikayetini ilet. Ekran görüntüsü ve varsa ilan bağlantısını eklersen daha hızlı ilerleriz." },
  { icon: "shield-alert-outline", title: "Dolandırıcılık / güvenlik", body: "Şüpheli işlem, sahte ilan veya güvenlik endişesi için bize yaz. Maddi kayıp/suç şüphesinde ayrıca 155 (Polis) / 156 (Jandarma)." },
  { icon: "file-document-outline", title: "Yasal & KVKK başvurusu", body: "Kişisel verilerine ilişkin talepler (erişim, düzeltme, silme) ve yasal başvurular için bu adresi kullanabilirsin." },
  { icon: "help-circle-outline", title: "Genel bilgi & destek", body: "Hesap, ilan, ortak satış veya komisyon süreçleriyle ilgili sorularını ilet." }
];

export default function ContactScreen() {
  const { language } = useLanguage();
  function openMail() {
    void openUrlSafe(SUPPORT_EMAIL_MAILTO);
  }
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: 0, paddingTop: 16 }} style={{ backgroundColor: colors.background }}>
      <Head>
        <title>{translateCopy("İletişim — OrtakSat destek, şikayet ve başvuru", language)}</title>
        <meta name="description" content={translateCopy("OrtakSat ile iletişim: şikayet, dolandırıcılık bildirimi, KVKK/yasal başvuru ve genel destek için destek@ortaksat.com. Ortaksat aracı platformdur; iletişim e-posta üzerinden yürür.", language)} />
        <meta property="og:title" content={translateCopy("İletişim — OrtakSat", language)} />
        <meta property="og:description" content={translateCopy("Şikayet, bilgi, yasal başvuru ve destek: destek@ortaksat.com", language)} />
      </Head>
      <View style={{ alignSelf: "center", gap: 18, maxWidth: 820, paddingHorizontal: 20, width: "100%" }}>
        {/* Breadcrumb */}
        <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
          <Link href="/" asChild>
            <Pressable style={({ pressed }) => ({ alignItems: "center", flexDirection: "row", gap: 3, opacity: pressed ? 0.7 : 1 })}>
              <MaterialCommunityIcons name="home-outline" size={14} color={colors.primaryDark} />
              <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Ana sayfa", language)}</Text>
            </Pressable>
          </Link>
          <MaterialCommunityIcons name="chevron-right" size={15} color={colors.subtle} />
          <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>{translateCopy("İletişim", language)}</Text>
        </View>

        <View style={{ gap: 8 }}>
          <Text accessibilityRole="header" {...({ role: "heading", "aria-level": 1 } as Record<string, unknown>)} style={{ color: colors.ink, fontSize: 30, fontWeight: "900", lineHeight: 36 }}>
            {translateCopy("İletişim", language)}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 15.5, fontWeight: "600", lineHeight: 23 }}>
            {translateCopy("OrtakSat bir aracı platformdur; çağrı merkezi/telefon hattı işletmez. Şikayet, bilgi, yasal başvuru ve destek talepleri için bize e-posta ile ulaşabilirsin. Genellikle 1–3 iş günü içinde dönüş yaparız.", language)}
          </Text>
        </View>

        {/* Prominent e-posta kartı */}
        <Pressable onPress={openMail} style={({ pressed }) => ({ backgroundColor: colors.primarySoft, borderColor: colors.primary, borderRadius: 16, borderWidth: 1, gap: 6, opacity: pressed ? 0.9 : 1, padding: 20 })}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <MaterialCommunityIcons name="email-outline" size={20} color={colors.primaryDark} />
            <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900", textTransform: "uppercase" }}>{translateCopy("E-posta", language)}</Text>
          </View>
          <Text selectable {...(Platform.OS === "web" ? ({ href: SUPPORT_EMAIL_MAILTO } as Record<string, unknown>) : {})} style={{ color: colors.ink, fontSize: 22, fontWeight: "900" }}>
            {SUPPORT_EMAIL}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>{translateCopy("Yazmak için dokun — varsayılan e-posta uygulaman açılır.", language)}</Text>
        </Pressable>

        {/* Ne için yazabilirsin */}
        <View style={{ gap: 12 }}>
          {REASONS.map((r) => (
            <View key={r.title} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 12, padding: 16 }}>
              <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 10, height: 40, justifyContent: "center", width: 40 }}>
                <MaterialCommunityIcons name={r.icon} size={20} color={colors.primaryDark} />
              </View>
              <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
                <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>{translateCopy(r.title, language)}</Text>
                <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "500", lineHeight: 20 }}>{translateCopy(r.body, language)}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 12, gap: 4, padding: 14 }}>
          <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "800" }}>{translateCopy("Önemli", language)}</Text>
          <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "500", lineHeight: 19 }}>
            {translateCopy("OrtakSat ödeme tutmaz, kargo/teslimat yürütmez. Satış, ödeme ve teslimat satıcı ile alıcı arasında gerçekleşir. Alışverişle ilgili anlaşmazlıklarda önce karşı tarafla platform mesajlaşmasında iletişim kurman, kayıtların korunması açısından önemlidir.", language)}
          </Text>
          <Link href="/legal" asChild>
            <Pressable style={{ marginTop: 4 }}><Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{translateCopy("Yasal & Destek belgeleri", language)} →</Text></Pressable>
          </Link>
        </View>
      </View>
      <WebFooter />
    </ScrollView>
  );
}

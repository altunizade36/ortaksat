import { MaterialCommunityIcons } from "@/components/icons";
import { Link } from "expo-router";
import Head from "expo-router/head";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Accordion } from "@/components/accordion";
import { colors } from "@/components/colors";
import { WebContainer } from "@/components/web-container";
import { WebFooter } from "@/components/web-landing";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { VERIFICATION_LEVELS, VERIFICATION_ROADMAP } from "@/lib/verification";
import { useIsWideWeb } from "@/lib/layout";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const BUYER_STEPS: Array<{ icon: IconName; t: string; b: string }> = [
  { icon: "image-search-outline", t: "Ürünü ve satıcıyı incele", b: "Gerçek fotoğraf, net açıklama ve satıcı puanına bak. Doğrulanmış satıcı rozeti ve satış geçmişi güven verir." },
  { icon: "message-text-outline", t: "Satıcıyla platformda konuş", b: "Soruları ilan üzerinden sor. Sohbeti hemen WhatsApp/Instagram'a taşımak isteyen satıcıya karşı dikkatli ol." },
  { icon: "map-marker-check-outline", t: "Mümkünse görerek al", b: "Elden teslimde kalabalık, güvenli ve gündüz bir yerde buluş. Ürünü teslim almadan ödeme yapma." },
  { icon: "truck-check-outline", t: "Kargoda güvenli öde", b: "Kapıda ödeme veya kapıda görerek teslim tercih et. Ürünü görmeden kapora/ön ödeme gönderme." },
  { icon: "star-outline", t: "Deneyimini puanla", b: "Alışveriş sonrası satıcıyı puanla; topluluğu koru, dürüst satıcılar öne çıksın." }
];

const RED_FLAGS: string[] = [
  "Ürünü görmeden kapora, ön ödeme veya 'kargo ücreti' istiyorsa.",
  "Piyasanın çok altında, 'acele et, başkası alacak' baskısıyla fiyat veriyorsa.",
  "Seni hemen platform dışına (WhatsApp/Telegram) çekip oradan ödeme istiyorsa.",
  "Sahte kargo takip linki, 'ödemeyi onayla' SMS'i veya banka/kod bilgisi istiyorsa.",
  "Kimliği, hesabı yeni ve puanı/geçmişi yoksa ve buna rağmen büyük ödeme istiyorsa.",
  "IBAN'ı ilandaki isimle uyuşmuyor ya da 'başkasının hesabına yatır' diyorsa."
];

const SELLER_TIPS: Array<{ icon: IconName; t: string; b: string }> = [
  { icon: "cash-check", t: "Ödemeyi teyit et", b: "Ürünü göndermeden ödemenin hesabına gerçekten geçtiğini doğrula. Sahte dekonta güvenme." },
  { icon: "package-variant-closed-check", t: "Kargo kaydını tut", b: "Takip numarasını sakla; teslim kanıtı anlaşmazlıkta seni korur." },
  { icon: "shield-alert-outline", t: "Şüpheliyi bildir", b: "Seni dolandırmaya çalışan alıcıyı 'Bildir' ile kayda geçir." }
];

const FAQ: Array<{ q: string; a: string }> = [
  { q: "OrtakSat ödememi tutuyor mu, garanti veriyor mu?", a: "Hayır. OrtakSat bir aracı ilan ve eşleşme platformudur; para tutmaz, ödeme almaz, kargo yapmaz, komisyon tahsil etmez. Ödeme, teslimat ve komisyon şartlarını satıcı, alıcı ve ortak kendi aralarında belirler. Bu yüzden ödeme ve teslimatta yukarıdaki güvenlik adımlarını uygulaman önemlidir." },
  { q: "Bir kullanıcı ya da ilanı nasıl şikayet ederim?", a: "İlan sayfasındaki 'Bildir' düğmesiyle ya da kullanıcının profilinden şikayet oluşturabilirsin. Kayıt moderasyon ekibine düşer ve incelenir. Şüpheli her durumu bildirmen hem seni hem topluluğu korur." },
  { q: "Doğrulanmış satıcı rozeti ne anlama gelir?", a: "Telefon/kimlik gibi bilgileri doğrulanmış satıcılarda rozet görünür. Rozet güven artırır ama yine de ödeme/teslimat adımlarında dikkatli olmalısın; rozet tek başına garanti değildir." },
  { q: "Dolandırıldığımı düşünüyorum, ne yapmalıyım?", a: "Önce kullanıcıyı/ilanı 'Bildir' ile kayda geçir. Maddi kayıp veya suç şüphesi varsa yerel kolluk kuvvetlerine (155 Polis / 156 Jandarma) başvur ve elindeki mesaj, dekont, kargo kaydı gibi kanıtları sakla." }
];

const faqLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } }))
});

export default function SafeShoppingGuidePage() {
  const isWideWeb = useIsWideWeb();
  const { language } = useLanguage();
  const title = translateCopy("Güvenli Alışveriş Rehberi — Dolandırıcılıktan Korunma | OrtakSat", language);
  const desc = translateCopy("OrtakSat güvenli alışveriş rehberi: platform ödeme tutmaz, taraflar kendi aralarında anlaşır. Güvenli alım-satım adımları, dolandırıcılık kırmızı bayrakları ve şikayet etme yolları.", language);
  const url = "https://www.ortaksat.com/guvenli-alisveris";

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ backgroundColor: colors.background, paddingBottom: 24 }} style={{ backgroundColor: colors.background }}>
      <Head>
        <title>{title}</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href={url} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={desc} />
        <meta property="og:url" content={url} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqLd }} />
      </Head>

      <WebContainer max={1280} padding={16} style={{ gap: 18, paddingTop: 18 }}>
        {/* Hero */}
        <View style={{ gap: 8 }}>
          <View style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primarySoft, borderRadius: 999, flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingVertical: 6 }}>
            <MaterialCommunityIcons name="shield-check" size={15} color={colors.primaryDark} />
            <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "900" }}>{translateCopy("Güven Merkezi", language)}</Text>
          </View>
          <Text style={{ color: colors.ink, fontSize: isWideWeb ? 30 : 25, fontWeight: "900", lineHeight: isWideWeb ? 36 : 30 }}>{translateCopy("Güvenli Alışveriş Rehberi", language)}</Text>
          <Text style={{ color: colors.muted, fontSize: 14.5, fontWeight: "600", lineHeight: 22, maxWidth: 680 }}>
            {translateCopy("Birkaç basit adımla alım-satımını güvende tut. Dolandırıcılığın çoğu, ürünü görmeden ödeme yapmaktan ve platform dışına çıkmaktan kaynaklanır.", language)}
          </Text>
        </View>

        {/* Platform ödeme almaz — en kritik açıklama */}
        <View style={{ backgroundColor: colors.warningSoft, borderColor: colors.warning, borderRadius: 16, borderWidth: 1, flexDirection: "row", gap: 12, padding: 18 }}>
          <MaterialCommunityIcons name="alert-decagram" size={26} color={colors.warning} />
          <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
            <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{translateCopy("OrtakSat ödeme almaz, para tutmaz", language)}</Text>
            <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600", lineHeight: 20 }}>
              {translateCopy("OrtakSat yalnızca satıcı, ortak ve alıcıyı buluşturur. Ödeme, teslimat ve komisyon şartlarını taraflar kendi aralarında belirler — platform bu sürecin tarafı değildir ve garanti vermez. Bu yüzden ödemeyi ve teslimatı güvenli yürütmek senin elinde. Aşağıdaki adımlar bunun için.", language)}
            </Text>
          </View>
        </View>

        {/* Doğrulama seviyeleri — "Doğrulanmış satıcı" ne demek, dürüstçe. */}
        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: isWideWeb ? 22 : 16 }}>
          <View style={{ gap: 3 }}>
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{translateCopy("\"Doğrulanmış satıcı\" ne anlama gelir?", language)}</Text>
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", lineHeight: 19 }}>{translateCopy("OrtakSat'ta doğrulama, satıcının kimliğini ve iletişimini teyit eden adımlardır. Bir satıcının profilinde YALNIZCA gerçekten tamamladığı doğrulamalar rozet olarak görünür.", language)}</Text>
          </View>
          <View style={{ gap: 10 }}>
            {VERIFICATION_LEVELS.map((lvl) => (
              <View key={lvl.key} style={{ alignItems: "flex-start", flexDirection: "row", gap: 10 }}>
                <View style={{ alignItems: "center", backgroundColor: colors.successSoft, borderRadius: 8, height: 34, justifyContent: "center", width: 34 }}>
                  <MaterialCommunityIcons name={lvl.icon as IconName} size={18} color={colors.success} />
                </View>
                <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
                  <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "900" }}>{translateCopy(lvl.label, language)}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{translateCopy(lvl.desc, language)}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={{ borderTopColor: colors.line, borderTopWidth: 1, gap: 8, paddingTop: 12 }}>
            <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Henüz sunmadığımız seviyeler (yakında):", language)}</Text>
            {VERIFICATION_ROADMAP.map((r) => (
              <View key={r.label} style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                <MaterialCommunityIcons name={r.icon as IconName} size={15} color={colors.subtle} />
                <Text style={{ color: colors.subtle, flex: 1, fontSize: 12, fontWeight: "700" }}>{translateCopy(r.label, language)} — {translateCopy(r.desc, language)}</Text>
              </View>
            ))}
            <Text style={{ color: colors.subtle, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>{translateCopy("Bu seviyeler henüz uygulanmadığından hiçbir satıcıya bu rozetler atanmaz.", language)}</Text>
          </View>
        </View>

        {/* Alıcı adımları */}
        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>{translateCopy("Alıcı için 5 güvenli adım", language)}</Text>
          <View style={{ gap: 10 }}>
            {BUYER_STEPS.map((s, i) => (
              <View key={s.t} style={{ alignItems: "flex-start", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 12, padding: 16 }}>
                <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 34, justifyContent: "center", width: 34 }}>
                  <Text style={{ color: colors.primaryDark, fontSize: 14, fontWeight: "900" }}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
                    <MaterialCommunityIcons name={s.icon} size={17} color={colors.primaryDark} />
                    <Text style={{ color: colors.ink, fontSize: 14.5, fontWeight: "900" }}>{translateCopy(s.t, language)}</Text>
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", lineHeight: 19 }}>{translateCopy(s.b, language)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Dolandırıcılık kırmızı bayrakları */}
        <View style={{ backgroundColor: colors.accentSoft, borderColor: colors.accent, borderRadius: 16, borderWidth: 1, gap: 10, padding: 18 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <MaterialCommunityIcons name="flag-variant" size={20} color={colors.accent} />
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{translateCopy("Dolandırıcılık kırmızı bayrakları", language)}</Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>{translateCopy("Bunlardan biriyle karşılaşırsan dur, ödeme yapma ve bildir:", language)}</Text>
          <View style={{ gap: 8 }}>
            {RED_FLAGS.map((r) => (
              <View key={r} style={{ alignItems: "flex-start", flexDirection: "row", gap: 8 }}>
                <MaterialCommunityIcons name="close-circle" size={16} color={colors.accent} style={{ marginTop: 1 }} />
                <Text style={{ color: colors.ink, flex: 1, fontSize: 13.5, fontWeight: "700", lineHeight: 19 }}>{translateCopy(r, language)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Satıcı ipuçları */}
        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>{translateCopy("Satıcı için güvenlik", language)}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {SELLER_TIPS.map((s) => (
              <View key={s.t} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flexBasis: 280, flexGrow: 1, gap: 6, padding: 16 }}>
                <MaterialCommunityIcons name={s.icon} size={22} color={colors.primaryDark} />
                <Text style={{ color: colors.ink, fontSize: 14.5, fontWeight: "900" }}>{translateCopy(s.t, language)}</Text>
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{translateCopy(s.b, language)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Şikayet / bildirim */}
        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 10, padding: 18 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <MaterialCommunityIcons name="flag-outline" size={20} color={colors.primaryDark} />
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{translateCopy("Şüpheli durumu bildir", language)}</Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600", lineHeight: 20 }}>
            {translateCopy("İlan sayfasındaki", language)} <Text style={{ color: colors.ink, fontWeight: "900" }}>"{translateCopy("Bildir", language)}"</Text> {translateCopy("düğmesiyle ya da kullanıcının profilinden şikayet oluşturabilirsin. Kayıt moderasyon ekibine düşer. Maddi kayıp veya suç şüphesinde 155 (Polis) / 156 (Jandarma) hattına başvur ve kanıtlarını sakla.", language)}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Link href="/explore" asChild>
              <Pressable style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 11, flexDirection: "row", gap: 6, paddingHorizontal: 18, paddingVertical: 11 }}>
                <MaterialCommunityIcons name="magnify" size={16} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{translateCopy("İlanları Keşfet", language)}</Text>
              </Pressable>
            </Link>
            <Link href="/trust" asChild>
              <Pressable style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 11, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 18, paddingVertical: 11 }}>
                <MaterialCommunityIcons name="shield-check-outline" size={16} color={colors.primaryDark} />
                <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>{translateCopy("Güven Merkezim", language)}</Text>
              </Pressable>
            </Link>
          </View>
        </View>

        {/* SSS */}
        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>{translateCopy("Sık sorulan sorular", language)}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {FAQ.map((item) => (
              <View key={item.q} style={{ flexBasis: 240, flexGrow: 1, minWidth: 0, maxWidth: 760 }}>
                <Accordion title={translateCopy(item.q, language)} icon="comment-question-outline">
                  <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "500", lineHeight: 21 }}>{translateCopy(item.a, language)}</Text>
                </Accordion>
              </View>
            ))}
          </View>
        </View>
      </WebContainer>
      <WebFooter />
    </ScrollView>
  );
}

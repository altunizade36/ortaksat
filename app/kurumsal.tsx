import { MaterialCommunityIcons } from "@/components/icons";
import { Link } from "expo-router";
import Head from "expo-router/head";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Accordion } from "@/components/accordion";
import { colors } from "@/components/colors";
import { WebContainer } from "@/components/web-container";
import { WebFooter } from "@/components/web-landing";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useIsWideWeb } from "@/lib/layout";
import { openUrlSafe } from "@/lib/link";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

// Bu sayfadaki her madde ÇALIŞAN ve uçtan uca denenmiş bir özelliği anlatır (toplu ilan ekranı, XML bağlantısı,
// otomatik eşitleme, yeni ürünlerin ilana dönüşmesi, kategori eşleme, ortaklık türleri, satıcı paneli).
// Olmayan bir şeyi (ödeme altyapısı, incelemesiz otomatik yayın) vaat etme.
const FEATURES: Array<{ icon: IconName; t: string; b: string }> = [
  { icon: "xml", t: "XML ve CSV ile toplu yükleme", b: "E-ticaret sitenin ürün XML bağlantısını yapıştır ya da XML / CSV dosyanı yükle; ürün adı, kodu, fiyatı, stoğu, kategorisi, markası ve görselleri otomatik tanınır." },
  { icon: "sync", t: "Otomatik eşitleme", b: "XML bağlantını kaydet; fiyat ve stoklar seçtiğin aralıkla (1–24 saat) kendiliğinden güncellensin. İstersen yeni ürünler ilan olarak açılır, başlık, açıklama ve görseller de akıştakiyle eşitlenir." },
  { icon: "account-group", t: "Komisyonla çalışan satış ağı", b: "Ortaklar ürünlerini kendi çevresine ve takipçilerine tanıtır. Komisyonu sen belirlersin; ödemeyi yalnız satış gerçekleşince, doğrudan ortağa yaparsın." },
  { icon: "tune", t: "Ürün bazında kontrol", b: "Komisyonu ve ortaklık türünü (onayına bağlı, herkese açık ya da ortaksız) yüklerken topluca seçer, CSV'de satır satır belirler, sonra her ilanda ayrı ayrı değiştirebilirsin." },
  { icon: "chart-line", t: "Satıcı paneli", b: "Hangi ilana kaç ortak katıldı, kaç talep ve satış geldi; panelinden takip eder, kayıtları dışa aktarırsın." },
  { icon: "cash-remove", t: "Ücretsiz", b: "İlan vermek, toplu yüklemek ve ortak toplamak ücretsizdir. Üyelik ücreti ya da aidat yoktur." }
];

const STEPS: Array<{ icon: IconName; t: string; b: string }> = [
  { icon: "account-plus-outline", t: "1. Hesabını aç", b: "E-posta adresinle ücretsiz hesap oluştur." },
  { icon: "file-upload-outline", t: "2. Kataloğunu yükle", b: "Toplu ilan ekranında XML bağlantını yapıştır ya da dosyanı seç; varsayılan ili ve komisyonu belirle." },
  { icon: "table-check", t: "3. Önizle ve gönder", b: "Her satırın kategorisini, fiyatını ve hatalarını yayından önce görürsün." },
  { icon: "share-variant-outline", t: "4. Ortaklar tanıtsın", b: "İlanların yayına girer; ortaklar başvurur ve ürünlerini paylaşmaya başlar." }
];

const FAQ: Array<{ q: string; a: string }> = [
  { q: "Hangi XML biçimleri destekleniyor?", a: "Her üründe bir ad ve bir fiyat etiketi bulunan ürün XML'leri okunur. Türkçe ve İngilizce yaygın etiket adları (UrunAdi, StokKodu, Fiyat, Kategori, Resim; title, price, image_link vb.) ile Google Merchant ürün akışı tanınır. Tanınmayan bir alan olursa önizlemede görürsün; destek ekibine örnek dosya gönderebilirsin." },
  { q: "XML bağlantısı verip otomatik güncelleme yapılabiliyor mu?", a: "Evet. Toplu ilan ekranında XML bağlantını kaydedersin (en çok 5 bağlantı, her birinin ayarı ayrı). Fiyat ve stoklar 1, 3, 6, 12 ya da 24 saatte bir kendiliğinden güncellenir; stokta kalmayan ürünün ilanı pasife alınır, yeniden stoğa girince geri açılır. İstersen akışa eklenen yeni ürünler ilan olarak açılır, başlık, açıklama ve görseller de eşitlenir." },
  { q: "Mağazamdaki kategoriler OrtakSat kategorileriyle nasıl eşleşiyor?", a: "Bağlantını eklerken mağazandaki kategoriler listelenir ve her biri için bir OrtakSat kategorisi önerilir. Önerileri bir kez kontrol edip düzeltirsin; eşitleme hep bu tabloyu kullanır. Eşlemediğin ya da sonradan eklenen kategorilerdeki ürünler seçtiğin varsayılan kategoriye gider." },
  { q: "Otomatik açılan ilanlar hemen yayına giriyor mu?", a: "Hayır. Otomatik ya da toplu açılan her yeni ilan önce incelemeden geçer, onaylandıktan sonra yayına girer. Mevcut ilanlarındaki fiyat ve stok güncellemeleri anında uygulanır." },
  { q: "Ödeme ve kargoyu OrtakSat mı yapıyor?", a: "Hayır. OrtakSat bir ilan ve eşleşme platformudur; para tutmaz, kargo yapmaz. Ödeme ve teslimat seninle alıcı arasında, komisyon ödemesi seninle ortak arasında gerçekleşir." },
  { q: "Komisyonu kim, ne zaman öder?", a: "Komisyonu sen belirlersin ve yalnız satış gerçekleştiğinde, anlaştığınız kanaldan doğrudan ortağa ödersin. Platform komisyondan pay almaz." },
  { q: "Bir seferde kaç ürün yükleyebilirim?", a: "Bir XML dosyasında 20.000 ürüne kadar okunur; ürünler 200'lük partiler halinde önizlenip yüklenir. Bir saatte en çok 2.000 yeni ilan eklenebilir; sınıra ulaşılırsa kalan ürünler bekler ve bir saat sonra kaldığı yerden devam edilir. Yeni toplu ilanlar yayına girmeden önce incelemeden geçer." },
  { q: "Ürünlerim hangi şehirde görünür?", a: "XML akışlarında şehir bilgisi bulunmadığı için yüklerken bir varsayılan il (ve istersen ilçe) seçersin. CSV dosyasında her ürüne ayrı il yazabilirsin." }
];

const faqLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } }))
});

export default function CorporateLandingPage() {
  const isWideWeb = useIsWideWeb();
  const { language } = useLanguage();
  const title = translateCopy("Kurumsal Satıcılar — XML ile Toplu İlan ve Komisyonlu Satış Ağı | OrtakSat", language);
  const desc = translateCopy("Ürün kataloğunu XML ya da CSV ile OrtakSat'a yükle, komisyonunu belirle; ortaklar ürünlerini tanıtsın. Ücretsiz; yalnız satış gerçekleşince komisyon ödersin.", language);
  const url = "https://www.ortaksat.com/kurumsal";
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("OrtakSat · Kurumsal iş birliği")}`;

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

      <WebContainer max={1080} padding={16} style={{ gap: 20, paddingTop: 18 }}>
        {/* Hero */}
        <View style={{ backgroundColor: colors.primaryDark, borderRadius: 18, gap: 12, padding: isWideWeb ? 26 : 18 }}>
          <View style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999, flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingVertical: 6 }}>
            <MaterialCommunityIcons name="domain" size={15} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "900" }}>{translateCopy("Kurumsal satıcılar ve e-ticaret markaları için", language)}</Text>
          </View>
          <Text accessibilityRole="header" style={{ color: "#FFFFFF", fontSize: isWideWeb ? 34 : 26, fontWeight: "900", lineHeight: isWideWeb ? 40 : 31 }}>{translateCopy("Kataloğunu yükle, ürünlerini komisyonlu satış ağı tanıtsın", language)}</Text>
          <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 15, fontWeight: "600", lineHeight: 23, maxWidth: 680 }}>
            {translateCopy("Ürün XML'ini ya da CSV dosyanı yükle, komisyonunu belirle. Ortaklar ürünlerini kendi çevresine tanıtır; sen yalnız satış gerçekleşince komisyon ödersin. Listeleme ücretsizdir.", language)}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <Link href="/toplu-ilan" asChild>
              <Pressable accessibilityRole="link" style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 12, flexDirection: "row", gap: 8, minHeight: 48, paddingHorizontal: 22 }}>
                <MaterialCommunityIcons name="file-upload-outline" size={18} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, fontSize: 15, fontWeight: "900" }}>{translateCopy("Kataloğunu Yükle", language)}</Text>
              </Pressable>
            </Link>
            <Pressable accessibilityRole="link" onPress={() => void openUrlSafe(mailto)} style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.5)", borderRadius: 12, borderWidth: 1.5, flexDirection: "row", gap: 8, minHeight: 48, paddingHorizontal: 22 }}>
              <MaterialCommunityIcons name="email-outline" size={18} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "900" }}>{translateCopy("Bize Yaz", language)}</Text>
            </Pressable>
          </View>
        </View>

        {/* Özellikler */}
        <View style={{ gap: 12 }}>
          <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 21, fontWeight: "900" }}>{translateCopy("Kurumsal satıcılara neler sunuyoruz?", language)}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {FEATURES.map((c) => (
              <View key={c.t} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flexBasis: 320, flexGrow: 1, gap: 6, minWidth: 0, padding: 16 }}>
                <MaterialCommunityIcons name={c.icon} size={22} color={colors.primaryDark} />
                <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>{translateCopy(c.t, language)}</Text>
                <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", lineHeight: 19 }}>{translateCopy(c.b, language)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Adımlar */}
        <View style={{ gap: 12 }}>
          <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 21, fontWeight: "900" }}>{translateCopy("Dört adımda kataloğun yayında", language)}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {STEPS.map((s) => (
              <View key={s.t} style={{ backgroundColor: colors.primarySoft, borderRadius: 14, flexBasis: 230, flexGrow: 1, gap: 6, minWidth: 0, padding: 16 }}>
                <MaterialCommunityIcons name={s.icon} size={22} color={colors.primaryDark} />
                <Text style={{ color: colors.ink, fontSize: 14.5, fontWeight: "900" }}>{translateCopy(s.t, language)}</Text>
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{translateCopy(s.b, language)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Aracı platform notu */}
        <View style={{ alignItems: "flex-start", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 10, padding: 16 }}>
          <MaterialCommunityIcons name="handshake-outline" size={20} color={colors.primaryDark} style={{ marginTop: 1 }} />
          <Text style={{ color: colors.muted, flex: 1, fontSize: 13, fontWeight: "600", lineHeight: 20 }}>
            <Text style={{ color: colors.ink, fontWeight: "900" }}>{translateCopy("OrtakSat aracı bir platformdur.", language)}</Text>
            {" "}
            {translateCopy("Para tutmaz, ödeme almaz, kargo yapmaz. Satış, ödeme ve teslimat seninle alıcı arasında; komisyon ödemesi seninle ortak arasında gerçekleşir.", language)}
          </Text>
        </View>

        {/* SSS */}
        <View style={{ gap: 12 }}>
          <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>{translateCopy("Sık sorulan sorular", language)}</Text>
          <View style={{ gap: 10 }}>
            {FAQ.map((item) => (
              <Accordion key={item.q} title={translateCopy(item.q, language)} icon="comment-question-outline">
                <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "500", lineHeight: 22 }}>{translateCopy(item.a, language)}</Text>
              </Accordion>
            ))}
          </View>
        </View>

        {/* CTA */}
        <View style={{ alignItems: isWideWeb ? "center" : "stretch", backgroundColor: colors.primarySoft, borderRadius: 18, flexDirection: isWideWeb ? "row" : "column", gap: 16, padding: 22 }}>
          <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
            <Text style={{ color: colors.ink, fontSize: 19, fontWeight: "900" }}>{translateCopy("Kataloğunla ilgili sorun mu var?", language)}</Text>
            <Text selectable style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600", lineHeight: 20 }}>{translateCopy("Örnek XML dosyanı ve sorularını bize gönder:", language)} {SUPPORT_EMAIL}</Text>
          </View>
          <Link href="/toplu-ilan" asChild>
            <Pressable accessibilityRole="link" style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 12, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 48, paddingHorizontal: 24 }}>
              <MaterialCommunityIcons name="file-upload-outline" size={18} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "900" }}>{translateCopy("Toplu İlan Yükle", language)}</Text>
            </Pressable>
          </Link>
        </View>
      </WebContainer>
      <WebFooter />
    </ScrollView>
  );
}

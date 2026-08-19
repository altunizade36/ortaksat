import { Link, type Href } from "expo-router";
import Head from "expo-router/head";
import { type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { MaterialCommunityIcons } from "@/components/icons";
import { Accordion } from "@/components/accordion";
import { colors } from "@/components/colors";
import { WebFooter } from "@/components/web-landing";
import { useIsWideWeb } from "@/lib/layout";

// CORNERSTONE / PILLAR sayfası — "ortak satış nedir", "satış ortaklığı nedir", "komisyonla satış
// nasıl yapılır" gibi Sahibinden'in RAKİP OLMADIĞI niş, bilgi-amaçlı head-term'leri hedefler.
// İçerik SSG'ye bake edilir (crawler okur); title/desc/FAQ JSON-LD seo-static ile enjekte edilir.
// İç-link: kategori hub'ları + /partner + /satici-ol + blog → konusal otorite + otorite akışı.

const FAQ: Array<{ q: string; a: string }> = [
  { q: "Ortak satış nedir?", a: "Ortak satış, bir satıcının ürününü kendi takipçisi veya çevresiyle tanıtan 'ortaklar' aracılığıyla sattığı modeldir. Satış gerçekleşince ortak, satıcının önceden belirlediği komisyonu kazanır. Sermaye, stok veya ön ödeme gerektirmez." },
  { q: "Ortak satış ile bayilik/dropshipping aynı şey mi?", a: "Hayır. Bayilikte ürünü satın alıp yeniden satarsın; dropshipping'de siparişi sen yönetirsin. Ortak satışta ise ürün ve satış satıcıda kalır — sen yalnızca tanıtır, yönlendirir ve satış olunca komisyon alırsın. Risk ve maliyet yok." },
  { q: "Komisyonla satış nasıl yapılır?", a: "Satıcı ilanını açar ve komisyon oranını (yüzde ya da sabit tutar) belirler. Ortak, ürünü Instagram, TikTok, WhatsApp veya kendi yöntemiyle tanıtır. Alıcı satıcıyla iletişime geçip satın alır; satış onaylanınca ortak komisyonunu satıcıdan alır." },
  { q: "OrtakSat para veya kargo işine karışıyor mu?", a: "Hayır. OrtakSat aracı bir ilan ve eşleşme platformudur; para tutmaz, ödeme almaz, kargo yapmaz. Ödeme ve teslimat her zaman alıcı ile satıcı arasında yapılır. Platform yalnızca ilanları, ortaklıkları ve komisyon takibini sağlar." },
  { q: "Ortak olmak için ne gerekir?", a: "Ücretsiz bir hesap yeterli. Beğendiğin ürüne 'Ortak Ol' talebi gönderirsin; satıcı kabul edince paylaşıma başlarsın. Zorunlu link, minimum takipçi veya aidat yoktur — küçük bir çevreyle bile başlayabilirsin." },
  { q: "Satıcıysam neden ortak satış kullanmalıyım?", a: "Ürününü, ödeme yapmadan, çok sayıda ortağın kendi kitlesine ulaştırmasını sağlarsın. Yalnızca gerçekleşen satışta komisyon ödersin — reklam bütçesi riskini ortadan kaldırır, erişimini büyütür." }
];

function H2({ children }: { children: ReactNode }) {
  return <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 20, fontWeight: "900", marginTop: 6 }}>{children}</Text>;
}
function P({ children }: { children: ReactNode }) {
  return <Text style={{ color: colors.muted, fontSize: 15, fontWeight: "500", lineHeight: 23 }}>{children}</Text>;
}
function LinkChip({ href, label }: { href: Href; label: string }) {
  return (
    <Link href={href} asChild>
      <Pressable style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 8 }}>
        <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{label}</Text>
      </Pressable>
    </Link>
  );
}

const CAT_LINKS: Array<{ href: Href; label: string }> = [
  { href: "/kategori/emlak" as Href, label: "Emlak" },
  { href: "/kategori/vasita" as Href, label: "Vasıta" },
  { href: "/kategori/cep-telefonu" as Href, label: "Cep Telefonu" },
  { href: "/kategori/beyaz-esya" as Href, label: "Beyaz Eşya" },
  { href: "/kategori/mobilya" as Href, label: "Mobilya" },
  { href: "/kategoriler" as Href, label: "Tüm Kategoriler" }
];

export default function OrtakSatisNedirPage() {
  const isWideWeb = useIsWideWeb();
  const title = "Ortak Satış Nedir? Komisyonla Satış ve Satış Ortaklığı Rehberi | OrtakSat";
  const desc = "Ortak satış nedir, nasıl çalışır ve komisyonla satış nasıl yapılır? Satıcı, ortak ve alıcı için sermayesiz, risksiz ortak satış modelini adım adım öğren. OrtakSat aracı platformdur.";
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, gap: 16, paddingBottom: 0, paddingHorizontal: isWideWeb ? 20 : 14, paddingTop: 18 }} style={{ backgroundColor: colors.background }}>
      <Head>
        <title>{title}</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href="https://www.ortaksat.com/ortak-satis-nedir" />
      </Head>

      <View style={{ alignSelf: "center", gap: 18, maxWidth: 820, width: "100%" }}>
        <View style={{ gap: 8 }}>
          <Text accessibilityRole="header" {...({ role: "heading", "aria-level": 1 } as Record<string, unknown>)} style={{ color: colors.ink, fontSize: isWideWeb ? 30 : 25, fontWeight: "900", lineHeight: isWideWeb ? 37 : 31 }}>Ortak satış nedir?</Text>
          <P>Ortak satış, bir satıcının ürününü doğrudan kendisi pazarlamak yerine, ürünü kendi çevresine tanıtan <Text style={{ fontWeight: "800", color: colors.ink }}>ortaklar</Text> aracılığıyla sattığı bir modeldir. Ortak; ürünü Instagram, TikTok, WhatsApp ya da kendi yöntemiyle tanıtır, satış gerçekleşince satıcının önceden belirlediği <Text style={{ fontWeight: "800", color: colors.ink }}>komisyonu</Text> kazanır. Sermaye, stok veya ön ödeme gerekmez.</P>
        </View>

        <View style={{ backgroundColor: colors.primarySoft, borderRadius: 14, gap: 6, padding: 16 }}>
          <Text style={{ color: colors.primaryDark, fontSize: 14, fontWeight: "900" }}>Kısaca</Text>
          <P>Satıcı ürünü + komisyonu belirler → Ortak kendi kitlesine tanıtır → Alıcı satıcıdan satın alır → Ortak komisyonunu alır. OrtakSat bu üçlüyü buluşturan <Text style={{ fontWeight: "800", color: colors.ink }}>aracı platformdur</Text>; para tutmaz, kargo yapmaz.</P>
        </View>

        <H2>Ortak satış nasıl çalışır?</H2>
        <P><Text style={{ fontWeight: "800", color: colors.ink }}>Satıcı için:</Text> Ürününü ücretsiz ilan olarak açarsın ve her satışta ödeyeceğin komisyonu (yüzde veya sabit tutar) belirlersin. Onaylanan ortaklar ürününü kendi kitlelerine ulaştırır; sen yalnızca gerçekleşen satışta komisyon ödersin. Reklam bütçesi riski olmadan erişimini büyütürsün.</P>
        <P><Text style={{ fontWeight: "800", color: colors.ink }}>Ortak için:</Text> Beğendiğin ürüne "Ortak Ol" talebi gönderirsin. Satıcı kabul edince ürünü kendi yönteminle tanıtırsın — zorunlu link, minimum takipçi veya aidat yoktur. Sattığında anlaştığın komisyonu doğrudan satıcıdan alırsın.</P>
        <P><Text style={{ fontWeight: "800", color: colors.ink }}>Alıcı için:</Text> Güvendiğin bir ortağın önerdiği ürünü incelersin ve satıcıyla doğrudan iletişime geçersin. Ödeme ve teslimat, aradaki komisyondan bağımsız olarak, seninle satıcı arasında yapılır — fiyatın değişmez.</P>

        <H2>Ortak satış, bayilik veya dropshipping'den farkı ne?</H2>
        <P>Bayilikte ürünü satın alıp yeniden satarsın; dropshipping'de siparişi ve tedariki sen yönetirsin. Ortak satışta ise ürün, stok ve satış satıcıda kalır — sen yalnızca tanıtır ve yönlendirirsin. Bu yüzden ortak satış <Text style={{ fontWeight: "800", color: colors.ink }}>sermayesiz ve risksizdir</Text>: satmadığın üründen zarar etmezsin.</P>

        <H2>Nereden başlanır?</H2>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <Link href="/partner" asChild><Pressable style={{ backgroundColor: colors.primary, borderRadius: 11, paddingHorizontal: 18, paddingVertical: 12 }}><Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>Ortak Ol, Kazan</Text></Pressable></Link>
          <Link href="/satici-ol" asChild><Pressable style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 11, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 12 }}><Text style={{ color: colors.ink, fontSize: 14, fontWeight: "900" }}>Satıcı Ol, İlan Ver</Text></Pressable></Link>
        </View>

        <H2>Popüler kategoriler</H2>
        <P>Ortak satışa açık binlerce ürünü kategorilere göre keşfedebilirsin:</P>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {CAT_LINKS.map((c) => <LinkChip key={c.label} href={c.href} label={c.label} />)}
        </View>

        <H2>Sık sorulan sorular</H2>
        <View style={{ gap: 8 }}>
          {FAQ.map((f) => (
            <Accordion key={f.q} title={f.q}>
              <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "500", lineHeight: 22 }}>{f.a}</Text>
            </Accordion>
          ))}
        </View>

        <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 10, marginTop: 4, padding: 16 }}>
          <MaterialCommunityIcons name="handshake-outline" size={24} color={colors.primaryDark} />
          <Text style={{ color: colors.ink, flex: 1, fontSize: 14, fontWeight: "700", lineHeight: 20 }}>OrtakSat ile ortak satış ücretsizdir: ilan vermek, ortak olmak ve komisyon takibi platformda; ödeme ve teslimat taraflar arasında.</Text>
        </View>
      </View>

      <WebFooter />
    </ScrollView>
  );
}

import { useIsWideWeb } from "@/lib/layout";
import { MaterialCommunityIcons } from "@/components/icons";
import { Link, type Href } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { PressLink } from "@/components/ui";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { translateCopy, useLanguage } from "@/lib/i18n";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/** Trust signals strip — reassures all three sides (ilan sahibi / ortak / alıcı). */
export function WebTrustStrip() {
  const { language } = useLanguage();
  const items: Array<{ icon: IconName; title: string; body: string }> = [
    { icon: "shield-check", title: "Anlaşma şartları kayıt altında", body: "Ortak satış anlaşması ve komisyon şartı sistemde saklanır; ödeme taraflar arasındadır." },
    { icon: "eye-check-outline", title: "Şeffaf süreç", body: "Talep, anlaşma ve komisyon şartı canlı panelde görünür." },
    { icon: "account-check-outline", title: "Doğrulanmış satıcılar", body: "Telefon/e-posta doğrulama ve güven puanı." },
    { icon: "star-check-outline", title: "Puan & yorumlar", body: "Her satış sonrası karşılıklı değerlendirme." }
  ];
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 4 }}>
      {items.map((item) => (
        <View
          key={item.title}
          style={{
            alignItems: "center",
            backgroundColor: colors.surfaceAlt,
            borderColor: colors.line,
            borderRadius: 16,
            borderWidth: 1,
            flexBasis: 240,
            flexDirection: "row",
            flexGrow: 1,
            gap: 12,
            paddingHorizontal: 16,
            paddingVertical: 14
          }}
        >
          <MaterialCommunityIcons name={item.icon} size={26} color={colors.primary} />
          <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 14, fontWeight: "900" }}>{translateCopy(item.title, language)}</Text>
            <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 16 }}>{translateCopy(item.body, language)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Web footer with brand, navigation columns and legal line. */
export function WebFooter() {
  const { language } = useLanguage();
  const isWideWeb = useIsWideWeb();
  // NOT: Footer bülten bloğu KALDIRILDI (Sahibinden-tarzı ince footer; "çok
  // kalın/abartı" geri bildirimi). Bülten kaydı blog sayfasında (app/blog.tsx)
  // duruyor — özellik korundu, yalnız footer'daki büyük blok temizlendi.
  const columns: Array<{ heading: string; links: Array<{ label: string; href: Href }> }> = [
    {
      heading: "Pazaryeri",
      links: [
        { label: "Keşfet", href: "/explore" },
        { label: "İlan Ver (Satıcı)", href: "/create" },
        { label: "Satıcı Ol", href: "/satici-ol" },
        { label: "Kategoriler", href: "/kategoriler" }
      ]
    },
    {
      // SEO: her sayfada render olan footer, ~1496 kategori hub'ına site-geneli iç-link/otorite
      // akışının EN YÜKSEK kaldıraçlı tek noktası. Yüksek-hacimli, index,follow kökler/alt-hub'lar.
      heading: "Popüler Kategoriler",
      links: [
        { label: "Emlak", href: "/kategori/emlak" as Href },
        { label: "Konut", href: "/kategori/konut" as Href },
        { label: "Vasıta", href: "/kategori/vasita" as Href },
        { label: "Otomobil", href: "/kategori/otomobil" as Href },
        { label: "Cep Telefonu", href: "/kategori/cep-telefonu" as Href },
        { label: "Beyaz Eşya", href: "/kategori/beyaz-esya" as Href },
        { label: "Mobilya", href: "/kategori/mobilya" as Href },
        { label: "Tüm Kategoriler", href: "/kategoriler" as Href }
      ]
    },
    {
      heading: "Kazan",
      links: [
        { label: "Ortak Ol", href: "/partner" },
        { label: "Nasıl Çalışır?", href: "/nasil-calisir" }
      ]
    },
    {
      heading: "Destek",
      links: [
        { label: "Yardım Merkezi", href: "/sss" },
        { label: "Güvenli Alışveriş", href: "/guvenli-alisveris" },
        { label: "Hakkımızda", href: "/hakkimizda" },
        { label: "İletişim", href: "/iletisim" }
      ]
    },
    {
      heading: "Hesabım",
      links: [
        { label: "Hesabım", href: "/profile" },
        { label: "Ortak Sözleşmem", href: "/legal?doc=ortak" },
        { label: "Komisyonlarım", href: "/partner" },
        { label: "Favorilerim", href: "/favorites" }
      ]
    },
    {
      heading: "Yasal",
      links: [
        { label: "Kullanım Şartları", href: "/kullanim-sartlari" },
        { label: "Gizlilik Politikası", href: "/gizlilik-politikasi" },
        { label: "KVKK", href: "/kvkk" },
        { label: "Çerez Politikası", href: "/cerez-politikasi" }
      ]
    }
  ];

  const trustBadges: Array<{ icon: IconName; label: string }> = [
    { icon: "shield-check", label: "Güvenli platform" },
    { icon: "account-check", label: "Doğrulanmış satıcılar" },
    { icon: "lock-outline", label: "KVKK uyumlu" }
  ];
  const light = "rgba(255,255,255,0.78)";

  return (
    <View
      style={{
        backgroundColor: colors.primaryDark,
        marginHorizontal: isWideWeb ? -20 : -12, // sayfa padding'iyle eşleş (mobil 12, masaüstü 20) — sabit -20 mobilde taşıyordu
        // Dibe sabit footer: ScrollView contentContainer flexGrow:1 olan sayfalarda
        // kısa içerikte footer'ı ekranın DİBİNE iter (altında beyaz boşluk kalmaz);
        // içerik uzunsa marginTop:auto=0 → normal akış. İnce üst çizgi + paddingTop
        // içerikten net AYIRIR ("içeriğe aşırı yakın" hissi biter).
        borderTopColor: colors.primary,
        borderTopWidth: 3,
        marginTop: "auto",
        paddingBottom: isWideWeb ? 12 : 12,
        paddingHorizontal: isWideWeb ? 32 : 16,
        paddingTop: isWideWeb ? 16 : 12
      }}
    >
      {/* MOBİL: marka bloğu TAM GENİŞLİK (kendi satırı), link sütunları DENGELİ 2-sütun
          ızgara (~%47) → eşit hizalı, kısa. MASAÜSTÜ: marka + 5 sütun tek satır (aynı). */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: isWideWeb ? 24 : 14, rowGap: isWideWeb ? 14 : 12 }}>
        <View style={{ flex: isWideWeb ? 1.4 : undefined, flexBasis: isWideWeb ? undefined : "100%", gap: isWideWeb ? 5 : 3, minWidth: isWideWeb ? 190 : 0 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "900", letterSpacing: 0.2 }}>ortaksat</Text>
          <Text style={{ color: light, fontSize: 12, fontWeight: "600", lineHeight: 16, maxWidth: 320 }}>
            {translateCopy("İlanını aç, satış yapabilecek ortaklarla eşleş; komisyonu birlikte belirleyin.", language)}
          </Text>
          <PressLink href="/iletisim" accessibilityLabel={SUPPORT_EMAIL} pressedOpacity={0.75} style={{ alignItems: "center", flexDirection: "row", gap: 6, marginTop: 2 }}>
            <MaterialCommunityIcons name="email-outline" size={13} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: "800" }}>{SUPPORT_EMAIL}</Text>
          </PressLink>
        </View>
        {columns.map((column) => (
          <View key={column.heading} style={{ gap: isWideWeb ? 5 : 3, flexBasis: isWideWeb ? 128 : "47%", flexGrow: 1, minWidth: isWideWeb ? 126 : 0 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: "900", letterSpacing: 0.2, marginBottom: 1 }}>{translateCopy(column.heading, language)}</Text>
            {column.links.map((link) => (
              <Link key={link.label} href={link.href} asChild>
                <Pressable style={{ paddingVertical: 2 }}>
                  <Text numberOfLines={1} style={{ color: light, fontSize: 12.5, fontWeight: "600" }}>{translateCopy(link.label, language)}</Text>
                </Pressable>
              </Link>
            ))}
          </View>
        ))}
      </View>
      <View style={{ alignItems: "center", borderTopColor: "rgba(255,255,255,0.16)", borderTopWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "space-between", marginTop: isWideWeb ? 12 : 10, paddingTop: isWideWeb ? 10 : 9 }}>
        <View style={{ flex: 1, gap: 2, minWidth: 200 }}>
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600" }}>
            {translateCopy("© 2026 OrtakSat. Tüm hakları saklıdır.", language)}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "600", lineHeight: 14.5, maxWidth: 680 }}>
            {translateCopy("OrtakSat ödeme, kargo veya komisyon tahsilatı yapmaz; yalnızca ilan, ortak satıcı eşleştirme, mesajlaşma ve anlaşma kaydı sağlar. Satış, ödeme, teslimat ve komisyon ödemesi kullanıcılar arasındaki anlaşmalardan ibaret olup tüm sorumluluk taraflara aittir.", language)}
          </Text>
        </View>
        {/* Rozet satırı flex ITEM olduğu için içeriği kadar genişleyip ebeveyni aşıyordu
            (390px ekranda +71px taşma). flexBasis:"100%" ile kendi satırını alır ve
            ebeveyn genişliğine sığar → çipler düzgün sarar. Ebeveyn ROW olduğu için
            flexBasis burada GENİŞLİK demektir (sütun konteynerde yükseklik olurdu). */}
        <View style={{ alignItems: "center", flexBasis: "100%", flexDirection: "row", flexWrap: "wrap", gap: 8, minWidth: 0 }}>
          {trustBadges.map((b) => (
            <View key={b.label} style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 999, flexDirection: "row", gap: 5, paddingHorizontal: 10, paddingVertical: 5 }}>
              <MaterialCommunityIcons name={b.icon} size={13} color="rgba(255,255,255,0.92)" />
              <Text style={{ color: "rgba(255,255,255,0.92)", fontSize: 11, fontWeight: "800" }}>{translateCopy(b.label, language)}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

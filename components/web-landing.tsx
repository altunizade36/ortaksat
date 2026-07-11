import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, type Href } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { subscribeNewsletterLive } from "@/lib/live-service";

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
  const { t, language } = useLanguage();
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [newsletterErr, setNewsletterErr] = useState(false);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  // Sonucu BEKLE + sonuca göre dallan (eskiden fire-and-forget → başarısızlıkta bile "kaydedildi" gösteriyordu).
  const submitNewsletter = async () => {
    if (!emailValid) return;
    setNewsletterErr(false);
    const res = await subscribeNewsletterLive(email.trim());
    if (res?.ok) setSubscribed(true); else setNewsletterErr(true);
  };
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
      heading: "Kazan",
      links: [
        { label: "Ortak / Influencer Ol", href: "/influencer-kazanc" },
        { label: "Kazanç Hesapla", href: "/ortak-kazanc" },
        { label: "Ortak Satış", href: "/partner" },
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
        marginHorizontal: -20,
        marginTop: 18,
        paddingBottom: 14,
        paddingHorizontal: 32,
        paddingTop: 18
      }}
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 24 }}>
        <View style={{ flex: 1.6, gap: 8, minWidth: 220 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "900" }}>ortaksat</Text>
          <Text style={{ color: light, fontSize: 13, fontWeight: "600", lineHeight: 19, maxWidth: 380 }}>
            {t("appSlogan")}. {translateCopy("İlanını aç, satış yapabilecek ortaklarla eşleş; komisyonu birlikte belirleyin.", language)}
          </Text>
          <Link href="/iletisim" asChild>
            <Pressable style={({ pressed }) => ({ alignItems: "center", flexDirection: "row", gap: 6, opacity: pressed ? 0.75 : 1 })}>
              <MaterialCommunityIcons name="email-outline" size={14} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>{SUPPORT_EMAIL}</Text>
            </Pressable>
          </Link>
          <View style={{ gap: 8, maxWidth: 380 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{translateCopy("Bültene abone ol", language)}</Text>
            {subscribed ? (
              <View style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 10, flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingVertical: 12 }}>
                <MaterialCommunityIcons name="check-circle" size={18} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", flex: 1, fontSize: 13, fontWeight: "700" }}>{translateCopy("Teşekkürler! Bülten aboneliğin kaydedildi.", language)}</Text>
              </View>
            ) : (
              <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder={translateCopy("E-posta adresin", language)}
                  placeholderTextColor="rgba(255,255,255,0.55)"
                  accessibilityLabel={translateCopy("Bülten için e-posta adresin", language)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                  {...({ name: "newsletter_email", "aria-label": translateCopy("Bülten için e-posta adresin", language), inputMode: "email" } as Record<string, unknown>)}
                  onSubmitEditing={() => { void submitNewsletter(); }}
                  returnKeyType="go"
                  style={{ backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.25)", borderRadius: 10, borderWidth: 1, color: "#FFFFFF", flex: 1, fontSize: 14, fontWeight: "600", height: 44, paddingHorizontal: 14 }}
                />
                <Pressable disabled={!emailValid} onPress={() => { void submitNewsletter(); }} style={{ alignItems: "center", backgroundColor: emailValid ? "#FFFFFF" : "rgba(255,255,255,0.4)", borderRadius: 10, height: 44, justifyContent: "center", paddingHorizontal: 18 }}>
                  <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{translateCopy("Abone Ol", language)}</Text>
                </Pressable>
              </View>
            )}
            {newsletterErr && !subscribed ? (
              <Text style={{ color: "#FFE0E0", fontSize: 12, fontWeight: "700" }}>{translateCopy("Abonelik kaydedilemedi, birazdan tekrar dene.", language)}</Text>
            ) : null}
          </View>
        </View>
        {columns.map((column) => (
          <View key={column.heading} style={{ gap: 10, minWidth: 150 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>{translateCopy(column.heading, language)}</Text>
            {column.links.map((link) => (
              <Link key={link.label} href={link.href} asChild>
                <Pressable>
                  <Text style={{ color: light, fontSize: 14, fontWeight: "600" }}>{translateCopy(link.label, language)}</Text>
                </Pressable>
              </Link>
            ))}
          </View>
        ))}
      </View>
      <View style={{ alignItems: "center", borderTopColor: "rgba(255,255,255,0.16)", borderTopWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between", marginTop: 12, paddingTop: 10 }}>
        <View style={{ flex: 1, gap: 3, minWidth: 200 }}>
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "600" }}>
            {translateCopy("© 2026 OrtakSat. Tüm hakları saklıdır.", language)}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11.5, fontWeight: "600", maxWidth: 640 }}>
            {translateCopy("OrtakSat ödeme, kargo veya komisyon tahsilatı yapmaz; yalnızca ilan, ortak satıcı eşleştirme, mesajlaşma ve anlaşma kaydı sağlar. Satış, ödeme, teslimat ve komisyon ödemesi kullanıcılar arasındaki anlaşmalardan ibaret olup tüm sorumluluk taraflara aittir.", language)}
          </Text>
        </View>
        <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {trustBadges.map((b) => (
            <View key={b.label} style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 999, flexDirection: "row", gap: 6, paddingHorizontal: 11, paddingVertical: 6 }}>
              <MaterialCommunityIcons name={b.icon} size={14} color="rgba(255,255,255,0.92)" />
              <Text style={{ color: "rgba(255,255,255,0.92)", fontSize: 11.5, fontWeight: "800" }}>{translateCopy(b.label, language)}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

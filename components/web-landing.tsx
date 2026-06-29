import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, type Href } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { listingCategories } from "@/lib/categories";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useStore } from "@/lib/use-store";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const CATEGORY_PALETTE: Array<[string, string]> = [
  [colors.primarySoft, colors.primaryDark],
  [colors.infoSoft, colors.info],
  [colors.violetSoft, colors.violet],
  [colors.goldSoft, colors.gold],
  [colors.accentSoft, colors.accent],
  [colors.successSoft, colors.success],
  [colors.warningSoft, colors.warning]
];

/** Desktop category showcase — image-thumbnail tiles with listing counts. */
export function WebCategories() {
  const { language } = useLanguage();
  const { listings } = useStore();
  const counts: Record<string, number> = {};
  const images: Record<string, string> = {};
  for (const listing of listings) {
    if (listing.status !== "active") continue;
    counts[listing.category] = (counts[listing.category] ?? 0) + 1;
    if (!images[listing.category] && listing.image) images[listing.category] = listing.image;
  }

  return (
    <View dataSet={{ reveal: "1" }} style={{ gap: 16, marginTop: 8 }}>
      <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 10, justifyContent: "space-between" }}>
        <View style={{ gap: 2 }}>
          <Text style={{ color: colors.ink, fontSize: 24, fontWeight: "900" }}>Kategoriler</Text>
          <Text style={{ color: colors.muted, fontSize: 15, fontWeight: "600" }}>İlgilendiğin alanı seç, en iyi fırsatları kaçırma.</Text>
        </View>
        <Link href="/explore" asChild>
          <Pressable style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
            <Text style={{ color: colors.primaryDark, fontSize: 14, fontWeight: "900" }}>Tüm kategorileri gör</Text>
            <MaterialCommunityIcons name="arrow-right" size={18} color={colors.primaryDark} />
          </Pressable>
        </Link>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
        {listingCategories.map((category, index) => {
          const [tileBg, tileColor] = CATEGORY_PALETTE[index % CATEGORY_PALETTE.length];
          const count = counts[category.key] ?? 0;
          const image = images[category.key];
          return (
            <Link key={category.key} href={{ pathname: "/explore", params: { q: category.label } }} asChild>
              <Pressable
                dataSet={{ card: "listing" }}
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.line,
                  borderRadius: 16,
                  borderWidth: 1,
                  flexBasis: 168,
                  flexGrow: 1,
                  gap: 10,
                  maxWidth: 240,
                  overflow: "hidden",
                  padding: 12
                }}
              >
                <View style={{ alignItems: "center", backgroundColor: tileBg, borderRadius: 12, height: 92, justifyContent: "center", overflow: "hidden", width: "100%" }}>
                  {image ? (
                    <SafeRemoteImage uri={image} style={{ height: "100%", width: "100%" }} contentFit="cover" transition={140} />
                  ) : (
                    <MaterialCommunityIcons name={category.icon} size={34} color={tileColor} />
                  )}
                </View>
                <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 14, fontWeight: "800" }}>
                  {translateCopy(category.label, language)}
                </Text>
                <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
                  {count > 0 ? `${count} ilan` : `${category.subcategories.length} alt kategori`}
                </Text>
              </Pressable>
            </Link>
          );
        })}
      </View>
    </View>
  );
}

/** Trust signals strip — reassures all three sides (ilan sahibi / ortak / alıcı). */
export function WebTrustStrip() {
  const items: Array<{ icon: IconName; title: string; body: string }> = [
    { icon: "shield-check", title: "Komisyon kayıt altında", body: "Anlaşma ve komisyon şartı sistemde saklanır." },
    { icon: "eye-check-outline", title: "Şeffaf süreç", body: "Talep, satış ve komisyon canlı panelde görünür." },
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
            <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 14, fontWeight: "900" }}>{item.title}</Text>
            <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 16 }}>{item.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Desktop "how it works" band — 3 steps explaining the ortak-satış model. */
export function WebHowItWorks() {
  const steps: Array<{ icon: IconName; title: string; body: string }> = [
    { icon: "store-plus-outline", title: "1 · İlanını aç", body: "Ürünü, fiyatı, stoğu ve ortaklara vereceğin komisyonu belirle." },
    { icon: "share-variant-outline", title: "2 · Ortaklar paylaşsın", body: "Ortakların kendi referans linkiyle ürününü kendi kitlesine yayar." },
    { icon: "cash-multiple", title: "3 · Satışta kazanın", body: "Gelen talepleri satışa çevir; komisyon panelde otomatik takip edilir." }
  ];

  return (
    <View dataSet={{ reveal: "1" }} style={{ gap: 16, marginTop: 8 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: colors.ink, fontSize: 24, fontWeight: "900" }}>Nasıl çalışır?</Text>
        <Text style={{ color: colors.muted, fontSize: 15, fontWeight: "600" }}>
          Ortak satış üç adımda: aç, paylaştır, kazan.
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: 16 }}>
        {steps.map((step) => (
          <View
            key={step.title}
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.line,
              borderRadius: 18,
              borderWidth: 1,
              flex: 1,
              gap: 12,
              padding: 24
            }}
          >
            <View
              style={{
                alignItems: "center",
                backgroundColor: colors.primarySoft,
                borderRadius: 14,
                height: 52,
                justifyContent: "center",
                width: 52
              }}
            >
              <MaterialCommunityIcons name={step.icon} size={26} color={colors.primaryDark} />
            </View>
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{step.title}</Text>
            <Text style={{ color: colors.muted, fontSize: 15, fontWeight: "600", lineHeight: 22 }}>{step.body}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** "Why ortaksat" — value props for both sides (seller + partner). */
export function WebWhy() {
  const sides: Array<{ icon: IconName; title: string; points: string[]; href: Href; cta: string }> = [
    {
      icon: "store-plus-outline",
      title: "Satıcıysan",
      points: [
        "Ürününü yüzlerce ortağın ağına taşı, erişimini büyüt.",
        "Reklam yerine sonuç bazlı komisyon: sadece satışta öde.",
        "Talep, satış ve komisyonu tek panelden yönet."
      ],
      href: "/create",
      cta: "İlan ver"
    },
    {
      icon: "handshake-outline",
      title: "Ortaksan",
      points: [
        "Sermaye gerektirmeden, hazır ürünleri satıp komisyon kazan.",
        "Kendi referans linkinle her kanalda paylaş.",
        "Kazancın şeffaf: bekleyen, onaylanan, ödenen olarak görünür."
      ],
      href: "/partner",
      cta: "Ortak satışa başla"
    }
  ];
  return (
    <View dataSet={{ reveal: "1" }} style={{ gap: 16, marginTop: 8 }}>
      <View style={{ gap: 2 }}>
        <Text style={{ color: colors.ink, fontSize: 24, fontWeight: "900" }}>Neden ortaksat?</Text>
        <Text style={{ color: colors.muted, fontSize: 15, fontWeight: "600" }}>İki taraf da kazanır: satıcı büyür, ortak komisyon alır.</Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
        {sides.map((side) => (
          <View
            key={side.title}
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.line,
              borderRadius: 18,
              borderWidth: 1,
              flexBasis: 360,
              flexGrow: 1,
              gap: 14,
              padding: 24
            }}
          >
            <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
              <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 12, height: 48, justifyContent: "center", width: 48 }}>
                <MaterialCommunityIcons name={side.icon} size={26} color={colors.primaryDark} />
              </View>
              <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>{side.title}</Text>
            </View>
            <View style={{ gap: 10 }}>
              {side.points.map((point) => (
                <View key={point} style={{ alignItems: "flex-start", flexDirection: "row", gap: 10 }}>
                  <MaterialCommunityIcons name="check-circle" size={18} color={colors.primary} />
                  <Text style={{ color: colors.muted, flex: 1, fontSize: 14, fontWeight: "600", lineHeight: 21 }}>{point}</Text>
                </View>
              ))}
            </View>
            <Link href={side.href} asChild>
              <Pressable style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 12, flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingVertical: 12 }}>
                <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>{side.cta}</Text>
                <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
              </Pressable>
            </Link>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Web footer with brand, navigation columns and legal line. */
export function WebFooter() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const columns: Array<{ heading: string; links: Array<{ label: string; href: Href }> }> = [
    {
      heading: "Pazaryeri",
      links: [
        { label: "Keşfet", href: "/explore" },
        { label: "İlan Ver", href: "/create" },
        { label: "Ortak Satış", href: "/partner" },
        { label: "Kategoriler", href: "/explore" }
      ]
    },
    {
      heading: "Destek",
      links: [
        { label: "Nasıl Çalışır?", href: "/nasil-calisir" },
        { label: "Yardım Merkezi", href: "/sss" },
        { label: "Güvenlik", href: "/trust" },
        { label: "İletişim", href: "/legal" }
      ]
    },
    {
      heading: "Hesabım",
      links: [
        { label: "Hesabım", href: "/profile" },
        { label: "Ortak Sözleşmem", href: "/legal" },
        { label: "Komisyonlarım", href: "/partner" },
        { label: "Favorilerim", href: "/favorites" }
      ]
    },
    {
      heading: "Yasal",
      links: [
        { label: "Kullanım Şartları", href: "/legal" },
        { label: "Gizlilik Politikası", href: "/legal" },
        { label: "KVKK", href: "/legal" },
        { label: "Çerez Politikası", href: "/legal" }
      ]
    }
  ];

  const socials: IconName[] = ["instagram", "whatsapp", "twitter", "youtube"];
  const payments = ["VISA", "Mastercard", "troy", "SSL Secured"];
  const light = "rgba(255,255,255,0.78)";

  return (
    <View
      style={{
        backgroundColor: colors.primaryDark,
        marginBottom: -100,
        marginHorizontal: -20,
        marginTop: 24,
        paddingBottom: 100,
        paddingHorizontal: 32,
        paddingTop: 26
      }}
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 32 }}>
        <View style={{ flex: 1.6, gap: 10, minWidth: 280 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 24, fontWeight: "900" }}>ortaksat</Text>
          <Text style={{ color: light, fontSize: 14, fontWeight: "600", lineHeight: 21, maxWidth: 380 }}>
            {t("appSlogan")}. İlanını aç, ortakların paylaşsın, satışta komisyon kazan.
          </Text>
          <View style={{ gap: 8, maxWidth: 380 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>Bültene abone ol</Text>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="E-posta adresin"
                placeholderTextColor="rgba(255,255,255,0.55)"
                style={{ backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.25)", borderRadius: 10, borderWidth: 1, color: "#FFFFFF", flex: 1, fontSize: 14, fontWeight: "600", height: 44, paddingHorizontal: 14 }}
              />
              <Pressable style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 10, height: 44, justifyContent: "center", paddingHorizontal: 18 }}>
                <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>Abone Ol</Text>
              </Pressable>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 2 }}>
            {socials.map((icon) => (
              <View key={icon} style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.22)", borderRadius: 999, borderWidth: 1, height: 38, justifyContent: "center", width: 38 }}>
                <MaterialCommunityIcons name={icon} size={19} color="#FFFFFF" />
              </View>
            ))}
          </View>
        </View>
        {columns.map((column) => (
          <View key={column.heading} style={{ gap: 10, minWidth: 150 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>{column.heading}</Text>
            {column.links.map((link) => (
              <Link key={link.label} href={link.href} asChild>
                <Pressable>
                  <Text style={{ color: light, fontSize: 14, fontWeight: "600" }}>{link.label}</Text>
                </Pressable>
              </Link>
            ))}
          </View>
        ))}
      </View>
      <View style={{ alignItems: "center", borderTopColor: "rgba(255,255,255,0.16)", borderTopWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between", marginTop: 18, paddingTop: 14 }}>
        <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "600" }}>
          © 2024 Ortak Sat. Tüm hakları saklıdır.
        </Text>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
          {payments.map((p) => (
            <View key={p} style={{ backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ color: colors.primaryDark, fontSize: 11, fontWeight: "900" }}>{p}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

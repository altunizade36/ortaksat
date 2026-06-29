import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, type Href } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
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

/** Desktop category showcase — deep marketplace feel: icon, sub-hints, count. */
export function WebCategories() {
  const { language } = useLanguage();
  const { listings } = useStore();
  const counts = listings.reduce<Record<string, number>>((acc, listing) => {
    if (listing.status === "active") acc[listing.category] = (acc[listing.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <View dataSet={{ reveal: "1" }} style={{ gap: 16, marginTop: 8 }}>
      <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 10, justifyContent: "space-between" }}>
        <View style={{ gap: 2 }}>
          <Text style={{ color: colors.ink, fontSize: 24, fontWeight: "900" }}>Kategoriler</Text>
          <Text style={{ color: colors.muted, fontSize: 15, fontWeight: "600" }}>İlgilendiğin alana göre ürünleri keşfet — {listingCategories.length} kategori.</Text>
        </View>
        <Link href="/explore" asChild>
          <Pressable style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
            <Text style={{ color: colors.primaryDark, fontSize: 14, fontWeight: "900" }}>Tümünü gör</Text>
            <MaterialCommunityIcons name="arrow-right" size={18} color={colors.primaryDark} />
          </Pressable>
        </Link>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
        {listingCategories.map((category, index) => {
          const [tileBg, tileColor] = CATEGORY_PALETTE[index % CATEGORY_PALETTE.length];
          const count = counts[category.key] ?? 0;
          const hints = category.subcategories.slice(0, 3).join(" · ");
          return (
            <Link key={category.key} href={{ pathname: "/explore", params: { q: category.label } }} asChild>
              <Pressable
                dataSet={{ card: "listing" }}
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.line,
                  borderRadius: 18,
                  borderWidth: 1,
                  flexBasis: 248,
                  flexGrow: 1,
                  gap: 12,
                  minHeight: 132,
                  padding: 18
                }}
              >
                <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
                  <View style={{ alignItems: "center", backgroundColor: tileBg, borderRadius: 14, height: 46, justifyContent: "center", width: 46 }}>
                    <MaterialCommunityIcons name={category.icon} size={24} color={tileColor} />
                  </View>
                  <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 16, fontWeight: "800" }}>
                    {translateCopy(category.label, language)}
                  </Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.subtle} />
                </View>
                <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>
                  {hints}
                </Text>
                <View style={{ alignItems: "center", flexDirection: "row", gap: 6, marginTop: "auto" }}>
                  <View style={{ backgroundColor: tileBg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
                    <Text style={{ color: tileColor, fontSize: 12, fontWeight: "900" }}>
                      {count > 0 ? `${count} ilan` : `${category.subcategories.length} alt kategori`}
                    </Text>
                  </View>
                </View>
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
      heading: "Pazar",
      links: [
        { label: t("home"), href: "/" },
        { label: t("explore"), href: "/explore" },
        { label: t("createListing"), href: "/create" },
        { label: t("partnerSales"), href: "/partner" }
      ]
    },
    {
      heading: "Kategoriler",
      links: listingCategories.slice(0, 5).map((c) => ({ label: c.label, href: { pathname: "/explore", params: { q: c.label } } as Href }))
    },
    {
      heading: "Yardım",
      links: [
        { label: "Nasıl çalışır?", href: "/nasil-calisir" },
        { label: "SSS", href: "/sss" },
        { label: t("legalSupport"), href: "/legal" }
      ]
    },
    {
      heading: "Kurumsal",
      links: [
        { label: "Hakkımızda", href: "/hakkimizda" },
        { label: t("trustCenter"), href: "/trust" },
        { label: t("menu"), href: "/menu" }
      ]
    }
  ];

  const socials: IconName[] = ["instagram", "whatsapp", "twitter", "youtube"];

  return (
    <View
      style={{
        borderTopColor: colors.line,
        borderTopWidth: 1,
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 40,
        marginTop: 24,
        paddingBottom: 16,
        paddingTop: 36
      }}
    >
      <View style={{ flex: 1.6, gap: 14, minWidth: 280 }}>
        <Text style={{ color: colors.primaryDark, fontSize: 24, fontWeight: "900" }}>ortaksat</Text>
        <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600", lineHeight: 21, maxWidth: 380 }}>
          {t("appSlogan")}. İlanını aç, ortakların paylaşsın, satışta komisyon kazan.
        </Text>
        <View style={{ gap: 8, maxWidth: 380 }}>
          <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>Bültene abone ol</Text>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="E-posta adresin"
              placeholderTextColor={colors.muted}
              style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, flex: 1, fontSize: 14, fontWeight: "600", height: 44, paddingHorizontal: 14 }}
            />
            <Pressable style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, height: 44, justifyContent: "center", paddingHorizontal: 18 }}>
              <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>Abone ol</Text>
            </Pressable>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 2 }}>
          {socials.map((icon) => (
            <View key={icon} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, height: 38, justifyContent: "center", width: 38 }}>
              <MaterialCommunityIcons name={icon} size={19} color={colors.primaryDark} />
            </View>
          ))}
        </View>
      </View>
      {columns.map((column) => (
        <View key={column.heading} style={{ gap: 10, minWidth: 150 }}>
          <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 }}>
            {column.heading}
          </Text>
          {column.links.map((link) => (
            <Link key={link.label} href={link.href} asChild>
              <Pressable>
                <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "700" }}>{link.label}</Text>
              </Pressable>
            </Link>
          ))}
        </View>
      ))}
      <View style={{ alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between", paddingTop: 16, width: "100%" }}>
        <Text style={{ color: colors.subtle, fontSize: 13, fontWeight: "600" }}>
          © 2026 ortaksat · Tüm hakları saklıdır
        </Text>
        <Text style={{ color: colors.subtle, fontSize: 13, fontWeight: "700" }}>
          KVKK · Gizlilik · Mesafeli Satış — Yasal ve Destek sayfasında
        </Text>
      </View>
    </View>
  );
}

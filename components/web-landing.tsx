import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, type Href } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { listingCategories } from "@/lib/categories";
import { translateCopy, useLanguage } from "@/lib/i18n";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/** Desktop category showcase — quick browse entry points into the feed. */
export function WebCategories() {
  const { language } = useLanguage();
  return (
    <View dataSet={{ reveal: "1" }} style={{ gap: 14, marginTop: 4 }}>
      <Text style={{ color: colors.ink, fontSize: 22, fontWeight: "900" }}>Kategoriler</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {listingCategories.map((category) => (
          <Link key={category.key} href={{ pathname: "/explore", params: { q: category.label } }} asChild>
            <Pressable
              dataSet={{ card: "listing" }}
              style={{
                alignItems: "center",
                backgroundColor: colors.surface,
                borderColor: colors.line,
                borderRadius: 16,
                borderWidth: 1,
                flexDirection: "row",
                gap: 12,
                paddingHorizontal: 18,
                paddingVertical: 16,
                width: 220
              }}
            >
              <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 12, height: 44, justifyContent: "center", width: 44 }}>
                <MaterialCommunityIcons name={category.icon} size={24} color={colors.primaryDark} />
              </View>
              <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 15, fontWeight: "800" }}>
                {translateCopy(category.label, language)}
              </Text>
            </Pressable>
          </Link>
        ))}
      </View>
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

/** Web footer with brand, navigation columns and legal line. */
export function WebFooter() {
  const { t } = useLanguage();
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
      heading: "Şirket",
      links: [
        { label: "Hakkımızda", href: "/hakkimizda" },
        { label: "Nasıl çalışır?", href: "/nasil-calisir" },
        { label: "SSS", href: "/sss" }
      ]
    },
    {
      heading: "Kurumsal",
      links: [
        { label: t("trustCenter"), href: "/trust" },
        { label: t("legalSupport"), href: "/legal" },
        { label: t("menu"), href: "/menu" }
      ]
    }
  ];

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
        paddingTop: 32
      }}
    >
      <View style={{ flex: 1.4, gap: 10, minWidth: 240 }}>
        <Text style={{ color: colors.primaryDark, fontSize: 22, fontWeight: "900" }}>ortaksat</Text>
        <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600", lineHeight: 21, maxWidth: 360 }}>
          {t("appSlogan")}. İlanını aç, ortakların paylaşsın, satışta komisyon kazan.
        </Text>
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
      <View style={{ borderTopColor: colors.line, borderTopWidth: 1, paddingTop: 16, width: "100%" }}>
        <Text style={{ color: colors.subtle, fontSize: 13, fontWeight: "600" }}>
          © 2026 ortaksat · Tüm hakları saklıdır · KVKK & Gizlilik için Yasal ve Destek sayfasına bakın.
        </Text>
      </View>
    </View>
  );
}

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";

import { colors } from "@/components/colors";
import { ListingCard } from "@/components/listing-card";
import { EmptyState, PrimaryButton } from "@/components/ui";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { searchKey } from "@/lib/locale";
import { useStore } from "@/lib/use-store";

export default function FavoritesScreen() {
  const { language } = useLanguage();
  const { width } = useWindowDimensions();
  const { currentUser, favorites, findUser, listings } = useStore();
  const [query, setQuery] = useState("");
  const horizontalPadding = 12;
  const gap = 8;
  const cardWidth = Math.floor((width - horizontalPadding * 2 - gap * 2) / 3);
  const tokens = searchKey(query).split(" ").filter(Boolean);
  const favoriteListings = favorites
    .filter((favorite) => favorite.userId === currentUser.id)
    .map((favorite) => listings.find((listing) => listing.id === favorite.listingId))
    .filter(Boolean);
  const visibleListings = favoriteListings.filter((listing) => {
    if (!listing || tokens.length === 0) return true;
    const haystack = searchKey([listing.title, listing.category, listing.location, listing.description, ...listing.tags].join(" "));
    return tokens.every((token) => haystack.includes(token));
  });

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 12, padding: 12, paddingBottom: 96 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
        <View style={{ alignItems: "center", backgroundColor: colors.accentSoft, borderRadius: 8, height: 46, justifyContent: "center", width: 46 }}>
          <MaterialCommunityIcons name="heart" size={22} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text selectable style={{ color: colors.ink, fontSize: 22, fontWeight: "900" }}>{translateCopy("Favoriler", language)}</Text>
          <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>{translateCopy("Kaydettiğin ürünleri buradan takip et.", language)}</Text>
        </View>
      </View>

      <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 10, minHeight: 50, paddingHorizontal: 12 }}>
        <MaterialCommunityIcons name="magnify" size={21} color={colors.accent} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={language === "en" ? "Search saved products, city, or category" : "Favorilerde ürün, şehir veya kategori ara"}
          placeholderTextColor={colors.muted}
          style={{ color: colors.ink, flex: 1, fontSize: 15, minHeight: 48, paddingVertical: 8 }}
        />
        {query ? (
          <Pressable onPress={() => setQuery("")} hitSlop={10}>
            <MaterialCommunityIcons name="close-circle" size={19} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <Text selectable style={{ color: colors.ink, flex: 1, fontSize: 18, fontWeight: "900" }}>{translateCopy("Ürünler", language)}</Text>
        <Text selectable style={{ color: colors.accent, fontSize: 12, fontWeight: "900" }}>{visibleListings.length} {language === "en" ? "results" : "sonuç"}</Text>
      </View>

      {favoriteListings.length === 0 ? <EmptyState title={language === "en" ? "No favorites" : "Favori yok"} body={language === "en" ? "Tap the heart on product details to add products to favorites." : "Ürün detayında kalp simgesine basarak ürünleri favorilerine ekleyebilirsin."} /> : null}
      {favoriteListings.length > 0 && visibleListings.length === 0 ? <EmptyState title="Sonuç yok" body={language === "en" ? "Change your search term to list your favorites again." : "Arama kelimesini değiştirerek favorilerini tekrar listeleyebilirsin."} /> : null}

      <View style={{ alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap }}>
        {visibleListings.map((listing) =>
          listing ? <ListingCard key={listing.id} listing={listing} owner={findUser(listing.ownerId)} width={cardWidth} /> : null
        )}
      </View>
      <PrimaryButton href="/(tabs)/explore" tone="secondary">Keşfete dön</PrimaryButton>
    </ScrollView>
  );
}


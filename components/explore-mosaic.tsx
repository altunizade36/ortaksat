import { LinearGradient } from "expo-linear-gradient";
import { memo, useMemo } from "react";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { MaterialCommunityIcons } from "@/components/icons";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { moneyIn } from "@/lib/format";
import { displayListingTitle } from "@/lib/listing-title";
import { listingPhotos } from "@/lib/mobile-listing";
import type { Listing } from "@/lib/types";

const GAP = 2;

type Block =
  | { kind: "feature"; big: Listing; side: Listing[][]; flip: boolean }
  | { kind: "row"; items: Listing[] };

function buildBlocks(listings: Listing[], columns: number): Block[] {
  const blocks: Block[] = [];
  const sideColumns = columns - 2;
  const featureSize = 1 + sideColumns * 2;
  let i = 0;
  let flip = false;
  while (i < listings.length) {
    if (listings.length - i >= featureSize) {
      const big = listings[i];
      const side: Listing[][] = [];
      for (let c = 0; c < sideColumns; c++) side.push(listings.slice(i + 1 + c * 2, i + 3 + c * 2));
      blocks.push({ kind: "feature", big, side, flip });
      flip = !flip;
      i += featureSize;
    }
    for (let r = 0; r < 2 && i < listings.length; r++) {
      blocks.push({ kind: "row", items: listings.slice(i, i + columns) });
      i += columns;
    }
  }
  return blocks;
}

function commissionLabel(l: Listing): string | null {
  if (l.partnershipMode === "none") return null;
  if (!Number.isFinite(l.commissionValue) || l.commissionValue <= 0) return null;
  if (l.commissionType === "rate") return l.commissionValue <= 90 ? `%${l.commissionValue}` : null;
  return moneyIn(l.commissionValue, l.currency);
}

/** Milyon ve üzeri sabit komisyonun kısa biçimi ("₺1,3 M") — yalnız tam tutar küçük karoya sığmadığında. */
function commissionCompact(l: Listing): string | null {
  if (l.commissionType === "rate" || !(l.commissionValue >= 1_000_000)) return null;
  const symbol = moneyIn(0, l.currency).slice(0, -1);
  return `${symbol}${(l.commissionValue / 1_000_000).toFixed(1).replace(".0", "").replace(".", ",")} M`;
}

const Tile = memo(function Tile({ listing: l, size, large, eager, onOpen }: { listing: Listing; size: number; large?: boolean; eager?: boolean; onOpen: (l: Listing) => void }) {
  const commission = commissionLabel(l);
  const photoCount = listingPhotos(l).length;
  const title = displayListingTitle(l.title);
  const price = l.price > 0 ? moneyIn(l.price, l.currency) : "";
  // Komisyon hapı tek satır. En dar karoda (320 dp ekran → ~105 dp) tutar "…" ile kırpılıyordu. Sıra:
  // çoklu-fotoğraf ikonu yoksa hap karonun tamamını kullanır → sığmıyorsa el sıkışma ikonu düşer →
  // hâlâ sığmıyorsa milyonluk tutar kısalır. Yazı boyutu küçülmez; geniş karolarda görünüm aynı kalır.
  const pillMax = size - (photoCount > 1 ? 34 : 12);
  const pillFont = large ? 12 : 10;
  const pillRoom = pillMax - (large ? 18 : 14);
  const pillFits = (text: string, room: number) => text.length * pillFont * 0.64 <= room;
  const pillIcon = !!commission && pillFits(commission, pillRoom - (large ? 16 : 13));
  const pillText = commission && !pillIcon && !pillFits(commission, pillRoom) ? commissionCompact(l) ?? commission : commission;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${title}${price ? ` — ${price}` : ""}`}
      onPress={() => onOpen(l)}
      dataSet={{ card: "listing", tile: "mosaic" }}
      style={({ pressed }) => ({ backgroundColor: colors.neutralSoft, height: size, opacity: pressed ? 0.86 : 1, overflow: "hidden", width: size })}
    >
      <SafeRemoteImage uri={l.imageUrl || l.image} full={large} alt={title} contentFit="cover" priority={eager ? "high" : undefined} transition={eager ? 0 : 140} style={{ height: "100%", width: "100%" }} />
      <LinearGradient pointerEvents="none" colors={["rgba(0,10,40,0)", "rgba(0,10,40,0.72)"]} style={{ bottom: 0, height: large ? 96 : 52, left: 0, position: "absolute", right: 0 }} />
      {photoCount > 1 ? (
        <View pointerEvents="none" style={{ position: "absolute", right: 6, top: 6 }}>
          <MaterialCommunityIcons name="image-multiple" size={large ? 18 : 14} color="#FFFFFF" />
        </View>
      ) : null}
      {commission ? (
        <View pointerEvents="none" style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 999, flexDirection: "row", gap: 3, left: 6, maxWidth: pillMax, paddingHorizontal: large ? 9 : 7, paddingVertical: large ? 4 : 2, position: "absolute", top: 6 }}>
          {pillIcon ? <MaterialCommunityIcons name="handshake" size={large ? 13 : 10} color="#FFFFFF" /> : null}
          <Text numberOfLines={1} style={{ color: "#FFFFFF", flexShrink: 1, fontSize: pillFont, fontWeight: "800" }}>{pillText}</Text>
        </View>
      ) : null}
      <View pointerEvents="none" style={{ bottom: large ? 10 : 5, left: large ? 10 : 6, position: "absolute", right: large ? 10 : 6 }}>
        {large ? <Text numberOfLines={2} style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "800", lineHeight: 18, marginBottom: 2 }}>{title}</Text> : null}
        {price ? <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: large ? 18 : 12, fontWeight: "900" }}>{price}</Text> : null}
      </View>
    </Pressable>
  );
});

/**
 * Keşfet mozaiği: kenardan kenara, ilan başına TEK kapak fotoğrafı. Her blokta bir büyük
 * (2×2) karo, sağ/sol dönüşümlü. Dokununca ilan sayfası açılır.
 */
export const ExploreMosaic = memo(function ExploreMosaic({ listings, width, onOpen }: { listings: Listing[]; width: number; onOpen: (l: Listing) => void }) {
  const columns = width >= 1000 ? 6 : width >= 700 ? 5 : width >= 520 ? 4 : 3;
  const unit = Math.floor((width - GAP * (columns - 1)) / columns);
  const blocks = useMemo(() => buildBlocks(listings, columns), [listings, columns]);
  return (
    <View style={{ gap: GAP, width }}>
      {blocks.map((block, index) => {
        if (block.kind === "row") {
          return (
            <View key={`r-${block.items[0].id}`} style={{ flexDirection: "row", gap: GAP }}>
              {block.items.map((l) => <Tile key={l.id} listing={l} size={unit} eager={index < 2} onOpen={onOpen} />)}
            </View>
          );
        }
        const big = <Tile key={block.big.id} listing={block.big} size={unit * 2 + GAP} large eager={index < 2} onOpen={onOpen} />;
        const side = block.side.map((pair, c) => (
          <View key={`c-${c}`} style={{ gap: GAP }}>
            {pair.map((l) => <Tile key={l.id} listing={l} size={unit} eager={index < 2} onOpen={onOpen} />)}
          </View>
        ));
        return (
          <View key={`f-${block.big.id}`} style={{ flexDirection: "row", gap: GAP }}>
            {block.flip ? [...side, big] : [big, ...side]}
          </View>
        );
      })}
    </View>
  );
});

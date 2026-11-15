import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { MaterialCommunityIcons } from "@/components/icons";
import { moneyIn } from "@/lib/format";
import { fetchListingPriceHistory, priceChangePct, priceChangeWhen, type PriceChange } from "@/lib/price-history";

/**
 * İLAN SAYFASI — FİYAT GEÇMİŞİ (2026-11-15). Fiyat değiştiyse en son değişikliği tek satırda gösterir
 * ("Fiyat 3 gün önce ₺22.000'den ₺20.000'e indi · %9"); birden çok değişiklik varsa dokununca liste açılır.
 * Değişiklik yoksa HİÇBİR ŞEY çizmez (boş "geçmiş yok" kutusu göstermek ilanı kötü gösterir).
 * Veri gerçek kayıttır (sunucu tetikleyicisi); özellik eklenmeden önceki değişiklikler görünmez.
 */
export function PriceHistoryNote({ listingId, currency }: { listingId: string; currency?: "TRY" | "USD" | "EUR" }) {
  const [changes, setChanges] = useState<PriceChange[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setChanges([]); setOpen(false);
    void fetchListingPriceHistory(listingId).then((rows) => { if (alive) setChanges(rows); });
    return () => { alive = false; };
  }, [listingId]);

  if (changes.length === 0) return null;
  const last = changes[0];
  const down = last.newPrice < last.oldPrice;
  const pct = Math.abs(priceChangePct(last));
  const money = (value: number) => moneyIn(value, currency ?? "TRY");
  return (
    <View testID="price-history" style={{ backgroundColor: colors.primarySoft, borderRadius: 10, gap: 6, paddingHorizontal: 10, paddingVertical: 8 }}>
      <Pressable accessibilityRole={changes.length > 1 ? "button" : undefined} accessibilityState={changes.length > 1 ? { expanded: open } : undefined} disabled={changes.length < 2} onPress={() => setOpen((value) => !value)} style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
        <MaterialCommunityIcons name={down ? "tag-arrow-down-outline" : "tag-arrow-up-outline"} size={16} color={colors.primaryDark} />
        <Text style={{ color: colors.ink, flex: 1, fontSize: 12, fontWeight: "700", lineHeight: 17 }}>
          Fiyat {priceChangeWhen(last.changedAt)} {money(last.oldPrice)} → {money(last.newPrice)}
          <Text style={{ color: colors.primaryDark, fontWeight: "900" }}>{pct > 0 ? ` · ${down ? "%" + pct + " indi" : "%" + pct + " arttı"}` : ""}</Text>
        </Text>
        {changes.length > 1 ? <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.primaryDark} /> : null}
      </Pressable>
      {open ? (
        <View style={{ borderTopColor: colors.line, borderTopWidth: 1, gap: 4, paddingTop: 6 }}>
          {changes.slice(1).map((change, index) => (
            <Text key={`${change.changedAt}:${index}`} style={{ color: colors.muted, fontSize: 11.5, fontVariant: ["tabular-nums"], fontWeight: "600" }}>
              {priceChangeWhen(change.changedAt)}: {money(change.oldPrice)} → {money(change.newPrice)}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

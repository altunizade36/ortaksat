import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { MaterialCommunityIcons } from "@/components/icons";
import { suggestCategories, type CategoryNode } from "@/lib/category-tree";
import { foldKey } from "@/lib/fast-text";

/**
 * "DİĞER" UYARISI (2026-11-15). İlan sahibi bir dalın "Diğer" yaprağını seçip başlığı yazınca, başlığa göre daha
 * uygun bir kategori varsa önerir ("Yıkama Dronu" ilanı Elektronik › Diğer'e düşmüştü; ağaçta dron kategorisi
 * vardı ama bulunamamıştı). Öneriye dokununca kategori değişir; istemezse hiçbir şey yapmasına gerek yok.
 *
 * - Yalnız seçili yaprak "Diğer…" ile başlıyorsa ve başlık en az 4 harfse çalışır.
 * - Arama tuşa her basışta değil, yazma durunca (450 ms) yapılır: ağaç 7.600+ düğüm.
 * - Öneri her zaman bir YAPRAKTIR. Arama bir üst dala işaret ederse (ör. "odun sobası" → Isıtma & Soğutma) o dalın
 *   içinde başlıkla sözcük eşleşmesi en iyi olan alt kategori seçilir (bkz. bestLeafUnder); eşleşme yoksa öneri çıkmaz.
 * - En fazla iki öneri; "Diğer" yaprakları ve zaten seçili olan yol önerilmez.
 */
const words = (text: string) => foldKey(text).split(" ").filter((w) => w.length >= 3);

/** Dalın altındaki yapraklardan başlıkla en çok sözcüğü örtüşeni (ön ek eşleşmesi: "sobasi" ↔ "soba"). */
export function bestLeafUnder(branch: CategoryNode[], title: string): CategoryNode[] | null {
  const titleWords = words(title);
  let best: { path: CategoryNode[]; score: number } | null = null;
  const walk = (path: CategoryNode[], depth: number) => {
    const node = path[path.length - 1];
    if (node.children && node.children.length) {
      if (depth < 3) for (const child of node.children) walk([...path, child], depth + 1);
      return;
    }
    if (node.label.startsWith("Diğer")) return;
    const score = words(node.label).filter((lw) => titleWords.some((tw) => tw.startsWith(lw) || lw.startsWith(tw))).length;
    if (score > 0 && (!best || score > best.score)) best = { path, score };
  };
  walk(branch, 0);
  return best ? (best as { path: CategoryNode[] }).path : null;
}

export function CategoryNudge({ path, title, onPick }: { path: CategoryNode[]; title: string; onPick: (path: CategoryNode[]) => void }) {
  const leaf = path[path.length - 1];
  const active = !!leaf && leaf.label.startsWith("Diğer") && title.trim().length >= 4;
  const currentKey = path.map((n) => n.slug).join("/");
  const [hits, setHits] = useState<CategoryNode[][]>([]);

  useEffect(() => {
    if (!active) { setHits([]); return; }
    const timer = setTimeout(() => {
      const seen = new Set<string>([currentKey]);
      const found: CategoryNode[][] = [];
      for (const hit of suggestCategories(title.trim(), 8)) {
        const last = hit.path[hit.path.length - 1];
        const isBranch = !!(last.children && last.children.length);
        const resolved = isBranch ? bestLeafUnder(hit.path, title) : last.label.startsWith("Diğer") ? null : hit.path;
        if (!resolved || resolved.length < 2) continue;
        const key = resolved.map((n) => n.slug).join("/");
        if (seen.has(key)) continue;
        seen.add(key);
        found.push(resolved);
        if (found.length === 2) break;
      }
      setHits(found);
    }, 450);
    return () => clearTimeout(timer);
  }, [active, title, currentKey]);

  if (!active || hits.length === 0) return null;
  return (
    <View testID="category-nudge" style={{ backgroundColor: colors.primarySoft, borderColor: colors.primary, borderRadius: 12, borderWidth: 1, gap: 8, padding: 11 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
        <MaterialCommunityIcons name="lightbulb-on-outline" size={17} color={colors.primaryDark} />
        <Text style={{ color: colors.primaryDark, flex: 1, fontSize: 12.5, fontWeight: "900" }}>Bu ilan için daha uygun bir kategori var</Text>
      </View>
      <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>“Diğer” yerine doğru kategoriyi seçersen ilanın aramalarda ve kategori sayfalarında daha kolay bulunur.</Text>
      {hits.map((hit) => (
        <Pressable key={hit.map((n) => n.slug).join("/")} accessibilityRole="button" accessibilityLabel={`Kategoriyi değiştir: ${hit.map((n) => n.label).join(" › ")}`} onPress={() => onPick(hit)}
          style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, minHeight: 42, paddingHorizontal: 10, paddingVertical: 7 }}>
          <Text style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "800", lineHeight: 17 }}>{hit.map((n) => n.label).join(" › ")}</Text>
          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "900" }}>Bunu seç</Text>
        </Pressable>
      ))}
    </View>
  );
}

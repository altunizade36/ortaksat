import AsyncStorage from "@react-native-async-storage/async-storage";
import { parseTrPrice } from "@/lib/validation";
export const listingDraftKey = (userId?: string) => `ortaksat_listing_draft_v1:${userId || "anon"}`;
export async function localDraftSummary(userId: string) {
  const raw = await AsyncStorage.getItem(listingDraftKey(userId));
  if (!raw) return null;
  const d = JSON.parse(raw);
  if (!d || !Array.isArray(d.path) || !d.path.length || !d.savedAt || Date.now() - d.savedAt > 7 * 86400000) return null;
  const values = d.values || {};
  return { title: String(values.title || "Yarım kalan ilan"), price: parseTrPrice(values.price || 0), image: Array.isArray(d.images) ? d.images[0] : undefined, savedAt: Number(d.savedAt), category: d.path.map((p: {label: string}) => p.label).join(" / ") };
}

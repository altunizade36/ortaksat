import { listingNo } from "@/lib/format";
import { searchKey } from "@/lib/locale";
import type { Listing } from "@/lib/types";

// Türkçe-normalize edilmiş sorguyu kelimelere böler ("şarj aleti" -> ["sarj","aleti"]).
export function tokenize(q: string): string[] {
  return searchKey(q).split(" ").filter(Boolean);
}

// Sınırlı Levenshtein — maxDist aşılırsa erken çıkar (performans).
function levenshtein(a: string, b: string, maxDist: number): number {
  const al = a.length;
  const bl = b.length;
  if (Math.abs(al - bl) > maxDist) return maxDist + 1;
  let prev = Array.from({ length: bl + 1 }, (_, i) => i);
  let curr = new Array(bl + 1).fill(0);
  for (let i = 1; i <= al; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDist) return maxDist + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[bl];
}

// Bir token'ın kelime listesindeki eşleşme gücü: 2 tam, 1.6 önek, 1.2 alt-dize, ≤0.6 fuzzy, 0 yok.
// maxDist SIKILAŞTIRILDI: kısa kelimede (≤5) yalnız 1 düzenleme; 2-düzenleme yalnız 6+ harfte.
// Eski (≤4→1, else→2) 5-harfli sorgularda 2 düzenlemeye izin veriyordu → "araba"↔"arsa" (d=2)
// gibi ALAKASIZ eşleşmeler (araba arayan kullanıcı ARSA ilanı görüyordu). allowFuzzy=false ile
// UZUN metin alanlarında (açıklama) fuzzy kapatılır: uzun metinde her sorgunun ~d2 komşusu bulunur.
function tokenStrength(words: string[], token: string, allowFuzzy = true): number {
  if (!token) return 0;
  let best = 0;
  const maxDist = token.length <= 5 ? 1 : 2;
  for (const w of words) {
    if (w === token) return 2;
    if (w.startsWith(token) || (token.length >= 4 && token.startsWith(w) && w.length >= token.length - 1)) {
      best = Math.max(best, 1.6);
    } else if (w.includes(token) && token.length >= 3) {
      best = Math.max(best, 1.2);
    } else if (allowFuzzy && token.length >= 4 && Math.abs(w.length - token.length) <= maxDist) {
      const d = levenshtein(w, token, maxDist);
      if (d <= maxDist) best = Math.max(best, 0.7 - (d - 1) * 0.15);
    }
  }
  return best;
}

// fuzzy: yalnız kısa/yüksek-sinyal alanlarda açık. Açıklama UZUN → fuzzy'de her sorgunun
// bir ~d2 komşusu bulunur (gürültü) → kapalı (yalnız tam/önek/alt-dize sayılır).
const FIELD_WEIGHTS: Array<{ pick: (l: Listing, owner?: string) => string | undefined; weight: number; fuzzy: boolean }> = [
  { pick: (l) => l.title, weight: 5, fuzzy: true },
  { pick: (l) => l.category, weight: 3, fuzzy: true },
  { pick: (l) => l.tags.join(" "), weight: 2.5, fuzzy: true },
  { pick: (l) => l.location, weight: 2, fuzzy: true },
  { pick: (_l, owner) => owner, weight: 1.5, fuzzy: false },
  { pick: (l) => l.description, weight: 1, fuzzy: false }
];

/**
 * İlanın sorguya alaka skoru. 0 = eşleşmiyor (her token bir alanda eşleşmeli — AND).
 * Fuzzy (yazım-hata) toleranslı; başlık eşleşmesi açıklamadan çok daha değerli.
 */
export function scoreListing(listing: Listing, ownerName: string | undefined, tokens: string[]): number {
  if (tokens.length === 0) return 1;
  const fieldWords = FIELD_WEIGHTS.map((f) => ({
    words: searchKey(f.pick(listing, ownerName) ?? "").split(" ").filter(Boolean),
    weight: f.weight,
    fuzzy: f.fuzzy
  }));
  let total = 0;
  for (const token of tokens) {
    let tokenBest = 0;
    for (const { words, weight, fuzzy } of fieldWords) {
      const s = tokenStrength(words, token, fuzzy);
      if (s > 0) tokenBest = Math.max(tokenBest, s * weight);
    }
    if (tokenBest === 0) return 0; // token hiçbir alanda eşleşmedi -> ilan elenir
    total += tokenBest;
  }
  if (listing.featured) total += 0.5;
  return total;
}

/** Sorguya göre filtrele + alaka sırasına diz. Boş sorguda liste olduğu gibi döner. */
export function searchAndRank(
  listings: Listing[],
  query: string,
  ownerNameOf?: (l: Listing) => string | undefined
): Listing[] {
  // İlan numarası araması: kullanıcı 10 haneli kodu (ör. 2049381756) yapıştırırsa
  // doğrudan o ilanı getir (fuzzy metin aramasına düşmeden — kesin kimlik eşleşmesi).
  const numeric = query.replace(/[^0-9]/g, "");
  if (numeric.length >= 6 && /^\s*[#0-9\s]+\s*$/.test(query)) {
    const exact = listings.filter((l) => listingNo(l.id) === numeric);
    if (exact.length > 0) return exact;
  }
  const tokens = tokenize(query);
  if (tokens.length === 0) return listings;
  return listings
    .map((l) => ({ l, s: scoreListing(l, ownerNameOf?.(l), tokens) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.l);
}

/** Tek bir ilanın sorguyla (fuzzy) eşleşip eşleşmediği — hızlı boolean testi. */
export function matchesQuery(listing: Listing, ownerName: string | undefined, tokens: string[]): boolean {
  return scoreListing(listing, ownerName, tokens) > 0;
}

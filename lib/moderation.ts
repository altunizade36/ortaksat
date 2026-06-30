/**
 * Yasaklı/şüpheli içerik taraması. İki katman:
 *  1) İstemci tarafı gömülü liste — anında, ağsız ön kontrol (DB seed'i ile aynı mantık).
 *  2) Sunucu tarafı `scan_prohibited` RPC — güncel listeyle son söz.
 *
 * Sonuç:
 *  - "block"  → ilan hiç oluşturulmamalı (silah, uyuşturucu, sahte belge vb.)
 *  - "review" → oluşturulur ama `pending_review` durumunda; admin onayı gerekir.
 *  - "none"   → sorun yok.
 *
 * NOT: OrtakSat aracı platformdur; bu kontrol yasal koruma ve kullanıcı güvenliği içindir.
 */

import { supabase } from "@/lib/supabase";

export type ModerationVerdict = "block" | "review" | "none";

// DB seed (prohibited_keywords) ile uyumlu gömülü liste.
const BLOCK_WORDS = [
  "silah", "tabanca", "tüfek", "mermi", "uyuşturucu", "esrar", "eroin", "kokain", "bonzai",
  "birinci kalite replika", "çalıntı", "kumar", "porno", "escort", "pasaport", "ehliyet",
  "nüfus cüzdanı", "organ", "böbrek"
];
const REVIEW_WORDS = [
  "fişek", "bıçak", "hap", "reçeteli", "ilaç", "sahte", "replika", "taklit", "a kalite",
  "kaçak", "bahis", "iddaa", "yetişkin", "kimlik", "diploma"
];

function localScan(text: string): ModerationVerdict {
  const hay = (text ?? "").toLocaleLowerCase("tr-TR");
  if (!hay.trim()) return "none";
  if (BLOCK_WORDS.some((w) => hay.includes(w))) return "block";
  if (REVIEW_WORDS.some((w) => hay.includes(w))) return "review";
  return "none";
}

const RANK: Record<ModerationVerdict, number> = { none: 0, review: 1, block: 2 };

/** Başlık + açıklamayı tarar. İstemci ve (varsa) sunucu sonucunun en kötüsünü döndürür. */
export async function moderateListingText(title: string, description: string): Promise<ModerationVerdict> {
  const combined = `${title}\n${description}`;
  let verdict = localScan(combined);

  if (supabase) {
    try {
      const { data, error } = await supabase.rpc("scan_prohibited", { p_text: combined });
      const dv: ModerationVerdict | null = data === "block" || data === "review" || data === "none" ? data : null;
      if (!error && dv && RANK[dv] > RANK[verdict]) verdict = dv;
    } catch {
      // Sunucu fonksiyonu yoksa istemci sonucuyla devam.
    }
  }

  return verdict;
}

export const MODERATION_MESSAGES: Record<Exclude<ModerationVerdict, "none">, string> = {
  block:
    "Bu ilan, yasaklı ürün/hizmet içerdiği için yayınlanamaz (ör. silah, uyuşturucu, sahte belge). Lütfen içeriği düzenleyin.",
  review:
    "İlanınız incelemeye alındı. İçeriğinde dikkat gerektiren ifadeler bulunduğu için yönetici onayından sonra yayınlanacaktır."
};

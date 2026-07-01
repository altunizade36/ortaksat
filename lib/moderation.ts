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

// DB seed (prohibited_keywords) ile uyumlu gömülü liste. Türkiye mevzuatı + pazaryeri
// standartlarına göre KESİN YASAK ürün/hizmetler. (Kelime-sınırı ile eşleşir.)
const BLOCK_WORDS = [
  // Silah, mühimmat, patlayıcı
  "silah", "ateşli silah", "tabanca", "tüfek", "av tüfeği", "pompalı", "mühimmat", "mermi",
  "fişek", "patlayıcı", "havai fişek", "el bombası", "kurusıkı",
  // Uyuşturucu / yasa dışı madde
  "uyuşturucu", "esrar", "eroin", "kokain", "bonzai", "metamfetamin", "ekstazi", "keyif verici madde",
  // Reçeteli / kontrolsüz medikal
  "reçeteli ilaç", "antibiyotik", "steroid", "anabolik", "zayıflama ilacı", "hormon ilacı",
  // Tütün ürünleri
  "sigara", "tütün", "elektronik sigara", "e-sigara", "vape", "puro", "nargile tütünü", "sarma tütün",
  // Alkol
  "alkol", "içki", "bira", "şarap", "rakı", "viski", "votka", "likör", "kaçak içki",
  // Sahte / replika / çalıntı
  "replika", "çakma", "birinci kalite replika", "a kalite replika", "sahte ürün", "sahte marka",
  "çalıntı", "seri numarası silinmiş",
  // Dinleme / casus / takip
  "dinleme cihazı", "gizli kamera", "casus kamera", "takip cihazı", "sinyal kesici", "jammer",
  // Dijital: hesap / hack / spam
  "hack", "exploit", "zararlı yazılım", "phishing", "çalıntı hesap", "hesap satışı", "oyun hesabı satışı",
  "sosyal medya hesabı satışı", "sahte takipçi", "sahte beğeni", "takipçi satışı",
  // Resmi belge
  "pasaport", "ehliyet", "nüfus cüzdanı", "kimlik kartı", "sahte belge", "sahte fatura", "sahte rapor", "sahte diploma",
  // İnsan / organ / anne sütü
  "insan organı", "organ satışı", "böbrek satışı", "anne sütü",
  // Kumar / bahis
  "kumar", "bahis", "iddaa", "yasa dışı bahis", "şans oyunu kuponu"
];

// Manuel moderasyona (pending_review) düşecek dikkatli/ambigü ifadeler.
const REVIEW_WORDS = [
  "ilaç", "hap", "medikal", "tıbbi cihaz", "takviye", "reçete",
  "yetişkin", "18+", "escort", "porno",
  "kaçak", "gümrüksüz", "sahte", "taklit", "a kalite",
  "kimlik", "diploma", "sertifika satışı",
  "bıçak", "kelebek bıçak", "muşta", "biber gazı"
];

// Türkçe harf-duyarlı kelime sınırı: kelime, harf olmayan bir karakterle çevrili olmalı.
// Böylece "hap" -> "kitap" içinde yakalanmaz; "bira" -> "labirent" içinde eşleşmez.
const LETTER = "a-zçğıiöşü0-9";
function matchesWord(hay: string, word: string): boolean {
  if (word.includes(" ")) return hay.includes(word); // çok kelimeli ifade: düz arama yeterli
  const re = new RegExp(`(^|[^${LETTER}])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^${LETTER}]|$)`, "i");
  return re.test(hay);
}

function localScan(text: string): ModerationVerdict {
  const hay = (text ?? "").toLocaleLowerCase("tr-TR");
  if (!hay.trim()) return "none";
  if (BLOCK_WORDS.some((w) => matchesWord(hay, w))) return "block";
  if (REVIEW_WORDS.some((w) => matchesWord(hay, w))) return "review";
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

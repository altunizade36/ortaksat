// Faz 4: KATEGORİ-BAZLI DÖNÜŞÜM OLAYI.
// "Satış gerçekleşti" olayı her kategoride aynı ölçülemez. Bu modül, bir ilanın
// kategorisine göre komisyonun HANGİ olayda hak edildiğini belirler:
//   - Ürün / dijital  → doğrulanan SATIŞ (sipariş/teslim/aktivasyon)
//   - Emlak / vasıta   → nitelikli TALEP / randevu (tam satış beklenmez)
//   - Hizmet / eğitim  → RANDEVU / rezervasyon / tamamlanan hizmet
import { categoryTree, type CategoryNode } from "./category-tree";

export type ConversionType = "sale" | "lead" | "appointment";
export type ConversionInfo = {
  type: ConversionType;
  event: string; // komisyon bu olayda hak edilir (uzun)
  short: string; // kısa etiket (kart/rozet)
  sellerVerb: string; // satıcı panelindeki aksiyon metni
  icon: string; // MaterialCommunityIcons adı
  hint: string; // açıklama satırı
};

// leaf/ara kategori etiketi → top-level kök etiketi (memoize'li DFS).
let ROOT_BY_LABEL: Record<string, string> | null = null;
function buildMap(): Record<string, string> {
  const map: Record<string, string> = {};
  const norm = (s: string) => s.toLocaleLowerCase("tr-TR").trim();
  for (const top of categoryTree) {
    const stack: CategoryNode[] = [top];
    while (stack.length) {
      const n = stack.pop() as CategoryNode;
      if (!(norm(n.label) in map)) map[norm(n.label)] = top.label;
      if (!(norm(n.slug) in map)) map[norm(n.slug)] = top.label;
      for (const c of n.children ?? []) stack.push(c);
    }
  }
  return map;
}
function rootLabelOf(category: string): string {
  if (!ROOT_BY_LABEL) ROOT_BY_LABEL = buildMap();
  return ROOT_BY_LABEL[category.toLocaleLowerCase("tr-TR").trim()] ?? "";
}

// Kök kategori → dönüşüm tipi. Eşleşmeyen her şey "sale" (ürün).
const ROOT_TYPE: Array<[RegExp, ConversionType]> = [
  [/emlak/i, "lead"],
  [/vas[ıi]ta|ara[çc]|oto|motosiklet|ticari/i, "lead"],
  [/ustalar|hizmet/i, "appointment"],
  [/[öo]zel ders|e[ğg]itim|kurs/i, "appointment"],
  [/i[şs] [ıi]lan/i, "appointment"]
];

export function categoryConversion(category: string | undefined): ConversionInfo {
  const root = category ? rootLabelOf(category) : "";
  let type: ConversionType = "sale";
  for (const [re, t] of ROOT_TYPE) if (re.test(root) || (category && re.test(category))) { type = t; break; }

  if (type === "lead") {
    return {
      type,
      event: "Nitelikli talep / randevu",
      short: "Nitelikli talep",
      sellerVerb: "Talep / randevu kaydet",
      icon: "phone-check-outline",
      hint: "Emlak ve vasıtada komisyon; ortağın getirdiği nitelikli talep, telefon görüşmesi ya da randevu doğrulanınca hak edilir — tam satış beklenmez."
    };
  }
  if (type === "appointment") {
    return {
      type,
      event: "Randevu / hizmet",
      short: "Randevu",
      sellerVerb: "Randevu / hizmeti kaydet",
      icon: "calendar-check-outline",
      hint: "Hizmet ve eğitimde komisyon; ortağın getirdiği randevu, rezervasyon ya da tamamlanan hizmetle hak edilir."
    };
  }
  return {
    type,
    event: "Doğrulanan satış",
    short: "Satış",
    sellerVerb: "Satış ekle",
    icon: "cart-check",
    hint: "Üründe komisyon; alıcının onayladığı satış/teslim ile hak edilir."
  };
}

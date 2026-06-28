const COMMON_TURKISH_REPAIRS: Array<[RegExp, string]> = [
  [/[?\uFFFD]stanbul/g, "İstanbul"],
  [/Istanbul/g, "İstanbul"],
  [/Canl[?\uFFFD]/g, "Canlı"],
  [/canl[?\uFFFD]/g, "canlı"],
  [/[?\uFFFD]r[?\uFFFD]n/g, "ürün"],
  [/[?\uFFFD]R[?\uFFFD]N/g, "ÜRÜN"],
  [/[uü][r]?[?\uFFFD]n/g, "ürün"],
  [/[UÜ][r]?[?\uFFFD]n/g, "Ürün"],
  [/sat\?\?/g, "satış"],
  [/sat\?/g, "satış"],
  [/Sat\?\?/g, "Satış"],
  [/Sat\?/g, "Satış"],
  [/Kazan\?/g, "Kazanç"],
  [/kazan\?/g, "kazanç"],
  [/T\?rk/g, "Türk"],
  [/T\?m/g, "Tüm"],
  [/t\?m/g, "tüm"],
  [/G\?ven/g, "Güven"],
  [/g\?ven/g, "güven"],
  [/Ba\?vuru/g, "Başvuru"],
  [/ba\?vuru/g, "başvuru"],
  [/m\?\?teri/g, "müşteri"],
  [/M\?\?teri/g, "Müşteri"],
  [/odeme/g, "ödeme"],
  [/Odeme/g, "Ödeme"],
  [/Oden/g, "Öden"]
];

export function repairTurkishText(value?: string | null) {
  if (!value) return "";
  let next = value;
  for (const [pattern, replacement] of COMMON_TURKISH_REPAIRS) {
    next = next.replace(pattern, replacement);
  }
  return next.replace(/\s+/g, " ").trim();
}

export function displayText(value?: string | null, fallback = "-") {
  const repaired = repairTurkishText(value);
  return repaired || fallback;
}

// Kategori-özel sayısal aralık filtreleri (m²/km/yıl…). Şema alan anahtarına göre eşleşir.
// Keşfet + kategori sayfası + ana sayfa filtreleri PAYLAŞIR (tek kaynak → yüzeyler drift etmez).
export const NUM_RANGE_FILTERS: Array<{ key: string; label: string; suffix?: string }> = [
  { key: "grossM2", label: "m²" }, { key: "m2", label: "m²" }, { key: "netM2", label: "m² (net)" },
  { key: "km", label: "Kilometre", suffix: "km" }, { key: "year", label: "Yıl" },
  { key: "salon", label: "Salon sayısı" }, { key: "bathrooms", label: "Banyo sayısı" }, { key: "floorCount", label: "Kat sayısı" },
  { key: "dues", label: "Aidat", suffix: "₺" }, { key: "rentalIncome", label: "Kira getirisi", suffix: "₺" },
  { key: "workHours", label: "Çalışma saati", suffix: "saat" }, { key: "engineHours", label: "Motor saati", suffix: "saat" }
];

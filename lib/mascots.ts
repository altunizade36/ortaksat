// OrtakSat maskot kaydı — 8 poz, her biri belirli bir bağlam için (bkz Mascot.tsx).
// Görseller public/assets/mascot/ altında WebP (1024 masaüstü, 512 mobil), şeffaf zeminli.
// Kaynak çözümü platforma göre: web → mascot-source.ts (URI), native → mascot-source.native.ts (require).
export type MascotName = "success" | "mobile" | "package" | "approved" | "thinking" | "laptop" | "idea" | "heart";

export const MASCOT_ALT: Record<MascotName, string> = {
  success: "OrtakSat maskotu başparmak kaldırıyor",
  mobile: "OrtakSat maskotu telefon tutuyor",
  package: "OrtakSat maskotu kutu taşıyor",
  approved: "OrtakSat maskotu onay işareti yapıyor",
  thinking: "OrtakSat maskotu düşünüyor",
  laptop: "OrtakSat maskotu bilgisayar kullanıyor",
  idea: "OrtakSat maskotu fikir buldu",
  heart: "OrtakSat maskotu kalp tutuyor"
};

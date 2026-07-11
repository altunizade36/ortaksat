// OrtakSat maskot kaydı — 8 poz, her biri belirli bir bağlam için (bkz Mascot.tsx).
// Görseller public/assets/mascot/ altında WebP (1024 masaüstü, 512 mobil), şeffaf zeminli.
export type MascotName = "success" | "mobile" | "package" | "approved" | "thinking" | "laptop" | "idea" | "heart";

const BASE = "/assets/mascot";

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

// Masaüstünde 1024, mobilde 512 sürümünü ver.
export const mascotSrc = (name: MascotName, wide: boolean) => `${BASE}/webp-${wide ? 1024 : 512}/${name}.webp`;

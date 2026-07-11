// Maskot görsel kaynağı — WEB (ve varsayılan) sürüm.
// Web'de görseller public/ kökünden servis edilir; root-relative URI yeterli.
// Native sürüm için bkz: mascot-source.native.ts (require ile bundle'lanır).
import type { MascotName } from "./mascots";

const BASE = "/assets/mascot";

export function mascotSource(name: MascotName, wide: boolean): { uri: string } {
  return { uri: `${BASE}/webp-${wide ? 1024 : 512}/${name}.webp` };
}

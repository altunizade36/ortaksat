import * as Location from "expo-location";
import { Platform } from "react-native";
import { matchGeocodedLocation } from "@/lib/geocoded-location";

export const deviceLocationAvailable = Platform.OS !== "web";
export async function currentListingLocation() {
  // Expo SDK 54 has no web reverse-geocoder. Do not request browser GPS access
  // when it cannot be converted into the supported province/district selection.
  if (!deviceLocationAvailable) throw new Error("LOCATION_WEB_UNAVAILABLE");
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") throw new Error("LOCATION_PERMISSION_DENIED");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const point = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const places = await Location.reverseGeocodeAsync(point.coords);
        const location = matchGeocodedLocation(places[0]);
        if (!location) throw new Error("LOCATION_NOT_RESOLVED");
        return location;
      })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("LOCATION_TIMEOUT")), 25000); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}

export function currentLocationError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "LOCATION_WEB_UNAVAILABLE") return "Tarayıcıda il ve ilçeyi listeden seçebilirsin.";
  if (code === "LOCATION_PERMISSION_DENIED") return "Konum izni verilmedi. İl ve ilçeyi listeden seçebilirsin.";
  if (code === "LOCATION_TIMEOUT") return "Konum alınması uzun sürdü. Yeniden dene veya il ve ilçeyi elle seç.";
  if (code === "LOCATION_NOT_RESOLVED") return "Konumun Türkiye il ve ilçeleriyle eşleştirilemedi. Listeden seçim yapabilirsin.";
  return "Konum alınamadı. Konum servislerini kontrol et veya il ve ilçeyi elle seç.";
}

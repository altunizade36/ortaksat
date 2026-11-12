import { Platform } from "react-native";

// Supabase Storage expects an ArrayBuffer on React Native; native Blob uploads
// can otherwise create an empty/corrupted object despite a successful request.
export async function storageBody(blob: Blob): Promise<Blob | ArrayBuffer> {
  if (Platform.OS === "web") return blob;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Görsel okunamadı."));
    reader.onload = () => {
      try {
        const decoded = atob(String(reader.result).split(",")[1]);
        const bytes = new Uint8Array(decoded.length);
        for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
        resolve(bytes.buffer);
      } catch (error) { reject(error); }
    };
    reader.readAsDataURL(blob);
  });
}

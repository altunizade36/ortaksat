import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// Native dokunsal geri bildirim (iOS/Android). Web'de no-op. Fire-and-forget: hata yutulur.
// Premium native his: favori, ortak-olma, mesaj, buton dokunuşları için.
const on = Platform.OS === "ios" || Platform.OS === "android";

export const haptic = {
  // Hafif dokunuş — buton/favori/seçim.
  light() {
    if (on) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  // Seçim değişimi — sekme geçişi, segment/chip seçimi.
  selection() {
    if (on) Haptics.selectionAsync().catch(() => {});
  },
  // Orta — daha belirgin aksiyon.
  medium() {
    if (on) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },
  // Başarı — ortaklık aktif, işlem tamam.
  success() {
    if (on) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  // Uyarı/hata.
  warning() {
    if (on) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
  error() {
    if (on) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  }
};

import Constants from "expo-constants";
import { Platform } from "react-native";

import { savePushTokenLive } from "@/lib/live-service";

/**
 * Native push kaydı. YALNIZCA native'de (web'de no-op). Kullanıcı girişte çağrılır.
 * EAS projectId gerçek değilse (henüz `eas init` yapılmadıysa) sessizce atlar —
 * altyapı hazırdır, ilk gerçek native derlemede otomatik devreye girer.
 * İçerik/gönderim sunucudadır (notifications INSERT → push_on_notification trigger).
 */
export async function registerForPush(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const projectId =
      (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ??
      (Constants.easConfig?.projectId as string | undefined);
    if (!projectId || projectId.includes("replace-after")) return; // EAS henüz kurulmadı

    // Dinamik import: web bundle'ına expo-notifications girmesin.
    const Notifications = await import("expo-notifications");
    const Device = await import("expo-device");
    if (!Device.isDevice) return; // emülatörde push token alınamaz

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== "granted") return;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "OrtakSat",
        importance: Notifications.AndroidImportance.DEFAULT
      });
    }

    const tokenResp = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResp.data;
    if (token) await savePushTokenLive(token, Platform.OS);
  } catch (err) {
    // Push kurulumu hiçbir zaman uygulamayı bloklamaz.
    if (__DEV__) console.warn("registerForPush skipped", err);
  }
}

/** Uygulama önplandayken bildirim davranışı (native). Web'de no-op. */
export async function configurePushHandler(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const Notifications = await import("expo-notifications");
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: true
      })
    });
  } catch {
    /* no-op */
  }
}

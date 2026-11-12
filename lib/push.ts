import Constants from "expo-constants";
import { Platform } from "react-native";

import { savePushTokenLive } from "@/lib/live-service";
import { supabase } from "@/lib/supabase";
import { notificationEnabled } from "@/lib/notification-preferences";
let currentPreferences:Record<string,unknown>={notify_all_off:true};
export function setPushPreferences(preferences:Record<string,unknown>){currentPreferences=preferences;}

/**
 * Native push kaydı. YALNIZCA native'de (web'de no-op). Kullanıcı girişte çağrılır.
 * EAS projectId gerçek değilse (henüz `eas init` yapılmadıysa) sessizce atlar —
 * altyapı hazırdır, ilk gerçek native derlemede otomatik devreye girer.
 * İçerik/gönderim sunucudadır (notifications INSERT → push_on_notification trigger).
 */
export async function registerForPush(): Promise<void> {
  if (Platform.OS === "web" || Constants.executionEnvironment === "storeClient") return;
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
    if (token) { registeredToken = token; await savePushTokenLive(token, Platform.OS); }
  } catch (err) {
    // Push kurulumu hiçbir zaman uygulamayı bloklamaz.
    if (__DEV__) console.warn("registerForPush skipped", err);
  }
}

// Bu cihazda kaydedilen son Expo push token'ı (çıkışta silmek için).
let registeredToken: string | null = null;

/**
 * Çıkıştan ÖNCE çağrılır: bu cihazın token'ını çıkış yapan kullanıcıdan ayırır. Yoksa push_tokens
 * satırı eski kullanıcıda kalır ve onun bildirimleri (genel başlıkla da olsa) bu cihaza gelmeye
 * devam eder; sıradaki kullanıcı görür. Oturum açıkken çalışmalı (RLS: user_id = auth.uid()).
 * Web'de ve token yokken no-op. Hata uygulamayı/çıkışı asla bloklamaz.
 *
 * Çıkış bu çağrıyı BEKLER; çevrimdışıyken istek 15 sn'lik genel zaman aşımına kadar asılı kalıp
 * "Çıkış yap" düğmesini ölü gösteriyordu → en çok UNREGISTER_WAIT_MS beklenir. Token yalnız silme
 * BAŞARILIYSA unutulur (başarısızsa sonraki denemede yeniden silinebilsin).
 */
const UNREGISTER_WAIT_MS = 2500;
export async function unregisterPush(): Promise<void> {
  const token = registeredToken;
  const client = supabase;
  if (Platform.OS === "web" || !token || !client) return;
  try {
    const removal: Promise<boolean> = (async () => {
      const { error } = await client.from("push_tokens").delete().eq("token", token);
      return !error;
    })().catch(() => false);
    const removed = await Promise.race([
      removal,
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), UNREGISTER_WAIT_MS))
    ]);
    if (removed && registeredToken === token) registeredToken = null;
  } catch {
    /* no-op */
  }
}

/** Uygulama önplandayken bildirim davranışı (native). Web'de no-op. */
export async function configurePushHandler(): Promise<void> {
  if (Platform.OS === "web" || Constants.executionEnvironment === "storeClient") return;
  try {
    const Notifications = await import("expo-notifications");
    Notifications.setNotificationHandler({
      handleNotification: async notification => {
        const type=String(notification.request.content.data?.type||"system");
        const enabled=notificationEnabled(currentPreferences,type)&&!(type==="message"&&currentPreferences.notify_message_inapp_only===true);
        return {shouldShowBanner:enabled,shouldShowList:enabled,shouldPlaySound:false,shouldSetBadge:enabled};
      }
    });
  } catch {
    /* no-op */
  }
}

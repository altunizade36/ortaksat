import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import Constants from "expo-constants";
import { useRouter } from "expo-router";

import { supabase } from "@/lib/supabase";
import { configurePushHandler, registerForPush, setPushPreferences } from "@/lib/push";
import { useStore } from "@/lib/use-store";

/**
 * Native push kaydı: uygulama açıldığında bildirim davranışını ayarlar ve
 * oturum açık kullanıcı için Expo push token'ını kaydeder. Web'de tamamen no-op.
 * Görsel bir şey render etmez. İlgili: push_on_notification tetikleyicisi (sunucu).
 */
export function PushRegistrar() {
  const store=useStore(),router=useRouter(),storeRef=useRef(store),handled=useRef("");storeRef.current=store;
  useEffect(()=>{setPushPreferences(store.isAuthenticated?store.currentUser.preferences||{}:{notify_all_off:true});},[store.isAuthenticated,store.currentUser.preferences]);
  useEffect(()=>{
    if(Platform.OS==="web"||Constants.executionEnvironment==="storeClient")return;
    let alive=true,remove:(()=>void)|undefined;
    void import("expo-notifications").then(async Notifications=>{
      if(!alive)return;
      function receive(response:import("expo-notifications").NotificationResponse){const id=response.notification.request.identifier;if(handled.current===id)return;handled.current=id;void storeRef.current.refreshUserData();router.push("/notifications");}
      const subscription=Notifications.addNotificationResponseReceivedListener(receive);remove=()=>subscription.remove();
      const last=await Notifications.getLastNotificationResponseAsync();if(last&&alive)receive(last);
    }).catch(()=>{});
    return()=>{alive=false;remove?.();};
  },[router]);
  useEffect(() => {
    if (Platform.OS === "web" || !supabase) return;
    let cancelled = false;

    async function tryRegister() {
      if (cancelled || !supabase) return;
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) await registerForPush();
      } catch {
        /* sessizce yut — push kritik değil */
      }
    }

    void configurePushHandler();
    void tryRegister();
    // Uygulama öne gelince (yeni giriş / izin değişimi) tekrar dene.
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") void tryRegister(); });
    return () => { cancelled = true; sub.remove(); };
  }, []);

  return null;
}

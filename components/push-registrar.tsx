import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import Constants from "expo-constants";
import { useRouter } from "expo-router";

import { supabase } from "@/lib/supabase";
import { configurePushHandler, registerForPush, setPushPreferences } from "@/lib/push";
import { notificationTarget } from "@/lib/notification-target";
import { useStore } from "@/lib/use-store";

/**
 * Native push kaydı: uygulama açıldığında bildirim davranışını ayarlar ve
 * oturum açık kullanıcı için Expo push token'ını kaydeder. Web'de tamamen no-op.
 * Görsel bir şey render etmez. İlgili: push_on_notification tetikleyicisi (sunucu).
 */
export function PushRegistrar() {
  const store=useStore(),router=useRouter(),storeRef=useRef(store),handled=useRef("");storeRef.current=store;
  const signedInUserId=store.isAuthenticated?store.currentUser.id:"";
  useEffect(()=>{setPushPreferences(store.isAuthenticated?store.currentUser.preferences||{}:{notify_all_off:true});},[store.isAuthenticated,store.currentUser.preferences]);
  useEffect(()=>{
    if(Platform.OS==="web"||Constants.executionEnvironment==="storeClient")return;
    let alive=true,remove:(()=>void)|undefined;
    void import("expo-notifications").then(async Notifications=>{
      if(!alive)return;
      // Push'a dokununca İLGİLİ ekranı aç (eskiden her push /notifications'a düşüyordu: "Yeni mesajın
      // var"a dokunan kullanıcı sohbeti kendisi aramak zorundaydı). Sunucu push verisinde yalnız
      // {type, notificationId} taşır (kilit ekranına içerik sızmasın) → bildirimi store'dan bulup
      // uygulama-içi listeyle AYNI hedef çözümleyiciyi (notificationTarget) kullanırız.
      // Soğuk açılışta oturum/hesap verisi henüz yüklenmemiş olabilir → kısa süre bekle.
      async function open(data:Record<string,unknown>){
        const notificationId=typeof data.notificationId==="string"?data.notificationId:"",type=typeof data.type==="string"?data.type:"";
        const fallback=type==="message"?"/messages":"/notifications";
        const wait=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
        for(let i=0;i<40&&alive&&!(storeRef.current.authReady&&(!storeRef.current.isAuthenticated||storeRef.current.accountLoaded));i++)await wait(200);
        if(!alive)return;
        if(!storeRef.current.isAuthenticated){router.push("/notifications");return;}
        try{await storeRef.current.refreshUserData();}catch{/* çevrimdışı: eldeki veriyle devam */}
        let found=storeRef.current.notifications.find(n=>n.id===notificationId);
        for(let i=0;i<10&&alive&&notificationId&&!found;i++){await wait(150);found=storeRef.current.notifications.find(n=>n.id===notificationId);}
        if(!alive)return;
        const s=storeRef.current;
        const target=found?notificationTarget(found,{userId:s.currentUser.id,listings:s.listings,partnerships:s.partnerships,conversations:s.conversations}):null;
        if(found&&!found.read)void s.markNotificationRead(found.id);
        router.push((target?.href??fallback) as never);
      }
      function receive(response:import("expo-notifications").NotificationResponse){const id=response.notification.request.identifier;if(handled.current===id)return;handled.current=id;void open((response.notification.request.content.data??{}) as Record<string,unknown>);}
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
    // Kullanıcı DEĞİŞİNCE (giriş / hesap değiştirme) yeniden kaydet: eskiden yalnız açılışta ve
    // uygulama öne gelince deneniyordu → uygulama içinde giriş yapan kullanıcı, uygulamayı
    // arka plana atıp dönene kadar push almıyordu.
  }, [signedInUserId]);

  return null;
}

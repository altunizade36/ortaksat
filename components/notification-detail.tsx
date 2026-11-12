import { Modal, Text, View } from "react-native";
import { MobileButton, MobileCard, MobileScreen, mobile, ms } from "@/components/mobile/ui";
import { isMobileApp } from "@/lib/mobile-app";
import type { Notification } from "@/lib/types";

export function NotificationDetail({ notification, onClose }: { notification: Pick<Notification, "title" | "body" | "createdAt"> | null; onClose: () => void }) {
  // headerShown: MobileScreen içindeki <Stack.Screen> Modal içinden de ALTTAKİ rotanın
  // seçeneklerini yazar. Varsayılan (false) web'de /notifications sayfasının site başlığını
  // detay açılınca gizliyor ve kapatınca da geri getirmiyordu → web'de başlık açık kalır.
  return <Modal visible={!!notification} animationType="slide" onRequestClose={onClose}><MobileScreen title="Bildirim Detayı" onBack={onClose} footer={<></>} headerShown={!isMobileApp}>
    {/* Geniş ekranda metin satırı kenardan kenara uzamasın: okunur genişlikte ortala. */}
    <View style={{ alignSelf: "center", maxWidth: 720, width: "100%" }}>
      {notification ? <MobileCard><Text accessibilityRole="header" style={ms.section}>{notification.title}</Text><Text style={ms.muted}>{new Date(notification.createdAt).toLocaleString("tr-TR")}</Text><Text selectable style={{ color: mobile.ink, fontSize: 15, lineHeight: 24 }}>{notification.body}</Text></MobileCard> : null}
      <MobileButton secondary onPress={onClose}>Bildirimlere Dön</MobileButton>
    </View>
  </MobileScreen></Modal>;
}

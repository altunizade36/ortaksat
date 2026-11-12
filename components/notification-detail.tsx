import { Modal, Text, View } from "react-native";
import { MobileButton, MobileCard, MobileScreen, mobile, ms } from "@/components/mobile/ui";
import { isMobileApp } from "@/lib/mobile-app";
import { notificationDateTime } from "@/lib/notification-time";
import { translateCopy, useLanguage } from "@/lib/i18n";
import type { Notification } from "@/lib/types";

export function NotificationDetail({ notification, onClose }: { notification: Pick<Notification, "title" | "body" | "createdAt"> | null; onClose: () => void }) {
  const { language } = useLanguage();
  // headerShown: MobileScreen içindeki <Stack.Screen> Modal içinden de ALTTAKİ rotanın
  // seçeneklerini yazar. Varsayılan (false) web'de /notifications sayfasının site başlığını
  // detay açılınca gizliyor ve kapatınca da geri getirmiyordu → web'de başlık açık kalır.
  return <Modal visible={!!notification} animationType="slide" onRequestClose={onClose}><MobileScreen title={translateCopy("Bildirim Detayı", language)} onBack={onClose} footer={<></>} headerShown={!isMobileApp}>
    {/* Geniş ekranda metin satırı kenardan kenara uzamasın: okunur genişlikte ortala. */}
    <View style={{ alignSelf: "center", maxWidth: 720, width: "100%" }}>
      {notification ? <MobileCard><Text accessibilityRole="header" style={ms.section}>{translateCopy(notification.title, language)}</Text><Text style={ms.muted}>{notificationDateTime(notification.createdAt, language)}</Text><Text selectable style={{ color: mobile.ink, fontSize: 15, lineHeight: 24 }}>{translateCopy(notification.body, language)}</Text></MobileCard> : null}
      <MobileButton secondary onPress={onClose}>{translateCopy("Bildirimlere Dön", language)}</MobileButton>
    </View>
  </MobileScreen></Modal>;
}

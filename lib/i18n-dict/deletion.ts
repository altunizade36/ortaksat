// Turkish -> English copy for the account deletion flow.
// Files: app/hesap-silme.tsx, components/account-deletion-notice.tsx, admin deletion queue.
// Keys are the exact Turkish source strings passed to translateCopy(...).
export const deletionDict: Record<string, string> = {
  // --- page chrome ---
  "Hesap Silme": "Account Deletion",
  "OrtakSat hesabını ve kişisel verilerini nasıl sileceğini, nelerin silinip nelerin saklandığını ve 30 günlük geri alma süresini bu sayfada bulabilirsin.": "This page explains how to delete your OrtakSat account and personal data, what is deleted, what is kept, and the 30-day recovery window.",
  "Neler silinir?": "What is deleted?",
  "Neler saklanır?": "What is kept?",
  "30 günlük geri alma süresi": "30-day recovery window",
  "Hesabımı silmek istiyorum": "I want to delete my account",

  // --- what is deleted / kept / window ---
  "Ad, telefon, profil fotoğrafı, hakkında yazısı ve kullanıcı adı gibi profil bilgilerin.": "Your profile details such as name, phone, profile photo, bio and username.",
  "Giriş bilgilerin: e-posta adresin, bağlı Google hesabın ve tüm oturumların. Aynı hesapla yeniden giriş yapılamaz.": "Your sign-in details: your email address, linked Google account and all sessions. You can no longer sign in with the same account.",
  "İlanların yayından kaldırılır ve arşivlenir; yeni mesaj, teklif veya ortaklık talebi alamazsın.": "Your listings are unpublished and archived; you can no longer receive messages, offers or partnership requests.",
  "Bu cihazlara gönderilen bildirim kayıtların.": "The notification registrations for your devices.",
  "Mali kayıtlar: tamamlanmış satış, sipariş ve komisyon kayıtları, yasal saklama yükümlülükleri ve karşı tarafın hakları nedeniyle anonim bir profile bağlı olarak saklanır.": "Financial records: completed sale, order and commission records are kept attached to an anonymous profile because of legal retention duties and the other party's rights.",
  "Karşı tarafın mesaj geçmişi: yazıştığın kişiler kendi sohbet geçmişlerini görmeye devam eder; mesajların anonim bir kullanıcıya ait görünür.": "The other party's message history: people you chatted with keep their own conversation history; your messages appear as sent by an anonymous user.",
  "Şikâyet, itiraz ve güvenlik kayıtları yasal süre boyunca saklanır.": "Report, dispute and security records are kept for the legally required period.",
  "Talebi gönderdiğin anda hesabın askıya alınır, yayındaki ilanların duraklatılır ve oturumun kapatılır.": "As soon as you submit the request your account is suspended, your live listings are paused and you are signed out.",
  "30 gün içinde yeniden giriş yapıp “Silme talebini iptal et” seçeneğiyle vazgeçebilirsin; hesabın ve talep nedeniyle duraklatılan ilanların geri açılır.": "Within 30 days you can sign in again and choose “Cancel deletion request”; your account and the listings paused by the request are restored.",
  "30 günün sonunda hesabın kalıcı olarak silinir. Bu aşamadan sonra işlem geri alınamaz.": "After 30 days your account is permanently deleted. This cannot be undone after that point.",

  // --- signed-out guidance ---
  "Oturum kontrol ediliyor…": "Checking your session…",
  "Talebi açmak için silmek istediğin hesaba giriş yap; form bu sayfada açılır. Uygulamada aynı ekrana Hesap Ayarları › Hesabımı Sil yolundan ulaşabilirsin.": "To open a request, sign in to the account you want to delete; the form appears on this page. In the app you can reach the same screen via Account Settings › Delete My Account.",
  "Giriş yap ve hesabımı sil": "Sign in and delete my account",
  "E-posta uygulaması açılamadı. Adres:": "Could not open the email app. Address:",

  // --- signed-in form ---
  "Hesap silme yalnızca canlı hesaplarda geçerlidir.": "Account deletion is only available for live accounts.",
  "Hesap bilgileri doğrulanamadı. Bağlantını kontrol edip tekrar dene.": "Could not verify your account details. Check your connection and try again.",
  "Hesap bilgileri doğrulanıyor…": "Verifying your account details…",
  "Tekrar dene": "Try again",
  "Silinecek hesap:": "Account to delete:",
  "Ayrılma nedenin (isteğe bağlı)": "Your reason for leaving (optional)",
  "Bize kısaca anlatabilirsin": "You can tell us briefly",
  "Hesap şifren": "Your account password",
  "Hesabın senin olduğunu doğrulamak için şifreni istiyoruz.": "We ask for your password to confirm the account is yours.",
  "Onaylamak için SİL yaz": "Type SİL to confirm",
  "Bu hesapta şifre yok (Google gibi bir sağlayıcıyla giriş yapıyorsun); bu yüzden yazılı onay istiyoruz.": "This account has no password (you sign in with a provider such as Google), so we ask for a typed confirmation instead.",
  "Devam etmek için hesap şifreni gir.": "Enter your account password to continue.",
  "Onaylamak için kutuya SİL yaz.": "Type SİL in the box to confirm.",
  "Hesabını sil": "Delete your account",
  "Hesabın hemen askıya alınacak ve 30 gün sonra kalıcı olarak silinecek. Devam edilsin mi?": "Your account will be suspended immediately and permanently deleted after 30 days. Continue?",
  "Hesabımı Sil": "Delete My Account",
  "İşleniyor…": "Processing…",
  "Talep gönderilince bu cihazdaki oturumun kapatılır. 30 gün içinde giriş yapıp talebi iptal edebilirsin.": "Once the request is sent you are signed out on this device. You can sign in within 30 days to cancel it.",
  "Şifre doğrulanamadı. Hesabın silinmedi; şifreni kontrol edip tekrar dene.": "Password could not be verified. Your account was not deleted; check your password and try again.",
  "Silme talebi oluşturulamadı. Hesabın değişmedi; bağlantını kontrol edip tekrar dene.": "The deletion request could not be created. Your account is unchanged; check your connection and try again.",
  "Hesap silme talebin alındı": "Your account deletion request was received",

  // --- pending notice ---
  "Hesabın silinmek üzere": "Your account is about to be deleted",
  "Hesabın 30 günlük sürenin sonunda kalıcı olarak silinecek.": "Your account will be permanently deleted at the end of the 30-day window.",
  "Bu süre boyunca hesabın askıda: ilanların yayında değil; ilan verme, mesajlaşma ve ortaklık işlemleri kapalı. Vazgeçersen talebi şimdi iptal edebilirsin; hesabın ve talep nedeniyle duraklatılan ilanların geri açılır.": "During this period your account is suspended: your listings are not live, and posting, messaging and partnership actions are disabled. If you change your mind you can cancel the request now; your account and the listings paused by the request are restored.",
  "Silme talebini iptal et": "Cancel deletion request",
  "İptal ediliyor…": "Cancelling…",
  "Çıkış yapılıyor…": "Signing out…",
  "Silme talebi iptal edilemedi. Bağlantını kontrol edip tekrar dene.": "The deletion request could not be cancelled. Check your connection and try again.",
  "Silme talebin iptal edildi. Hesabın yeniden aktif.": "Your deletion request was cancelled. Your account is active again.",
  "Çıkış yapılamadı. Tekrar dene.": "Could not sign out. Try again.",
  "Hesap silme hakkında bilgi": "About account deletion",

  // --- entry points (settings / legal) ---
  "Hesabı Sil": "Delete Account",
  "Hesabını silme talebi oluşturursan hesabın hemen askıya alınır ve 30 gün sonra kalıcı olarak silinir. Bu süre içinde giriş yapıp talebi iptal edebilirsin.": "If you request deletion your account is suspended immediately and permanently deleted after 30 days. You can sign in during that period to cancel the request.",
  "Hesap silme ekranına git": "Go to the account deletion screen",

  // --- commission override modal: the fixed-amount toggle now shows the listing's currency symbol ---
  "Sabit": "Fixed"
};

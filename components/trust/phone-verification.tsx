import { useRef, useState } from "react";
import { Text } from "react-native";
import { MobileButton, MobileCard, MobileField, SectionLabel } from "@/components/mobile/ui";
import { confirmTrustPhoneOtp, requestTrustPhoneOtp, trustError } from "@/lib/trust-v1/api";

export function TrustPhoneVerification({ available }: { available: boolean }) {
  const [phone, setPhone] = useState(""), [code, setCode] = useState(""), [sentTo, setSentTo] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [retryAt, setRetryAt] = useState(0);
  const flight = useRef(false);
  return <MobileCard><SectionLabel>Telefon doğrulama</SectionLabel>
    {!available ? <Text>SMS sağlayıcısı yapılandırılmadığı için telefon doğrulama şu anda kullanılamıyor. Telefon doğrulanmış olarak işaretlenmez.</Text> : <>
      <MobileField label="Telefon (ülke koduyla, +90…)" value={phone} onChange={setPhone} maxLength={16} />
      <MobileButton secondary disabled={busy || !/^\+[1-9]\d{7,14}$/.test(phone)} onPress={async () => {
        if (flight.current) return;
        if (Date.now() < retryAt) { setMessage("Yeni kod istemeden önce bir dakika bekle."); return; }
        flight.current = true; setBusy(true); setMessage("");
        try { await requestTrustPhoneOtp(phone); setSentTo(phone); setRetryAt(Date.now() + 60000); setMessage("Kod gönderildi. Kodu yalnızca bu ekranda kullan."); } catch (e) { setMessage(trustError(e)); } finally { flight.current = false; setBusy(false); }
      }}>SMS kodu gönder</MobileButton>
      {!!sentTo && <><MobileField label="SMS doğrulama kodu" value={code} onChange={setCode} numeric maxLength={6} /><MobileButton disabled={busy || !/^\d{6}$/.test(code) || phone !== sentTo} onPress={async () => {
        if (flight.current) return; flight.current = true; setBusy(true);
        try { await confirmTrustPhoneOtp(sentTo, code); setMessage("Telefonun sunucuda doğrulandı."); setCode(""); setSentTo(""); } catch (e) { setMessage(trustError(e)); } finally { flight.current = false; setBusy(false); }
      }}>Telefonumu doğrula</MobileButton></>}
    </>}
    {!!message && <Text accessibilityRole="alert">{message}</Text>}
  </MobileCard>;
}

import { TrustPage } from "@/components/trust/screen";
import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MobileButton, MobileCard, MobileField, MobileScreen } from "@/components/mobile/ui";
import { Seo } from "@/components/seo";
import { trustCapabilities, trustConfirmReferral, trustError, trustGuestReferral, trustRequestId } from "@/lib/trust-v1/api";
import type { TrustCapabilities } from "@/lib/trust-v1/model";
import { useStore } from "@/lib/use-store";

export default function ReferralScreen() {
  const { transaction, code } = useLocalSearchParams<{ transaction?: string; code?: string }>(), router = useRouter(), { isAuthenticated } = useStore();
  const [caps, setCaps] = useState<TrustCapabilities>(), [consent, setConsent] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [done, setDone] = useState(false);
  const inFlight = useRef(false), request = useRef(trustRequestId());
  const [email, setEmail] = useState(""), [otp, setOtp] = useState(""), [challenge, setChallenge] = useState("");
  const [recordedTransaction, setRecordedTransaction] = useState("");
  useEffect(() => { let active = true; void trustCapabilities().then(c => { if (active) setCaps(c); }).catch(e => { if (active) setError(trustError(e)); }); return () => { active = false; }; }, []);
  const valid = /^[a-f\d-]{36}$/i.test(transaction || "") && !!code && code.length <= 128;
  return <TrustPage title="Alıcı Yönlendirme"><Seo title="Alıcı Yönlendirme | OrtakSat" description="Alıcı yönlendirmesini doğrula." noindex /><View style={{ gap: 14 }}>
    <MobileCard><Text style={{ fontSize: 21, fontWeight: "700", marginBottom: 12 }}>Seni bu ilana bir satış ortağı mı yönlendirdi?</Text><Text style={{ fontSize: 15, lineHeight: 23 }}>Bu adım yalnızca yönlendirmeyi kaydeder. Satın alma, ödeme veya satış doğrulaması değildir. İlk geçerli yönlendirme anlaşmadaki koruma süresince korunur.</Text></MobileCard>
    {!!error && <Text accessibilityRole="alert" style={{ color: "#A12639" }}>{error}</Text>}
    {!valid && <Text>Yönlendirme bağlantısı eksik veya geçersiz.</Text>}
    {caps && !caps.enabled && <Text>Yönlendirme sistemi henüz kullanıma açılmadı.</Text>}
    {done ? <MobileCard><Text accessibilityRole="alert">Yönlendirmen doğrulandı.</Text>{isAuthenticated && <MobileButton secondary onPress={() => router.push(`/guven-merkezi?transaction=${recordedTransaction || transaction}`)}>İşlem dosyasını aç</MobileButton>}</MobileCard> : caps?.enabled && valid && <>
      {!isAuthenticated ? <>
        {caps.guestReferralsAvailable ? <>
          <Text>Hesap açmadan e-posta koduyla yönlendirmeyi doğrulayabilirsin. E-posta yalnızca doğrulama hizmetine iletilir; herkese açık gösterilmez.</Text>
          {!challenge ? <MobileField label="E-posta" value={email} onChange={setEmail} maxLength={254} /> : <MobileField label="E-posta doğrulama kodu" value={otp} onChange={setOtp} maxLength={6} numeric />}
          <MobileButton secondary onPress={() => setConsent(v => !v)}>{consent ? "✓ Yönlendirmeyi doğruluyor, e-posta kodunu istiyorum" : "Bu satış ortağının beni yönlendirdiğini doğruluyorum"}</MobileButton>
          <MobileButton disabled={busy || !consent || (challenge ? !/^\d{6}$/.test(otp) : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))} onPress={async () => {
            if (inFlight.current) return; inFlight.current = true; setBusy(true); setError("");
            try {
              const result = challenge ? await trustGuestReferral({ operation: "confirm", challengeId: challenge, code: otp }) : await trustGuestReferral({ operation: "begin", email: email.trim(), transactionId: transaction!, refCode: code!, consent: true });
              if (result.challengeId) setChallenge(result.challengeId); if (result.ok) setDone(true);
            } catch (e) { setError(trustError(e)); } finally { inFlight.current = false; setBusy(false); }
          }}>{challenge ? "Kodu doğrula" : "E-posta kodu gönder"}</MobileButton>
        </> : <Text>E-posta ile misafir doğrulama hizmeti henüz yapılandırılmadı. Mevcut hesabınla devam edebilirsin.</Text>}
        <MobileButton secondary onPress={() => router.push(`/auth?redirect=${encodeURIComponent(`/guven-yonlendirme?transaction=${transaction}&code=${code}`)}`)}>Hesabımla giriş yap</MobileButton>
      </> : <>
        <MobileButton secondary onPress={() => setConsent(v => !v)}>{consent ? "✓ Bu satış ortağının beni yönlendirdiğini doğruluyorum" : "Bu satış ortağı beni yönlendirdi"}</MobileButton>
        <MobileButton disabled={busy || !consent} onPress={async () => {
          if (inFlight.current) return; inFlight.current = true; setBusy(true); setError("");
          try { const result = await trustConfirmReferral(transaction!, code!, request.current); setRecordedTransaction(result.transactionId || transaction); setDone(true); } catch (e) { setError(trustError(e)); } finally { inFlight.current = false; setBusy(false); }
        }}>Yönlendirmeyi kaydet</MobileButton>
      </>}
    </>}
  </View></TrustPage>;
}

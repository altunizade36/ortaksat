import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { Mascot } from "@/components/brand/Mascot";
import { Seo } from "@/components/seo";
import { money } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

type SaleInfo = { product_title: string; amount: number; seller_name: string | null; status: string; confirmed: boolean; created_at: string };

// Alıcı satış-onay sayfası (Faz 2): giriş GEREKMEZ. Token'lı link ile açılır; alıcı
// ürünü/hizmeti aldığını onaylar ya da sorun bildirir. Güvenli RPC'ler (SECURITY DEFINER)
// yalnız minimal bilgi döndürür ve token ile yetkilendirir.
export default function BuyerConfirmScreen() {
  const { language } = useLanguage();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<SaleInfo | null>(null);
  const [result, setResult] = useState<"confirmed" | "disputed" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!token || !supabase) { setLoading(false); setError("gecersiz"); return; }
      const { data, error: rpcErr } = await supabase.rpc("sale_confirm_info", { p_token: token });
      if (!alive) return;
      const row = Array.isArray(data) ? data[0] : data;
      if (rpcErr || !row) { setError("bulunamadi"); setLoading(false); return; }
      setInfo(row as SaleInfo);
      if ((row as SaleInfo).confirmed) setResult("confirmed");
      else if ((row as SaleInfo).status === "disputed") setResult("disputed");
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [token]);

  async function act(action: "confirm" | "dispute") {
    if (!token || !supabase || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc("confirm_sale", { p_token: token, p_action: action });
      if (rpcErr) { setError("islem"); return; }
      if (data === "confirmed" || data === "already") setResult("confirmed");
      else if (data === "disputed") setResult("disputed");
      else setError("islem");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ alignItems: "center", flexGrow: 1, justifyContent: "center", padding: 20 }} style={{ backgroundColor: colors.background }}>
      <Seo title={translateCopy("Satış onayı — OrtakSat", language)} description={translateCopy("OrtakSat satış onay sayfası.", language)} path="/onay" noindex />
      <View style={{ alignSelf: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 20, borderWidth: 1, gap: 16, maxWidth: 440, padding: 26, width: "100%" }}>
        {loading ? (
          <View style={{ alignItems: "center", gap: 12, paddingVertical: 20 }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>{translateCopy("Yükleniyor…", language)}</Text>
          </View>
        ) : error === "bulunamadi" || error === "gecersiz" || !info ? (
          <View style={{ alignItems: "center", gap: 12 }}>
            <MaterialCommunityIcons name="link-off" size={40} color={colors.muted} />
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900", textAlign: "center" }}>{translateCopy("Bağlantı geçersiz", language)}</Text>
            <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600", lineHeight: 20, textAlign: "center" }}>{translateCopy("Bu onay bağlantısı geçersiz ya da süresi dolmuş. Satıcıdan yeni bir onay linki isteyebilirsin.", language)}</Text>
            <Link href="/" asChild><Pressable style={{ backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 }}><Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" }}>{translateCopy("Ana sayfa", language)}</Text></Pressable></Link>
          </View>
        ) : result === "confirmed" ? (
          <View style={{ alignItems: "center", gap: 12 }}>
            <Mascot name="success" size={92} />
            <Text style={{ color: colors.ink, fontSize: 19, fontWeight: "900", textAlign: "center" }}>{translateCopy("Teşekkürler, onaylandı!", language)}</Text>
            <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600", lineHeight: 20, textAlign: "center" }}>{translateCopy("Aldığını onayladın. Bu, ortağın komisyonunun doğrulanmasına yardımcı olur. İyi günlerde kullan!", language)}</Text>
          </View>
        ) : result === "disputed" ? (
          <View style={{ alignItems: "center", gap: 12 }}>
            <MaterialCommunityIcons name="alert-circle-outline" size={44} color={colors.warning} />
            <Text style={{ color: colors.ink, fontSize: 19, fontWeight: "900", textAlign: "center" }}>{translateCopy("Sorun bildirildi", language)}</Text>
            <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600", lineHeight: 20, textAlign: "center" }}>{translateCopy("Bildirimin kaydedildi ve satışa itiraz olarak işaretlendi. Satıcı ile iletişime geçip durumu netleştirebilirsin.", language)}</Text>
          </View>
        ) : (
          <>
            <View style={{ alignItems: "center", gap: 8 }}>
              <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 16, height: 56, justifyContent: "center", width: 56 }}>
                <MaterialCommunityIcons name="check-decagram-outline" size={30} color={colors.primaryDark} />
              </View>
              <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "900", textAlign: "center" }}>{translateCopy("Alışverişini onayla", language)}</Text>
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", lineHeight: 19, textAlign: "center" }}>{translateCopy("Aşağıdaki ürünü/hizmeti aldıysan onayla. Bu, seni yönlendiren ortağın komisyonunun doğrulanmasını sağlar. OrtakSat ödeme tutmaz.", language)}</Text>
            </View>
            <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 6, padding: 14 }}>
              <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>{info.product_title}</Text>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                <Text style={{ color: colors.primaryDark, fontSize: 16, fontWeight: "900" }}>{money(Number(info.amount || 0))}</Text>
                {info.seller_name ? <Text numberOfLines={1} style={{ color: colors.muted, flex: 1, fontSize: 12, fontWeight: "700" }}>· {info.seller_name}</Text> : null}
              </View>
            </View>
            <Pressable disabled={busy} onPress={() => void act("confirm")} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 12, flexDirection: "row", gap: 8, justifyContent: "center", opacity: busy ? 0.7 : 1, paddingVertical: 14 }}>
              <MaterialCommunityIcons name="check-bold" size={17} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 14.5, fontWeight: "900" }}>{translateCopy("Aldığımı onaylıyorum", language)}</Text>
            </Pressable>
            <Pressable disabled={busy} onPress={() => void act("dispute")} style={{ alignItems: "center", justifyContent: "center", paddingVertical: 8 }}>
              <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Almadım / sorun var", language)}</Text>
            </Pressable>
            {error === "islem" ? <Text style={{ color: colors.accent, fontSize: 12.5, fontWeight: "700", textAlign: "center" }}>{translateCopy("İşlem tamamlanamadı, lütfen tekrar dene.", language)}</Text> : null}
          </>
        )}
      </View>
    </ScrollView>
  );
}

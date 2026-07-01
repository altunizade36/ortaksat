import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { colors } from "@/components/colors";
import { commissionAmount, commissionText, money } from "@/lib/format";
import type { Listing, Partnership } from "@/lib/types";

/**
 * Ortak Satış Anlaşması özeti. Ürün, fiyat, komisyon tipi/tutarı, satış olursa
 * kimin kime ödeyeceği ve iki tarafın kabul durumunu tek kartta gösterir.
 * ÖDEME SİSTEM DIŞINDADIR — platform yalnızca anlaşmayı kayıt altına alır.
 */
export function AgreementCard({ listing, partnership }: { listing: Listing; partnership?: Partnership }) {
  const commission = commissionAmount(listing);
  const partnerAccepted = Boolean(partnership); // başvuru = ortağın kabulü
  const sellerAccepted = partnership?.status === "active" || partnership?.status === "completed";
  const rejected = partnership?.status === "rejected" || partnership?.status === "blocked";

  const rows: Array<{ label: string; value: string }> = [
    { label: "Ürün", value: listing.title },
    { label: "Ürün fiyatı", value: money(listing.price) },
    { label: "Komisyon tipi", value: listing.commissionType === "rate" ? "Yüzde (%)" : "Sabit tutar (₺)" },
    { label: "Komisyon", value: `${commissionText(listing)}  ≈ ${money(commission)}` },
    { label: "Satış olursa", value: "Satıcı → Ortağa komisyonu öder" },
    { label: "Ödeme yöntemi", value: "Taraflar belirler (havale/EFT, elden…)" }
  ];

  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 16 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 9 }}>
        <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 9, height: 34, justifyContent: "center", width: 34 }}>
          <MaterialCommunityIcons name="file-sign" size={19} color={colors.primaryDark} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.ink, fontSize: 15.5, fontWeight: "900" }}>Ortak Satış Anlaşması</Text>
          <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>Şartlar kayıt altına alınır; ödeme taraflar arasındadır.</Text>
        </View>
      </View>

      <View style={{ gap: 7 }}>
        {rows.map((r) => (
          <View key={r.label} style={{ alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "space-between" }}>
            <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>{r.label}</Text>
            <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "800", textAlign: "right" }}>{r.value}</Text>
          </View>
        ))}
      </View>

      {/* İki tarafın kabul durumu */}
      <View style={{ borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 8, paddingTop: 10 }}>
        <AcceptPill label="Ortak" ok={partnerAccepted} rejected={false} />
        <AcceptPill label="Satıcı" ok={sellerAccepted} rejected={rejected} />
      </View>

      <View style={{ alignItems: "flex-start", backgroundColor: colors.surfaceAlt, borderRadius: 10, flexDirection: "row", gap: 8, padding: 10 }}>
        <MaterialCommunityIcons name="shield-alert-outline" size={16} color={colors.muted} style={{ marginTop: 1 }} />
        <Text style={{ color: colors.muted, flex: 1, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>
          OrtakSat ödeme, tahsilat veya teslimat yapmaz. Komisyon satıcı ile ortak arasında, anlaşılan kanaldan ödenir. Satış ve ödeme sonrası durum panelden "Ödendi/Alındı" olarak işaretlenir.
        </Text>
      </View>
    </View>
  );
}

function AcceptPill({ label, ok, rejected }: { label: string; ok: boolean; rejected: boolean }) {
  const tint = rejected ? colors.accentSoft : ok ? colors.successSoft : colors.warningSoft;
  const color = rejected ? colors.accent : ok ? colors.success : colors.warning;
  const icon = rejected ? "close-circle-outline" : ok ? "check-decagram" : "clock-outline";
  const state = rejected ? "Reddetti" : ok ? "Kabul etti" : "Bekliyor";
  return (
    <View style={{ alignItems: "center", backgroundColor: tint, borderRadius: 10, flex: 1, flexDirection: "row", gap: 7, paddingHorizontal: 11, paddingVertical: 9 }}>
      <MaterialCommunityIcons name={icon} size={16} color={color} />
      <View style={{ minWidth: 0 }}>
        <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "900" }}>{label}</Text>
        <Text style={{ color, fontSize: 10.5, fontWeight: "800" }}>{state}</Text>
      </View>
    </View>
  );
}

import { ScrollView, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { CAT, DonutChart, GroupedBarChart, HBarChart, KpiDeltaTile, LineAreaChart, Treemap } from "@/components/charts";

// GEÇİCİ önizleme — grafik kitini görsel doğrulamak için (admin-only panel screenshot alınamıyor).
// Doğrulama sonrası kaldırılır / admin'e taşınır.
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 18, shadowColor: "#0A2E22", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 12 }}>
      <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900", letterSpacing: -0.2 }}>{title}</Text>
      {children}
    </View>
  );
}

export default function PanelPreview() {
  const days = Array.from({ length: 14 }).map((_, i) => ({ label: `${i + 1}`, value: [3, 5, 4, 7, 6, 9, 8, 11, 7, 12, 10, 14, 13, 16][i] }));
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ gap: 16, maxWidth: 1180, padding: 16, width: "100%", alignSelf: "center" }}>
      <Text style={{ color: colors.ink, fontSize: 24, fontWeight: "900" }}>Panel Grafik Önizleme</Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <KpiDeltaTile label="Toplam GMV" value={401412} money icon="cash-multiple" delta={21} tint="#0F9D66" accent="#0A7A50" />
        <KpiDeltaTile label="Net Komisyon" value={68908} money icon="chart-line" delta={8} tint="#2C82F6" accent="#1E63C8" />
        <KpiDeltaTile label="Aktif Kullanıcı" value={3117} icon="account-group" delta={24} tint="#7C5CFC" accent="#5E3FE0" />
        <KpiDeltaTile label="Yeni İlan" value={1233} icon="storefront-outline" delta={-12} tint="#E0A81E" accent="#B7791F" />
        <KpiDeltaTile label="Açık Talep" value={382} icon="account-clock-outline" delta={35} tint="#E4572E" accent="#C43E1A" />
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
        <View style={{ flexBasis: 340, flexGrow: 1, minWidth: 300 }}>
          <Card title="Satış Tipi (Donut)">
            <DonutChart data={[{ label: "Doğrudan", value: 52 }, { label: "Online", value: 33 }, { label: "Toptan", value: 15 }]} centerTop="%52" centerBottom="Doğrudan" />
          </Card>
        </View>
        <View style={{ flexBasis: 340, flexGrow: 1, minWidth: 300 }}>
          <Card title="Ödeme Modu (Donut)">
            <DonutChart data={[{ label: "Nakit", value: 50, color: CAT[3] }, { label: "Online", value: 50, color: CAT[2] }]} centerTop="₺68B" centerBottom="Toplam" />
          </Card>
        </View>
      </View>

      <Card title="Kampanya Performansı (Gruplu Bar)">
        <GroupedBarChart
          series={[{ label: "Gösterim", color: CAT[0] }, { label: "Tıklama", color: CAT[3] }]}
          groups={[{ label: "Kamp 1", values: [820, 340] }, { label: "Kamp 2", values: [640, 210] }, { label: "Kamp 3", values: [950, 420] }, { label: "Kamp 4", values: [510, 180] }, { label: "Kamp 5", values: [720, 300] }]}
        />
      </Card>

      <Card title="Son 30 Gün Aktivite (Çizgi + Alan)">
        <LineAreaChart points={days.concat(days).slice(0, 30).map((d, i) => ({ label: `${i + 1}`, value: 5 + Math.round(Math.abs(Math.sin(i / 3)) * 18) }))} />
      </Card>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
        <View style={{ flexBasis: 340, flexGrow: 1, minWidth: 300 }}>
          <Card title="Kategori Dağılımı (Treemap)">
            <Treemap data={[{ label: "Emlak", value: 95269 }, { label: "Vasıta", value: 92964 }, { label: "Elektronik", value: 80282 }, { label: "Moda", value: 62300 }, { label: "Ev", value: 91617 }, { label: "Spor", value: 45200 }]} />
          </Card>
        </View>
        <View style={{ flexBasis: 340, flexGrow: 1, minWidth: 300 }}>
          <Card title="En Çok İlan (Yatay Bar)">
            <HBarChart data={[{ label: "Emlak", value: 42 }, { label: "Vasıta", value: 31 }, { label: "Elektronik", value: 24 }, { label: "Moda", value: 18 }, { label: "Ev & Yaşam", value: 12 }]} />
          </Card>
        </View>
      </View>
    </ScrollView>
  );
}

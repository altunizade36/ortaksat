import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Alert } from "@/lib/alert";

import { Accordion } from "@/components/accordion";
import { AnchoredDropdown, useAnchor } from "@/components/anchored-dropdown";
import { colors } from "@/components/colors";
import { Seo } from "@/components/seo";
import { EmptyState } from "@/components/ui";
import { WebFooter } from "@/components/web-landing";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { useIsWideWeb } from "@/lib/layout";
import { useStore } from "@/lib/use-store";

const REQUEST_TYPES = [
  { key: "view", icon: "file-eye-outline", label: "Veri Görüntüleme", desc: "Kişisel verilerinizin bir kopyasını talep edebilirsiniz." },
  { key: "edit", icon: "file-document-edit-outline", label: "Veri Düzeltme", desc: "Yanlış ya da eksik verilerinizin düzeltilmesini isteyebilirsiniz." },
  { key: "delete", icon: "delete-outline", label: "Veri Silme", desc: "Kişisel verilerinizin silinmesini talep edebilirsiniz." },
  { key: "revoke", icon: "lock-reset", label: "İzinleri Geri Çekme", desc: "Pazarlama ve iletişim izinlerinizi geri çekebilirsiniz." },
  { key: "close", icon: "account-cancel-outline", label: "Hesap Kapatma", desc: "Hesabınızı ve ilgili verilerinizi kalıcı olarak kapatabilirsiniz." }
] as const;

type HistoryRow = { id: string; type: string; created: string; updated: string; status: "Tamamlandı" | "İncelemede" | "Reddedildi" };

const STATUS_TONE: Record<HistoryRow["status"], { tint: string; color: string }> = {
  "Tamamlandı": { tint: colors.successSoft, color: colors.success },
  "İncelemede": { tint: colors.warningSoft, color: colors.warning },
  "Reddedildi": { tint: colors.accentSoft, color: colors.accent }
};

export default function KvkkScreen() {
  const isWideWeb = useIsWideWeb();
  const { createSupportTicket, currentUser } = useStore();
  const [reqType, setReqType] = useState("Veri Görüntüleme");
  const [desc, setDesc] = useState("");
  // Geçmiş, kullanıcının bu oturumda oluşturduğu gerçek taleplerle dolar; sahte
  // örnek kayıt gösterilmez (önceden uydurma "Reddedildi/Tamamlandı" satırları vardı).
  const [history, setHistory] = useState<HistoryRow[]>([]);

  async function submit() {
    const ok = await createSupportTicket(`KVKK Talebi: ${reqType}`, desc || reqType);
    setHistory((h) => [{ id: `TR-2026-${String(160 + h.length).padStart(5, "0")}`, type: reqType, created: "Bugün", updated: "Bugün", status: "İncelemede" }, ...h]);
    setDesc("");
    Alert.alert(ok ? "Talebiniz alındı" : "Talep kaydedildi", "KVKK talebiniz kayıt altına alındı; en geç 30 gün içinde sonuçlandırılır.");
  }

  const kvkkInfo = [
    "Şeffaf ve güvenli veri işleme",
    "Veri güvenliği ve gizlilik",
    "Yasal süreler içinde yanıt",
    "Ücretsiz başvuru hakkı"
  ];
  const responseTimes = [
    { t: "İlk değerlendirme: 7 iş günü", icon: "clock-start" as const },
    { t: "Yanıt süresi: En geç 30 gün", icon: "calendar-clock" as const },
    { t: "Ek süre (gerekirse): +15 gün", icon: "timer-sand" as const }
  ];
  const timeline = [
    { icon: "file-document-outline" as const, title: "Başvuru Alındı", sub: "Talebiniz sisteme kaydedilir." },
    { icon: "magnify" as const, title: "İnceleme", sub: "Talebiniz KVKK kapsamında incelenir." },
    { icon: "shield-check-outline" as const, title: "Onay", sub: "Uygunluk değerlendirilir ve onaylanır." },
    { icon: "check-circle-outline" as const, title: "Tamamlandı", sub: "Talebiniz sonuçlandırılır ve size iletilir." }
  ];

  const Body = (
    <>
      {/* Breadcrumb */}
      <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        <Link href="/profile" asChild><Pressable><Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>Hesabım</Text></Pressable></Link>
        <MaterialCommunityIcons name="chevron-right" size={15} color={colors.subtle} />
        <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>KVKK ve Veri Talepleri</Text>
      </View>

      <View style={{ alignItems: "center", flexDirection: "row", gap: 14 }}>
        <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 12, height: 52, justifyContent: "center", width: 52 }}>
          <MaterialCommunityIcons name="shield-lock" size={28} color={colors.primaryDark} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: colors.ink, fontSize: 26, fontWeight: "900" }}>KVKK ve Veri Talepleri</Text>
          <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>Kişisel verilerinizle ilgili talepleri oluşturun, takip edin ve geçmiş başvurularınızı yönetin.</Text>
        </View>
      </View>

      <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 20 }}>
        <View style={{ flex: 1, gap: 16, minWidth: 0 }}>
          {/* Stat cards */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
            <KvkkStat icon="shield-check" tint={colors.successSoft} color={colors.success} value={currentUser.verifiedIdentity ? "Doğrulanmış" : "Bekliyor"} title="Doğrulama Durumu" sub={currentUser.verifiedIdentity ? "Kimlik doğrulaması tamamlandı" : "Kimlik henüz doğrulanmadı"} />
            <KvkkStat icon="file-document-outline" tint={colors.infoSoft} color={colors.info} value={`${history.filter((h) => h.status === "İncelemede").length}`} title="Açık Talep" sub="Aktif açık talebiniz" />
            <KvkkStat icon="calendar-check-outline" tint={colors.violetSoft} color={colors.violet} value="≤ 30 gün" title="Yasal Yanıt Süresi" sub="Talepler bu süre içinde sonuçlanır" />
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
            {/* Request types */}
            <View style={{ flexBasis: 300, flexGrow: 1, gap: 10, minWidth: 0 }}>
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>Talep türleri</Text>
              {REQUEST_TYPES.map((r) => (
                <Accordion key={r.key} title={r.label} icon={r.icon}>
                  <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "500", lineHeight: 19 }}>{r.desc}</Text>
                  <Pressable onPress={() => setReqType(r.label)} style={{ alignSelf: "flex-start", marginTop: 4 }}>
                    <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>Bu talebi oluştur →</Text>
                  </Pressable>
                </Accordion>
              ))}
            </View>

            {/* New request form */}
            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, flexBasis: 320, flexGrow: 1, gap: 12, minWidth: 0, padding: 20 }}>
              <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>Yeni Talep Oluştur</Text>
              <KvkkSelect label="Talep Türü" value={reqType} options={REQUEST_TYPES.map((r) => r.label)} onSelect={setReqType} />
              <View style={{ gap: 6 }}>
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>Açıklama</Text>
                <TextInput value={desc} onChangeText={setDesc} multiline placeholder="Talebinizle ilgili detaylı bilgi verin (isteğe bağlı)" placeholderTextColor={colors.subtle} maxLength={1000} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 110, paddingHorizontal: 12, paddingVertical: 11, textAlignVertical: "top" }} />
                <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "600", textAlign: "right" }}>{desc.length} / 1000</Text>
              </View>
              <View style={{ alignItems: "flex-start", backgroundColor: colors.infoSoft, borderRadius: 10, flexDirection: "row", gap: 8, padding: 11 }}>
                <MaterialCommunityIcons name="shield-account-outline" size={17} color={colors.info} style={{ marginTop: 1 }} />
                <Text style={{ color: colors.muted, flex: 1, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>Kimlik doğrulama gereklidir. 6698 sayılı KVKK gereği, talebinizi işleme alabilmemiz için kimliğinizin doğrulanmış olması gerekir.</Text>
              </View>
              <Pressable onPress={() => void submit()} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 13 }}>
                <MaterialCommunityIcons name="send" size={17} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" }}>Talebini Gönder</Text>
              </Pressable>
            </View>
          </View>

          {/* Timeline */}
          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 16, padding: 20 }}>
            <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>İşlem Süreci</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {timeline.map((s, i) => (
                <View key={s.title} style={{ flex: 1, gap: 8 }}>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
                    <View style={{ alignItems: "center", backgroundColor: i === 0 ? colors.primary : colors.surfaceAlt, borderRadius: 999, height: 30, justifyContent: "center", width: 30 }}>
                      <MaterialCommunityIcons name={s.icon} size={16} color={i === 0 ? "#FFFFFF" : colors.muted} />
                    </View>
                    {i < timeline.length - 1 ? <View style={{ backgroundColor: colors.line, flex: 1, height: 2 }} /> : null}
                  </View>
                  <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{s.title}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>{s.sub}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* History */}
          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, overflow: "hidden" }}>
            <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900", padding: 18 }}>Geçmiş Taleplerim</Text>
            <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderTopWidth: 1, flexDirection: "row", paddingHorizontal: 18, paddingVertical: 9 }}>
              <Text style={{ color: colors.muted, flex: 1.3, fontSize: 11, fontWeight: "800" }}>TALEP NO</Text>
              <Text style={{ color: colors.muted, flex: 1.4, fontSize: 11, fontWeight: "800" }}>TÜR</Text>
              <Text style={{ color: colors.muted, flex: 1.4, fontSize: 11, fontWeight: "800" }}>OLUŞTURMA</Text>
              <Text style={{ color: colors.muted, flex: 1.4, fontSize: 11, fontWeight: "800" }}>SON GÜNCELLEME</Text>
              <Text style={{ color: colors.muted, flex: 1, fontSize: 11, fontWeight: "800" }}>DURUM</Text>
              <Text style={{ color: colors.muted, flex: 0.8, fontSize: 11, fontWeight: "800", textAlign: "right" }}>İŞLEM</Text>
            </View>
            {history.length === 0 ? <View style={{ padding: 18 }}><EmptyState title="Talep yok" body="Henüz bir KVKK talebi oluşturmadınız." /></View> : null}
            {history.map((h, idx) => (
              <View key={h.id} style={{ alignItems: "center", borderTopColor: colors.line, borderTopWidth: idx === 0 ? 0 : 1, flexDirection: "row", paddingHorizontal: 18, paddingVertical: 12 }}>
                <Text numberOfLines={1} style={{ color: colors.primaryDark, flex: 1.3, fontSize: 12, fontWeight: "800" }}>{h.id}</Text>
                <Text numberOfLines={1} style={{ color: colors.ink, flex: 1.4, fontSize: 12.5, fontWeight: "700" }}>{h.type}</Text>
                <Text numberOfLines={1} style={{ color: colors.muted, flex: 1.4, fontSize: 12, fontWeight: "600" }}>{h.created}</Text>
                <Text numberOfLines={1} style={{ color: colors.muted, flex: 1.4, fontSize: 12, fontWeight: "600" }}>{h.updated}</Text>
                <View style={{ flex: 1 }}>
                  <View style={{ alignSelf: "flex-start", backgroundColor: STATUS_TONE[h.status].tint, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
                    <Text style={{ color: STATUS_TONE[h.status].color, fontSize: 10.5, fontWeight: "900" }}>{h.status}</Text>
                  </View>
                </View>
                <Text style={{ color: colors.primaryDark, flex: 0.8, fontSize: 12, fontWeight: "800", textAlign: "right" }}>Detay →</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Sidebar */}
        <View style={{ gap: 16, width: 300 }}>
          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 10, padding: 18 }}>
            <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>KVKK Hakkında</Text>
            <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında, kişisel verileriniz üzerinde çeşitli haklara sahipsiniz.</Text>
            {kvkkInfo.map((k) => (
              <View key={k} style={{ alignItems: "flex-start", flexDirection: "row", gap: 8 }}>
                <MaterialCommunityIcons name="check-circle" size={16} color={colors.success} style={{ marginTop: 1 }} />
                <Text style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{k}</Text>
              </View>
            ))}
            <Link href="/legal" asChild><Pressable><Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>KVKK Aydınlatma Metni'ni İncele →</Text></Pressable></Link>
          </View>

          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 11, padding: 18 }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
              <MaterialCommunityIcons name="clock-outline" size={19} color={colors.primaryDark} />
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>Yanıt Süreleri</Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", lineHeight: 17 }}>KVKK gereği talepleriniz en geç 30 gün içinde ücretsiz olarak sonuçlandırılır.</Text>
            {responseTimes.map((r) => (
              <View key={r.t} style={{ alignItems: "center", flexDirection: "row", gap: 9 }}>
                <MaterialCommunityIcons name={r.icon} size={16} color={colors.primary} />
                <Text style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "700" }}>{r.t}</Text>
              </View>
            ))}
          </View>

          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 18 }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
              <MaterialCommunityIcons name="lifebuoy" size={19} color={colors.primaryDark} />
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>Destek ve İletişim</Text>
            </View>
            <KvkkContact icon="email-outline" label="KVKK & Destek E-posta" value={SUPPORT_EMAIL} />
            <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>
              KVKK başvuruların, veri talepleri ve tüm iletişim bu e-posta üzerinden yürür. OrtakSat çağrı merkezi/telefon hattı işletmez.
            </Text>
            <Link href="/iletisim" asChild>
              <Pressable style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 10, flexDirection: "row", gap: 7, justifyContent: "center", paddingVertical: 11 }}>
                <MaterialCommunityIcons name="email-outline" size={16} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>İletişim sayfasına git</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </View>
    </>
  );

  if (isWideWeb) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, flexGrow: 1, paddingBottom: 0 }} style={{ backgroundColor: colors.background }}>
        <View style={{ gap: 16, paddingHorizontal: 20, paddingTop: 16 }}>{Body}</View>
        <View style={{ marginTop: 20 }}><WebFooter /></View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 14, padding: 14, paddingBottom: 96 }}>
      <Seo title="KVKK ve Veri Talepleri — Kişisel veri hakların | OrtakSat" description="KVKK kapsamında kişisel verilerine ilişkin erişim, düzeltme, silme taleplerini oluştur ve takip et. Başvuru: destek@ortaksat.com." path="/kvkk" />
      <Text style={{ color: colors.ink, fontSize: 22, fontWeight: "900" }}>KVKK ve Veri Talepleri</Text>
      <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>Kişisel verilerinle ilgili talep oluştur ve geçmişini takip et.</Text>
      <View style={{ gap: 8 }}>
        <KvkkSelect label="Talep Türü" value={reqType} options={REQUEST_TYPES.map((r) => r.label)} onSelect={setReqType} />
        <TextInput value={desc} onChangeText={setDesc} multiline placeholder="Açıklama (isteğe bağlı)" placeholderTextColor={colors.subtle} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 15, minHeight: 100, padding: 12, textAlignVertical: "top" }} />
        <Pressable onPress={() => void submit()} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 13 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>Talebini Gönder</Text>
        </Pressable>
      </View>
      {history.map((h) => (
        <View key={h.id} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 12, borderWidth: 1, gap: 4, padding: 12 }}>
          <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "800" }}>{h.type}</Text>
            <View style={{ backgroundColor: STATUS_TONE[h.status].tint, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: STATUS_TONE[h.status].color, fontSize: 10.5, fontWeight: "900" }}>{h.status}</Text></View>
          </View>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{h.id} · {h.created}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function KvkkStat({ icon, tint, color, value, title, sub }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; tint: string; color: string; value: string; title: string; sub: string }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, flexBasis: 200, flexGrow: 1, gap: 8, minWidth: 0, padding: 16 }}>
      <View style={{ alignItems: "center", backgroundColor: tint, borderRadius: 10, height: 40, justifyContent: "center", width: 40 }}>
        <MaterialCommunityIcons name={icon} size={20} color={color} />
      </View>
      <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{value}</Text>
      <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{title}</Text>
      <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{sub}</Text>
    </View>
  );
}

function KvkkContact({ icon, label, value }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string }) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
      <MaterialCommunityIcons name={icon} size={17} color={colors.primaryDark} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>{label}</Text>
        <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{value}</Text>
      </View>
    </View>
  );
}

function KvkkSelect({ label, value, options, onSelect }: { label: string; value: string; options: string[]; onSelect: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  // ÇAPALI KATMAN (ebeveyne-absolute → kırpılma/taşma giderildi).
  const { ref: anchorRef, rect: anchorRect, measure } = useAnchor(open);
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>{label}</Text>
      <View ref={anchorRef} collapsable={false} onLayout={measure}>
        <Pressable onPress={() => { if (open) { setOpen(false); return; } measure(); setOpen(true); }} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: open ? colors.primary : colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, minHeight: 46, paddingHorizontal: 12 }}>
          <Text style={{ color: colors.ink, flex: 1, fontSize: 14, fontWeight: "700" }}>{value}</Text>
          <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
        </Pressable>
      </View>
      <AnchoredDropdown visible={open} anchor={anchorRect} onClose={() => setOpen(false)} maxHeight={300} minWidth={200}>
        <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {options.map((o) => (
            <Pressable key={o} onPress={() => { onSelect(o); setOpen(false); }} style={({ pressed }) => ({ backgroundColor: pressed || o === value ? colors.surfaceAlt : "transparent", paddingHorizontal: 12, paddingVertical: 10 })}>
              <Text style={{ color: o === value ? colors.primaryDark : colors.ink, fontSize: 13, fontWeight: o === value ? "800" : "600" }}>{o}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </AnchoredDropdown>
    </View>
  );
}

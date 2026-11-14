import { HorizontalScroll } from "@/components/horizontal-scroll";
import { displayListingTitle } from "@/lib/listing-title";
import { useCallback, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/lib/use-store";
import { moneyIn } from "@/lib/format";
import {
  MobileButton,
  MobileCard,
  MobileChip,
  mobile,
  ms,
  type MobileIcon,
} from "./ui";
type Event = {
  id: string;
  listingId?: string;
  partnershipId?: string;
  kind: string;
  title: string;
  amount?: number;
  currency?: string;
  createdAt: string;
};
const labels: Record<
  string,
  { label: string; icon: MobileIcon; color: string }
> = {
  application: {
    label: "Ortaklık talebi gönderildi",
    icon: "send",
    color: "#075BEB",
  },
  approved: {
    label: "Ortaklık onaylandı",
    icon: "check-circle",
    color: "#0645C9",
  },
  rejected: {
    label: "Ortaklık talebi reddedildi",
    icon: "close-circle",
    color: "#F14B69",
  },
  cancelled: {
    label: "Ortaklık sonlandırıldı",
    icon: "exit-to-app",
    color: "#778296",
  },
  completed: {
    label: "Ortaklık tamamlandı",
    icon: "check-decagram",
    color: "#0645C9",
  },
  blocked: {
    label: "Ortaklık kapatıldı",
    icon: "block-helper",
    color: "#A67A87",
  },
  paid: {
    label: "Komisyon ödendi olarak onaylandı",
    icon: "cash-check",
    color: mobile.teal,
  },
};
const filters = [
  { key: "all", label: "Tümü" },
  { key: "application", label: "Başvurular" },
  { key: "approved", label: "Onaylanan" },
  { key: "paid", label: "Ödemeler" },
  { key: "rejected", label: "Reddedilen" },
  { key: "cancelled", label: "Sonlandırılan" },
  { key: "completed", label: "Tamamlanan" },
  { key: "blocked", label: "Kapatılan" },
];
export function MobilePartnerActivity() {
  const store = useStore(),
    router = useRouter(),
    [filter, setFilter] = useState("all"),
    [rows, setRows] = useState<Event[]>([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const revision = useRef(0),
    pageLock = useRef(false);
  const load = useCallback(
    async (offset = 0) => {
      // Supabase yoksa (önizleme) "Geçmiş yükleniyor…" sonsuza dek kalıyordu.
      if (!supabase) {
        setLoading(false);
        return;
      }
      if (offset && pageLock.current) return;
      pageLock.current = true;
      const n = ++revision.current;
      setLoading(true);
      setError("");
      try {
        const { data, error } = await supabase.rpc("mobile_partner_activity", {
          event_kind: filter,
          page_offset: offset,
        });
        if (error || !data || !Array.isArray(data.events)) throw Error();
        if (n === revision.current) {
          setRows((old) =>
            offset
              ? [
                  ...new Map(
                    [...old, ...(data.events as Event[])].map((e) => [e.id, e]),
                  ).values(),
                ]
              : data.events,
          );
          setTotal(data.total);
        }
      } catch {
        if (n === revision.current)
          setError("Faaliyet geçmişi yüklenemedi. Tekrar dene.");
      } finally {
        if (n === revision.current) {
          setLoading(false);
          pageLock.current = false;
        }
      }
    },
    [filter],
  );
  useFocusEffect(
    useCallback(() => {
      setRows([]);
      void load();
      return () => {
        revision.current++;
        pageLock.current = false;
      };
    }, [load, retry, store.currentUser.id]),
  );
  return (
    <View style={{ gap: 12 }}>
      <MobileCard style={{ backgroundColor: mobile.tealSoft }}>
        <Text style={ms.muted}>
          Başvurularını, onayları ve komisyon güncellemelerini takip et. 23 Ekim
          2026'dan sonraki değişiklikler sunucuda olay olarak tutulur. Önceki
          kayıtlar yalnızca mevcut başvuru, onay ve ödeme tarihlerini içerir.
        </Text>
      </MobileCard>
      <HorizontalScroll
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 7 }}
      >
        {filters.map((f) => (
          <MobileChip
            key={f.key}
            label={f.label}
            selected={filter === f.key}
            onPress={() => setFilter(f.key)}
          />
        ))}
      </HorizontalScroll>
      {!!error && (
        <MobileCard>
          <Text accessibilityRole="alert" style={ms.error}>
            {error}
          </Text>
          <MobileButton
            secondary
            onPress={() =>
              rows.length ? void load(rows.length) : setRetry((v) => v + 1)
            }
          >
            Tekrar Dene
          </MobileButton>
        </MobileCard>
      )}
      {rows.map((event) => {
        const meta = labels[event.kind] || labels.application;
        return (
          <MobileCard key={event.id}>
            <View style={ms.row}>
              <View
                style={{
                  padding: 10,
                  borderRadius: 30,
                  backgroundColor: meta.color + "18",
                }}
              >
                <Icon name={meta.icon} size={25} color={meta.color} />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={[ms.label, { color: meta.color }]}>
                  {meta.label}
                </Text>
                <Text numberOfLines={3} style={ms.section}>
                  {displayListingTitle(event.title)}
                </Text>
                <Text style={ms.muted}>
                  {new Date(event.createdAt).toLocaleString("tr-TR")}
                </Text>
                {event.kind === "paid" && event.amount != null && (
                  <Text
                    style={{
                      color: meta.color,
                      fontWeight: "800",
                      fontSize: 19,
                    }}
                  >
                    {event.currency
                      ? moneyIn(event.amount, event.currency)
                      : `${event.amount} · Para birimi kaydı yok`}
                  </Text>
                )}
              </View>
            </View>
            {(event.partnershipId || event.listingId) && (
              <MobileButton
                secondary
                onPress={() =>
                  router.push(
                    (event.partnershipId
                      ? `/partnership/${event.partnershipId}`
                      : `/listing/${event.listingId}`) as never,
                  )
                }
              >
                {event.partnershipId ? "Ortaklık Detayı" : "İlanı Gör"}
              </MobileButton>
            )}
          </MobileCard>
        );
      })}
      {loading && <Text style={ms.muted}>Geçmiş yükleniyor…</Text>}
      {!loading && !error && !rows.length && (
        <Text style={ms.muted}>Bu grupta faaliyet kaydın yok.</Text>
      )}
      {rows.length < total && !loading && (
        <MobileButton secondary onPress={() => void load(rows.length)}>
          Diğer Faaliyetleri Göster
        </MobileButton>
      )}
      <MobileButton secondary onPress={() => setRetry((v) => v + 1)}>
        Geçmişi Yenile
      </MobileButton>
    </View>
  );
}

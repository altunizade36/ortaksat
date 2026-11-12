import { listingFlowPaths, listingJoinAction } from "@/lib/listing-actions";
import { listingInviteCode } from "@/lib/format";
import { useUnsavedForm } from "@/lib/use-unsaved-form";
import { displayListingTitle } from "@/lib/listing-title";
import { UserAvatar } from "@/components/user-avatar";
import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { useStore } from "@/lib/use-store";
import { fetchListingById } from "@/lib/supabase-data";
import { moneyIn } from "@/lib/format";
import { parseTrPrice } from "@/lib/validation";
import { showToast } from "@/lib/toast";
import type { Listing, User } from "@/lib/types";
import { MobileButton, MobileCard, MobileChip, MobileField, MobileScreen, SectionLabel, mobile, ms, useMobileLayout } from "@/components/mobile/ui";

const qualities = ["Sosyal medyada tanıtabilirim", "Çevreme önerebilirim", "Düzenli müşteri getirebilirim", "Şehir dışı alıcı bulabilirim"];
const readyMessages = ["Merhaba, bu ilana ortak olmak istiyorum. İlanı çevremle paylaşabilir, müşteri getirmek için elimden geleni yapabilirim. Uygun görürseniz talebimi onaylar mısınız?", "Merhaba, bu ürünü sosyal medya hesaplarımda tanıtarak alıcılara ulaştırmak istiyorum. Ortaklık koşullarınızı görüşebilir miyiz?", "Merhaba, bu ilanla ilgilenebilecek bir çevrem var. Birlikte çalışmak isterim."];
export default function PartnershipRequest() {
  const { id, invite, resume } = useLocalSearchParams<{ id: string; invite?: string; resume?: string }>();
  const router = useRouter();
  const { tablet } = useMobileLayout();
  const store = useStore();
  const [remote, setRemote] = useState<{ listing: Listing; owner?: User } | null>(null);
  const [loading, setLoading] = useState(!store.findListing(id));
  const [retry, setRetry] = useState(0);
  const submitLock = useRef(false);
  const initializedForm = useRef("");
  const [result, setResult] = useState<{ id: string; status: string } | null>(null);
  const [message, setMessage] = useState("");
  const [extra, setExtra] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [kind, setKind] = useState<"fixed" | "rate">("fixed");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [formReady, setFormReady] = useState(false);
  const [templates, setTemplates] = useState(false);
  const [sent, setSent] = useState(false);
  const l = store.findListing(id) ?? (remote?.listing.id === id ? remote.listing : undefined);
  const owner = l ? store.findUser(l.ownerId) ?? remote?.owner : undefined;
  const existing = l ? store.findPartnership(l.id) : undefined;
  const action = l ? listingJoinAction({ listing: l, status: existing?.status, isOwner: l.ownerId === store.currentUser.id, hasInvite: !!invite && invite === listingInviteCode(l), sellerBlocked: store.isUserBlocked(l.ownerId) }) : undefined;
  const flowPaths = listingFlowPaths(id, l && invite === listingInviteCode(l) ? invite : undefined);
  const dirty = !!(message || extra || selected.length || l && amount && (amount !== String(l.commissionValue).replace(".", ",") || kind !== l.commissionType));
  const allowLeave = useUnsavedForm(formReady && !sent && action?.kind === "apply" && dirty, busy);
  const draftKey = `ortaksat_mobile_application:${store.isAuthenticated ? store.currentUser.id : "guest"}:${id}`;
  useEffect(() => { if (l) return; let active = true; setLoading(true); setError(""); fetchListingById(id).then((v) => { if (active) { if (v && "listing" in v) setRemote(v); else if (v && "error" in v) setError("İlan yüklenemedi. Tekrar dene."); } }).catch(() => { if (active) setError("İlan yüklenemedi."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [id, l, retry]);
  async function submit() {
    if (!l || !formReady || busy || submitLock.current) return;
    if (action?.kind !== "apply") { setError(action?.reason || "Bu talep zaten oluşturulmuş."); return; }
    const value = kind === "rate" ? Number(amount.replace(",",".")) : parseTrPrice(amount);
    if (!Number.isFinite(value) || value <= 0 || kind === "rate" && value > 90) { setError("Geçerli bir komisyon teklifi gir. Yüzde teklif 90 değerini aşamaz."); return; }
    if (message.trim().length < 10) { setError("Kendini tanıtan en az 10 karakterlik bir mesaj yaz."); return; }
    if (!store.isAuthenticated) {
      submitLock.current = true;
      try {
        await AsyncStorage.setItem(`ortaksat_mobile_application:guest:${id}`, JSON.stringify({ message, extra, selected, kind, amount }));
        router.push({ pathname: "/auth", params: { redirect: `/partnership-request/${id}?resume=1${invite ? `&invite=${encodeURIComponent(invite)}` : ""}` } } as never);
      } catch { setError("Taslağın saklanamadı. Metnin bu ekranda duruyor; tekrar dene."); }
      finally { submitLock.current = false; }
      return;
    }
    if (l.demo || l.ownerId === store.currentUser.id || l.partnershipMode === "none" || l.status !== "active") { setError("Bu ilana ortaklık talebi gönderilemiyor."); return; }
    submitLock.current = true; setBusy(true); setError("");
    try {
      const proposal = kind === "rate" ? `%${value}` : moneyIn(value, l.currency);
      const note = `${message.trim()}\nKomisyon teklifim: ${proposal}${selected.length ? `\nTanıtım: ${selected.join(", ")}` : ""}${extra.trim() ? `\nEk bilgi: ${extra.trim()}` : ""}`;
      const result = await store.joinListing(l.id, { note, shareChannel: selected.includes(qualities[0]) ? "Sosyal medya" : "Çevrem", audience: selected.join(", "), inviteCode: invite || "" }, l);
      if (result) { setResult({ id: result.id, status: result.status }); allowLeave(); setSent(true); void Promise.all([AsyncStorage.removeItem(draftKey), AsyncStorage.removeItem(`ortaksat_mobile_application:guest:${id}`)]).catch(() => {}); }
      else setError(store.authError || "Talep gönderilemedi. İlanın durumunu ve ortaklık koşullarını kontrol et.");
    } catch { setError("Talep gönderilemedi. Bağlantını kontrol edip tekrar dene."); } finally { submitLock.current = false; setBusy(false); }
  }
  const listingReady = !!l;
  const defaultKind = l?.commissionType ?? "fixed";
  // TR ondalık: parseTrPrice "." işaretini BİNLİK sayar → "1500.5" varsayılanı 15005 olarak okunurdu
  // (commission-override-modal ile aynı dönüşüm). Ondalık virgülle yazılır.
  const defaultAmount = String(l?.commissionValue ?? "").replace(".", ",");
  // Initialize defaults and restored proposal together; a late listing must not overwrite the draft.
  useEffect(() => {
    if (!listingReady) { setFormReady(false); return; }
    const identity = `${draftKey}:${resume || ""}`;
    if (initializedForm.current === identity) return;
    let active = true;
    setFormReady(false);
    const restoreKey = store.isAuthenticated && resume !== "1" ? draftKey : `ortaksat_mobile_application:guest:${id}`;
    void AsyncStorage.getItem(restoreKey).then((raw) => {
      if (!active) return;
      let draft: Record<string, unknown> = {};
      try { const parsed = raw ? JSON.parse(raw) : null; if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) draft = parsed; } catch { /* Invalid old draft: use listing defaults. */ }
      setMessage(typeof draft.message === "string" ? draft.message.slice(0, 500) : "");
      setExtra(typeof draft.extra === "string" ? draft.extra.slice(0, 300) : "");
      setSelected(Array.isArray(draft.selected) ? qualities.filter(q => (draft.selected as unknown[]).includes(q)) : []);
      setKind(draft.kind === "rate" || draft.kind === "fixed" ? draft.kind : defaultKind);
      setAmount(typeof draft.amount === "string" && draft.amount ? draft.amount : defaultAmount);
    }).catch(() => {
      if (active) { setKind(defaultKind); setAmount(defaultAmount); setError("Kaydedilmiş taslak açılamadı. Formu yeniden doldurabilirsin."); }
    }).finally(() => { if (active) { initializedForm.current = identity; setFormReady(true); } });
    return () => { active = false; };
  }, [id, draftKey, store.isAuthenticated, resume, listingReady, defaultKind, defaultAmount]);
  if (sent) return <MobileScreen title="Ortaklık Talebin"><MobileCard><Icon name="check-circle" size={50} color={mobile.teal} /><Text style={[ms.section, { fontSize: 22 }]}>{result?.status === "active" ? "Ortaklığın aktif" : "Başvurun alındı"}</Text><Text style={ms.muted}>Ortaklık durumunu Ortak Satış bölümünden takip edebilirsin. Satıcıyla mesajlaşarak teklif koşullarını netleştirebilirsin.</Text><MobileButton onPress={() => router.replace(result ? `/partnership/${result.id}` as never : "/partner")}>Başvurunun Detayını Gör</MobileButton></MobileCard></MobileScreen>;
  if (l && action?.kind === "view" && existing) return <MobileScreen title="Ortaklık Talebi"><MobileCard><Text style={ms.section}>{existing.status === "active" ? "Bu ilanda zaten ortaksın" : "Başvurun incelemede"}</Text><Text style={ms.muted}>Mevcut kaydının durumunu detay ekranından takip edebilirsin.</Text><MobileButton onPress={() => router.replace(`/partnership/${existing.id}` as never)}>Detayı Gör</MobileButton></MobileCard></MobileScreen>;
  if (l && action?.kind === "disabled") return <MobileScreen title="Ortaklık Talebi"><MobileCard><Text style={ms.section}>{action.label}</Text><Text accessibilityRole="alert" style={ms.muted}>{action.reason}</Text><MobileButton secondary onPress={() => router.replace(`/listing/${l.id}` as never)}>İlana Dön</MobileButton></MobileCard></MobileScreen>;
  return <MobileScreen title="Ortaklık Talebi">
    {!l ? <MobileCard><Text style={ms.section}>{loading ? "İlan yükleniyor…" : error ? "İlan yüklenemedi" : "İlan bulunamadı"}</Text>{!!error && <><Text accessibilityRole="alert" style={ms.error}>{error}</Text><MobileButton secondary onPress={() => setRetry(n => n + 1)}>İlanı yeniden yükle</MobileButton></>}</MobileCard> : !formReady ? <MobileCard><Text style={ms.muted}>Başvuru formu hazırlanıyor…</Text></MobileCard> : <>
      <MobileCard style={{ flexDirection: "row", alignItems: "center" }}><SafeRemoteImage uri={l.image} style={{ width: tablet ? 140 : 100, height: tablet ? 110 : 82, borderRadius: 9 }} /><View style={{ flex: 1, minWidth: 0, gap: 6 }}><Text numberOfLines={3} style={[ms.section, { fontSize: 16 }]}>{displayListingTitle(l.title)}</Text><Text style={{ color: mobile.teal, fontSize: 22, fontWeight: "800" }}>{moneyIn(l.price, l.currency)}</Text><Text style={ms.muted}>⌖ {l.location}</Text></View></MobileCard>
      <MobileCard style={{ flexDirection: "row", alignItems: "center" }}><UserAvatar uri={owner?.avatar} style={{ width: 45, height: 45, borderRadius: 23 }} /><View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={2} style={ms.section}>{owner?.name || "Satıcı"}</Text><Text style={ms.muted}>{owner?.listingCount || 0} aktif ilan</Text></View><MobileButton secondary icon="chat" onPress={() => { if (!store.isAuthenticated) { router.push({ pathname: "/auth", params: { redirect: flowPaths.request } } as never); return; } const c = store.startConversation(l.id, l.ownerId, "", l); if (c) router.push(`/chat/${c.id}` as never); else showToast("Mesaj başlatılamadı. İlanın veya hesabın durumunu kontrol et."); }}>Mesaj Gönder</MobileButton></MobileCard>
      <MobileCard style={{ backgroundColor: mobile.tealSoft, borderColor: mobile.line, flexDirection: "row", alignItems: "center" }}><View style={{ width: 45, height: 45, borderRadius: 23, backgroundColor: mobile.teal, alignItems: "center", justifyContent: "center" }}><Icon name="handshake" size={29} color="white" /></View><View style={{ flex: 1, minWidth: 0 }}><Text style={{ fontWeight: "700", color: mobile.ink, fontSize: 13 }}>Bu ilana ortak olarak komisyon kazanabilirsin!</Text><Text style={[ms.muted, { fontSize: 12 }]}>Teklifin başvuru mesajına eklenir. Geçerli komisyonu satıcıyla anlaşarak netleştirirsin.</Text></View></MobileCard>
      <MobileCard><SectionLabel icon="numeric-1-circle">Komisyon Teklifin</SectionLabel><Text style={ms.muted}>Satıcının belirlediği komisyon: {l.commissionType === "rate" ? `%${l.commissionValue}` : moneyIn(l.commissionValue, l.currency)}</Text><View style={ms.wrap}><MobileChip label={`${l.currency === "EUR" ? "EUR" : l.currency === "USD" ? "USD" : "TL"} Tutarı ile Teklif Et`} selected={kind === "fixed"} onPress={() => { setKind("fixed"); setAmount(""); }} /><MobileChip label="%  Yüzde ile Teklif Et" selected={kind === "rate"} onPress={() => { setKind("rate"); setAmount(""); }} /></View><MobileField required label={kind === "rate" ? "Teklif Ettiğin Komisyon Oranı (%)" : "Teklif Ettiğin Komisyon Tutarı"} value={amount} onChange={setAmount} numeric /></MobileCard>
      <MobileCard><View style={[ms.row, { justifyContent: "space-between" }]}><SectionLabel icon="numeric-2-circle">Mesajın</SectionLabel><Pressable accessibilityRole="button" onPress={() => setTemplates((v) => !v)}><Text style={{ color: mobile.teal, fontSize: 12 }}>☷ Hazır Mesajlar</Text></Pressable></View>{templates && readyMessages.map((text) => <Pressable key={text} accessibilityRole="button" onPress={() => { setMessage(text); setTemplates(false); }} style={{ padding: 10, borderRadius: 9, backgroundColor: mobile.tealSoft }}><Text style={ms.muted}>{text}</Text></Pressable>)}<MobileField value={message} onChange={setMessage} placeholder="Kendini ve ürünü nasıl tanıtacağını anlat..." multiline maxLength={500} /></MobileCard>
      <MobileCard><SectionLabel icon="numeric-3-circle">Ek Bilgiler (Opsiyonel)</SectionLabel><View style={ms.wrap}>{qualities.map((q) => <MobileChip key={q} label={q} selected={selected.includes(q)} icon={selected.includes(q) ? "check-circle" : undefined} onPress={() => setSelected((prev) => prev.includes(q) ? prev.filter((v) => v !== q) : [...prev, q])} />)}</View><MobileField value={extra} onChange={setExtra} placeholder="Eklemek istediğin bir bilgi var mı?" multiline maxLength={300} /></MobileCard>
      {error && <Text accessibilityRole="alert" style={ms.error}>{error}</Text>}
      <MobileButton onPress={() => void submit()} disabled={busy || l.demo || l.partnershipMode === "none"} icon="send">{busy ? "Gönderiliyor…" : "Ortaklık Talebini Gönder"}</MobileButton>
    </>}
  </MobileScreen>;
}

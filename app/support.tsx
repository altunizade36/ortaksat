import {useUnsavedForm} from "@/lib/use-unsaved-form";
import { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { AuthRequired } from "@/components/auth-gate";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import { MobileBottomNav, MobileButton, MobileCard, MobileChip, MobileField, MobileScreen, MobileSelect, mobile, ms } from "@/components/mobile/ui";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/lib/use-store";
import { showToast } from "@/lib/toast";
import { makeUuid } from "@/lib/live-service";
import { uploadEvidence, type EvidencePhoto } from "@/lib/mobile-evidence";
import { EvidenceGallery, EvidencePicker } from "@/components/mobile/evidence";
import { SupportThread, type SupportReplyDraft } from "@/components/mobile/support-thread";

type Ticket = { id: string; subject: string; message: string; status: string; created_at: string; updated_at: string; attachments?:string[]; category?:string; answered?:boolean };
const groups = [{ key: "all", label: "Tümü" }, { key: "open", label: "Açık" }, { key: "answered", label: "Yanıtlandı" }, { key: "reviewing", label: "İnceleniyor" }, { key: "completed", label: "Tamamlandı" }, { key: "rejected", label: "Reddedildi" }];
const categories = ["Hesap ve Giriş Sorunları", "İlan Verme ve Düzenleme", "Ortaklık Sistemi", "Mesajlaşma", "Ödeme, Kargo ve Teslimat", "Güvenlik ve Şikayet", "Teknik Hata", "Diğer"];
export default function SupportScreen() {
  const store = useStore();
  if (!store.authReady) return <ScreenSkeleton />;
  if (!store.isAuthenticated) return <AuthRequired title="Destek taleplerin için giriş yap" />;
  return <SupportTickets key={store.currentUser.id} />;
}
function SupportTickets() {
  const store = useStore();
  const [tickets, setTickets] = useState<Ticket[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [group, setGroup] = useState("all"), [counts, setCounts] = useState<Record<string, number>>({});
  const [form, setForm] = useState(false), [expanded, setExpanded] = useState<string | null>(null), [hasMore, setHasMore] = useState(false);
  const [category, setCategory] = useState(""), [subject, setSubject] = useState(""), [message, setMessage] = useState(""), [sending, setSending] = useState(false);
  const generation = useRef(0), locked = useRef(false), pageBusy = useRef(false);
  const [photos,setPhotos]=useState<EvidencePhoto[]>([]);
  const ticketId=useRef(makeUuid()), uploaded=useRef(new Map<string,string>());
  const drafts=useRef(new Map<string,SupportReplyDraft>());
  const [,redrawDrafts]=useState(0);
  function replyDraft(id:string){let draft=drafts.current.get(id);if(!draft){draft={body:"",photos:[],requestId:makeUuid(),uploaded:new Map()};drafts.current.set(id,draft);}return draft;}
  useUnsavedForm((form&&(!!category||!!subject||!!message||photos.length>0))||[...drafts.current.values()].some(d=>!!d.body||d.photos.length>0),sending);
  const load = useCallback(async () => {
    const revision = ++generation.current;
    setLoading(true); setError(""); setTickets([]); setHasMore(false);
    if (!supabase) { setError("Destek talepleri için sunucu bağlantısı gerekli."); setLoading(false); return; }
    try {
      let query = supabase.from("support_tickets").select("id,subject,message,status,created_at,updated_at,category,attachments,answered").eq("user_id", store.currentUser.id).order("created_at", { ascending: false }).order("id", { ascending: false }).range(0, 49);
      if (group === "answered") query=query.eq("answered",true); else if (group !== "all") query = query.eq("status", group);
      const [result, totals] = await Promise.all([query, Promise.all(groups.map(async g => {
        let countQuery = supabase!.from("support_tickets").select("id", { count: "exact", head: true }).eq("user_id", store.currentUser.id);
        if (g.key === "answered") countQuery=countQuery.eq("answered",true); else if (g.key !== "all") countQuery = countQuery.eq("status", g.key);
        const result = await countQuery;
        if (result.error) throw result.error;
        return [g.key, result.count || 0] as const;
      }))]);
      if (revision !== generation.current) return;
      if (result.error) throw result.error;
      const rows = (result.data || []) as Ticket[];
      setTickets(rows); setCounts(Object.fromEntries(totals)); setHasMore(rows.length < (Object.fromEntries(totals)[group] || 0));
    } catch { if (revision === generation.current) setError("Destek talepleri yüklenemedi. Tekrar dene."); }
    finally { if (revision === generation.current) setLoading(false); }
  }, [store.currentUser.id, group]);
  useFocusEffect(useCallback(() => { void load(); return () => { generation.current++; }; }, [load]));
  async function more() {
    if (pageBusy.current || !supabase) return;
    pageBusy.current = true; const revision = generation.current;
    try {
      let query = supabase.from("support_tickets").select("id,subject,message,status,created_at,updated_at,category,attachments,answered").eq("user_id", store.currentUser.id).order("created_at", { ascending: false }).order("id", { ascending: false }).range(tickets.length, tickets.length + 49);
      if (group === "answered") query=query.eq("answered",true); else if (group !== "all") query = query.eq("status", group);
      const { data, error } = await query;
      if (revision !== generation.current) return;
      if (error) throw error;
      setTickets(old => [...new Map([...old, ...(data || []) as Ticket[]].map(t => [t.id, t])).values()]);
      setHasMore(tickets.length + (data?.length || 0) < (counts[group] || 0));
    } catch { showToast("Diğer talepler yüklenemedi. Tekrar dene."); } finally { pageBusy.current = false; }
  }
  async function send() {
    if (locked.current) return;
    if (!category || subject.trim().length < 3 || message.trim().length < 20) { setError("Kategori seç; konuya en az 3, açıklamaya en az 20 karakter yaz."); return; }
    locked.current = true; setSending(true); setError("");
    try {
      const paths:string[]=[];
      for(const photo of photos){let path=uploaded.current.get(photo.uri);if(!path){path=await uploadEvidence(photo,store.currentUser.id);uploaded.current.set(photo.uri,path);}paths.push(path);}
      const ok = await store.createSupportTicket(subject.trim(), message.trim(), {id:ticketId.current, category, attachments:paths});
      if (!ok) throw new Error("Support insert failed");
      setForm(false); setSubject(""); setMessage(""); setCategory(""); setPhotos([]); uploaded.current.clear(); ticketId.current=makeUuid(); showToast("Destek talebin gönderildi."); await load();
    } catch { setError("Talep gönderilemedi. Yazdıkların korunuyor; tekrar dene."); } finally { locked.current = false; setSending(false); }
  }
  return <MobileScreen title={form ? "Destek Talebi Oluştur" : "Destek Taleplerim"} onBack={form ? () => { if (!sending) { setForm(false); setError(""); } } : undefined} right={!form ? <MobileChip label="Yeni Talep" icon="plus" onPress={() => { setForm(true); setError(""); }} /> : undefined} bottom={<MobileBottomNav active="profile" />}>
    {form ? <><MobileCard style={{ backgroundColor: "#EFF2FC" }}><Text style={ms.section}>Sorununu bize ilet</Text><Text style={ms.muted}>Yaşadığın sorunu açık ve detaylı yaz. Ödeme ve teslimat alıcı ile satıcı arasında gerçekleşir.</Text></MobileCard><View style={{ gap: 18, marginTop: 8 }}><MobileSelect label="Talep Kategorisi *" value={category} options={categories} onChange={setCategory} /><MobileField label="Konu Başlığı" required value={subject} onChange={setSubject} maxLength={100} /><MobileField label="Açıklama" required value={message} onChange={setMessage} multiline maxLength={1000} /><EvidencePicker photos={photos} onChange={setPhotos} disabled={sending}/>{error ? <Text accessibilityRole="alert" style={ms.error}>{error}</Text> : null}<MobileButton icon="send" disabled={sending} onPress={() => void send()}>{sending ? "Gönderiliyor…" : "Talebi Gönder"}</MobileButton></View></> : <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingVertical: 12 }}>{groups.map(g => <MobileChip key={g.key} label={`${g.label} (${loading ? "…" : counts[g.key] ?? "…"})`} selected={group === g.key} onPress={() => setGroup(g.key)} />)}</ScrollView>
      {error ? <MobileCard><Text accessibilityRole="alert" style={ms.error}>{error}</Text><MobileButton secondary onPress={() => void load()}>Tekrar Dene</MobileButton></MobileCard> : null}
      {loading && <Text style={ms.muted}>Taleplerin yükleniyor…</Text>}
      {!loading && !error && !tickets.length && <MobileCard><Text style={ms.section}>Bu durumda destek talebin yok</Text><Text style={ms.muted}>Yeni Talep düğmesiyle yaşadığın sorunu bize iletebilirsin.</Text></MobileCard>}
      {tickets.map(ticket => <MobileCard key={ticket.id}><Pressable accessibilityRole="button" accessibilityLabel={ticket.subject} accessibilityState={{ expanded: expanded === ticket.id }} onPress={() => setExpanded(expanded === ticket.id ? null : ticket.id)}><View style={ms.row}><Text style={[ms.section, { flex: 1 }]}>{ticket.subject}</Text><Text style={{ color: ticket.status === "completed" ? "#078C5C" : mobile.teal, fontSize: 11 }}>{ticket.answered&&["open","reviewing"].includes(ticket.status)?"Yanıtlandı":groups.find(g => g.key === ticket.status)?.label || ticket.status}</Text></View><Text style={[ms.muted, { marginTop: 7 }]}>{new Date(ticket.created_at).toLocaleString("tr-TR")}</Text><Text style={{ color: mobile.muted, fontSize: 10, marginTop: 4 }}>Talep No: {ticket.id}</Text></Pressable>{expanded === ticket.id && <View style={{ gap: 10, paddingTop: 10, borderTopWidth: 1, borderColor: mobile.line }}><Text style={{ color: mobile.ink, lineHeight: 21, fontSize: 13 }}>{ticket.message}</Text><EvidenceGallery paths={ticket.attachments||[]}/><Text style={ms.muted}>Son güncelleme: {new Date(ticket.updated_at).toLocaleString("tr-TR")}</Text><SupportThread draft={replyDraft(ticket.id)} onDraftChange={()=>redrawDrafts(v=>v+1)} ticketId={ticket.id} closed={["completed","rejected"].includes(ticket.status)} onSent={()=>void load()}/></View>}</MobileCard>)}
      {hasMore && <MobileButton secondary onPress={() => void more()}>Diğer Talepleri Göster</MobileButton>}
    </>}
  </MobileScreen>;
}

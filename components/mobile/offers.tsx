import { HorizontalScroll } from "@/components/horizontal-scroll";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { UserAvatar } from "@/components/user-avatar";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { AuthRequired } from "@/components/auth-gate";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import { useStore } from "@/lib/use-store";
import { supabase } from "@/lib/supabase";
import { fetchListingsByIds, fetchPublicProfiles } from "@/lib/supabase-data";
import { mapOffer, offerSellerRespondLive, offerBuyerActionLive } from "@/lib/live-service";
import { moneyIn } from "@/lib/format";
import { parseTrPrice } from "@/lib/validation";
import { Alert } from "@/lib/alert";
import type { Listing, Offer, User } from "@/lib/types";
import { MobileBottomNav, MobileButton, MobileCard, MobileChip, MobileField, MobileScreen, mobile, ms } from "./ui";

const labels: Record<Offer["status"],string> = { pending:"Yanıt Bekliyor", countered:"Karşı Teklif", accepted:"Kabul Edildi", rejected:"Reddedildi", withdrawn:"Geri Çekildi" };
export function MobileOffers() {
  const store=useStore();
  if(!store.authReady||store.isAuthenticated&&!store.accountLoaded)return <ScreenSkeleton/>;
  if(!store.isAuthenticated)return <AuthRequired title="Tekliflerin için giriş yap"/>;
  return <Offers key={store.currentUser.id}/>;
}
function Offers() {
  const store=useStore(),router=useRouter(),account=store.currentUser.id;
  const [tab,setTab]=useState("Gelen Teklifler"),[status,setStatus]=useState<Offer["status"]|"all">("all"),[rows,setRows]=useState<Offer[]>([]),[total,setTotal]=useState(0),[extra,setExtra]=useState<Listing[]>([]),[people,setPeople]=useState<User[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[busy,setBusy]=useState(false),[counterId,setCounterId]=useState<string|null>(null),[counter,setCounter]=useState(""),[retry,setRetry]=useState(0);
  const revision=useRef(0),lock=useRef(false),moreLock=useRef(false),incoming=tab==="Gelen Teklifler";
  const load=useCallback(async(offset=0)=>{
    const n=revision.current;setLoading(true);
    try{let query=supabase!.from("offers").select("*",{count:"exact"}).eq(incoming?"seller_id":"buyer_id",account);if(status!=="all")query=query.eq("status",status);const{data,count,error}=await query.order("created_at",{ascending:false}).order("id").range(offset,offset+23);if(error)throw error;if(n!==revision.current)return;const next=(data||[]).map(mapOffer);setRows(old=>offset?[...new Map([...old,...next].map(o=>[o.id,o])).values()]:next);setTotal(count||0);setError("");
      try{const profiles=await fetchPublicProfiles(next.map(o=>incoming?o.buyerId:o.sellerId));if(n===revision.current)setPeople(old=>[...new Map([...(offset?old:[]),...profiles].map(p=>[p.id,p])).values()]);}catch{if(n===revision.current)setError("Teklifler yüklendi; bazı profil bilgileri yüklenemedi.");}
    }catch{if(n===revision.current)setError("Teklifler yüklenemedi. Mevcut kayıtlar korunuyor; tekrar dene.");}finally{if(n===revision.current)setLoading(false);}
  },[account,incoming,status]);
  useFocusEffect(useCallback(()=>{revision.current++;setRows([]);setCounterId(null);setError("");void load();return()=>{revision.current++;};},[load,retry]));
  const missing=[...new Set(rows.map(o=>o.listingId))].filter(id=>!store.listings.some(l=>l.id===id)).sort().join(",");
  useEffect(()=>{let alive=true;if(missing)void fetchListingsByIds(missing.split(",")).then(result=>{if(alive&&result)setExtra(result.listings);});return()=>{alive=false;};},[missing]);
  const listings=new Map([...extra,...store.listings].map(l=>[l.id,l])),users=new Map([...people,...store.users].map(u=>[u.id,u]));
  async function act(o:Offer,action:"accepted"|"rejected"|"countered"|"withdrawn"|"accept_counter"|"reject_counter"){
    if(lock.current)return;
    if(action==="countered"&&(!/^[\d.,\s]+$/.test(counter)||parseTrPrice(counter)<=0)){setError("Pozitif ve geçerli bir karşı teklif tutarı gir.");return;}
    lock.current=true;setBusy(true);setError("");
    try{const ok=incoming?await offerSellerRespondLive(o.id,action as "accepted"|"rejected"|"countered",action==="countered"?parseTrPrice(counter):undefined):await offerBuyerActionLive(o.id,action as "withdrawn"|"accept_counter"|"reject_counter");if(!ok)throw Error();setCounterId(null);setCounter("");await load();void store.refreshUserData();}catch{setError("Teklif işlemi kaydedilemedi. Güncel durumu yenileyerek tekrar dene.");}finally{lock.current=false;setBusy(false);}
  }
  async function more(){if(moreLock.current)return;moreLock.current=true;try{await load(rows.length);}finally{moreLock.current=false;}}
  return <MobileScreen title="Pazarlık Teklifleri" bottom={<MobileBottomNav/>}>
    <Text style={[ms.muted,{marginVertical:12}]}>İlanlarına gelen teklifleri ve gönderdiğin teklifleri yönet. Teklifin kabul edilmesi satış veya ödeme kaydı oluşturmaz.</Text>
    <View style={[ms.row,{marginBottom:13}]}>{["Gelen Teklifler","Gönderdiğim"].map(label=><MobileChip key={label} label={label} selected={tab===label} onPress={()=>{if(!busy){setTab(label);setStatus("all");}}}/>)}</View>
    <HorizontalScroll  contentContainerStyle={{gap:7,marginBottom:14}}>{(["all","pending","countered","accepted","rejected","withdrawn"]as const).map(value=><MobileChip key={value} label={value==="all"?"Tümü":labels[value]} selected={status===value} onPress={()=>{if(!busy)setStatus(value);}}/>)}</HorizontalScroll>
    <Text accessibilityLiveRegion="polite" style={[ms.muted,{marginBottom:10}]}>{loading?"Yükleniyor…":`${total} teklif`}</Text>
    {error&&<MobileCard><Text accessibilityRole="alert" style={ms.error}>{error}</Text><MobileButton secondary disabled={busy} onPress={()=>setRetry(v=>v+1)}>Teklifleri Yenile</MobileButton></MobileCard>}
    {rows.map(o=>{const l=listings.get(o.listingId),person=users.get(incoming?o.buyerId:o.sellerId),value=o.status==="countered"?o.counterAmount??o.amount:o.amount,price=(n:number)=>l?moneyIn(n,l.currency):n.toLocaleString("tr-TR");return <MobileCard key={o.id}>
      <View style={ms.row}><UserAvatar uri={person?.avatar} size={42}/><View style={{flex:1,gap:4}}><Text style={ms.section}>{person?.name||(incoming?"Alıcı Profili":"Satıcı Profili")}</Text><Text style={ms.muted}>{new Date(o.createdAt).toLocaleString("tr-TR")}</Text></View><Text style={{color:mobile.teal,fontSize:11}}>{labels[o.status]}</Text></View>
      <View style={ms.row}><SafeRemoteImage uri={l?.imageUrl||l?.image} style={{width:64,height:60,borderRadius:9}}/><View style={{flex:1,gap:5}}><Text style={ms.section}>{l?.title||"İlan Bilgisi Kullanılamıyor"}</Text><Text style={{fontSize:22,fontWeight:"800",color:mobile.teal}}>{price(value)}</Text>{o.status==="countered"&&<Text style={ms.muted}>İlk teklif: {price(o.amount)}</Text>}{!l&&<Text style={ms.muted}>Para birimi ve ilan bilgilerini detaydan kontrol et.</Text>}</View></View>
      {o.note&&<Text style={ms.muted}>{o.note}</Text>}
      {incoming&&o.status==="pending"&&<><View style={ms.row}><MobileButton secondary disabled={busy} style={{flex:1}} onPress={()=>void act(o,"rejected")}>Reddet</MobileButton><MobileButton disabled={busy} style={{flex:1}} onPress={()=>Alert.alert("Teklifi Kabul Et","Alıcının teklifini kabul etmek istiyor musun?",[{text:"Vazgeç",style:"cancel"},{text:"Kabul Et",onPress:()=>void act(o,"accepted")}])}>Kabul Et</MobileButton></View><MobileButton secondary disabled={busy} onPress={()=>{setCounterId(o.id);setCounter("");}}>Karşı Teklif Ver</MobileButton></>}
      {counterId===o.id&&o.status==="pending"&&<View style={{gap:10}}><MobileField label="Karşı Teklif Tutarı" numeric value={counter} onChange={setCounter}/><MobileButton disabled={busy} onPress={()=>void act(o,"countered")}>Karşı Teklifi Gönder</MobileButton><MobileButton secondary disabled={busy} onPress={()=>setCounterId(null)}>Vazgeç</MobileButton></View>}
      {!incoming&&o.status==="countered"&&<View style={ms.row}><MobileButton secondary disabled={busy} style={{flex:1}} onPress={()=>void act(o,"reject_counter")}>Karşı Teklifi Reddet</MobileButton><MobileButton disabled={busy} style={{flex:1}} onPress={()=>Alert.alert("Karşı Teklifi Kabul Et",`${price(value)} tutarındaki karşı teklif kabul edilsin mi?`,[{text:"Vazgeç",style:"cancel"},{text:"Kabul Et",onPress:()=>void act(o,"accept_counter")}])}>Kabul Et</MobileButton></View>}
      {!incoming&&["pending","countered"].includes(o.status)&&<MobileButton secondary disabled={busy} onPress={()=>Alert.alert("Teklifi Geri Çek","Gönderdiğin teklif geri çekilsin mi?",[{text:"Vazgeç",style:"cancel"},{text:"Geri Çek",onPress:()=>void act(o,"withdrawn")}])}>Teklifi Geri Çek</MobileButton>}
      <MobileButton secondary onPress={()=>router.push(`/listing/${o.listingId}`as never)}>İlanı Gör</MobileButton>
    </MobileCard>;})}
    {!loading&&!error&&!rows.length&&<MobileCard><Text style={ms.muted}>Bu görünümde teklif bulunmuyor.</Text></MobileCard>}{rows.length<total&&!loading&&<MobileButton secondary disabled={busy} onPress={()=>void more()}>Diğer Teklifleri Göster</MobileButton>}
  </MobileScreen>;
}

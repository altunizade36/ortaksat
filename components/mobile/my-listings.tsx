import { HorizontalScroll } from "@/components/horizontal-scroll";
import { displayListingTitle } from "@/lib/listing-title";
import { useCallback, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { Alert } from "@/lib/alert";
import { useStore } from "@/lib/use-store";
import { useForegroundRefresh } from "@/lib/use-foreground-refresh";
import { listingDraftKey, localDraftSummary } from "@/lib/mobile-drafts";
import { listingPhotos, listingStatusLabels, maximumPartners } from "@/lib/mobile-listing";
import { moneyIn, groupThousands } from "@/lib/format";
import { searchKey } from "@/lib/locale";
import { showToast } from "@/lib/toast";
import type { Listing } from "@/lib/types";
import { MobileButton, MobileCard, MobileChip, MobileField, MobileScreen, IconButton, mobile, ms } from "./ui";

const tabs = ["Tümü", "Yayında", "Taslak", "Süresi doldu", "Yayından kaldırıldı", "İncelemede", "Reddedildi", "Satıldı", "Arşivlendi"];
export function MobileMyListings() {
  const store = useStore(), router = useRouter();
  const [tab,setTab] = useState("Tümü"), [query,setQuery] = useState(""), [search,setSearch] = useState(false);
  const [limit,setLimit] = useState(20), [busy,setBusy] = useState<string | null>(null);
  const [draft,setDraft] = useState<Awaited<ReturnType<typeof localDraftSummary>>>(null);
  const [draftError,setDraftError] = useState(false);
  const readDraft = useCallback(() => { let alive = true; localDraftSummary(store.currentUser.id).then(d => {if(alive){setDraft(d);setDraftError(false);}}).catch(()=>{if(alive)setDraftError(true);}); return () => {alive=false;}; },[store.currentUser.id]);
  useFocusEffect(readDraft);
  useForegroundRefresh(store.refreshUserData);
  const mine = store.listings.filter(l=>l.ownerId===store.currentUser.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const matches = (l:Listing) => !query || searchKey(`${displayListingTitle(l.title)} ${l.category} ${l.location}`).includes(searchKey(query));
  const visible = mine.filter(l => matches(l) && (tab==="Tümü" || listingStatusLabels[l.status]===tab));
  const showDraft = !!draft && (tab==="Tümü" || tab==="Taslak") && (!query || searchKey(`${draft.title} ${draft.category}`).includes(searchKey(query)));
  const count = (label:string) => mine.filter(l=>matches(l)&&(label==="Tümü"||listingStatusLabels[l.status]===label)).length + (draft&&(label==="Tümü"||label==="Taslak")&&(!query||searchKey(draft.title).includes(searchKey(query)))?1:0);
  async function status(l:Listing,next:Listing["status"]) {
    if(busy)return; setBusy(l.id);
    try { const ok=await store.updateListingStatus(l.id,next); showToast(ok?next==="paused"?"İlan yayından kaldırıldı.":"İlan durumu güncellendi.":"İlan durumu kaydedilemedi. Tekrar dene."); }
    finally {setBusy(null);}
  }
  function remove(l:Listing) { Alert.alert("İlanı sil", "İlan kaldırılacak. İşlem geçmişi varsa kayıt ve ortaklık geçmişi arşivde korunur.", [{text:"Vazgeç",style:"cancel"},{text:"Sil",style:"destructive",onPress:()=>{if(busy)return;setBusy(l.id);void store.removeListing(l.id).then(ok=>showToast(ok?"İlan kaldırıldı.":"İlan kaldırılamadı. Tekrar dene.")).finally(()=>setBusy(null));}}]); }
  const goEdit = (l:Listing, section?:string) => router.push({pathname:"/listing-edit/[id]",params:{id:l.id,...(section?{section}:{} )}} as never);
  return <MobileScreen title="İlanlarım" right={<View style={ms.row}><IconButton name="magnify" label="İlanlarımda ara" onPress={()=>setSearch(v=>!v)}/><MobileChip label="İlan Ver" icon="plus" selected onPress={()=>router.push("/create")}/></View>}>
    {search&&<MobileField placeholder="İlanlarında ara" value={query} onChange={v=>{setQuery(v);setLimit(20);}}/>}
    <HorizontalScroll  showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:7,paddingVertical:12}}>{tabs.map(label=><MobileChip key={label} label={`${label} (${store.accountLoaded?count(label):"…"})`} selected={tab===label} onPress={()=>{setTab(label);setLimit(20);}}/>)}</HorizontalScroll>
    <MobileCard style={{backgroundColor:"#EFF2FC",flexDirection:"row",alignItems:"center"}}><Icon name="text-box-edit" size={28} color={mobile.teal}/><Text style={[ms.muted,{flex:1}]}>İlanlarını düzenleyebilir, yayından kaldırabilir ve ortaklık ayarlarını değiştirebilirsin.</Text></MobileCard>
    {showDraft&&draft&&<MobileCard><View style={ms.row}>{draft.image&&<SafeRemoteImage uri={draft.image} style={{width:94,height:75,borderRadius:9}}/>}<View style={{flex:1}}><Text style={ms.section}>{draft.title}</Text><Text style={ms.muted}>Cihazdaki taslak · {new Date(draft.savedAt).toLocaleDateString("tr-TR")}</Text><Text numberOfLines={2} style={ms.muted}>{draft.category}</Text></View></View><View style={ms.row}><MobileButton style={{flex:1}} onPress={()=>router.push("/create")}>Taslağa Devam Et</MobileButton><MobileButton secondary onPress={()=>Alert.alert("Taslağı sil","Bu cihazdaki yarım kalan ilan silinecek.",[{text:"Vazgeç",style:"cancel"},{text:"Sil",style:"destructive",onPress:()=>{void AsyncStorage.removeItem(listingDraftKey(store.currentUser.id)).then(()=>setDraft(null)).catch(()=>showToast("Taslak silinemedi."));}}])}>Sil</MobileButton></View></MobileCard>}
    {draftError&&<MobileCard><Text style={ms.error}>Cihazdaki taslak okunamadı.</Text><MobileChip label="Taslağı tekrar yükle" onPress={()=>readDraft()}/></MobileCard>}
    {visible.slice(0,limit).map(l=>{const photos=listingPhotos(l),max=maximumPartners(l);return <MobileCard key={l.id}>
      <View style={{flexDirection:"row",gap:10}}><Pressable accessibilityRole="button" accessibilityLabel={`${displayListingTitle(l.title)} ilanını aç`} onPress={()=>router.push(`/listing/${l.id}` as never)} style={{width:"32%"}}><SafeRemoteImage uri={photos[0]} style={{width:"100%",height:102,borderRadius:9}}/><Text style={{position:"absolute",left:5,bottom:5,backgroundColor:"#182633AA",color:"white",padding:4,borderRadius:5,fontSize:9}}>{photos.length?`1/${photos.length}`:"Fotoğraf yok"}</Text></Pressable><View style={{flex:1,gap:5}}><Text numberOfLines={2} style={{fontWeight:"700",fontSize:14,color:mobile.ink}}>{displayListingTitle(l.title)}</Text><Text style={{fontWeight:"800",fontSize:20,color:mobile.teal}}>{moneyIn(l.price,l.currency)}</Text><Text numberOfLines={1} style={ms.muted}>⌖ {l.location}</Text><View style={[ms.row,{flexWrap:"wrap",justifyContent:"space-between"}]}><Text style={{fontSize:10,color:l.status==="active"?"#12814B":mobile.muted,backgroundColor:l.status==="active"?"#E2F8EE":"#F0F3F6",padding:5,borderRadius:5}}>{listingStatusLabels[l.status]}</Text><Text style={{fontSize:10,color:mobile.muted}}>{new Date(l.createdAt).toLocaleDateString("tr-TR")}</Text></View></View></View>
      {l.rejectionReason&&<Text style={ms.error}>{l.rejectionReason}</Text>}
      <View style={{flexDirection:"row",borderTopWidth:1,borderColor:mobile.line,paddingTop:9}}>{[["Görüntüleme",groupThousands(l.viewCount||0)],["Favori",l.favoriteCount||0],["Sohbet",store.conversations.filter(c=>c.listingId===l.id).length],["Ortak",`${l.partnerCount||0}/${max||"∞"}`]].map(([label,value])=><View key={label} style={{flex:1,alignItems:"center",gap:3}}><Text style={{fontWeight:"700",color:mobile.ink,fontSize:12}}>{value}</Text><Text style={{fontSize:9,color:mobile.muted}}>{label}</Text></View>)}</View>
      <View style={ms.wrap}><MobileChip label="Düzenle" icon="pencil" onPress={()=>goEdit(l)}/><MobileChip label="Ortakları Yönet" icon="account-group" onPress={()=>router.push(`/partner?listingId=${l.id}&tab=active` as never)}/><MobileChip label="Ortaklık Ayarları" icon="account-group" onPress={()=>goEdit(l,"partnership")}/><MobileChip label="İstatistikler" icon="chart-bar" onPress={()=>router.push(`/listing-stats/${l.id}` as never)}/>{l.status==="active"?<MobileChip label={busy===l.id?"Kaydediliyor…":"Yayından Kaldır"} icon="power" onPress={()=>Alert.alert("Yayından kaldır","İlan artık keşfet ve arama sonuçlarında gösterilmeyecek.",[{text:"Vazgeç",style:"cancel"},{text:"Onayla",onPress:()=>void status(l,"paused")}])}/>:['draft','paused','expired'].includes(l.status)?<MobileChip label={l.status==="draft"?"Yayına Al":"Yeniden Yayınla"} icon="refresh" onPress={()=>goEdit(l,"preview")}/>:null}{l.status!=="active"&&<MobileChip label="Sil" icon="trash-can-outline" onPress={()=>remove(l)}/>}</View>
    </MobileCard>;})}
    {!visible.length&&!showDraft&&<MobileCard><Text style={ms.section}>{store.accountLoaded?"Bu görünümde ilan bulunamadı":"İlanların yükleniyor…"}</Text><Text style={ms.muted}>Diğer durumları seçebilir veya yeni bir ilan oluşturabilirsin.</Text></MobileCard>}
    {visible.length>limit&&<MobileButton secondary onPress={()=>setLimit(v=>v+20)}>Diğer ilanları göster</MobileButton>}
    <MobileButton secondary onPress={()=>router.push({pathname:"/seller",params:{view:"advanced"}} as never)}>Satış ve ödeme yönetimi</MobileButton>

  </MobileScreen>;
}

import { HorizontalScroll } from "@/components/horizontal-scroll";
import { displayListingTitle } from "@/lib/listing-title";
import { useCallback, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { Alert } from "@/lib/alert";
import { useStore } from "@/lib/use-store";
import { useForegroundRefresh } from "@/lib/use-foreground-refresh";
import { listingDraftKey, localDraftSummary } from "@/lib/mobile-drafts";
import { listingPhotos, listingStatusLabels, maximumPartners } from "@/lib/mobile-listing";
import { listingCategoryTrail } from "@/lib/mobile-catalog";
import { moneyIn, groupThousands } from "@/lib/format";
import { searchKey } from "@/lib/locale";
import { showToast } from "@/lib/toast";
import type { Listing } from "@/lib/types";
import { MobileButton, MobileCard, MobileChip, MobileField, MobileScreen, IconButton, mobile, ms } from "./ui";

const tabs = ["Tümü", "Yayında", "Taslak", "Süresi doldu", "Yayından kaldırıldı", "İncelemede", "Reddedildi", "Satıldı", "Arşivlendi"];
// Her zaman görünen sekmeler; diğerleri yalnız o durumda ilan varsa çizilir (dokuz çipin çoğu boş listeye götürüyordu).
const alwaysTabs = new Set(["Tümü", "Yayında", "Taslak"]);

/** İlanın alıcıya NEREDE göründüğünü tek cümleyle söyler ("nereye gönderildiği belli olsun"). */
function visibilityNote(status: Listing["status"]): { text: string; live: boolean } {
  if (status === "active") return { text: "Ana sayfa, Keşfet, arama ve bu kategoride görünüyor.", live: true };
  if (status === "pending_review") return { text: "İncelemede — onaylanınca bu kategoride yayınlanır.", live: false };
  if (status === "sold") return { text: "Satıldı — alıcılara artık gösterilmiyor.", live: false };
  if (status === "rejected") return { text: "Reddedildi — yayında değil. Düzenleyip yeniden gönderebilirsin.", live: false };
  return { text: "Yayında değil — alıcılara görünmüyor.", live: false };
}

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
  const activeMine = mine.filter(l=>l.status==="active");
  const matches = (l:Listing) => !query || searchKey(`${displayListingTitle(l.title)} ${l.category} ${l.location}`).includes(searchKey(query));
  const visible = mine.filter(l => matches(l) && (tab==="Tümü" || listingStatusLabels[l.status]===tab));
  const showDraft = !!draft && (tab==="Tümü" || tab==="Taslak") && (!query || searchKey(`${draft.title} ${draft.category}`).includes(searchKey(query)));
  const count = (label:string) => mine.filter(l=>matches(l)&&(label==="Tümü"||listingStatusLabels[l.status]===label)).length + (draft&&(label==="Tümü"||label==="Taslak")&&(!query||searchKey(draft.title).includes(searchKey(query)))?1:0);
  async function status(l:Listing,next:Listing["status"]) {
    if(busy)return; setBusy(l.id);
    try { const ok=await store.updateListingStatus(l.id,next); showToast(ok?next==="paused"?"İlan yayından kaldırıldı.":next==="sold"?"İlan satıldı olarak işaretlendi.":"İlan durumu güncellendi.":"İlan durumu kaydedilemedi. Tekrar dene."); }
    finally {setBusy(null);}
  }
  // Silme her durumda mümkün (eskiden yayındaki ilan önce yayından kaldırılmadan silinemiyordu). Geçmişi olan ilan
  // sunucuda arşive alınır; bu yüzden metin "silinir ya da arşivlenir" der, sonucu olduğundan kesin göstermez.
  function remove(l:Listing) { Alert.alert("İlanı sil", l.status==="active"?"İlan yayından kalkacak ve silinecek. Satış ya da ortaklık geçmişi varsa kayıtlar arşivde korunur. Bu işlem geri alınamaz.":"İlan silinecek. Satış ya da ortaklık geçmişi varsa kayıtlar arşivde korunur. Bu işlem geri alınamaz.", [{text:"Vazgeç",style:"cancel"},{text:"Sil",style:"destructive",onPress:()=>{if(busy)return;setBusy(l.id);void store.removeListing(l.id).then(ok=>showToast(ok?"İlan kaldırıldı.":"İlan kaldırılamadı. Tekrar dene.")).finally(()=>setBusy(null));}}]); }
  const goEdit = (l:Listing, section?:string) => router.push({pathname:"/listing-edit/[id]",params:{id:l.id,...(section?{section}:{} )}} as never);

  return <MobileScreen title="İlanlarım" right={<View style={ms.row}><IconButton name="magnify" label="İlanlarımda ara" onPress={()=>setSearch(v=>!v)}/><MobileChip label="İlan Ver" icon="plus" selected onPress={()=>router.push("/create")}/></View>}>
    {search&&<MobileField placeholder="İlanlarında ara" value={query} onChange={v=>{setQuery(v);setLimit(20);}}/>}
    <View style={[ms.row,{marginTop:8}]}>
      <MobileButton secondary icon="storefront-outline" style={{flex:1}} onPress={()=>router.push(`/store/${store.currentUser.id}` as never)}>Mağazamı Gör</MobileButton>
      <MobileButton secondary icon="swap-vertical" style={{flex:1}} disabled={activeMine.length<2} onPress={()=>router.push("/magaza-sirasi" as never)}>Mağaza Sırası</MobileButton>
    </View>
    <HorizontalScroll  showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:7,paddingVertical:12}}>{tabs.filter(label=>alwaysTabs.has(label)||tab===label||!store.accountLoaded||count(label)>0).map(label=><MobileChip key={label} label={`${label} (${store.accountLoaded?count(label):"…"})`} selected={tab===label} onPress={()=>{setTab(label);setLimit(20);}}/>)}</HorizontalScroll>
    {showDraft&&draft&&<MobileCard><View style={ms.row}>{draft.image&&<SafeRemoteImage uri={draft.image} style={{width:94,height:75,borderRadius:9}}/>}<View style={{flex:1}}><Text style={ms.section}>{draft.title}</Text><Text style={ms.muted}>Cihazdaki taslak · {new Date(draft.savedAt).toLocaleDateString("tr-TR")}</Text><Text numberOfLines={2} style={ms.muted}>{draft.category}</Text></View></View><View style={ms.row}><MobileButton style={{flex:1}} onPress={()=>router.push("/create")}>Taslağa Devam Et</MobileButton><MobileButton secondary onPress={()=>Alert.alert("Taslağı sil","Bu cihazdaki yarım kalan ilan silinecek.",[{text:"Vazgeç",style:"cancel"},{text:"Sil",style:"destructive",onPress:()=>{void AsyncStorage.removeItem(listingDraftKey(store.currentUser.id)).then(()=>setDraft(null)).catch(()=>showToast("Taslak silinemedi."));}}])}>Sil</MobileButton></View></MobileCard>}
    {draftError&&<MobileCard><Text style={ms.error}>Cihazdaki taslak okunamadı.</Text><MobileChip label="Taslağı tekrar yükle" onPress={()=>readDraft()}/></MobileCard>}
    {visible.slice(0,limit).map(l=>{const photos=listingPhotos(l),max=maximumPartners(l),trail=listingCategoryTrail(store.categoryTree,l),place=trail.length?trail.map(n=>n.label).join(" › "):l.category,leaf=trail[trail.length-1],note=visibilityNote(l.status);return <MobileCard key={l.id}>
      <View style={{flexDirection:"row",gap:10}}><Pressable accessibilityRole="button" accessibilityLabel={`${displayListingTitle(l.title)} ilanını aç`} onPress={()=>router.push(`/listing/${l.id}` as never)} style={{width:"32%"}}><SafeRemoteImage uri={photos[0]} style={{width:"100%",height:102,borderRadius:9}}/><Text style={{position:"absolute",left:5,bottom:5,backgroundColor:"#182633AA",color:"white",padding:4,borderRadius:5,fontSize:9}}>{photos.length?`1/${photos.length}`:"Fotoğraf yok"}</Text></Pressable><View style={{flex:1,gap:5}}><Text numberOfLines={2} style={{fontWeight:"700",fontSize:14,color:mobile.ink}}>{displayListingTitle(l.title)}</Text><Text style={{fontWeight:"800",fontSize:20,color:mobile.teal}}>{moneyIn(l.price,l.currency)}</Text><Text numberOfLines={1} style={ms.muted}>⌖ {l.location}</Text><View style={[ms.row,{flexWrap:"wrap",justifyContent:"space-between"}]}><Text style={{fontSize:10,color:l.status==="active"?mobile.teal:mobile.muted,backgroundColor:l.status==="active"?mobile.tealSoft:"#F0F3F6",padding:5,borderRadius:5}}>{listingStatusLabels[l.status]}</Text><Text style={{fontSize:10,color:mobile.muted}}>{new Date(l.createdAt).toLocaleDateString("tr-TR")}</Text></View></View></View>
      {l.rejectionReason&&<Text style={ms.error}>{l.rejectionReason}</Text>}
      {/* NEREDE YAYINLANIYOR: kategori yolu (dokununca o kategori sayfası açılır) + alıcıya görünürlük durumu. */}
      <Pressable accessibilityRole={leaf?"link":undefined} accessibilityLabel={`Yayınlandığı kategori: ${place}`} disabled={!leaf} onPress={()=>leaf&&router.push(`/kategori/${leaf.slug}` as never)} style={{flexDirection:"row",gap:8,alignItems:"flex-start",backgroundColor:note.live?mobile.tealSoft:"#F3F5F8",borderRadius:9,paddingHorizontal:10,paddingVertical:8}}>
        <Icon name={note.live?"map-marker-check-outline":"map-marker-off-outline"} size={18} color={note.live?mobile.teal:mobile.muted}/>
        <View style={{flex:1,minWidth:0,gap:2}}><Text numberOfLines={2} style={{fontSize:12,fontWeight:"700",color:mobile.ink}}>{place||"Kategori belirtilmemiş"}</Text><Text style={{fontSize:11,color:mobile.muted,lineHeight:16}}>{note.text}</Text></View>
        {leaf&&<Icon name="chevron-right" size={18} color={mobile.muted}/>}
      </Pressable>
      <View style={{flexDirection:"row",borderTopWidth:1,borderColor:mobile.line,paddingTop:9}}>{[["Görüntüleme",groupThousands(l.viewCount||0)],["Favori",l.favoriteCount||0],["Sohbet",store.conversations.filter(c=>c.listingId===l.id).length],["Ortak",`${l.partnerCount||0}/${max||"∞"}`]].map(([label,value])=><View key={label} style={{flex:1,alignItems:"center",gap:3}}><Text style={{fontWeight:"700",color:mobile.ink,fontSize:12}}>{value}</Text><Text style={{fontSize:9,color:mobile.muted}}>{label}</Text></View>)}</View>
      <View style={ms.wrap}><MobileChip label="Düzenle" icon="pencil" onPress={()=>goEdit(l)}/><MobileChip label="Ortakları Yönet" icon="account-group" onPress={()=>router.push(`/partner?listingId=${l.id}&tab=active` as never)}/><MobileChip label="Ortaklık Ayarları" icon="account-cog-outline" onPress={()=>goEdit(l,"partnership")}/><MobileChip label="İstatistikler" icon="chart-bar" onPress={()=>router.push(`/listing-stats/${l.id}` as never)}/>{l.status==="active"?<MobileChip label={busy===l.id?"Kaydediliyor…":"Yayından Kaldır"} icon="power" onPress={()=>Alert.alert("Yayından kaldır","İlan artık keşfet ve arama sonuçlarında gösterilmeyecek.",[{text:"Vazgeç",style:"cancel"},{text:"Onayla",onPress:()=>void status(l,"paused")}])}/>:['draft','paused','expired'].includes(l.status)?<MobileChip label={l.status==="draft"?"Yayına Al":"Yeniden Yayınla"} icon="refresh" onPress={()=>goEdit(l,"preview")}/>:null}{(l.status==="active"||l.status==="paused")&&<MobileChip label="Satıldı" icon="check-circle-outline" onPress={()=>Alert.alert("Satıldı olarak işaretle","İlan yayından kalkar ve Satıldı sekmesine taşınır.",[{text:"Vazgeç",style:"cancel"},{text:"Satıldı",onPress:()=>void status(l,"sold")}])}/>}{l.status!=="archived"&&<MobileChip label="Sil" icon="trash-can-outline" onPress={()=>remove(l)}/>}</View>
    </MobileCard>;})}
    {!visible.length&&!showDraft&&<MobileCard><Text style={ms.section}>{store.accountLoaded?"Bu görünümde ilan bulunamadı":"İlanların yükleniyor…"}</Text><Text style={ms.muted}>Diğer durumları seçebilir veya yeni bir ilan oluşturabilirsin.</Text>{store.accountLoaded&&!mine.length&&<MobileButton icon="plus" onPress={()=>router.push("/create")}>İlk İlanını Ver</MobileButton>}</MobileCard>}
    {visible.length>limit&&<MobileButton secondary onPress={()=>setLimit(v=>v+20)}>Diğer ilanları göster</MobileButton>}
    <MobileButton secondary onPress={()=>router.push({pathname:"/seller",params:{view:"advanced"}} as never)}>Satış ve ödeme yönetimi</MobileButton>

  </MobileScreen>;
}

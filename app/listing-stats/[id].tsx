import { displayListingTitle } from "@/lib/listing-title";
import {useCallback,useState} from "react";
import {Text,View} from "react-native";
import {useFocusEffect,useLocalSearchParams,useRouter} from "expo-router";
import {AuthRequired} from "@/components/auth-gate";
import {ScreenSkeleton} from "@/components/screen-skeleton";
import {SafeRemoteImage} from "@/components/safe-remote-image";
import {LineAreaChart,DonutChart} from "@/components/charts";
import {MobileBottomNav,MobileButton,MobileCard,MobileChip,MobileScreen,MobileSelect,mobile,ms,useMobileLayout} from "@/components/mobile/ui";
import {useStore} from "@/lib/use-store";
import {supabase} from "@/lib/supabase";
import {fetchListingById} from "@/lib/supabase-data";
import {listingStatusLabels} from "@/lib/mobile-listing";
import {moneyIn,groupThousands} from "@/lib/format";
import type {Listing} from "@/lib/types";
type Point={label:string;value:number};
type Analytics={views:number;favorites:number;partners:number;requests:number;conversations:number;leads:number;sales:number;periodViews:number;previousViews:number;series:Point[];referralSources:Point[]};
export default function ListingStats(){const store=useStore(),{id}=useLocalSearchParams<{id:string}>();if(!store.authReady||store.isAuthenticated&&!store.accountLoaded)return <ScreenSkeleton/>;if(!store.isAuthenticated)return <AuthRequired title="İlan istatistikleri için giriş yap"/>;return <Stats key={`${store.currentUser.id}:${id}`} id={id}/>;}
function Stats({id}:{id:string}){
 const store=useStore(),router=useRouter(),{maxWidth,tablet}=useMobileLayout();
 const [listing,setListing]=useState<Listing|null>(store.listings.find(l=>l.id===id)||null),[data,setData]=useState<Analytics|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[retry,setRetry]=useState(0),[period,setPeriod]=useState("Son 30 Gün"),[group,setGroup]=useState("Günlük");
 const days=period==="Son 7 Gün"?7:period==="Son 90 Gün"?90:30;
 useFocusEffect(useCallback(()=>{let alive=true;setLoading(true);setError("");setData(null);void (async()=>{try{if(!supabase)throw Error();const [result,detail]=await Promise.all([supabase.rpc("mobile_listing_analytics",{target_id:id,period_days:days}),fetchListingById(id)]);if(!alive)return;if(result.error)throw result.error;if(!result.data){setError("İlan bulunamadı veya bu ilanın istatistiklerine erişimin yok.");return;}if(!detail||!("listing" in detail)||detail.listing.ownerId!==store.currentUser.id){setError("İlan bilgileri yüklenemedi.");return;}setListing(detail.listing);setData(result.data as Analytics);}catch{if(alive)setError("İstatistikler yüklenemedi. Bağlantını kontrol edip tekrar dene.");}finally{if(alive)setLoading(false);}})();return()=>{alive=false;};},[id,days,retry,store.currentUser.id]));
 const buckets=new Map<string,Point>();for(const p of data?.series||[]){const date=new Date(`${p.label}T12:00:00`);if(group==="Haftalık")date.setDate(date.getDate()-((date.getDay()+6)%7));const key=group==="Aylık"?p.label.slice(0,7):date.toISOString().slice(0,10);const label=group==="Aylık"?date.toLocaleDateString("tr-TR",{month:"short",year:"2-digit"}):date.toLocaleDateString("tr-TR",{day:"numeric",month:"short"});const old=buckets.get(key);buckets.set(key,{label,value:(old?.value||0)+p.value});}
 const sourceTotal=(data?.referralSources||[]).reduce((n,p)=>n+p.value,0),growth=data&&data.previousViews>0?Math.round((data.periodViews-data.previousViews)/data.previousViews*100):null;
 return <MobileScreen title="İlan İstatistikleri" bottom={<MobileBottomNav/>} right={<MobileChip icon="refresh" label="Yenile" onPress={()=>setRetry(v=>v+1)}/>}>
  <MobileSelect label="Görüntüleme Dönemi" value={period} options={["Son 7 Gün","Son 30 Gün","Son 90 Gün"]} onChange={setPeriod}/>
  {loading&&<Text style={[ms.muted,{marginVertical:20}]}>İstatistikler yükleniyor…</Text>}
  {!!error&&<MobileCard><Text accessibilityRole="alert" style={ms.error}>{error}</Text><MobileButton secondary onPress={()=>setRetry(v=>v+1)}>Tekrar Dene</MobileButton></MobileCard>}
  {data&&listing&&<>
   <MobileCard><View style={ms.row}><SafeRemoteImage uri={listing.imageUrl||listing.image} style={{width:95,height:95,borderRadius:12}}/><View style={{flex:1,gap:6}}><Text style={ms.section}>{displayListingTitle(listing.title)}</Text><Text style={{fontSize:23,fontWeight:"800",color:mobile.teal}}>{moneyIn(listing.price,listing.currency)}</Text><Text style={ms.muted}>{listing.location}</Text><Text style={{color:listing.status==="active"?"#008D57":mobile.muted,fontSize:12}}>{listingStatusLabels[listing.status]}</Text></View></View><MobileButton secondary icon="open-in-new" onPress={()=>router.push(`/listing/${id}` as never)}>İlanı Gör</MobileButton></MobileCard>
   <Text style={ms.section}>Toplam Etkileşimler</Text><View style={{flexDirection:"row",flexWrap:"wrap",gap:8,marginVertical:12}}>{[["Görüntüleme",data.views],["Favori",data.favorites],["Sohbet",data.conversations],["Ortaklık Talebi",data.requests],["Aktif Ortak",data.partners],["Müşteri Kaydı",data.leads],["Onaylı Satış",data.sales]].map(([label,value])=><MobileCard key={label} style={{width:(maxWidth-32-(tablet?3:1)*8)/(tablet?4:2),gap:5}}><Text style={{fontSize:23,color:mobile.teal,fontWeight:"800"}}>{groupThousands(Number(value))}</Text><Text style={ms.muted}>{label}</Text></MobileCard>)}</View>
   <MobileCard><Text style={ms.section}>Görüntüleme Grafiği</Text><Text style={ms.muted}>{period}: {groupThousands(data.periodViews)} görüntüleme{growth!==null?` · Önceki eşit döneme göre ${growth>0?"+":""}%${growth}`:""}</Text><View style={ms.wrap}>{["Günlük","Haftalık","Aylık"].map(label=><MobileChip key={label} label={label} selected={group===label} onPress={()=>setGroup(label)}/>)}</View><LineAreaChart points={[...buckets.values()]} width={maxWidth-60} height={210} color={mobile.teal}/><Text style={ms.muted}>Aynı ziyaretçinin aynı gün yaptığı tekrar ziyaretler bir kez sayılır. Satıcının kendi ziyareti sayılmaz. Haftalık ve aylık sütunlar seçilen dönemdeki günlerin toplamıdır.</Text></MobileCard>
   <MobileCard><Text style={ms.section}>Ortaklık Bağlantılarından Gelenler</Text>{sourceTotal?<><DonutChart data={data.referralSources} centerTop={groupThousands(sourceTotal)} centerBottom="Tıklama"/><View style={{gap:9}}>{data.referralSources.map(source=><View key={source.label} style={[ms.row,{justifyContent:"space-between"}]}><Text style={ms.muted}>{source.label}</Text><Text style={ms.label}>{source.value} · %{Math.round(source.value/sourceTotal*100)}</Text></View>)}</View></>:<Text style={ms.muted}>Seçili dönemde kayıtlı ortaklık bağlantısı tıklaması yok.</Text>}<Text style={ms.muted}>Bu bölüm yalnızca kaydedilmiş ortaklık bağlantılarının kaynaklarını gösterir. Arama, kategori ve cihaz dağılımı için veri toplanmadığından oran gösterilmez.</Text></MobileCard>
   <MobileButton secondary icon="account-group" onPress={()=>router.push(`/partner?listingId=${id}&tab=active` as never)}>Ortaklık Yönetimi</MobileButton>
  </>}
 </MobileScreen>;
}

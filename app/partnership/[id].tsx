import {useEffect,useRef,useState} from "react";
import {Text,View} from "react-native";
import {useLocalSearchParams,useRouter} from "expo-router";
import {AuthRequired} from "@/components/auth-gate";
import {ScreenSkeleton} from "@/components/screen-skeleton";
import {CommissionOverrideModal} from "@/components/commission-override-modal";
import {MobilePartnershipContent,partnershipStatusLabels} from "@/components/mobile/partnership-content";
import {MobileBottomNav,MobileButton,MobileCard,MobileScreen,ms,useMobileLayout} from "@/components/mobile/ui";
import {displayListingTitle} from "@/lib/listing-title";
import {useStore} from "@/lib/use-store";
import {fetchListingById} from "@/lib/supabase-data";
import {shareOrCopy} from "@/lib/share";
import {showToast} from "@/lib/toast";
import {Alert} from "@/lib/alert";
import {moneyIn} from "@/lib/format";
import type {Listing} from "@/lib/types";
export default function PartnershipDetail(){const store=useStore(),{id}=useLocalSearchParams<{id:string}>();if(!store.authReady||store.isAuthenticated&&!store.accountLoaded)return <ScreenSkeleton/>;if(!store.isAuthenticated)return <AuthRequired title="Ortaklık için giriş yap"/>;return <Detail key={`${store.currentUser.id}:${id}`} id={id}/>;}
function Detail({id}:{id:string}){
 const store=useStore(),router=useRouter(),{tablet}=useMobileLayout(),partnership=store.partnerships.find(p=>p.id===id),cached=store.listings.find(l=>l.id===partnership?.listingId);
 const [remote,setRemote]=useState<Listing|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(""),[retry,setRetry]=useState(0),[busy,setBusy]=useState(false),[commission,setCommission]=useState(false);const lock=useRef(false);
 const listing=cached||remote;
 useEffect(()=>{let alive=true;setRemote(null);setError("");setLoading(false);if(partnership&&!cached){setLoading(true);void fetchListingById(partnership.listingId).then(data=>{if(!alive)return;if(data&&"listing" in data)setRemote(data.listing);else setError("İlan bilgileri yüklenemedi veya ilan artık erişilebilir değil.");}).catch(()=>{if(alive)setError("İlan bilgileri yüklenemedi. Tekrar dene.");}).finally(()=>{if(alive)setLoading(false);});}return()=>{alive=false;};},[partnership?.listingId,cached,retry]);
 const owner=listing?.ownerId===store.currentUser.id;
 async function act(action:"leave"|"end"|"block") {if(lock.current||!partnership)return;lock.current=true;setBusy(true);setError("");try{const ok=action==="leave"?await store.leavePartnership(id):await store.endPartnership(id,action==="block"?"blocked":"cancelled");if(!ok){setError("Ortaklık işlemi kaydedilemedi. Önceki durum korunuyor; tekrar dene.");return;}showToast(action==="leave"?"Ortaklıktan ayrıldın.":"Ortaklık sonlandırıldı.");}finally{lock.current=false;setBusy(false);}}
 function confirm(action:"leave"|"end"|"block"){Alert.alert(action==="leave"?"Ortaklıktan Ayrıl":action==="block"?"Ortaklığı Kapat":"Ortaklığı Sonlandır","Bu ortaklık yeni müşteri yönlendirmelerine kapanır. Geçmiş satış ve ödeme kayıtları korunur.",[{text:"Vazgeç",style:"cancel"},{text:"Onayla",style:"destructive",onPress:()=>{void act(action);}}]);}
 function message(){if(!listing||!partnership)return;const receiver=owner?partnership.partnerId:listing.ownerId;const c=store.startConversation(listing.id,receiver,"",listing);if(c)router.push(`/chat/${c.id}` as never);else showToast("Mesaj başlatılamadı. İlanın veya hesabın durumunu kontrol et.");}
 if(!partnership)return <MobileScreen title="Ortaklık Detayı" bottom={<MobileBottomNav/>}><MobileCard><Text style={ms.muted}>Ortaklık bulunamadı veya bu kayda erişimin yok.</Text><MobileButton secondary onPress={()=>{void store.refreshUserData();}}>Hesap Verilerini Yenile</MobileButton></MobileCard></MobileScreen>;
 return <MobileScreen title="Ortaklık Detayı" bottom={<MobileBottomNav active="partner"/>}>
 {loading&&<Text style={ms.muted}>İlan bilgileri yükleniyor…</Text>}{!!error&&<MobileCard><Text accessibilityRole="alert" style={ms.error}>{error}</Text><MobileButton secondary onPress={()=>setRetry(v=>v+1)}>Tekrar Dene</MobileButton></MobileCard>}
 {listing?<MobilePartnershipContent key={listing.id} listing={listing} partnership={partnership}/>:!loading&&<MobileCard><Text style={ms.section}>{partnershipStatusLabels[partnership.status]}</Text><Text style={ms.muted}>Başvuru: {new Date(partnership.createdAt).toLocaleDateString("tr-TR")}</Text></MobileCard>}
 <View style={[{gap:11,marginVertical:18},tablet&&{alignSelf:"center",maxWidth:560,width:"100%"}]}><MobileButton icon="chat" disabled={!listing||busy} onPress={message}>{owner?"Ortağa Mesaj Gönder":"Satıcıya Mesaj Gönder"}</MobileButton><View style={ms.row}><MobileButton secondary icon="open-in-new" style={{flex:1}} onPress={()=>router.push(`/listing/${partnership.listingId}` as never)}>İlanı Gör</MobileButton><MobileButton secondary icon="share-variant" style={{flex:1}} onPress={()=>{void shareOrCopy({title:listing?displayListingTitle(listing.title):"OrtakSat İlanı",url:`https://www.ortaksat.com/ilan/${partnership.listingId}`}).then(result=>{if(result==="copied")showToast("Bağlantı kopyalandı.");if(result==="failed")showToast("Paylaşılamadı. Lütfen tekrar dene.");});}}>Paylaş</MobileButton></View><MobileButton secondary icon="bell-outline" onPress={()=>router.push("/notification-settings" as never)}>Bildirim Tercihleri</MobileButton><MobileButton secondary icon={store.isFavorite(partnership.listingId)?"heart":"heart-outline"} onPress={()=>store.toggleFavorite(partnership.listingId)}>{store.isFavorite(partnership.listingId)?"Favorilerden Kaldır":"Favorilere Ekle"}</MobileButton>
 {owner&&listing&&<><MobileButton secondary icon="cash-edit" disabled={busy} onPress={()=>setCommission(true)}>Ortağa Özel Komisyon</MobileButton><MobileButton secondary icon="chart-bar" onPress={()=>router.push(`/listing-stats/${listing.id}` as never)}>İlan İstatistikleri</MobileButton></>}
 {partnership.status==="active"&&<><MobileButton secondary icon="exit-to-app" disabled={busy} onPress={()=>confirm(owner?"end":"leave")}>{busy?"Kaydediliyor…":owner?"Ortaklığı Sonlandır":"Ortaklıktan Ayrıl"}</MobileButton>{owner&&<MobileButton secondary icon="block-helper" disabled={busy} onPress={()=>confirm("block")}>Ortaklığı Kapat</MobileButton>}</>}
 <MobileButton secondary onPress={()=>router.push({pathname:owner?"/seller":"/partner",params:{view:"advanced",focus:partnership.listingId}} as never)}>Satış, Müşteri ve Ayrıntılı İşlemler</MobileButton></View>
 {listing&&owner&&<CommissionOverrideModal visible={commission} partnerName={store.findUser(partnership.partnerId)?.name||"Ortak"} currency={listing.currency} defaultLabel={(partnership.agreedCommissionType??listing.commissionType)==="rate"?`%${partnership.agreedCommissionValue??listing.commissionValue}`:moneyIn(partnership.agreedCommissionValue??listing.commissionValue,listing.currency)} currentType={partnership.commissionOverrideType} currentValue={partnership.commissionOverrideValue} onClose={()=>setCommission(false)} onSubmit={(type,value)=>store.setPartnershipCommission(id,type,value)} onClear={()=>store.setPartnershipCommission(id)}/>}
 </MobileScreen>;
}

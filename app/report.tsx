import {useUnsavedForm} from "@/lib/use-unsaved-form";
import {useEffect,useRef,useState} from "react";
import {Text,View} from "react-native";
import {useLocalSearchParams,useRouter} from "expo-router";
import {AuthRequired} from "@/components/auth-gate";
import {ScreenSkeleton} from "@/components/screen-skeleton";
import {UserAvatar} from "@/components/user-avatar";
import {SafeRemoteImage} from "@/components/safe-remote-image";
import {EvidencePicker} from "@/components/mobile/evidence";
import {MobileBottomNav,MobileButton,MobileCard,MobileChip,MobileField,MobileScreen,mobile,ms} from "@/components/mobile/ui";
import {useStore} from "@/lib/use-store";
import {fetchListingById} from "@/lib/supabase-data";
import {makeUuid} from "@/lib/live-service";
import {uploadEvidence,type EvidencePhoto} from "@/lib/mobile-evidence";
import {moneyIn} from "@/lib/format";
import type{Listing}from"@/lib/types";
const listingReasons=["Sahte ilan","Yanıltıcı fiyat","Yanıltıcı açıklama veya fotoğraflar","Yanlış kategori","Yasaklı veya uygunsuz ürün","Diğer"];
const userReasons=["Sahte ilan","Dolandırıcılık şüphesi","Rahatsız edici mesajlar","Kural ihlali","Gerçek olmayan profil","Diğer"];
export default function ReportScreen(){const store=useStore();if(!store.authReady)return <ScreenSkeleton/>;if(!store.isAuthenticated)return <AuthRequired title="Şikâyet göndermek için giriş yap"/>;return <ReportForm key={store.currentUser.id}/>;}
function ReportForm(){
 const {listingId,userId}=useLocalSearchParams<{listingId?:string;userId?:string}>(),store=useStore(),router=useRouter();
 const [remote,setRemote]=useState<Listing|null>(null),[reason,setReason]=useState(""),[details,setDetails]=useState(""),[photos,setPhotos]=useState<EvidencePhoto[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const locked=useRef(false),id=useRef(makeUuid()),uploaded=useRef(new Map<string,string>()),listing=store.listings.find(l=>l.id===listingId)||remote,user=store.findUser(userId||listing?.ownerId||"");
 useEffect(()=>{let alive=true;if(listingId&&!store.listings.some(l=>l.id===listingId))void fetchListingById(listingId).then(data=>{if(alive)setRemote(data&&"listing" in data?data.listing:null);}).catch(()=>{});return()=>{alive=false;};},[listingId,store.listings]);
 const allowLeave=useUnsavedForm(!!reason||!!details||photos.length>0,busy);
 async function send(){if(locked.current)return;if(!listingId&&!userId){setError("Şikâyet etmek için ilgili ilanı veya kullanıcıyı seç.");return;}if(!reason||details.trim().length<20){setError("Şikâyet nedeni seç ve en az 20 karakter açıklama yaz.");return;}locked.current=true;setBusy(true);setError("");try{const paths:string[]=[];for(const photo of photos){let path=uploaded.current.get(photo.uri);if(!path){path=await uploadEvidence(photo,store.currentUser.id);uploaded.current.set(photo.uri,path);}paths.push(path);}const ok=listingId?await store.reportListing(listingId,reason,details.trim(),{id:id.current,attachments:paths}):await store.reportUser(userId!,reason,details.trim(),{id:id.current,attachments:paths});if(!ok)throw new Error();allowLeave();router.replace({pathname:"/reports",params:{id:id.current}} as never);}catch{setError("Şikâyet gönderilemedi. Açıklaman ve görsellerin korunuyor; tekrar dene.");}finally{locked.current=false;setBusy(false);}}
 return <MobileScreen title={listingId?"İlanı Şikâyet Et":"Kullanıcıyı Şikâyet Et"} bottom={<MobileBottomNav/>}>
  <MobileCard><View style={ms.row}>{listing?<SafeRemoteImage uri={listing.imageUrl||listing.image} style={{width:75,height:75,borderRadius:10}}/>:<UserAvatar uri={user?.avatar} size={65}/>}<View style={{flex:1,gap:5}}><Text style={ms.section}>{listing?.title||user?.name||"Seçili kullanıcı / ilan"}</Text>{listing&&<Text style={{color:mobile.teal,fontWeight:"800"}}>{moneyIn(listing.price,listing.currency)}</Text>}<Text style={ms.muted}>{listing?.location||user?.city||""}</Text><Text style={{fontSize:9,color:mobile.muted}}>No: {listingId||userId}</Text></View></View></MobileCard>
  <Text style={[ms.section,{marginVertical:13}]}>Şikâyet Nedeni *</Text><View style={{gap:9,marginBottom:17}}>{(listingId?listingReasons:userReasons).map(r=><MobileChip key={r} label={r} selected={reason===r} icon={reason===r?"check-circle":"circle-outline"} onPress={()=>setReason(r)}/>)}</View>
  <MobileField label="Açıklama" required multiline maxLength={1000} value={details} onChange={setDetails}/><View style={{marginVertical:19}}><EvidencePicker photos={photos} onChange={setPhotos} disabled={busy}/></View><MobileCard style={{backgroundColor:"#EFF2FC"}}><Text style={ms.muted}>Şikâyetin incelendikten sonra gerekli işlemler yapılır. Eklediğin görseller herkese açık yayınlanmaz. Yalnızca yaşadığın durumu ve ilgili bilgileri paylaş.</Text></MobileCard>{!!error&&<Text accessibilityRole="alert" style={ms.error}>{error}</Text>}<MobileButton icon="send" disabled={busy} onPress={()=>void send()}>{busy?"Gönderiliyor…":"Şikâyeti Gönder"}</MobileButton>
 </MobileScreen>;
}

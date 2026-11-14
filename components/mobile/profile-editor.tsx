import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { UserAvatar } from "@/components/user-avatar";
import { OptionSheet } from "@/components/option-sheet";
import { Alert } from "@/lib/alert";
import {LocationSelector} from "@/components/location-selector";
import {provinces} from "@/lib/locations";
import {supabase} from "@/lib/supabase";
import {useUnsavedForm} from "@/lib/use-unsaved-form";
import { uploadProfileAvatar, uploadProfileCover } from "@/lib/live-service";
import { CoverField } from "@/components/cover-field";
import { useStore } from "@/lib/use-store";
import { showToast } from "@/lib/toast";
import { MobileButton, MobileCard, MobileField, MobileScreen, MobileSelect, mobile, ms } from "./ui";

export function MobileProfileEditor() {
  const store = useStore(), user = store.currentUser, router = useRouter();
  const [name, setName] = useState(user.name), [phone, setPhone] = useState(user.phone || ""), [bio, setBio] = useState(user.bio || ""), [city, setCity] = useState(user.city || ""), [avatar, setAvatar] = useState(user.avatar), [cover, setCover] = useState<string | null>(user.cover ?? null);
  const [photoMenu, setPhotoMenu] = useState(false), [picking, setPicking] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const [username,setUsername]=useState(user.username||""),[districtId,setDistrictId]=useState<number|undefined>(user.districtId),[website,setWebsite]=useState(user.website||""),[instagram,setInstagram]=useState(user.instagram||""),[email,setEmail]=useState(""),[usernameIssue,setUsernameIssue]=useState("");
  const locked = useRef(false);
  useEffect(()=>{let alive=true;void supabase?.auth.getUser().then(({data})=>{if(alive)setEmail(data.user?.email||"");});return()=>{alive=false;};},[]);
  useEffect(()=>{let alive=true;setUsernameIssue("");if(!username||username===user.username)return;if(!/^[a-z0-9_]{3,30}$/.test(username)){setUsernameIssue("3–30 karakter; küçük harf, rakam ve alt çizgi kullan.");return;}const timer=setTimeout(()=>{void supabase?.from("profiles").select("id").eq("username",username).neq("id",user.id).limit(1).then(({data,error})=>{if(alive)setUsernameIssue(error?"Kullanıcı adı kontrol edilemedi; kaydederken yeniden kontrol edilecek.":data?.length?"Bu kullanıcı adı kullanılıyor.":"");});},350);return()=>{alive=false;clearTimeout(timer);};},[username,user.username,user.id]);
  const dirty = name !== user.name || phone !== (user.phone || "") || bio !== (user.bio || "") || city !== (user.city || "") || avatar !== user.avatar || cover !== (user.cover ?? null) || username!==(user.username||"") || districtId!==user.districtId || website!==(user.website||"") || instagram!==(user.instagram||"");
  const allowLeave=useUnsavedForm(dirty,saving||picking);
  function leave(){if(!saving&&!picking){if(router.canGoBack())router.back();else router.replace("/profile");}}
  async function pick(camera: boolean) {
    if (picking || saving) return;
    setPicking(true); setError("");
    try {
      const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { setError(camera ? "Fotoğraf çekmek için kamera izni gerekli." : "Fotoğraf seçmek için galeri izni gerekli."); return; }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.85 };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled) {
        const photo = result.assets[0];
        if (photo.fileSize && photo.fileSize > 5 * 1024 * 1024) { setError("Profil fotoğrafı en fazla 5 MB olabilir."); return; }
        setAvatar(photo.uri);
      }
    } catch { setError("Fotoğraf alınamadı. Tekrar dene."); } finally { setPicking(false); }
  }
  async function save() {
    if (locked.current || picking) return;
    if (name.trim().length < 2) { setError("Ad soyad en az 2 karakter olmalı."); return; }
    if (phone.trim() && !/^\+?[\d\s()-]{10,24}$/.test(phone.trim())) { setError("Geçerli bir telefon numarası gir."); return; }
    if(username&&!/^[a-z0-9_]{3,30}$/.test(username)||usernameIssue==="Bu kullanıcı adı kullanılıyor."){setError("Geçerli ve kullanılmayan bir kullanıcı adı seç.");return;}
    if(website&&(!/^https:\/\/[^\s]+$/i.test(website)||website.length>200)){setError("Web sitesi https:// ile başlamalı ve en fazla 200 karakter olmalı.");return;}
    if(instagram&&!/^[A-Za-z0-9_.]{1,30}$/.test(instagram)){setError("Geçerli bir Instagram kullanıcı adı gir.");return;}
    locked.current = true; setSaving(true); setError("");
    try {
      const nextAvatar = avatar && avatar !== user.avatar && store.backendMode === "supabase" ? await uploadProfileAvatar(avatar, user.id) : avatar;
      if (avatar && !nextAvatar) throw new Error("Avatar upload failed");
      const nextCover = cover && !/^https?:\/\//i.test(cover) && store.backendMode === "supabase" ? await uploadProfileCover(cover, user.id) : cover;
      if (!await store.updateProfile({ name: name.trim(), phone: phone.trim(), avatar: nextAvatar || "", bio: bio.trim(), city, username, districtId:districtId||null,website,instagram, expertiseCategories: user.expertiseCategories, cover: nextCover })) throw new Error("Profile save failed");
      showToast("Profilin güncellendi."); allowLeave(); router.replace("/profile");
    } catch { setError("Profil kaydedilemedi. Değişikliklerin bu ekranda korunuyor; tekrar dene."); } finally { locked.current = false; setSaving(false); }
  }
  return <MobileScreen title="Profil Düzenle" onBack={leave}>
    <MobileCard style={{ backgroundColor: mobile.tealSoft, flexDirection: "row", alignItems: "center" }}><UserAvatar uri={avatar} name={name} size={90} /><View style={{ flex: 1, gap: 8 }}><Text style={ms.section}>Profil Fotoğrafı</Text><Text style={ms.muted}>Seni en iyi yansıtan bir fotoğraf kullan. En fazla 5 MB.</Text><MobileButton secondary icon="camera-outline" disabled={picking || saving} onPress={() => setPhotoMenu(true)}>{picking ? "Fotoğraf Alınıyor…" : "Fotoğrafı Değiştir"}</MobileButton></View></MobileCard>
    <MobileCard style={{ gap: 10, marginTop: 12 }}><Text style={ms.section}>Kapak Görseli</Text><CoverField value={cover} onChange={setCover} disabled={picking || saving} /></MobileCard>
    <Text style={[ms.section, { marginVertical: 14 }]}>Temel Bilgiler</Text><View style={{ gap: 18 }}><MobileField label="Ad Soyad" required value={name} onChange={setName} maxLength={100} /><MobileField label="Kullanıcı Adı" value={username} onChange={v=>setUsername(v.replace(/^@/,"").toLowerCase())} maxLength={30}/>{usernameIssue&&<Text style={ms.muted}>{usernameIssue}</Text>}<View><Text style={ms.label}>E-posta</Text><Text selectable style={ms.muted}>{email||"E-posta bilgisi yüklenemedi"}</Text><MobileButton secondary onPress={()=>router.push("/account-security" as never)}>E-posta ve Güvenlik Ayarları</MobileButton></View><MobileField label="Telefon Numarası" value={phone} onChange={setPhone} maxLength={24} /><Text style={ms.muted}>Telefonunu değiştirirsen önceki telefon doğrulaması kaldırılır.</Text><View><Text style={ms.label}>İl ve İlçe</Text><LocationSelector value={{provinceId:provinces.find(p=>p.name===city)?.id,districtId}} onChange={loc=>{setCity(provinces.find(p=>p.id===loc.provinceId)?.name||"");setDistrictId(loc.districtId);}} mode="profile" showNeighborhood={false}/></View><MobileField label="Web Sitesi (Herkese Açık)" value={website} onChange={setWebsite} placeholder="https://" maxLength={200}/><MobileField label="Instagram Kullanıcı Adı (Herkese Açık)" value={instagram} onChange={v=>setInstagram(v.replace(/^@/,""))} maxLength={30}/><MobileField label="Hakkında" value={bio} onChange={setBio} multiline maxLength={500} />{error ? <Text accessibilityRole="alert" style={ms.error}>{error}</Text> : null}<MobileButton icon="content-save-outline" disabled={saving || picking} onPress={() => void save()}>{saving ? "Kaydediliyor…" : "Değişiklikleri Kaydet"}</MobileButton><MobileButton secondary onPress={() => router.push({ pathname: "/profile-edit", params: { view: "advanced", section: "store" } } as never)}>Mağaza ve Uzmanlık Ayarları</MobileButton></View>
    <OptionSheet visible={photoMenu} title="Profil Fotoğrafı" options={["Galeriden Seç", "Fotoğraf Çek"]} onClose={() => setPhotoMenu(false)} onSelect={value => { setPhotoMenu(false); void pick(value === "Fotoğraf Çek"); }} />
  </MobileScreen>;
}

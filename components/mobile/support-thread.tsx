import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/lib/use-store";
import { makeUuid } from "@/lib/live-service";
import { uploadEvidence, type EvidencePhoto } from "@/lib/mobile-evidence";
import { EvidenceGallery, EvidencePicker } from "./evidence";
import { MobileButton, MobileCard, MobileField, mobile, ms } from "./ui";

export type SupportReplyDraft={body:string;photos:EvidencePhoto[];requestId:string;uploaded:Map<string,string>};
type Message={id:string;author_id:string;body:string;attachments:string[];is_staff:boolean;created_at:string};
export function SupportThread({ticketId,closed,onSent,draft,onDraftChange}:{ticketId:string;closed:boolean;onSent:()=>void;draft:SupportReplyDraft;onDraftChange:()=>void}){
  const {currentUser}=useStore(),[messages,setMessages]=useState<Message[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[body,updateBody]=useState(draft.body),[photos,updatePhotos]=useState<EvidencePhoto[]>(draft.photos),[sending,setSending]=useState(false),[more,setMore]=useState(false);
  const locked=useRef(false),requestId=useRef(draft.requestId),uploaded=useRef(draft.uploaded),mounted=useRef(true);
  function setBody(value:string){draft.body=value;updateBody(value);onDraftChange();}
  function setPhotos(value:EvidencePhoto[]){draft.photos=value;updatePhotos(value);onDraftChange();}
  const load=useCallback(async(offset=0)=>{if(!supabase)return;setLoading(true);setError("");try{const {data,error}=await supabase.from("support_messages").select("id,author_id,body,attachments,is_staff,created_at").eq("ticket_id",ticketId).order("created_at").order("id").range(offset,offset+49);if(error)throw error;if(mounted.current){setMessages(old=>offset?[...old,...data as Message[]]:data as Message[]);setMore(data.length===50);}}catch{if(mounted.current)setError("Yanıtlar yüklenemedi. Tekrar dene.");}finally{if(mounted.current)setLoading(false);}},[ticketId]);
  useEffect(()=>{mounted.current=true;void load();return()=>{mounted.current=false;};},[load]);
  async function send(){if(locked.current||closed||!supabase)return;if(!body.trim()){setError("Yanıtını yaz.");return;}locked.current=true;setSending(true);setError("");try{
    const paths:string[]=[];for(const photo of photos){let path=uploaded.current.get(photo.uri);if(!path){path=await uploadEvidence(photo,currentUser.id);uploaded.current.set(photo.uri,path);}paths.push(path);}
    const {error}=await supabase.from("support_messages").insert({id:requestId.current,ticket_id:ticketId,author_id:currentUser.id,body:body.trim(),attachments:paths});
    if(error&&error.code!=="23505")throw error;
    if(error){const prior=await supabase.from("support_messages").select("id").eq("id",requestId.current).eq("author_id",currentUser.id).maybeSingle();if(prior.error||!prior.data)throw error;}
    if(mounted.current){setBody("");setPhotos([]);uploaded.current.clear();requestId.current=makeUuid();draft.requestId=requestId.current;await load();onSent();}
  }catch{if(mounted.current)setError("Yanıt gönderilemedi. Yazdıkların ve görsellerin korunuyor.");}finally{locked.current=false;if(mounted.current)setSending(false);}}
  return <View style={{gap:10}}><Text style={ms.section}>Talep Yanıtları</Text>{messages.map(message=><MobileCard key={message.id} style={{backgroundColor:message.is_staff?"#EFF2FE":"#F6F8FB"}}><Text style={{fontWeight:"700",color:mobile.ink}}>{message.is_staff?"OrtakSat Destek Ekibi":message.author_id===currentUser.id?"Siz":"Talep Sahibi"}</Text><Text style={ms.muted}>{new Date(message.created_at).toLocaleString("tr-TR")}</Text><Text style={{fontSize:13,lineHeight:21,color:mobile.ink}}>{message.body}</Text><EvidenceGallery paths={message.attachments||[]}/></MobileCard>)}{loading&&<Text style={ms.muted}>Yanıtlar yükleniyor…</Text>}{!messages.length&&!loading&&!error&&<Text style={ms.muted}>Henüz yanıt yok. Ek bilgi gönderebilirsin.</Text>}{more&&!loading&&<MobileButton secondary onPress={()=>void load(messages.length)}>Diğer Yanıtları Göster</MobileButton>}{!!error&&<View style={{gap:6}}><Text accessibilityRole="alert" style={ms.error}>{error}</Text>{!sending&&<MobileButton secondary onPress={()=>void load()}>Yanıtları Yenile</MobileButton>}</View>}{closed?<Text style={ms.muted}>Bu talep kapalı. Yeni bir sorun için yeni talep oluşturabilirsin.</Text>:<View style={{gap:14}}><MobileField label="Yanıtınız" value={body} onChange={setBody} multiline maxLength={1000}/><EvidencePicker photos={photos} onChange={setPhotos} disabled={sending}/><MobileButton icon="send" disabled={sending} onPress={()=>void send()}>{sending?"Gönderiliyor…":"Yanıtı Gönder"}</MobileButton></View>}</View>;
}

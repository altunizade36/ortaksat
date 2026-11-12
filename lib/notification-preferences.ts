export const notificationGroups=[
 {key:"messages",title:"Mesaj Bildirimleri",description:"Yeni mesajlardan haberdar ol.",icon:"chat-outline" as const,types:[{key:"message",label:"Yeni mesaj aldığımda"}]},
 {key:"partnerships",title:"Ortaklık Bildirimleri",description:"Ortaklık talepleri, satış ve komisyon gelişmeleri.",icon:"handshake-outline" as const,types:[{key:"application",label:"Ortaklık talepleri ve güncellemeler"},{key:"lead",label:"Yeni müşteri talebi"},{key:"sale",label:"Satış ve komisyon güncellemeleri"},{key:"payout",label:"Ödeme durumu değiştiğinde"}]},
 {key:"listings",title:"İlan Bildirimleri",description:"İlanların ve favorilerindeki ürünler için gelişmeler.",icon:"bullhorn-outline" as const,types:[{key:"review",label:"Yeni değerlendirme aldığımda"},{key:"price_drop",label:"Favorimde fiyat düştüğünde"},{key:"sold",label:"Favorimdeki ürün satıldığında"},{key:"offer",label:"Teklif ve karşı teklif güncellemeleri"},{key:"question",label:"İlan soruları ve yanıtları"}]},
 {key:"system",title:"Sistem Bildirimleri",description:"Takip edilen mağazalar ve uygulama duyuruları.",icon:"cog-outline" as const,types:[{key:"follow",label:"Takip ettiğim satıcıdan yeni ilan"},{key:"system",label:"Uygulama içi duyurular"}]},
];

type Prefs=Record<string,unknown>;

/** Türün ait olduğu grup (sunucudaki `mobile_notification_enabled` ile AYNI eşleme). */
export function notificationGroupOf(type:string){
 return notificationGroups.find(g=>g.types.some(t=>t.key===type))?.key||"system";
}

/**
 * Tür anahtarı açık mı? Sunucunun okuduğu `notify_type_<tür>` esastır. Hiç yazılmamışsa ESKİ
 * `/notifications` ekranının yazdığı `notif_mute_<tür>` anahtarına bakılır (kullanıcının eski
 * "sustur" seçimi kaybolmasın). Yeni anahtar bir kez yazıldıktan sonra eski anahtar yok sayılır.
 */
export function notificationTypeFlag(prefs:Prefs,type:string){
 const v=prefs[`notify_type_${type}`];
 if(v===false)return false;
 if(v===true)return true;
 return prefs[`notif_mute_${type}`]!==true;
}

/** Grup + tür birlikte açık mı ("tümünü kapat" HARİÇ): tür anahtarının ekranda göstereceği değer. */
export function notificationTypeEnabled(prefs:Prefs,type:string){
 return prefs[`notify_${notificationGroupOf(type)}`]!==false&&notificationTypeFlag(prefs,type);
}

export function notificationEnabled(prefs:Prefs,type:string){
 return prefs.notify_all_off!==true&&notificationTypeEnabled(prefs,type);
}

/**
 * Tek bir türü aç/kapat için yazılacak tercih yaması: yalnız sunucunun onurlandırdığı anahtarlar.
 * Grubu kapalı bir türü AÇARKEN grup da açılır; gruptaki diğer türler o ana kadar fiilen kapalı
 * olduğundan açıkça `false` yazılır (tek türü açmak bütün grubu açmasın).
 */
export function notificationTypePatch(prefs:Prefs,type:string,enabled:boolean):Record<string,boolean>{
 const patch:Record<string,boolean>={[`notify_type_${type}`]:enabled};
 if(!enabled)return patch;
 const group=notificationGroups.find(g=>g.key===notificationGroupOf(type));
 if(group&&prefs[`notify_${group.key}`]===false){
  patch[`notify_${group.key}`]=true;
  for(const sibling of group.types)if(sibling.key!==type)patch[`notify_type_${sibling.key}`]=false;
 }
 return patch;
}

/**
 * ESKİ `notif_mute_<tür>` seçimlerini sunucunun okuduğu anahtara taşıyan yama (boşsa taşınacak
 * bir şey yok). Eski anahtar yalnız listeyi istemcide gizliyordu; push/e-posta/uygulama-içi
 * üretimi durmuyordu. Taşındıktan sonra seçim sunucuda da geçerli olur.
 */
export function legacyMuteMigrationPatch(prefs:Prefs):Record<string,boolean>{
 const patch:Record<string,boolean>={};
 for(const group of notificationGroups)for(const t of group.types){
  if(prefs[`notif_mute_${t.key}`]===true&&typeof prefs[`notify_type_${t.key}`]!=="boolean")patch[`notify_type_${t.key}`]=false;
 }
 return patch;
}

export const notificationGroups=[
 {key:"messages",title:"Mesaj Bildirimleri",description:"Yeni mesajlardan haberdar ol.",icon:"chat-outline" as const,types:[{key:"message",label:"Yeni mesaj aldığımda"}]},
 {key:"partnerships",title:"Ortaklık Bildirimleri",description:"Ortaklık talepleri, satış ve komisyon gelişmeleri.",icon:"handshake-outline" as const,types:[{key:"application",label:"Ortaklık talepleri ve güncellemeler"},{key:"lead",label:"Yeni müşteri talebi"},{key:"sale",label:"Satış ve komisyon güncellemeleri"},{key:"payout",label:"Ödeme durumu değiştiğinde"}]},
 {key:"listings",title:"İlan Bildirimleri",description:"İlanların ve favorilerindeki ürünler için gelişmeler.",icon:"bullhorn-outline" as const,types:[{key:"review",label:"Yeni değerlendirme aldığımda"},{key:"price_drop",label:"Favorimde fiyat düştüğünde"},{key:"sold",label:"Favorimdeki ürün satıldığında"},{key:"offer",label:"Teklif ve karşı teklif güncellemeleri"},{key:"question",label:"İlan soruları ve yanıtları"}]},
 {key:"system",title:"Sistem Bildirimleri",description:"Takip edilen mağazalar ve uygulama duyuruları.",icon:"cog-outline" as const,types:[{key:"follow",label:"Takip ettiğim satıcıdan yeni ilan"},{key:"system",label:"Uygulama içi duyurular"}]},
];
export function notificationEnabled(prefs:Record<string,unknown>,type:string){
 const group=notificationGroups.find(g=>g.types.some(t=>t.key===type))?.key||"system";
 return prefs.notify_all_off!==true&&prefs[`notify_${group}`]!==false&&prefs[`notify_type_${type}`]!==false;
}

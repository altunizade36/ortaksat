import { AuthRequired } from "@/components/auth-gate";
import { MobileStoreOrder } from "@/components/mobile/store-order";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import { useStore } from "@/lib/use-store";

/** Mağaza sırası: satıcı yayındaki ilanlarının mağazasında görüneceği sırayı belirler (giriş gerekir). */
export default function StoreOrderRoute() {
  const store = useStore();
  if (!store.authReady || (store.isAuthenticated && !store.accountLoaded)) return <ScreenSkeleton />;
  if (!store.isAuthenticated) return <AuthRequired title="Mağaza sırası için giriş yap" />;
  return <MobileStoreOrder key={store.currentUser.id} />;
}

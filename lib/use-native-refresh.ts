import { useCallback, useState } from "react";

// Native pull-to-refresh yardımcısı: `refreshing` state + `onRefresh` sarmalayıcı.
// Kullanım: const { refreshing, onRefresh } = useNativeRefresh(() => Promise.all([...]));
// <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} .../>}>
export function useNativeRefresh(fn: () => Promise<unknown> | void) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fn();
    } catch {
      // sessiz — spinner yine kapanır
    } finally {
      setRefreshing(false);
    }
  }, [fn]);
  return { refreshing, onRefresh };
}

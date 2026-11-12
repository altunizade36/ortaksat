import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { MobileButton } from "@/components/mobile/ui";
import { trustCapabilities } from "@/lib/trust-v1/api";

/** No entry point is shown until the shared server flag is enabled. */
export function TrustEntry({ userId }: { userId?: string }) {
  const [enabled, setEnabled] = useState(false), router = useRouter();
  useEffect(() => { let active = true; void trustCapabilities().then(c => { if (active) setEnabled(c.enabled); }).catch(() => { /* Existing marketplace remains usable if Trust is unavailable. */ }); return () => { active = false; }; }, []);
  return enabled ? <MobileButton secondary onPress={() => userId ? router.push(`/guven-profili?user=${encodeURIComponent(userId)}`) : router.push("/guven-merkezi")}>{userId ? "Rol bazlı güven karnesini incele" : "Anlaşmalar, güven ve işlem merkezi"}</MobileButton> : null;
}

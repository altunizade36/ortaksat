import type { ReactNode } from "react";
import { MobileBottomNav, MobileScreen, useMobileLayout } from "@/components/mobile/ui";
import { WebFooter } from "@/components/web-landing";
import { isMobileApp } from "@/lib/mobile-app";

export function TrustPage({ title, children, active = "partner" }: { title: string; children: ReactNode; active?: string }) {
  const { width } = useMobileLayout(), desktop = !isMobileApp && width >= 1000;
  return <MobileScreen title={title} headerShown={desktop} bottom={desktop ? undefined : <MobileBottomNav active={active} />} footer={isMobileApp ? undefined : <WebFooter />}>{children}</MobileScreen>;
}

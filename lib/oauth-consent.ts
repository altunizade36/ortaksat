import AsyncStorage from "@react-native-async-storage/async-storage";
import { recordLegalConsentLive } from "@/lib/live-service";

const KEY = "ortaksat.oauth-consent.v1";
const VERSION = "2026-06-11";
const pending = new Set<string>();

export async function prepareOAuthConsent() {
  await AsyncStorage.setItem(KEY, JSON.stringify({ provider: "google", version: VERSION, acceptedAt: new Date().toISOString() }));
}
export async function clearOAuthConsent() { await AsyncStorage.removeItem(KEY); }

/** A restored Google session is not evidence of consent. Only a checked OAuth attempt is. */
export async function recordExplicitOAuthConsent(userId: string) {
  if (pending.has(userId)) return;
  pending.add(userId);
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return;
    const consent = JSON.parse(raw);
    const age = Date.now() - Date.parse(consent.acceptedAt);
    if (consent.provider !== "google" || consent.version !== VERSION || !Number.isFinite(age) || age < 0 || age > 30 * 60 * 1000) { await clearOAuthConsent(); return; }
    const results = await Promise.all((["privacy", "terms", "kvkk", "seller_rules"] as const).map(type => recordLegalConsentLive(userId, type, consent.acceptedAt)));
    if (results.every(Boolean)) await clearOAuthConsent();
  } catch (error) {
    console.warn("Explicit OAuth consent could not be recorded", error);
  } finally { pending.delete(userId); }
}

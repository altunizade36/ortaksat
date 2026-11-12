import { Platform } from "react-native";

// The preview flag is development-only. Production web always keeps its own UI.
export const isMobileApp = Platform.OS !== "web" || (__DEV__ && process.env.EXPO_PUBLIC_MOBILE_PREVIEW === "1");

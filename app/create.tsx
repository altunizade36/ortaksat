import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";

import { colors } from "@/components/colors";
import { DesktopCreateFlow } from "@/components/desktop-create-flow";
import { useIsWideWeb } from "@/lib/layout";

/**
 * İlan oluşturma — Sahibinden tarzı çok seviyeli kategori seçimi + kategoriye
 * göre değişen dinamik form + merkezi konum seçici. Masaüstü ve mobil (dar web /
 * native) aynı akışı kullanır; yerleşim responsive olarak sarılır.
 */
export default function CreateListingScreen() {
  const isWideWeb = useIsWideWeb();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{ backgroundColor: colors.background, paddingBottom: 48, paddingHorizontal: isWideWeb ? 20 : 12, paddingTop: 16 }}
      >
        <View style={{ alignSelf: "center", maxWidth: 1240, width: "100%" }}>
          <DesktopCreateFlow />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

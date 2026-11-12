import { useState, type Ref } from "react";
import { Text, TextInput, View } from "react-native";
import { LISTING_TITLE_HELP, LISTING_TITLE_LIMITS, listingTitleLength, validateListingTitle } from "@/lib/listing-title";

export function ListingTitleField({ value, onChange, invalid = false, inputRef }: { value: string; onChange: (value: string) => void; invalid?: boolean; inputRef?: Ref<TextInput> }) {
  const [touched, setTouched] = useState(false);
  const result = validateListingTitle(value);
  const error = (value.length > 0 || touched || invalid) ? result.error : null;
  const count = listingTitleLength(value);
  return <View dataSet={{ field: "title" }} style={{ gap: 6, minWidth: 0 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Text style={{ flex: 1, color: "#14213D", fontSize: 13, fontWeight: "700" }}>Başlık *</Text>
      <Text testID="title-counter" style={{ color: count > LISTING_TITLE_LIMITS.max ? "#B42318" : "#64748B", fontSize: 12 }}>{count}/{LISTING_TITLE_LIMITS.max}</Text>
    </View>
    <TextInput ref={inputRef} testID="field-title" accessibilityLabel="Başlık" value={value} onChangeText={onChange} onBlur={() => setTouched(true)}
      placeholder="Örn. iPhone 13 Pro 128 GB, temiz kullanılmış" placeholderTextColor="#79869A" autoCapitalize="sentences"
      style={{ minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: error ? "#D92D20" : "#D9E2EC", backgroundColor: "#FFFFFF", color: "#14213D", paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 }} />
    <Text style={{ color: "#64748B", fontSize: 12, lineHeight: 18 }}>{LISTING_TITLE_HELP}</Text>
    {error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: "#B42318", fontSize: 12, lineHeight: 18 }}>{error}</Text>}
  </View>;
}

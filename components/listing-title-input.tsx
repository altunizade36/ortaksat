import { useState, type Ref } from "react";
import { Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { LISTING_TITLE_HELP, LISTING_TITLE_LIMITS, listingTitleLength, validateListingTitle } from "@/lib/listing-title";

/**
 * İlan OLUŞTURMA başlık alanı. `ListingTitleField` ile aynı kurallar (lib/listing-title), tek fark
 * hatanın NE ZAMAN gösterildiği: "en az 10 karakter" uyarısı, kullanıcı alanı terk edene (blur) ya da
 * "Yayınla"ya basana (`invalid`) kadar gösterilmez. Eskiden kategori seçince otomatik gelen kısa öneri
 * ("Audi A4") kullanıcı tek tuşa basmadan kırmızı hata basıyordu. Yasak karakter / çok uzun başlık gibi
 * YAZARKEN oluşan hatalar ise anında gösterilmeye devam eder.
 */
export function ListingTitleInput({ value, onChange, invalid = false, inputRef, placeholder }: { value: string; onChange: (value: string) => void; invalid?: boolean; inputRef?: Ref<TextInput>; placeholder?: string }) {
  const { language } = useLanguage();
  const [touched, setTouched] = useState(false);
  const result = validateListingTitle(value);
  const count = listingTitleLength(value);
  const tooShort = count < LISTING_TITLE_LIMITS.min;
  const error = result.error && (touched || invalid || (value.length > 0 && !tooShort)) ? result.error : null;
  return (
    <View dataSet={{ field: "title" }} style={{ gap: 6, minWidth: 0 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <Text style={{ color: error ? colors.accent : colors.muted, flex: 1, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Başlık", language)} *</Text>
        <Text testID="title-counter" style={{ color: count > LISTING_TITLE_LIMITS.max ? colors.accent : colors.subtle, fontSize: 11, fontVariant: ["tabular-nums"], fontWeight: "700" }}>{count}/{LISTING_TITLE_LIMITS.max}</Text>
      </View>
      <TextInput
        ref={inputRef}
        testID="field-title"
        accessibilityLabel={translateCopy("Başlık", language)}
        value={value}
        onChangeText={onChange}
        onBlur={() => setTouched(true)}
        placeholder={translateCopy(placeholder || "Örn. iPhone 13 Pro 128 GB, temiz kullanılmış", language)}
        placeholderTextColor={colors.subtle}
        autoCapitalize="sentences"
        style={{ backgroundColor: colors.surfaceAlt, borderColor: error ? colors.accent : colors.line, borderRadius: 11, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: 46, paddingHorizontal: 12, paddingVertical: 8 }}
      />
      {error
        ? <Text testID="title-error" accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: colors.accent, fontSize: 12, fontWeight: "700", lineHeight: 17 }}>{translateCopy(error, language)}</Text>
        : <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>{translateCopy(LISTING_TITLE_HELP, language)}</Text>}
    </View>
  );
}

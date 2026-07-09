import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { modelsForSchema, type FieldDef } from "@/lib/category-tree";
import { translateCopy, useLanguage } from "@/lib/i18n";

type AttrValue = string | boolean | string[];

/**
 * Kategori form şemasının alanlarını (title/description/price hariç) düzenlenebilir
 * biçimde render eder. Hem ilan düzenleme hem de tekrar-kullanım için tek kaynak.
 * multiselect → çip; select → açılır liste; bool → anahtar; number/text → giriş.
 */
export function AttributeFields({ fields, values, onChange, schemaKey }: { fields: FieldDef[]; values: Record<string, AttrValue>; onChange: (key: string, v: AttrValue) => void; schemaKey?: string }) {
  const editable = fields.filter((f) => f.key !== "title" && f.key !== "description" && f.key !== "price");
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {editable.map((f) => {
        // Marka→model bağımlı seçici (create ile parite): markanın bilinen modelleri
        // varsa model alanı serbest metin yerine açılır liste olur.
        let field = f;
        if (f.key === "model") {
          const models = modelsForSchema(schemaKey ?? "", String(values.brand ?? ""));
          if (models.length) field = { ...f, type: "select", options: [...models, "Diğer"] };
        }
        return <AField key={f.key} field={field} value={values[f.key]} onChange={(v) => onChange(f.key, v)} />;
      })}
    </View>
  );
}

function AField({ field, value, onChange }: { field: FieldDef; value: AttrValue | undefined; onChange: (v: AttrValue) => void }) {
  const { language } = useLanguage();
  const wide = field.type === "textarea" || field.type === "multiselect";
  const selected = Array.isArray(value) ? value : [];
  return (
    <View style={{ flexBasis: wide ? "100%" : 220, flexGrow: 1, gap: 6, minWidth: 0 }}>
      <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800" }}>
        {field.label}{field.required ? <Text style={{ color: colors.accent }}> *</Text> : null}{field.suffix ? ` (${field.suffix})` : ""}{field.type === "multiselect" && selected.length ? ` · ${selected.length} ${translateCopy("seçili", language)}` : ""}
      </Text>
      {field.type === "multiselect" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {(field.options ?? []).map((opt) => {
            const on = selected.includes(opt);
            return (
              <Pressable key={opt} onPress={() => onChange(on ? selected.filter((x) => x !== opt) : [...selected, opt])} style={{ alignItems: "center", backgroundColor: on ? colors.primarySoft : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 4, paddingHorizontal: 11, paddingVertical: 7 }}>
                {on ? <MaterialCommunityIcons name="check" size={13} color={colors.primaryDark} /> : null}
                <Text style={{ color: on ? colors.primaryDark : colors.ink, fontSize: 12, fontWeight: on ? "800" : "600" }}>{opt}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : field.type === "bool" ? (
        <Pressable onPress={() => onChange(!(value === true))} style={{ alignItems: "center", flexDirection: "row", gap: 9 }}>
          <View style={{ alignItems: value === true ? "flex-end" : "flex-start", backgroundColor: value === true ? colors.primary : colors.line, borderRadius: 999, height: 26, justifyContent: "center", paddingHorizontal: 3, width: 48 }}><View style={{ backgroundColor: "#FFFFFF", borderRadius: 999, height: 20, width: 20 }} /></View>
          <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "700" }}>{value === true ? translateCopy("Evet", language) : translateCopy("Hayır", language)}</Text>
        </Pressable>
      ) : field.type === "select" ? (
        <ASelect value={String(value ?? "")} options={field.options ?? []} onChange={onChange} />
      ) : (
        <TextInput
          value={String(value ?? "")}
          onChangeText={onChange}
          keyboardType={field.type === "number" ? "numeric" : "default"}
          placeholder={field.placeholder}
          placeholderTextColor={colors.subtle}
          multiline={field.type === "textarea"}
          style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 11, borderWidth: 1, color: colors.ink, fontSize: 14, minHeight: field.type === "textarea" ? 92 : 46, paddingHorizontal: 12, paddingVertical: field.type === "textarea" ? 10 : 8, textAlignVertical: field.type === "textarea" ? "top" : "center" }}
        />
      )}
    </View>
  );
}

function ASelect({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ position: "relative", zIndex: open ? 1000 : 1 }}>
      <Pressable onPress={() => setOpen((o) => !o)} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: open ? colors.primary : colors.line, borderRadius: 11, borderWidth: 1, flexDirection: "row", gap: 8, minHeight: 46, paddingHorizontal: 12 }}>
        <Text style={{ color: value ? colors.ink : colors.subtle, flex: 1, fontSize: 13.5, fontWeight: value ? "700" : "500" }}>{value || translateCopy("Seçin", language)}</Text>
        <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
      </Pressable>
      {open ? (
        <>
          <Pressable onPress={() => setOpen(false)} style={{ bottom: -2000, left: -2000, position: "absolute", right: -2000, top: -2000, zIndex: 900 }} />
          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 11, borderWidth: 1, left: 0, maxHeight: 260, position: "absolute", right: 0, shadowColor: "#101828", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.16, shadowRadius: 20, top: 52, zIndex: 1000 }}>
            <View>
              {value ? (
                <Pressable onPress={() => { onChange(""); setOpen(false); }} style={{ paddingHorizontal: 12, paddingVertical: 9 }}>
                  <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>{translateCopy("Temizle", language)}</Text>
                </Pressable>
              ) : null}
              {options.map((o) => (
                <Pressable key={o} onPress={() => { onChange(o); setOpen(false); }} style={({ pressed }) => ({ backgroundColor: pressed || o === value ? colors.surfaceAlt : "transparent", paddingHorizontal: 12, paddingVertical: 9 })}>
                  <Text style={{ color: o === value ? colors.primaryDark : colors.ink, fontSize: 13, fontWeight: o === value ? "800" : "600" }}>{o}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

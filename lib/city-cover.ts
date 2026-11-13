import manifest from "@/data/city-cover-manifest.json";
import { provinces } from "@/data/tr-locations";

export type CityCover = {
  city: string;
  url: string;
  sourceUrl: string;
  title: string;
  artist: string | null;
  license: string | null;
};

const fold = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9çğıöşü]+/g, " ")
    .trim();

const provinceAliases = new Map<string, string>();
for (const province of provinces) {
  provinceAliases.set(fold(province.name), province.name);
  provinceAliases.set(fold(province.slug), province.name);
}

const covers = new Map(
  manifest.entries.map((entry) => [entry.city, entry as CityCover]),
);

export function normalizeProfileCity(value?: string | null): string | null {
  if (!value?.trim()) return null;
  const normalized = fold(value);
  const exact = provinceAliases.get(normalized);
  if (exact) return exact;
  for (const [alias, province] of provinceAliases) {
    if (
      normalized === alias ||
      normalized.startsWith(`${alias} `) ||
      normalized.endsWith(` ${alias}`)
    )
      return province;
  }
  return null;
}

export function cityCoverFor(value?: string | null): CityCover | null {
  const city = normalizeProfileCity(value);
  if (!city || city === "İstanbul") return null;
  return covers.get(city) ?? null;
}

export function cityCoverCount() {
  return covers.size;
}

/**
 * CSV dışa-aktarım (yalnızca web — admin araçları). Alan içindeki tırnak/virgül/
 * yeni-satır RFC-4180'e göre kaçışlanır; başta UTF-8 BOM ile Excel'de Türkçe
 * karakterler bozulmaz.
 */
function esc(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv(filename: string, headers: string[], rows: Array<Array<unknown>>): void {
  if (typeof window === "undefined" || !window.document || !window.URL?.createObjectURL) return;
  const body = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\r\n");
  const blob = new Blob(["﻿" + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

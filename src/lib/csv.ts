/**
 * CSV for Excel: UTF-8 with BOM (Persian text opens correctly), CRLF lines, quoted cells.
 * Cells starting with = + - @ (or a tab/CR) get a leading apostrophe so Excel never runs them as
 * formulas (CSV injection), since names and answers come from users.
 */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

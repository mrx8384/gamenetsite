/**
 * Tournament start times are entered and shown in Tehran time. Iran has no daylight saving time
 * (since 2022), so the offset is a fixed +03:30 — independent of the server or browser time zone.
 */
export const TEHRAN_OFFSET = "+03:30";

/** ISO instant → "yyyy-MM-ddTHH:mm" in Tehran time (value for <input type="datetime-local">). */
export function isoToTehranInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 3.5 * 3600_000);
  return d.toISOString().slice(0, 16);
}

/** "yyyy-MM-ddTHH:mm" (Tehran) → ISO instant, or "" when empty. */
export function tehranInputToIso(local: string): string {
  return local ? new Date(`${local}:00${TEHRAN_OFFSET}`).toISOString() : "";
}

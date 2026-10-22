/** Public URL for an uploaded file. Served by the media route (Phase 6). */
export function mediaUrl(storageKey: string): string {
  return `/media/${storageKey.split("/").map(encodeURIComponent).join("/")}`;
}

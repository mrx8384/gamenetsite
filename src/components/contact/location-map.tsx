import { MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseMapLocation } from "@/lib/map-location";

function otherMapLabel(url: string): string {
  try {
    const host = new URL(url).hostname;
    if (/neshan|nshn/i.test(host)) return "مسیریابی با نشان";
    if (/balad/i.test(host)) return "مسیریابی با بلد";
  } catch {
    // invalid URLs are rejected by the settings validator; fall through
  }
  return "باز کردن در نقشهٔ دیگر";
}

/** Shop location on the contact page: Google Maps embed + navigation buttons, in the site's card style. */
export function LocationMap({ location, address, otherMapUrl }: { location: string; address: string; otherMapUrl: string }) {
  const map = parseMapLocation(location);
  if (!map) return null;
  return (
    <section aria-labelledby="map-title" className="mt-8 overflow-hidden rounded-2xl border border-t-4 border-t-brand-green bg-surface shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-green/15 text-brand-green-deep">
            <MapPin className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id="map-title" className="text-lg font-black">موقعیت ما روی نقشه</h2>
            {address ? <p className="text-sm leading-7 text-muted-foreground">{address}</p> : null}
          </div>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Button asChild variant="strong" className="flex-1 sm:flex-none">
            <a href={map.directionsUrl} target="_blank" rel="noopener noreferrer"><Navigation /> مسیریابی با گوگل‌مپ</a>
          </Button>
          {map.wazeUrl ? (
            <Button asChild variant="outline" className="flex-1 sm:flex-none">
              <a href={map.wazeUrl} target="_blank" rel="noopener noreferrer">Waze</a>
            </Button>
          ) : null}
          {otherMapUrl ? (
            <Button asChild variant="outline" className="flex-1 sm:flex-none">
              <a href={otherMapUrl} target="_blank" rel="noopener noreferrer">{otherMapLabel(otherMapUrl)}</a>
            </Button>
          ) : null}
        </div>
      </div>
      {map.embedUrl ? (
        <div className="relative h-72 border-t bg-secondary sm:h-96">
          {/* Shown until (or if) Google Maps loads, e.g. on a connection that blocks it. */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground" aria-hidden>
            <MapPin className="size-8 text-brand-green" />
            در حال بارگذاری نقشه…
          </div>
          <iframe
            src={map.embedUrl}
            title="نقشهٔ موقعیت اتم گیم کلاب"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
            className="absolute inset-0 size-full border-0 [filter:saturate(0.85)_sepia(0.06)]"
          />
        </div>
      ) : (
        <div className="border-t p-4 text-sm">
          <a href={map.openUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-link hover:underline">مشاهدهٔ موقعیت در گوگل‌مپ</a>
        </div>
      )}
    </section>
  );
}

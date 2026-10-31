"use client";

import * as React from "react";
import Image from "next/image";
import { Building2, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PublicOrganization } from "@/features/organizations/queries";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

/** Auto-scroll speed in px per second (slow, readable). */
const SPEED = 28;
/** Pause after the visitor touches, drags, scrolls or hovers the row. */
const RESUME_AFTER_MS = 2500;

function Logo({ org, size }: { org: PublicOrganization; size: "card" | "dialog" }) {
  const box = size === "card" ? "h-16 w-28" : "size-24";
  return (
    <span className={cn("relative flex items-center justify-center", box)}>
      {org.logoKey ? (
        <Image src={mediaUrl(org.logoKey)} alt={size === "dialog" ? `لوگوی ${org.name}` : ""} fill unoptimized sizes={size === "card" ? "112px" : "96px"} className="object-contain" draggable={false} />
      ) : (
        <Building2 className="size-9 text-muted-foreground" aria-hidden />
      )}
    </span>
  );
}

function Card({ org, onOpen, hidden }: { org: PublicOrganization; onOpen: (o: PublicOrganization) => void; hidden?: boolean }) {
  const body = (
    <>
      <Logo org={org} size="card" />
      <span className="line-clamp-2 text-center text-xs leading-5 font-medium text-foreground">{org.name}</span>
    </>
  );
  const cls = "flex w-40 shrink-0 select-none flex-col items-center justify-center gap-2 rounded-2xl border bg-surface px-3 py-4 shadow-card";
  if (!org.showDetails) {
    return (
      <div className={cls} aria-hidden={hidden || undefined}>
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      className={cn(cls, "cursor-pointer transition-colors hover:border-brand-green focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green")}
      onClick={() => onOpen(org)}
      aria-label={`جزئیات قرارداد با ${org.name}`}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
    >
      {body}
    </button>
  );
}

/**
 * One horizontal row. When the logos don't fit, the row repeats itself and drifts slowly; visitors can
 * swipe or drag it, and the drift pauses while they do. Fits → centred, no movement. Respects reduced motion.
 */
export function OrganizationsStrip({ organizations }: { organizations: PublicOrganization[] }) {
  const scroller = React.useRef<HTMLDivElement>(null);
  const firstSet = React.useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = React.useState(false);
  const [selected, setSelected] = React.useState<PublicOrganization | null>(null);
  const pausedUntil = React.useRef(0);
  const hovering = React.useRef(false);
  const drag = React.useRef<{ x: number; left: number; moved: boolean } | null>(null);

  // Does one copy of the list fit in the row?
  React.useEffect(() => {
    const el = scroller.current;
    const set = firstSet.current;
    if (!el || !set) return;
    const measure = () => setOverflows(set.scrollWidth > el.clientWidth + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(set);
    return () => ro.disconnect();
  }, [organizations]);

  // Slow drift with seamless wrap (the list is rendered twice while it overflows).
  React.useEffect(() => {
    const el = scroller.current;
    const set = firstSet.current;
    if (!el || !set || !overflows) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let pos = el.scrollLeft;
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const dt = Math.min(now - last, 100) / 1000;
      last = now;
      const loop = set.offsetWidth; // width of one copy incl. its trailing gap
      if (loop > 0) {
        if (hovering.current || drag.current || now < pausedUntil.current) {
          pos = el.scrollLeft; // follow the visitor
        } else {
          pos += SPEED * dt;
        }
        if (pos >= loop) pos -= loop;
        if (pos < 0) pos += loop;
        if (Math.abs(el.scrollLeft - pos) >= 0.5) el.scrollLeft = pos;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [overflows]);

  const pause = () => {
    pausedUntil.current = performance.now() + RESUME_AFTER_MS;
  };

  return (
    <>
      <div
        ref={scroller}
        dir="ltr"
        className={cn("no-scrollbar w-full overflow-x-auto overscroll-x-contain py-2", overflows ? "cursor-grab [mask-image:linear-gradient(to_right,transparent,black_2rem,black_calc(100%-2rem),transparent)] active:cursor-grabbing" : "")}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") hovering.current = true;
        }}
        onPointerLeave={() => {
          hovering.current = false;
          if (drag.current) drag.current = null;
          pause();
        }}
        onPointerDown={(e) => {
          pause();
          // Touch scrolls natively; mouse gets click-and-drag.
          if (e.pointerType === "mouse" && overflows && scroller.current) drag.current = { x: e.clientX, left: scroller.current.scrollLeft, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || !scroller.current) return;
          const dx = e.clientX - d.x;
          if (Math.abs(dx) > 4) d.moved = true;
          scroller.current.scrollLeft = d.left - dx;
        }}
        onPointerUp={() => {
          pause();
          // Let the click handler see whether this was a drag.
          setTimeout(() => (drag.current = null), 0);
        }}
        onClickCapture={(e) => {
          if (drag.current?.moved) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onWheel={pause}
        onTouchStart={pause}
        onTouchMove={pause}
        onFocus={pause}
      >
        <div className={cn("flex w-max", overflows ? "" : "mx-auto")}>
          <div ref={firstSet} dir="rtl" className="flex shrink-0 gap-4 pe-4">
            {organizations.map((o) => (
              <Card key={o.id} org={o} onOpen={setSelected} />
            ))}
          </div>
          {overflows ? (
            <div dir="rtl" className="flex shrink-0 gap-4 pe-4" aria-hidden>
              {organizations.map((o) => (
                <Card key={o.id} org={o} onOpen={setSelected} hidden />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
          {selected ? (
            <>
              <DialogHeader className="items-center text-center">
                <div className="flex size-28 items-center justify-center rounded-2xl border bg-white p-2">
                  <Logo org={selected} size="dialog" />
                </div>
                <DialogTitle className="text-xl">{selected.name}</DialogTitle>
                <DialogDescription>طرف قرارداد با اتم گیم کلاب</DialogDescription>
              </DialogHeader>
              <div className="space-y-5 text-sm leading-7">
                {selected.description ? <p className="whitespace-pre-line">{selected.description}</p> : null}
                {selected.terms ? (
                  <section className="space-y-2 rounded-xl border bg-secondary/40 p-4">
                    <h3 className="font-bold">شرایط قرارداد</h3>
                    <p className="whitespace-pre-line text-muted-foreground">{selected.terms}</p>
                  </section>
                ) : null}
                {selected.website ? (
                  <a href={selected.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 font-medium text-link hover:underline">
                    <ExternalLink className="size-4" aria-hidden /> سایت {selected.name}
                  </a>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

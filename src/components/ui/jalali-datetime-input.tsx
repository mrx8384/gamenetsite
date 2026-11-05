"use client";

import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { Button } from "@/components/ui/button";
import { JALALI_MONTHS, JALALI_WEEKDAYS_SHORT, jalaliMonthLength, persianWeekday, toGregorian, toJalali } from "@/lib/jalali";
import { cn } from "@/lib/utils";

/**
 * Date + time picker on the Persian (Shamsi) calendar. The value stays the plain local string
 * "yyyy-MM-ddTHH:mm" (Gregorian, Tehran time) that the forms already send, so server code is unchanged.
 */
interface Props {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  placeholder?: string;
  /** Time used when a day is picked before any time (HH:mm). */
  defaultTime?: string;
  className?: string;
}

const fa = (n: number, pad = 0) => String(n).padStart(pad, "0").replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
const pad2 = (n: number) => String(n).padStart(2, "0");

function parse(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [gy, gm, gd, hh, mm] = m.slice(1).map(Number);
  return { ...toJalali(gy, gm, gd), gy, gm, gd, hh, mm };
}

function build(jy: number, jm: number, jd: number, hh: number, mm: number) {
  const g = toGregorian(jy, jm, jd);
  return `${g.gy}-${pad2(g.gm)}-${pad2(g.gd)}T${pad2(hh)}:${pad2(mm)}`;
}

/** Today in Tehran (fixed +03:30, no DST in Iran since 2022). */
function tehranToday() {
  const d = new Date(Date.now() + 3.5 * 3600_000);
  return toJalali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

const WEEKDAY_NAMES = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

/** «شنبه ۱۷ آبان ۱۴۰۵ — ساعت ۱۸:۳۰» */
export function formatJalaliLocal(value: string): string | null {
  const p = parse(value);
  if (!p) return null;
  return `${WEEKDAY_NAMES[persianWeekday(p.gy, p.gm, p.gd)]} ${fa(p.jd)} ${JALALI_MONTHS[p.jm - 1]} ${fa(p.jy)} — ساعت ${fa(p.hh, 2)}:${fa(p.mm, 2)}`;
}

export function JalaliDateTimeInput({ id, value, onChange, placeholder = "انتخاب تاریخ و ساعت", defaultTime = "18:00", className, ...aria }: Props) {
  const [open, setOpen] = React.useState(false);
  const label = formatJalaliLocal(value);
  return (
    <div className={cn("flex gap-2", className)}>
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        <PopoverPrimitive.Trigger asChild>
          <button
            id={id}
            type="button"
            data-invalid={aria["aria-invalid"] ? "" : undefined}
            aria-describedby={aria["aria-describedby"]}
            className={cn(
              "flex h-10 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg border border-input bg-surface px-3 text-start text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[invalid]:border-destructive disabled:cursor-not-allowed disabled:opacity-50",
              !label && "text-muted-foreground",
            )}
          >
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">{label ?? placeholder}</span>
          </button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content align="start" sideOffset={6} className="z-50 w-72 rounded-xl border bg-surface p-3 shadow-lg outline-none" dir="rtl">
            {open ? <Calendar value={value} defaultTime={defaultTime} onChange={onChange} onDone={() => setOpen(false)} /> : null}
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
      {value ? (
        <Button type="button" variant="ghost" size="icon" aria-label="پاک کردن تاریخ" onClick={() => onChange("")}>
          <X />
        </Button>
      ) : null}
    </div>
  );
}

function Calendar({ value, defaultTime, onChange, onDone }: { value: string; defaultTime: string; onChange: (v: string) => void; onDone: () => void }) {
  const [today] = React.useState(tehranToday);
  const sel = parse(value);
  const [view, setView] = React.useState(() => ({ jy: sel?.jy ?? today.jy, jm: sel?.jm ?? today.jm }));
  const [dh, dm] = defaultTime.split(":").map(Number);
  const hh = sel?.hh ?? dh;
  const mm = sel?.mm ?? dm;

  const days = jalaliMonthLength(view.jy, view.jm);
  const first = toGregorian(view.jy, view.jm, 1);
  const lead = persianWeekday(first.gy, first.gm, first.gd);
  const move = (step: 1 | -1) =>
    setView((v) => {
      const m = v.jm + step;
      return m < 1 ? { jy: v.jy - 1, jm: 12 } : m > 12 ? { jy: v.jy + 1, jm: 1 } : { jy: v.jy, jm: m };
    });
  const pick = (jd: number) => onChange(build(view.jy, view.jm, jd, hh, mm));
  const setTime = (h: number, m: number) => onChange(build(sel?.jy ?? today.jy, sel?.jm ?? today.jm, sel?.jd ?? today.jd, h, m));
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);
  if (!minutes.includes(mm)) minutes.push(mm);
  minutes.sort((a, b) => a - b);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="ماه قبل" onClick={() => move(-1)}><ChevronRight /></Button>
        <p className="text-sm font-bold" aria-live="polite">{JALALI_MONTHS[view.jm - 1]} {fa(view.jy)}</p>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="ماه بعد" onClick={() => move(1)}><ChevronLeft /></Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center" role="grid" aria-label={`${JALALI_MONTHS[view.jm - 1]} ${fa(view.jy)}`}>
        {JALALI_WEEKDAYS_SHORT.map((w, i) => (
          <span key={w} className={cn("py-1 text-xs font-bold text-muted-foreground", i === 6 && "text-destructive")} aria-hidden>{w}</span>
        ))}
        {Array.from({ length: lead }, (_, i) => <span key={`e${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const jd = i + 1;
          const selected = sel && sel.jy === view.jy && sel.jm === view.jm && sel.jd === jd;
          const isToday = today.jy === view.jy && today.jm === view.jm && today.jd === jd;
          const friday = (lead + i) % 7 === 6;
          return (
            <button
              key={jd}
              type="button"
              aria-pressed={!!selected}
              aria-label={`${fa(jd)} ${JALALI_MONTHS[view.jm - 1]} ${fa(view.jy)}${isToday ? " (امروز)" : ""}`}
              onClick={() => pick(jd)}
              className={cn(
                "flex h-8 cursor-pointer items-center justify-center rounded-md text-sm transition-colors hover:bg-secondary",
                friday && "text-destructive",
                isToday && "ring-1 ring-brand-green",
                selected && "bg-primary font-bold text-primary-foreground hover:bg-primary",
              )}
            >
              {fa(jd)}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 border-t pt-3 text-sm" dir="ltr">
        <span className="me-auto text-muted-foreground" dir="rtl">ساعت (به وقت ایران)</span>
        <select aria-label="ساعت" value={hh} onChange={(e) => setTime(Number(e.target.value), mm)} className="h-8 rounded-md border bg-surface px-1">
          {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{fa(h, 2)}</option>)}
        </select>
        <span>:</span>
        <select aria-label="دقیقه" value={mm} onChange={(e) => setTime(hh, Number(e.target.value))} className="h-8 rounded-md border bg-surface px-1">
          {minutes.map((m) => <option key={m} value={m}>{fa(m, 2)}</option>)}
        </select>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setView({ jy: today.jy, jm: today.jm });
            onChange(build(today.jy, today.jm, today.jd, hh, mm));
          }}
        >
          امروز
        </Button>
        <Button type="button" size="sm" onClick={onDone}>تأیید</Button>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { JalaliDateTimeInput } from "@/components/ui/jalali-datetime-input";
import { adminCreateBooking } from "@/features/booking/admin-actions";
import { persianWeekday, shiftRange, WEEKDAY_LABELS } from "@/features/booking/rules";

/** Booking taken by phone or at the counter (confirmed, paid at the venue). */
export function ManualBookingDialog({ shifts, trigger }: { shifts: { id: string; title: string; weekdays: number[]; startMinute: number; endMinute: number }[]; trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [when, setWhen] = React.useState("");
  const [shiftId, setShiftId] = React.useState("");
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [guests, setGuests] = React.useState("");
  const [note, setNote] = React.useState("");
  const [code, setCode] = React.useState("");
  const [pending, start] = React.useTransition();
  const day = when.slice(0, 10);
  const options = day ? shifts.filter((s) => s.weekdays.includes(persianWeekday(day))) : [];
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>ثبت رزرو دستی (تلفنی / حضوری)</DialogTitle></DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await adminCreateBooking({ date: day, shiftId, name, phone, guests: guests || null, note, discountCode: code });
              if (!res.ok) return void toast.error(res.error);
              toast.success(res.message);
              setOpen(false);
              setName(""); setPhone(""); setGuests(""); setNote(""); setCode(""); setShiftId("");
              router.refresh();
            });
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="m-day">روز</Label>
            <JalaliDateTimeInput id="m-day" value={when} onChange={(v) => { setWhen(v); setShiftId(""); }} placeholder="انتخاب روز" defaultTime="12:00" />
            {day ? <p className="text-xs text-muted-foreground">{WEEKDAY_LABELS[persianWeekday(day)]} — ساعت انتخاب‌شده مهم نیست؛ ساعت از شیفت می‌آید.</p> : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="m-shift">شیفت</Label>
            <NativeSelect id="m-shift" value={shiftId} onChange={(e) => setShiftId(e.target.value)} disabled={!day}>
              <option value="">{day ? (options.length ? "انتخاب شیفت" : "در این روز شیفتی نیست") : "اول روز را انتخاب کنید"}</option>
              {options.map((s) => <option key={s.id} value={s.id}>{s.title} ({shiftRange(s.startMinute, s.endMinute)})</option>)}
            </NativeSelect>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5"><Label htmlFor="m-name">نام</Label><Input id="m-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></div>
            <div className="grid gap-1.5"><Label htmlFor="m-phone">شمارهٔ تماس</Label><Input id="m-phone" dir="ltr" className="text-start" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} /></div>
            <div className="grid gap-1.5"><Label htmlFor="m-guests">تعداد نفرات (اختیاری)</Label><Input id="m-guests" type="number" min={1} dir="ltr" className="text-start" value={guests} onChange={(e) => setGuests(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="m-code">کد تخفیف (اختیاری)</Label><Input id="m-code" dir="ltr" className="font-mono" value={code} onChange={(e) => setCode(e.target.value)} maxLength={40} /></div>
          </div>
          <div className="grid gap-1.5"><Label htmlFor="m-note">توضیحات</Label><Textarea id="m-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></div>
          <DialogFooter><Button type="submit" loading={pending} disabled={!shiftId}>ثبت رزرو</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

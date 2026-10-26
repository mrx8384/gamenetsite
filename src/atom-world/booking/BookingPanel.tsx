"use client";

import { useDialogFocus } from "../components/useDialogFocus";
import { useRef, useState, useSyncExternalStore } from "react";
import { SITE_URL } from "../config";
import { useMachines } from "../data/machines";
import { clubStore } from "../data/remoteMachines";
import { loadName, saveName } from "../minigames/scores";
import { useWorld, worldStore } from "../store";
import styles from "../styles/atomWorld.module.css";
import { type BookingErrors, type BookingRequest, bookingEnabled, nextDays, sendBooking, validateBooking } from "./booking";

const siteHref = (path: string) => `${SITE_URL.replace(/\/$/, "")}${path}`;

/** «ساعت کاری و رزرو»: opening hours and contact from the site; a booking request form when connected. */
export function BookingPanel() {
  const open = useWorld((s) => s.booking);
  if (!open) return null;
  return <Body machineId={open.machineId} />;
}

function Body({ machineId }: { machineId: string | null }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);
  const club = useSyncExternalStore(clubStore.subscribe, clubStore.get, clubStore.get);
  const machines = useMachines();
  const games = Object.values(machines).filter((m) => m.listed !== false && !m.noPrice && !m.travel);
  const [days] = useState(() => nextDays());
  const [form, setForm] = useState<BookingRequest>(() => ({ game: games.find((g) => g.id === machineId)?.id ?? games[0]?.id ?? "", day: days[0].iso, time: "", people: 2, name: loadName(), phone: "", note: "" }));
  const [errors, setErrors] = useState<BookingErrors>({});
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const close = () => worldStore.set({ booking: null });
  const set = <K extends keyof BookingRequest>(k: K, v: BookingRequest[K]) => setForm((f) => ({ ...f, [k]: v }));
  const phoneHref = (v: string) => `tel:${v.replace(/[\s-]/g, "")}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateBooking(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    saveName(form.name);
    setState("sending");
    setState((await sendBooking(form)) ? "sent" : "failed");
  };

  const field = (k: keyof BookingRequest) => (errors[k] ? { "aria-invalid": true, "aria-describedby": `aw-bk-${k}-err` } : {});
  const err = (k: keyof BookingRequest) =>
    errors[k] ? (
      <span id={`aw-bk-${k}-err`} className={styles.fieldError}>
        {errors[k]}
      </span>
    ) : null;

  return (
    <div className={styles.backdrop} onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <section className={styles.panel} ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="aw-booking-title" style={{ maxWidth: 560 }}>
        <div className={styles.panelHead}>
          <h2 id="aw-booking-title" className={styles.panelTitle}>
            📅 ساعت کاری و رزرو
          </h2>
          <button type="button" className={`${styles.btn} ${styles.iconBtn}`} aria-label="بستن" onClick={close} autoFocus>
            ✕
          </button>
        </div>

        <div className={styles.price}>
          <span>ساعت کاری</span>
          {club.hours ? <strong>{club.hours}</strong> : <span>ساعت کاری هنوز در سایت ثبت نشده است.</span>}
        </div>
        {club.address && (
          <p className={styles.desc}>
            📍 {club.address}
            {club.mapUrl && (
              <>
                {" "}
                <a className={styles.inlineLink} href={club.mapUrl} target="_blank" rel="noopener noreferrer">
                  نمایش روی نقشه ↗
                </a>
              </>
            )}
          </p>
        )}

        <div className={styles.sectionLabel}>رزرو تلفنی یا پیام</div>
        <div className={styles.panelActions} style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
          {club.phone && (
            <a className={styles.btn} href={phoneHref(club.phone)}>
              📞 تماس: <span dir="ltr">{club.phone}</span>
            </a>
          )}
          {club.mobile && (
            <a className={styles.btn} href={phoneHref(club.mobile)}>
              📱 <span dir="ltr">{club.mobile}</span>
            </a>
          )}
          {club.whatsapp && (
            <a className={styles.btn} href={club.whatsapp} target="_blank" rel="noopener noreferrer">
              💬 واتس‌اپ
            </a>
          )}
          {club.telegram && (
            <a className={styles.btn} href={club.telegram} target="_blank" rel="noopener noreferrer">
              ✈️ تلگرام
            </a>
          )}
          <a className={styles.btn} href={siteHref("/contact")}>
            صفحهٔ تماس سایت ↗
          </a>
        </div>

        {bookingEnabled() && (
          <>
            <div className={styles.sectionLabel}>درخواست رزرو آنلاین</div>
            {state === "sent" ? (
              <p className={styles.bookingDone} role="status">
                ✓ درخواست شما ثبت شد. این رزرو قطعی نیست؛ مجموعه برای تأیید با شمارهٔ شما تماس می‌گیرد.
              </p>
            ) : (
              <form className={styles.bookingForm} onSubmit={submit} noValidate onKeyDown={(e) => e.stopPropagation()}>
                <label>
                  بازی
                  <select value={form.game} onChange={(e) => set("game", e.target.value)} {...field("game")}>
                    {games.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.emoji} {g.name}
                      </option>
                    ))}
                  </select>
                  {err("game")}
                </label>
                <label>
                  روز
                  <select value={form.day} onChange={(e) => set("day", e.target.value)} {...field("day")}>
                    {days.map((d) => (
                      <option key={d.iso} value={d.iso}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                  {err("day")}
                </label>
                <label>
                  ساعت
                  <input type="time" value={form.time} onChange={(e) => set("time", e.target.value)} {...field("time")} />
                  {err("time")}
                </label>
                <label>
                  تعداد نفرات
                  <input type="number" min={1} max={20} inputMode="numeric" value={form.people} onChange={(e) => set("people", Number(e.target.value))} {...field("people")} />
                  {err("people")}
                </label>
                <label>
                  نام
                  <input value={form.name} maxLength={40} autoComplete="name" onChange={(e) => set("name", e.target.value)} {...field("name")} />
                  {err("name")}
                </label>
                <label>
                  شمارهٔ موبایل
                  <input value={form.phone} inputMode="tel" autoComplete="tel" placeholder="۰۹۱۲۳۴۵۶۷۸۹" dir="ltr" onChange={(e) => set("phone", e.target.value)} {...field("phone")} />
                  {err("phone")}
                </label>
                <label className={styles.bookingWide}>
                  توضیح (اختیاری)
                  <textarea rows={2} maxLength={300} value={form.note} onChange={(e) => set("note", e.target.value)} {...field("note")} />
                  {err("note")}
                </label>
                {state === "failed" && (
                  <p className={styles.fieldError} role="alert">
                    ارسال انجام نشد؛ اتصال اینترنت را بررسی کنید یا تماس بگیرید.
                  </p>
                )}
                <div className={`${styles.bookingWide} ${styles.panelActions}`}>
                  <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={state === "sending"}>
                    {state === "sending" ? "در حال ارسال…" : "ارسال درخواست رزرو"}
                  </button>
                </div>
                <p className={`${styles.bookingWide} ${styles.panelSub}`}>درخواست شما پس از تأیید تلفنی مجموعه قطعی می‌شود. شماره فقط برای تماس دربارهٔ همین رزرو است.</p>
              </form>
            )}
          </>
        )}
      </section>
    </div>
  );
}

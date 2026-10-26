"use client";
/* eslint-disable @next/next/no-img-element -- uploaded images and data: URLs, not optimisable assets */

import { useEffect, useState } from "react";
import { BASE_MACHINES, type MachineInfo } from "../data/machines";
import type { ClubInfo, MachineOverride } from "../data/overrideParsers";
import { EMPTY_CLUB } from "../data/overrideParsers";
import { ACHIEVEMENTS } from "../minigames/achievementList";
import { textSlots, type WorldConfig } from "../world/config";
import { ART_SLOTS } from "../world/slots";
import styles from "./admin.module.css";
import type { AdminBackend } from "./backend";

type Props = { draft: WorldConfig; onChange: (c: WorldConfig) => void; backend: AdminBackend; notify: (m: string) => void };

function groupBy<T>(list: T[], key: (t: T) => string) {
  const m = new Map<string, T[]>();
  for (const t of list) m.set(key(t), [...(m.get(key(t)) ?? []), t]);
  return [...m.entries()];
}

/** File picker that uploads (resized) and hands back the stored URL. */
function UploadButton({ label, backend, notify, onDone }: { label: string; backend: AdminBackend; notify: (m: string) => void; onDone: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <label className={`${styles.btn} ${styles.small} ${styles.fileBtn}`} aria-busy={busy}>
      {busy ? "در حال بارگذاری…" : label}
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={busy}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          try {
            onDone(await backend.upload(f));
          } catch {
            notify("بارگذاری تصویر انجام نشد. فقط PNG، JPEG یا WebP تا ۴ مگابایت.");
          } finally {
            setBusy(false);
          }
        }}
      />
    </label>
  );
}

// ── machines and services

const EDITABLE_MACHINES = Object.values(BASE_MACHINES).filter((m) => !m.travel && !m.opens);

export function MachinesEditor({ draft, onChange, backend, notify }: Props) {
  const set = (id: string, o: MachineOverride | null) => {
    const machines = { ...draft.machines };
    if (o && Object.keys(o).length) machines[id] = o;
    else delete machines[id];
    onChange({ ...draft, machines });
  };
  return (
    <>
      <p className={styles.note}>نام، توضیح، تعرفه و عکس هر بازی و خدمت را این‌جا تغییر دهید. خانهٔ خالی یعنی همان متن اصلی؛ تعرفهٔ خالی یعنی «هنوز ثبت نشده» (قیمتی ساخته نمی‌شود).</p>
      {EDITABLE_MACHINES.map((m) => (
        <MachineCard key={m.id} base={m} o={draft.machines[m.id] ?? {}} onSet={(o) => set(m.id, o)} backend={backend} notify={notify} />
      ))}
    </>
  );
}

function MachineCard({ base, o, onSet, backend, notify }: { base: MachineInfo; o: MachineOverride; onSet: (o: MachineOverride | null) => void; backend: AdminBackend; notify: (m: string) => void }) {
  const field = (k: "name" | "emoji" | "prompt" | "price", label: string, max: number) => (
    <label className={styles.field}>
      {label}
      <input
        className={styles.input}
        maxLength={max}
        value={o[k] ?? ""}
        placeholder={(k === "price" ? "ثبت نشده" : (base[k] as string | null)) ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          const n: MachineOverride = { ...o };
          if (v.trim()) (n as Record<string, string>)[k] = v;
          else delete n[k];
          onSet(n);
        }}
      />
    </label>
  );
  const photos = o.photos ?? base.photos;
  return (
    <section className={`${styles.card} ${Object.keys(o).length ? styles.changed : ""}`}>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>
          {o.emoji ?? base.emoji} {o.name ?? base.name}
        </h3>
        {Object.keys(o).length > 0 && (
          <button type="button" className={`${styles.btn} ${styles.small}`} onClick={() => onSet(null)}>
            ↩ متن اصلی
          </button>
        )}
      </div>
      <div className={styles.grid2}>
        {field("name", "نام", 80)}
        {field("emoji", "شکلک", 8)}
        {field("prompt", "پیام نزدیک شدن", 80)}
        {!base.noPrice && field("price", "تعرفه", 160)}
      </div>
      <label className={styles.field}>
        توضیح
        <textarea
          className={styles.input}
          maxLength={1500}
          value={o.description ?? ""}
          placeholder={base.description}
          onChange={(e) => {
            const n: MachineOverride = { ...o };
            if (e.target.value.trim()) n.description = e.target.value;
            else delete n.description;
            onSet(n);
          }}
        />
      </label>
      <label className={styles.row} style={{ marginBottom: 10, fontSize: "0.9rem" }}>
        <input
          type="checkbox"
          checked={(o.listed ?? base.listed) !== false}
          onChange={(e) => {
            const n: MachineOverride = { ...o };
            if (e.target.checked === (base.listed !== false)) delete n.listed;
            else n.listed = e.target.checked;
            onSet(n);
          }}
        />
        در فهرست «بازی‌ها و خدمات مجموعه» نشان داده شود
      </label>
      <div className={styles.field}>
        عکس‌ها
        <div className={styles.photoRow}>
          {photos.map((p, i) => (
            <figure key={`${p.src}${i}`}>
              <img src={p.src} alt={p.alt} />
              <button
                type="button"
                className={`${styles.btn} ${styles.small} ${styles.danger}`}
                style={{ width: "100%", marginTop: 4 }}
                onClick={() => onSet({ ...o, photos: photos.filter((_, j) => j !== i) })}
              >
                حذف
              </button>
            </figure>
          ))}
        </div>
        <div className={styles.row}>
          {photos.length < 8 && <UploadButton label="➕ افزودن عکس" backend={backend} notify={notify} onDone={(src) => onSet({ ...o, photos: [...photos, { src, alt: o.name ?? base.name }] })} />}
          {o.photos && (
            <button
              type="button"
              className={`${styles.btn} ${styles.small}`}
              onClick={() => {
                const n = { ...o };
                delete n.photos;
                onSet(n);
              }}
            >
              ↩ عکس‌های اصلی
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

// ── wall art

export function ArtEditor({ draft, onChange, backend, notify }: Props) {
  const set = (id: string, url: string | null) => {
    const art = { ...draft.art };
    if (url) art[id] = url;
    else delete art[id];
    onChange({ ...draft, art });
  };
  return (
    <>
      <p className={styles.note}>هر نقاشی یا تصویر دیواری را با عکس تازه عوض کنید؛ بهتر است تصویر هم‌اندازهٔ دیوار باشد (نسبت عرض به ارتفاع زیر هر مورد نوشته شده).</p>
      {groupBy(ART_SLOTS, (s) => s.place).map(([place, slots]) => (
        <section key={place}>
          <h3 className={styles.cardTitle} style={{ margin: "14px 0 8px" }}>
            {place}
          </h3>
          <div className={styles.grid2}>
            {slots.map((s) => (
              <div key={s.id} className={`${styles.card} ${draft.art[s.id] ? styles.changed : ""}`}>
                <img className={styles.thumb} src={draft.art[s.id] ?? s.default} alt={s.label} />
                <div className={styles.cardHead}>
                  <p className={styles.cardTitle}>{s.label}</p>
                  <span className={styles.status}>نسبت ≈ {s.aspect.toLocaleString("fa-IR")}:۱</span>
                </div>
                <div className={styles.row}>
                  <UploadButton label="🖼 تغییر تصویر" backend={backend} notify={notify} onDone={(url) => set(s.id, url)} />
                  {draft.art[s.id] && (
                    <button type="button" className={`${styles.btn} ${styles.small}`} onClick={() => set(s.id, null)}>
                      ↩ تصویر اصلی
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

// ── texts

export function TextsEditor({ draft, onChange }: Props) {
  const set = (id: string, v: string) => {
    const texts = { ...draft.texts };
    if (v.trim()) texts[id] = v;
    else delete texts[id];
    onChange({ ...draft, texts });
  };
  return (
    <>
      <p className={styles.note}>نوشته‌های داخل دنیا (تابلوها، تختهٔ گچی) و نام بخش‌ها در نوار بالا، نقشه و منو. خانهٔ خالی یعنی همان متن اصلی.</p>
      {groupBy(textSlots(), (s) => s.place).map(([place, slots]) => (
        <section key={place} className={styles.card}>
          <h3 className={styles.cardTitle} style={{ marginBottom: 8 }}>
            {place}
          </h3>
          <div className={styles.grid2}>
            {slots.map((s) => (
              <label key={s.id} className={styles.field}>
                {s.label}
                <input className={styles.input} maxLength={s.max} value={draft.texts[s.id] ?? ""} placeholder={s.default} onChange={(e) => set(s.id, e.target.value)} />
              </label>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

// ── club info and prizes

const CLUB_FIELDS: [keyof ClubInfo, string, string][] = [
  ["hours", "ساعت کاری", "شنبه تا پنجشنبه، ۱۰ تا ۲۲"],
  ["phone", "تلفن", ""],
  ["mobile", "موبایل", ""],
  ["whatsapp", "لینک واتساپ (https://…)", ""],
  ["telegram", "لینک تلگرام (https://…)", ""],
  ["address", "نشانی", ""],
  ["mapUrl", "لینک نقشه (https://…)", ""],
];

export function ClubEditor({ draft, onChange }: Props) {
  const club = draft.club ?? EMPTY_CLUB;
  return (
    <>
      <p className={styles.note}>اطلاعاتی که در بخش «ساعت کاری و رزرو» و تماس نشان داده می‌شود، و جایزهٔ هر دستاورد مینی‌گیم‌ها. فقط اطلاعات واقعی مجموعه را وارد کنید.</p>
      <section className={styles.card}>
        <h3 className={styles.cardTitle} style={{ marginBottom: 8 }}>
          اطلاعات تماس و ساعت کاری
        </h3>
        <div className={styles.grid2}>
          {CLUB_FIELDS.map(([k, label, ph]) => (
            <label key={k} className={styles.field}>
              {label}
              <input
                className={styles.input}
                value={club[k]}
                placeholder={ph}
                dir={k === "hours" || k === "address" ? "rtl" : "ltr"}
                onChange={(e) => {
                  const next = { ...club, [k]: e.target.value };
                  onChange({ ...draft, club: Object.values(next).some((v) => v.trim()) ? next : null });
                }}
              />
            </label>
          ))}
        </div>
      </section>
      <section className={styles.card}>
        <h3 className={styles.cardTitle} style={{ marginBottom: 8 }}>
          جایزهٔ دستاوردها
        </h3>
        <div className={styles.grid2}>
          {ACHIEVEMENTS.map((a) => (
            <label key={a.id} className={styles.field}>
              {a.emoji} {a.title}
              <input
                className={styles.input}
                maxLength={120}
                value={draft.rewards[a.id] ?? ""}
                placeholder="بدون جایزه"
                onChange={(e) => {
                  const rewards = { ...draft.rewards };
                  if (e.target.value.trim()) rewards[a.id] = e.target.value;
                  else delete rewards[a.id];
                  onChange({ ...draft, rewards });
                }}
              />
            </label>
          ))}
        </div>
      </section>
    </>
  );
}

// ── versions

export function VersionsPanel({ backend, onRestored, notify }: { backend: AdminBackend; onRestored: (c: WorldConfig) => void; notify: (m: string) => void }) {
  const [list, setList] = useState<{ id: string; updatedAt: string }[] | null>(null);
  useEffect(() => {
    let live = true;
    backend
      .versions()
      .then((v) => live && setList(v))
      .catch(() => live && setList([]));
    return () => {
      live = false;
    };
  }, [backend]);
  if (!list) return <p className={styles.status}>در حال دریافت…</p>;
  return (
    <>
      <p className={styles.note}>هر بار «ذخیره و انتشار»، نسخهٔ قبلی این‌جا نگه داشته می‌شود ({backend.mode === "local" ? "۵" : "۲۰"} نسخهٔ آخر). با بازگرداندن، آن نسخه دوباره منتشر می‌شود.</p>
      {list.length === 0 && <p className={styles.status}>هنوز نسخهٔ قبلی‌ای نیست.</p>}
      {list.map((v) => (
        <div key={v.id} className={`${styles.card} ${styles.row}`}>
          <span style={{ flex: 1 }}>{new Date(v.updatedAt).toLocaleString("fa-IR")}</span>
          <button
            type="button"
            className={`${styles.btn} ${styles.small}`}
            onClick={async () => {
              if (!window.confirm("این نسخه دوباره منتشر شود؟")) return;
              const c = await backend.restore(v.id);
              if (c) {
                onRestored(c);
                notify("نسخهٔ انتخاب‌شده منتشر شد.");
              } else notify("بازگرداندن انجام نشد.");
            }}
          >
            ↩ بازگرداندن
          </button>
        </div>
      ))}
    </>
  );
}

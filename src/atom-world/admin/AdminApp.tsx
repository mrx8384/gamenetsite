"use client";

import { useCallback, useEffect, useState } from "react";
import { EMPTY_WORLD_CONFIG, type WorldConfig } from "../world/config";
import styles from "./admin.module.css";
import { type AdminSession, backend } from "./backend";
import { ArtEditor, ClubEditor, MachinesEditor, TextsEditor, VersionsPanel } from "./ContentEditors";
import { LayoutEditor } from "./LayoutEditor";

/**
 * World editor of ATOM World (/atom-world/admin): the club's manager changes the 3D world without
 * code — where every movable item stands (and adds new ones), the machines' info, wall art, sign
 * texts, contact info and prizes. «ذخیره و انتشار» publishes it for every visitor.
 */
const TABS = [
  ["layout", "🧭 چیدمان"],
  ["machines", "🎮 بازی‌ها و خدمات"],
  ["art", "🖼 نقاشی‌ها"],
  ["texts", "🔤 نوشته‌ها"],
  ["club", "☎️ مجموعه و جوایز"],
  ["versions", "🕘 نسخه‌ها"],
] as const;
type Tab = (typeof TABS)[number][0];

const DRAFT_KEY = "atom-world:admin-draft";

function readDraft(): { base: string | null; draft: WorldConfig } | null {
  try {
    const v = window.localStorage.getItem(DRAFT_KEY);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}
function writeDraft(base: string | null, draft: WorldConfig | null) {
  try {
    if (draft) window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ base, draft }));
    else window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* storage full / private mode: the draft lives only in this page */
  }
}

export function AdminApp() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [saved, setSaved] = useState<WorldConfig | null>(null);
  const [draft, setDraft] = useState<WorldConfig>(EMPTY_WORLD_CONFIG);
  const [tab, setTab] = useState<Tab>("layout");
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const notify = useCallback((m: string) => setToast(m), []);
  const dirty = saved !== null && JSON.stringify(saved) !== JSON.stringify(draft);

  const load = useCallback(async () => {
    const cfg = await backend.load();
    setSaved(cfg);
    const d = readDraft();
    if (d && d.base === cfg.updatedAt && JSON.stringify(d.draft) !== JSON.stringify(cfg)) {
      setDraft(d.draft);
      setRestoredDraft(true);
    } else setDraft(cfg);
  }, []);

  useEffect(() => {
    backend
      .session()
      .then((s) => {
        setSession(s);
        if (s.admin) void load();
      })
      .catch(() => setSession({ enabled: false, admin: false }));
  }, [load]);

  // unsaved work survives a reload of the phone's browser
  useEffect(() => {
    if (!saved) return;
    writeDraft(saved.updatedAt, dirty ? draft : null);
  }, [draft, saved, dirty]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  if (!session) return <div className={styles.root} />;
  if (!session.enabled)
    return (
      <div className={styles.root}>
        <div className={styles.login}>
          <h1 className={styles.title}>ویرایش دنیای سه‌بعدی اتم</h1>
          <p className={styles.note}>ویرایشگر روی این سرور خاموش است. برای روشن کردن، رمز مدیر را در تنظیمات سرور (ATOM_WORLD_ADMIN_PASSWORD، دست‌کم ۱۰ حرف) قرار دهید.</p>
        </div>
      </div>
    );
  if (!session.admin && session.loginUrl && !session.password) return <SiteLogin loginUrl={session.loginUrl} />;
  if (!session.admin) return <Login siteLoginUrl={session.loginUrl} onDone={() => setSession({ ...session, admin: true })} onLoad={load} />;

  const save = async () => {
    setSaving(true);
    try {
      const cfg = await backend.save(draft);
      setSaved(cfg);
      setDraft(cfg);
      setRestoredDraft(false);
      notify(backend.mode === "local" ? "ذخیره شد (فقط روی همین دستگاه)." : "ذخیره و منتشر شد؛ بازدیدکننده‌ها در ورود بعدی آن را می‌بینند.");
    } catch (e) {
      notify((e as { status?: number }).status === 401 ? "ورود شما منقضی شده؛ دوباره وارد شوید." : "ذخیره انجام نشد. اتصال را بررسی کنید و دوباره بزنید.");
      if ((e as { status?: number }).status === 401) setSession({ ...session, admin: false });
    } finally {
      setSaving(false);
    }
  };

  const openWorld = () => {
    if (backend.mode === "local") {
      // the stand-alone preview: the world reads the saved config on a fresh start
      window.location.hash = "";
      window.location.reload();
    } else window.open("/atom-world", "_blank", "noopener");
  };

  const props = { draft, onChange: setDraft, backend, notify };
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <h1 className={styles.title}>ویرایش دنیای سه‌بعدی اتم</h1>
        <span className={`${styles.status} ${dirty ? styles.dirty : ""}`} role="status">
          {saved === null ? "در حال دریافت…" : dirty ? "● تغییرات ذخیره‌نشده" : saved.updatedAt ? `ذخیره‌شده ${new Date(saved.updatedAt).toLocaleString("fa-IR")}` : "هنوز تغییری ذخیره نشده"}
        </span>
        <button type="button" className={`${styles.btn} ${styles.primary}`} disabled={!dirty || saving} onClick={save}>
          {saving ? "در حال ذخیره…" : "💾 ذخیره و انتشار"}
        </button>
        {dirty && (
          <button type="button" className={styles.btn} onClick={() => saved && setDraft(saved)}>
            ✕ لغو تغییرات
          </button>
        )}
        <button type="button" className={styles.btn} onClick={openWorld} disabled={backend.mode === "local" && dirty}>
          👁 دیدن در دنیا
        </button>
        {backend.mode === "server" && session.password && (
          <button
            type="button"
            className={styles.btn}
            onClick={async () => {
              await backend.logout();
              // on the site, a logged-in site ADMIN stays in the editor
              setSession(await backend.session().catch(() => ({ ...session, admin: false })));
            }}
          >
            خروج
          </button>
        )}
      </header>
      <nav className={styles.tabs} role="tablist" aria-label="بخش‌های ویرایشگر">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" className={styles.tab} aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      <main className={styles.main}>
        {backend.mode === "local" && <p className={`${styles.note} ${styles.warnNote}`}>این پیش‌نمایش سرور ندارد: تغییرات فقط روی همین دستگاه ذخیره می‌شود و فقط شما آن را در دنیا می‌بینید. روی سایت، مدیر وارد می‌شود و تغییرات برای همه منتشر می‌شود.</p>}
        {restoredDraft && dirty && <p className={styles.note}>تغییرات ذخیره‌نشدهٔ دفعهٔ قبل برگردانده شد. برای انتشار «ذخیره و انتشار» را بزنید یا «لغو تغییرات».</p>}
        {saved === null ? (
          <p className={styles.status}>در حال دریافت…</p>
        ) : tab === "layout" ? (
          <LayoutEditor draft={draft} onChange={setDraft} />
        ) : tab === "machines" ? (
          <MachinesEditor {...props} />
        ) : tab === "art" ? (
          <ArtEditor {...props} />
        ) : tab === "texts" ? (
          <TextsEditor {...props} />
        ) : tab === "club" ? (
          <ClubEditor {...props} />
        ) : (
          <VersionsPanel
            backend={backend}
            notify={notify}
            onRestored={(c) => {
              setSaved(c);
              setDraft(c);
            }}
          />
        )}
      </main>
      {toast && (
        <div className={styles.toast} role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

/** On the main site: the editor is for the site's ADMIN accounts; log in on the site's own page. */
function SiteLogin({ loginUrl }: { loginUrl: string }) {
  return (
    <div className={styles.root}>
      <div className={styles.login}>
        <h1 className={styles.title} style={{ marginBottom: 12 }}>
          ویرایش دنیای سه‌بعدی اتم
        </h1>
        <p className={styles.note}>فقط مدیر سایت می‌تواند دنیا را ویرایش کند. با حساب مدیر وارد شوید؛ بعد از ورود به همین صفحه برمی‌گردید.</p>
        <a className={`${styles.btn} ${styles.primary}`} href={loginUrl} style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
          ورود با حساب مدیر سایت
        </a>
      </div>
    </div>
  );
}

function Login({ onDone, onLoad, siteLoginUrl }: { onDone: () => void; onLoad: () => Promise<void>; siteLoginUrl?: string }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className={styles.root}>
      <form
        className={styles.login}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const r = await backend.login(pw);
          setBusy(false);
          if (r === "ok") {
            onDone();
            await onLoad();
          } else setErr(r === "wrong" ? "رمز درست نیست." : r === "rate" ? "تلاش زیاد؛ یک دقیقه بعد دوباره امتحان کنید." : "ورود ممکن نشد.");
        }}
      >
        <h1 className={styles.title} style={{ marginBottom: 12 }}>
          ویرایش دنیای سه‌بعدی اتم
        </h1>
        <label className={styles.field}>
          رمز مدیر
          <input className={styles.input} type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        </label>
        {err && (
          <p className={`${styles.note} ${styles.warnNote}`} role="alert">
            {err}
          </p>
        )}
        <button type="submit" className={`${styles.btn} ${styles.primary}`} disabled={busy || !pw} style={{ width: "100%" }}>
          ورود
        </button>
        {siteLoginUrl && (
          <a className={styles.btn} href={siteLoginUrl} style={{ display: "block", textAlign: "center", textDecoration: "none", marginTop: 8 }}>
            یا ورود با حساب مدیر سایت
          </a>
        )}
      </form>
    </div>
  );
}

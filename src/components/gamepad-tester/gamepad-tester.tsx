"use client";

import * as React from "react";
import { CheckCircle2, ClipboardCopy, Gamepad2, RotateCcw, ShieldAlert, Timer, Vibrate } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buttonLabel,
  circularity,
  CIRCULARITY_LABELS,
  controllerFamily,
  controllerModel,
  DRIFT_LABELS,
  driftVerdict,
  magnitude,
  type CircularityResult,
  type ControllerFamily,
  type DriftVerdict,
} from "@/features/gamepad-tester/analysis";
import { cn } from "@/lib/utils";

interface PadSnapshot {
  index: number;
  id: string;
  mapping: string;
  buttons: { pressed: boolean; value: number }[];
  axes: number[];
  canVibrate: boolean;
}

interface StickResults {
  drift: [number, number] | null;
  circle: [CircularityResult, CircularityResult] | null;
}

const fa = (n: number) => n.toLocaleString("fa-IR");
const DRIFT_MS = 3000;

function snapshot(p: Gamepad): PadSnapshot {
  return {
    index: p.index,
    id: p.id,
    mapping: p.mapping,
    buttons: p.buttons.map((b) => ({ pressed: b.pressed, value: b.value })),
    axes: [...p.axes],
    canVibrate: Boolean(p.vibrationActuator),
  };
}

type Support = "checking" | "ok" | "insecure" | "unsupported";
const noopSubscribe = () => () => {};
function readSupport(): Support {
  if (!window.isSecureContext) return "insecure";
  return typeof navigator.getGamepads === "function" ? "ok" : "unsupported";
}

/** Browser-based controller test (Gamepad API): buttons, triggers, sticks, drift, range and vibration. */
export function GamepadTester() {
  const supported = React.useSyncExternalStore<Support>(noopSubscribe, readSupport, () => "checking");
  const [pads, setPads] = React.useState<PadSnapshot[]>([]);
  const [selected, setSelected] = React.useState<number | null>(null);
  const [tested, setTested] = React.useState<Record<string, number[]>>({});
  const [results, setResults] = React.useState<Record<string, StickResults>>({});
  const [mode, setMode] = React.useState<"idle" | "drift" | "circle">("idle");
  const [driftLeft, setDriftLeft] = React.useState(0);
  const [vibrated, setVibrated] = React.useState<Record<string, boolean>>({});
  const [traces, setTraces] = React.useState<{ l: { x: number; y: number }[]; r: { x: number; y: number }[] }>({ l: [], r: [] });
  const driftRef = React.useRef<{ until: number; max: [number, number] }>({ until: 0, max: [0, 0] });
  const modeRef = React.useRef(mode);
  const selectedRef = React.useRef(selected);
  React.useEffect(() => {
    modeRef.current = mode;
    selectedRef.current = selected;
  }, [mode, selected]);

  // Poll the Gamepad API every animation frame.
  React.useEffect(() => {
    if (supported !== "ok") return;
    let frame = 0;
    const loop = () => {
      const list = Array.from(navigator.getGamepads?.() ?? []).filter((p): p is Gamepad => Boolean(p && p.connected));
      const snaps = list.map(snapshot);
      setPads(snaps);
      setSelected((cur) => (cur !== null && snaps.some((s) => s.index === cur) ? cur : (snaps[0]?.index ?? null)));
      // Mark pressed buttons as tested.
      if (snaps.length) {
        setTested((prev) => {
          let next = prev;
          for (const s of snaps) {
            const have = new Set(prev[s.id] ?? []);
            let changed = false;
            s.buttons.forEach((b, i) => {
              if ((b.pressed || b.value > 0.5) && !have.has(i)) {
                have.add(i);
                changed = true;
              }
            });
            if (changed) next = { ...next, [s.id]: [...have] };
          }
          return next;
        });
      }
      sample(snaps.find((p) => p.index === selectedRef.current) ?? snaps[0]);
      frame = requestAnimationFrame(loop);
    };
    // Records stick samples for the running test (drift / range).
    const sample = (p: PadSnapshot | undefined) => {
      if (!p) return;
      const [lx = 0, ly = 0, rx = 0, ry = 0] = p.axes;
      if (modeRef.current === "circle") {
        setTraces((t) => ({ l: [...t.l, { x: lx, y: ly }].slice(-4000), r: [...t.r, { x: rx, y: ry }].slice(-4000) }));
      } else if (modeRef.current === "drift") {
        const d = driftRef.current;
        d.max = [Math.max(d.max[0], magnitude(lx, ly)), Math.max(d.max[1], magnitude(rx, ry))];
        const left = d.until - performance.now();
        setDriftLeft(Math.max(0, left));
        if (left <= 0) {
          const max: [number, number] = [d.max[0], d.max[1]];
          modeRef.current = "idle";
          setResults((r) => ({ ...r, [p.id]: { circle: r[p.id]?.circle ?? null, drift: max } }));
          setMode("idle");
        }
      }
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [supported]);

  const pad = pads.find((p) => p.index === selected) ?? null;
  const family: ControllerFamily = pad ? controllerFamily(pad.id) : "generic";
  const lx = pad?.axes[0] ?? 0;
  const ly = pad?.axes[1] ?? 0;
  const rx = pad?.axes[2] ?? 0;
  const ry = pad?.axes[3] ?? 0;

  function startDrift() {
    driftRef.current = { until: performance.now() + DRIFT_MS, max: [0, 0] };
    modeRef.current = "drift";
    setDriftLeft(DRIFT_MS);
    setMode("drift");
  }
  function startCircle() {
    setTraces({ l: [], r: [] });
    setMode("circle");
  }
  function finishCircle() {
    if (!pad) return;
    const res: [CircularityResult, CircularityResult] = [circularity(traces.l), circularity(traces.r)];
    setResults((r) => ({ ...r, [pad.id]: { drift: r[pad.id]?.drift ?? null, circle: res } }));
    setMode("idle");
  }
  async function vibrate(strong: number, weak: number, duration: number) {
    if (!pad) return;
    const live = navigator.getGamepads?.()[pad.index];
    const act = live?.vibrationActuator;
    if (!act) return void toast.error("مرورگر یا این دسته از لرزش پشتیبانی نمی‌کند.");
    try {
      await act.playEffect("dual-rumble", { startDelay: 0, duration, strongMagnitude: strong, weakMagnitude: weak });
      setVibrated((v) => ({ ...v, [pad.id]: true }));
    } catch {
      toast.error("اجرای لرزش ناموفق بود.");
    }
  }
  function reset() {
    if (!pad) return;
    setTested((t) => ({ ...t, [pad.id]: [] }));
    setResults((r) => ({ ...r, [pad.id]: { drift: null, circle: null } }));
    setVibrated((v) => ({ ...v, [pad.id]: false }));
    setTraces({ l: [], r: [] });
    setMode("idle");
  }

  if (supported === "checking") return null;
  if (supported !== "ok") {
    return (
      <Card className="border-destructive/30">
        <CardContent className="flex items-start gap-3 text-start">
          <ShieldAlert className="mt-1 size-5 shrink-0 text-destructive" />
          <div className="space-y-1 text-sm leading-7">
            {supported === "insecure" ? (
              <>
                <p className="font-bold">این ابزار فقط روی اتصال امن (HTTPS) کار می‌کند.</p>
                <p className="text-muted-foreground">مرورگرها دسترسی به دسته را فقط روی آدرس‌های https می‌دهند. سایت را با دامنه و https باز کنید.</p>
              </>
            ) : (
              <>
                <p className="font-bold">مرورگر شما از تست دسته پشتیبانی نمی‌کند.</p>
                <p className="text-muted-foreground">از نسخهٔ جدید Chrome یا Edge استفاده کنید.</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!pad) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <Gamepad2 className="size-12 animate-pulse text-brand-green-deep" aria-hidden />
          <p className="text-lg font-bold" aria-live="polite">منتظر اتصال دسته…</p>
          <p className="max-w-md text-sm leading-7 text-muted-foreground">
            دسته را با کابل USB یا بلوتوث به همین دستگاه وصل کنید و <strong>یک دکمه را بزنید</strong> تا شناسایی شود. بهترین نتیجه در Chrome یا Edge است.
          </p>
        </CardContent>
      </Card>
    );
  }

  const testedSet = new Set(tested[pad.id] ?? []);
  const res = results[pad.id] ?? { drift: null, circle: null };
  const total = pad.buttons.length;
  const nonStandard = pad.mapping !== "standard";

  const reportText = [
    `گزارش تست دسته — ${controllerModel(pad.id) ?? pad.id}`,
    `دکمه‌ها: ${fa(testedSet.size)} از ${fa(total)} تست شد${testedSet.size < total ? ` (تست‌نشده: ${pad.buttons.map((_, i) => i).filter((i) => !testedSet.has(i)).map((i) => buttonLabel(family, i)).join("، ")})` : ""}`,
    res.drift ? `دریفت استیک چپ: ${DRIFT_LABELS[driftVerdict(res.drift[0])]} (${res.drift[0].toFixed(3)}) — استیک راست: ${DRIFT_LABELS[driftVerdict(res.drift[1])]} (${res.drift[1].toFixed(3)})` : "دریفت: تست نشده",
    res.circle ? `دامنهٔ استیک چپ: ${CIRCULARITY_LABELS[res.circle[0].verdict]} — استیک راست: ${CIRCULARITY_LABELS[res.circle[1].verdict]}` : "دامنهٔ حرکت: تست نشده",
    `لرزش: ${pad.canVibrate ? (vibrated[pad.id] ? "اجرا شد (با حس بررسی شود)" : "تست نشده") : "پشتیبانی نمی‌شود"}`,
  ].join("\n");

  return (
    <div className="space-y-4 text-start">
      {/* Controller picker + summary */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="flex flex-wrap items-center gap-2 font-bold">
              <Gamepad2 className="size-5 text-brand-green-deep" />
              {controllerModel(pad.id) ?? "دسته متصل است"}
              <Badge variant="success">متصل</Badge>
            </p>
            <p className="ltr truncate text-start text-xs text-muted-foreground" title={pad.id}>{pad.id}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {pads.length > 1 ? (
              <select className="h-9 rounded-lg border bg-surface px-2 text-sm" value={pad.index} onChange={(e) => setSelected(Number(e.target.value))} aria-label="انتخاب دسته">
                {pads.map((p) => (
                  <option key={p.index} value={p.index}>{`${fa(p.index + 1)}. ${controllerModel(p.id) ?? p.id.slice(0, 30)}`}</option>
                ))}
              </select>
            ) : null}
            <Button variant="outline" size="sm" onClick={reset}><RotateCcw /> شروع دوباره</Button>
          </div>
        </CardContent>
      </Card>
      {nonStandard ? (
        <p className="rounded-lg bg-warning-soft p-3 text-sm text-warning">این دسته نقشهٔ استاندارد ندارد؛ نام دکمه‌ها ممکن است با دسته مطابقت نداشته باشد.</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Buttons */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              دکمه‌ها
              <span className="text-sm font-normal text-muted-foreground">{fa(testedSet.size)} از {fa(total)} تست شد</span>
            </CardTitle>
            <CardDescription>همهٔ دکمه‌ها را یکی‌یکی بزنید؛ دکمه‌هایی که کار کنند سبز می‌مانند.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="h-2 overflow-hidden rounded-full bg-secondary" aria-hidden>
              <div className="h-full bg-brand-green transition-[width]" style={{ width: `${(testedSet.size / Math.max(1, total)) * 100}%` }} />
            </div>
            {/* Triggers */}
            <div className="grid grid-cols-2 gap-4" dir="ltr">
              {[6, 7].map((i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs"><span className="font-bold">{buttonLabel(family, i)}</span><span>{Math.round((pad.buttons[i]?.value ?? 0) * 100)}%</span></div>
                  <div className="h-3 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-brand-yellow" style={{ width: `${(pad.buttons[i]?.value ?? 0) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2" dir="ltr">
              {pad.buttons.map((b, i) => (
                <span
                  key={i}
                  className={cn(
                    "flex h-11 min-w-11 items-center justify-center rounded-lg border px-2 text-sm font-bold transition-colors",
                    b.pressed || b.value > 0.5 ? "border-brand-black bg-brand-black text-brand-cream scale-95" : testedSet.has(i) ? "border-brand-green bg-success-soft text-success" : "bg-surface text-muted-foreground",
                  )}
                  aria-label={`${buttonLabel(family, i)}${testedSet.has(i) ? " — تست شد" : ""}`}
                >
                  {buttonLabel(family, i)}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Vibration + report */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Vibrate className="size-5" /> لرزش</CardTitle>
              <CardDescription>{pad.canVibrate ? "موتورهای لرزش را جداگانه امتحان کنید." : "مرورگر یا این دسته از لرزش پشتیبانی نمی‌کند."}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2">
              <Button variant="outline" size="sm" disabled={!pad.canVibrate} onClick={() => vibrate(0, 1, 700)}>ضعیف</Button>
              <Button variant="outline" size="sm" disabled={!pad.canVibrate} onClick={() => vibrate(1, 0, 700)}>قوی</Button>
              <Button variant="outline" size="sm" disabled={!pad.canVibrate} onClick={() => vibrate(1, 1, 1500)}>هر دو</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">گزارش</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <pre className="whitespace-pre-wrap rounded-lg bg-secondary p-3 font-sans text-xs leading-6">{reportText}</pre>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => navigator.clipboard?.writeText(`${reportText}\nتاریخ: ${new Date().toLocaleString("fa-IR")}`).then(() => toast.success("گزارش کپی شد."), () => toast.error("کپی ناموفق بود."))}
              >
                <ClipboardCopy /> کپی گزارش
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sticks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">آنالوگ‌ها (استیک‌ها)</CardTitle>
          <CardDescription>دایرهٔ کوچک وسط محدودهٔ مرده (Deadzone) است؛ در حالت رها، نقطه باید داخل آن بماند.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-6 sm:grid-cols-2" dir="ltr">
            <Stick label={buttonLabel(family, 10)} x={lx} y={ly} pressed={pad.buttons[10]?.pressed} trace={mode === "circle" ? traces.l : null} drift={res.drift?.[0]} circle={res.circle?.[0]} />
            <Stick label={buttonLabel(family, 11)} x={rx} y={ry} pressed={pad.buttons[11]?.pressed} trace={mode === "circle" ? traces.r : null} drift={res.drift?.[1]} circle={res.circle?.[1]} />
          </div>
          <div className="flex flex-wrap gap-2">
            {mode === "drift" ? (
              <p className="flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm font-bold text-warning" aria-live="polite">
                <Timer className="size-4" /> به استیک‌ها دست نزنید… {fa(Math.ceil(driftLeft / 1000))}
              </p>
            ) : mode === "circle" ? (
              <>
                <p className="rounded-lg bg-info-soft px-3 py-2 text-sm text-info">هر دو استیک را چند دور کامل، تا لبه، بچرخانید.</p>
                <Button onClick={finishCircle}><CheckCircle2 /> پایان تست دامنه</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={startDrift}><Timer /> تست دریفت (۳ ثانیه)</Button>
                <Button variant="outline" onClick={startCircle}><RotateCcw /> تست دامنهٔ حرکت</Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stick({ label, x, y, pressed, trace, drift, circle }: { label: string; x: number; y: number; pressed?: boolean; trace: { x: number; y: number }[] | null; drift?: number; circle?: CircularityResult }) {
  const S = 160;
  const c = S / 2;
  const R = S / 2 - 8;
  const px = c + Math.max(-1.2, Math.min(1.2, x)) * R;
  const py = c + Math.max(-1.2, Math.min(1.2, y)) * R;
  const verdict: DriftVerdict | null = drift === undefined ? null : driftVerdict(drift);
  return (
    <div className="flex items-start gap-4">
      <svg viewBox={`0 0 ${S} ${S}`} className="size-40 shrink-0" role="img" aria-label={`استیک ${label}: X ${x.toFixed(2)}، Y ${y.toFixed(2)}`}>
        <circle cx={c} cy={c} r={R} className="fill-secondary stroke-border" strokeWidth={2} />
        <circle cx={c} cy={c} r={R * 0.1} className="fill-none stroke-muted-foreground" strokeDasharray="3 3" />
        <line x1={c} y1={8} x2={c} y2={S - 8} className="stroke-border" />
        <line x1={8} y1={c} x2={S - 8} y2={c} className="stroke-border" />
        {trace && trace.length > 1 ? (
          <polyline points={trace.map((p) => `${c + p.x * R},${c + p.y * R}`).join(" ")} className="fill-none stroke-brand-green" strokeWidth={1.5} opacity={0.7} />
        ) : null}
        <circle cx={px} cy={py} r={9} className={pressed ? "fill-brand-black" : "fill-brand-green"} />
      </svg>
      <div className="space-y-1 text-xs">
        <p className="text-sm font-bold">{label}</p>
        <p>X: {x.toFixed(3)}</p>
        <p>Y: {y.toFixed(3)}</p>
        <p>|r|: {magnitude(x, y).toFixed(3)}</p>
        {verdict ? (
          <p dir="rtl" className={cn("font-bold", verdict === "drift" ? "text-destructive" : "text-success")}>{DRIFT_LABELS[verdict]} ({drift!.toFixed(3)})</p>
        ) : null}
        {circle ? (
          <p dir="rtl" className={cn("font-bold", circle.verdict === "complete" ? "text-success" : "text-warning")}>
            {CIRCULARITY_LABELS[circle.verdict]} — پوشش {Math.round(circle.coverage * 100).toLocaleString("fa-IR")}٪
          </p>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import { BatteryCharging, BatteryFull, BatteryLow, BatteryMedium, CheckCircle2, Copy, Info, Plug, Power, Save, Settings2, ShieldAlert, Unplug, Wrench } from "lucide-react";
import { toast } from "sonner";
import { ControllerPicture, type PictureModel } from "@/components/gamepad-tester/controller-picture";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { plain, tr } from "@/features/gamepad-tester/ps-i18n";
import { cn } from "@/lib/utils";
import { StickDials, type Stick } from "./stick-dials";

/*
 * Native PlayStation controller screen. All controller communication (WebHID reports, calibration
 * commands, saving to flash) is the original, unmodified code of DualShock Calibration GUI (MIT,
 * vendor/dualshock-tools/js) — only the screens are ours. The step logic below follows its
 * core.js / calib-center-modal.js / calib-range-modal.js.
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- the vendored modules are untyped JavaScript */
type Manager = any;
type HidDevice = any;
/* eslint-enable @typescript-eslint/no-explicit-any */

const CIRC_N = 48; // CIRCULARITY_DATA_SIZE in stick-renderer.js
const RANGE_UNLOCK_SECONDS = 15;
const RANGE_CYCLES = 4;
const fa = (n: number) => n.toLocaleString("fa-IR");

type Model = "DS4" | "DS5" | "DS5_Edge" | "VR2";
interface UiConfig { showInfo?: boolean; showFinetune?: boolean; showQuickCalib?: boolean; showFourStepCalib?: boolean; showCalibrationHistory?: boolean }
interface InfoItem { key: string; value: string; severity?: string; isExtra?: boolean; copyable?: boolean }
interface Connected {
  name: string;
  ids: string;
  model: Model;
  sticks: number;
  ui: UiConfig;
  info: InfoItem[];
  disableBits: number;
  nv: string | null;
}
type Notice = { id: number; variant: "info" | "success" | "warning" | "destructive"; text: string };

const hidApi = (): { requestDevice: (o: unknown) => Promise<HidDevice[]>; getDevices: () => Promise<HidDevice[]>; addEventListener: (t: string, f: (e: { device: HidDevice }) => void) => void; removeEventListener: (t: string, f: (e: { device: HidDevice }) => void) => void } | null =>
  typeof navigator !== "undefined" && "hid" in navigator ? ((navigator as unknown as { hid: never }).hid) : null;

function pictureFor(model: Model, pid: number): PictureModel {
  if (model === "DS4") return "dualshock4";
  if (model === "DS5_Edge" || pid === 0x0df2) return "dualsense-edge";
  return "dualsense";
}

type Snapshot = { states: Record<string, unknown> & { sticks: { left: Stick; right: Stick } }; ll: number[]; rr: number[] };
const EMPTY_SNAPSHOT: Snapshot = { states: { sticks: { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } } }, ll: new Array(CIRC_N).fill(0), rr: new Array(CIRC_N).fill(0) };

const hex = (n: number) => n.toString(16).padStart(4, "0");

/** Button states of the vendored manager → Gamepad API "standard" order used by ControllerPicture. */
function toStandard(s: Record<string, unknown>) {
  const b = (k: string) => ({ pressed: !!s[k], value: s[k] ? 1 : 0 });
  const a = (k: string) => {
    const v = Number(s[`${k}_analog`] ?? 0) / 255;
    return { pressed: v > 0.5, value: v };
  };
  return [b("cross"), b("circle"), b("square"), b("triangle"), b("l1"), b("r1"), a("l2"), a("r2"), s.create !== undefined ? b("create") : b("share"), b("options"), b("l3"), b("r3"), b("up"), b("down"), b("left"), b("right"), b("ps"), b("touchpad")];
}

export function PlayStationTool({ onAdvanced }: { onAdvanced: (beforeSwitch: () => Promise<void>) => void }) {
  const hid = React.useSyncExternalStore(() => () => {}, () => !!hidApi(), () => true);
  const [phase, setPhase] = React.useState<"idle" | "connecting" | "connected">("idle");
  const [dev, setDev] = React.useState<Connected | null>(null);
  const [pid, setPid] = React.useState(0);
  const [hasChanges, setHasChanges] = React.useState(false);
  const [battery, setBattery] = React.useState<{ level: number; charging: boolean; error: boolean } | null>(null);
  const [notices, setNotices] = React.useState<Notice[]>([]);
  const [view, setView] = React.useState<"normal" | "zoom" | "circle">("normal");
  const [busy, setBusy] = React.useState<null | "save" | "reboot">(null);
  const [edgeProgress, setEdgeProgress] = React.useState<number | null>(null);
  const [dialog, setDialog] = React.useState<null | "center" | "range" | "reboot">(null);
  const [centerMethod, setCenterMethod] = React.useState<"four-step" | "quick">("four-step");
  const [snap, setSnap] = React.useState<Snapshot>(EMPTY_SNAPSHOT);

  const manager = React.useRef<Manager>(null);
  const device = React.useRef<HidDevice>(null);
  const ll = React.useRef<number[]>(new Array(CIRC_N).fill(0));
  const rr = React.useRef<number[]>(new Array(CIRC_N).fill(0));
  const rangeOpen = React.useRef(false);
  const failedDetections = React.useRef(0);
  const shownRangeWarning = React.useRef(false);
  const frame = React.useRef(0);
  const noticeId = React.useRef(0);

  const notify = React.useCallback((variant: Notice["variant"], text: string) => {
    const id = ++noticeId.current;
    setNotices((n) => [...n.slice(-3), { id, variant, text }]);
    // Success messages go away by themselves; warnings and errors stay until closed.
    if (variant === "success") setTimeout(() => setNotices((n) => n.filter((x) => x.id !== id)), 6000);
  }, []);

  const states = snap.states;

  const collect = React.useCallback((sticks: { left?: Stick; right?: Stick } | undefined) => {
    if (!sticks) return;
    for (const [stick, data] of [[sticks.left, ll.current], [sticks.right, rr.current]] as const) {
      if (!stick) return;
      const d = Math.sqrt(stick.x * stick.x + stick.y * stick.y);
      const i = (Math.round((Math.atan2(stick.y, stick.x) * CIRC_N) / 2 / Math.PI) + CIRC_N) % CIRC_N;
      data[i] = Math.max(data[i] ?? 0, d);
    }
  }, []);

  const clearCircle = () => {
    ll.current.fill(0);
    rr.current.fill(0);
  };

  // Input from the controller (~250 reports/s): record, then repaint once per animation frame.
  const onInput = React.useCallback(
    ({ changes, batteryStatus }: { changes: Record<string, unknown> & { sticks?: { left: Stick; right: Stick } }; batteryStatus?: { changed?: boolean; charge_level: number; is_charging: boolean; is_error: boolean } }) => {
      collect(changes.sticks);
      if (!rangeOpen.current && changes.sticks && !shownRangeWarning.current) {
        const failed = [changes.sticks.left, changes.sticks.right].some((s) => s && Math.abs(s.x) + Math.abs(s.y) === 2);
        failedDetections.current = failed ? failedDetections.current + 1 : 0;
        if (failedDetections.current >= 5) {
          shownRangeWarning.current = true;
          notify("warning", tr("Range calibration appears to have failed. Please try again and make sure you rotate the sticks."));
        }
      }
      if (batteryStatus?.changed) setBattery({ level: batteryStatus.charge_level, charging: batteryStatus.is_charging, error: batteryStatus.is_error });
      if (!frame.current) frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        const bs = manager.current?.button_states as (Record<string, unknown> & { sticks: { left: Stick; right: Stick } }) | undefined;
        if (!bs) return;
        setSnap({
          states: { ...bs, sticks: { left: { ...bs.sticks.left }, right: { ...bs.sticks.right } } },
          ll: ll.current.slice(),
          rr: rr.current.slice(),
        });
      });
    },
    [collect, notify],
  );

  const cleanup = React.useCallback(() => {
    manager.current = null;
    device.current = null;
    setDev(null);
    setPhase("idle");
    setHasChanges(false);
    setBattery(null);
    setBusy(null);
    setEdgeProgress(null);
    setDialog(null);
    clearCircle();
    setSnap(EMPTY_SNAPSHOT);
  }, []);

  const disconnect = React.useCallback(async () => {
    try {
      if (manager.current?.isConnected()) await manager.current.disconnect();
    } catch (e) {
      console.warn("[ps] disconnect", e);
    }
    cleanup();
  }, [cleanup]);

  // Cable pulled / controller rebooted → back to the start screen.
  React.useEffect(() => {
    const api = hidApi();
    if (!api) return;
    const onGone = (e: { device: HidDevice }) => {
      if (e.device === device.current) {
        cleanup();
        notify("info", "دسته جدا شد.");
      }
    };
    api.addEventListener("disconnect", onGone);
    return () => api.removeEventListener("disconnect", onGone);
  }, [cleanup, notify]);

  React.useEffect(() => () => void disconnect(), [disconnect]);

  async function connect() {
    const api = hidApi();
    if (!api) return;
    setNotices([]);
    setPhase("connecting");
    shownRangeWarning.current = false;
    failedDetections.current = 0;
    clearCircle();
    try {
      const [{ initControllerManager }, { default: ControllerFactory }, { FinetuneHistory }] = await Promise.all([
        import("@ds-tools/js/controller-manager.js"),
        import("@ds-tools/js/controllers/controller-factory.js"),
        import("@ds-tools/js/finetune-history.js"),
      ]);
      const m: Manager = initControllerManager({
        handleNvStatusUpdate: (nv: { status?: string }) => setDev((d) => (d ? { ...d, nv: nv?.status ?? null } : d)),
        onChangesStateUpdate: (v: boolean) => setHasChanges(v),
      });
      m.setInputHandler(onInput);
      manager.current = m;

      const supported: { vendorId: number; productId: number }[] = ControllerFactory.getSupportedModels();
      const isSupported = (d: HidDevice) => supported.some((s) => s.vendorId === d.vendorId && s.productId === d.productId);
      let devices: HidDevice[] = (await api.getDevices()).filter(isSupported);
      if (devices.length === 0) devices = (await api.requestDevice({ filters: supported })).filter(isSupported);
      if (devices.length === 0) {
        cleanup();
        return;
      }
      if (devices.length > 1) {
        notify("info", tr("Please connect only one controller at time."));
        cleanup();
        return;
      }
      const d: HidDevice = devices[0];
      if (d.opened) {
        await d.close();
        await new Promise((r) => setTimeout(r, 500));
      }
      await d.open();
      device.current = d;

      // The first input report tells USB (63 bytes) from Bluetooth.
      const first = await new Promise<{ data: DataView } | null>((resolve) => {
        const t = setTimeout(() => resolve(null), 3000);
        d.oninputreport = (e: { data: DataView }) => {
          clearTimeout(t);
          d.oninputreport = null;
          resolve(e);
        };
      });
      if (!first) throw new Error(tr("Failed to connect to device"));
      if (first.data.byteLength !== 63) {
        notify("warning", tr("The device is connected via Bluetooth. Disconnect and reconnect using a USB cable instead."));
        await disconnect();
        return;
      }

      const instance = ControllerFactory.createControllerInstance(d);
      m.setControllerInstance(instance);
      const info = await instance.getInfo();
      const isClone = ((info?.disable_bits ?? 0) & 1) !== 0;
      if (!isClone && instance.initializeCurrentOutputState) await instance.initializeCurrentOutputState();
      if (!info?.ok) throw new Error(`${tr("Connected invalid device")}: ${tr("Error")} 1`);

      d.oninputreport = m.getInputHandler();
      const model = instance.getModel() as Model;
      const sticks = instance.getNumberOfSticks();
      setPid(d.productId);
      setDev({
        name: ControllerFactory.getDeviceName(d.productId),
        ids: `${hex(d.vendorId)}:${hex(d.productId)}`,
        model,
        sticks,
        ui: ControllerFactory.getUIConfig(d.productId),
        info: (info.infoItems ?? []).filter((i: InfoItem) => i?.key),
        disableBits: info.disable_bits ?? 0,
        nv: info.nv?.status ?? null,
      });
      setPhase("connected");
      if (info.nv?.locked === false) await m.nvsLock();

      if (isClone) notify("destructive", tr("The device appears to be a clone. All calibration functionality is disabled."));
      else if ((info.disable_bits ?? 0) & 2) notify("destructive", `${tr("This DualSense controller has outdated firmware.")} ${tr("Please update the firmware and try again.")}`);
      if (model === "DS5_Edge") notify("info", `${tr("Please note: the stick modules on the DS Edge <b>cannot be calibrated via software alone</b>.").replace(/<[^>]+>/g, "")} ${plain(tr("To store a custom calibration on the stick's internal memory, a <b>hardware modification</b> is required."))}`);
      if (model === "VR2") notify("warning", plain(tr("<p>Support for PS VR2 controllers is <b>minimal and highly experimental</b>.</p><p>I currently don't own these controllers, so I cannot verify the calibration process myself.</p><p>If you'd like to help improve full support, you can contribute with a donation or even send the controllers for testing.</p><p>Feel free to contact me on Discord (the_al) or by email at ds4@the.al .</p><br><p>Thank you for your support!</p>")));
      if (m.has_changes_to_write) notify("warning", `${tr("It appears the latest joystick calibration has not been saved.")} ${tr("You should save your changes, or reboot the controller to revert back to the previous state.")}`);

      // Same as the original: remember the controller's own calibration (used by «Restore calibration»).
      if ((model === "DS5" || model === "DS5_Edge") && !isClone && !m.has_changes_to_write) {
        try {
          const serial = await instance.getSerialNumber();
          const data = await instance.getInMemoryModuleData();
          if (data) FinetuneHistory.save(data, serial);
        } catch (e) {
          console.warn("[ps] finetune history", e);
        }
      }
    } catch (e) {
      console.error("[ps] connect", e);
      const name = (e as { name?: string })?.name;
      if (name !== "NotFoundError" && name !== "AbortError") notify("destructive", tr((e as Error)?.message) || tr("Failed to connect to device"));
      await disconnect();
    }
  }

  async function save() {
    const m = manager.current;
    if (!m) return;
    setBusy("save");
    const edge = dev?.model === "DS5_Edge";
    if (edge) setEdgeProgress(0);
    try {
      const res = await m.flash(edge ? (p: number) => setEdgeProgress(p) : null);
      if (res?.success) notify("success", plain(tr(res.message)) || tr("Changes saved successfully"));
      else if (res?.message) notify("destructive", plain(tr(res.message)));
    } catch (e) {
      notify("destructive", `${tr("Error while saving changes")}: ${tr((e as Error)?.message)}`);
    } finally {
      setBusy(null);
      setEdgeProgress(null);
    }
  }

  async function reboot() {
    const m = manager.current;
    if (!m) return;
    setBusy("reboot");
    try {
      await m.reset();
    } catch (e) {
      console.warn("[ps] reboot", e);
    }
    // The controller restarts and disconnects; the "disconnect" event resets the screen.
    setTimeout(() => setBusy(null), 4000);
  }

  if (!hid) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="flex items-start gap-3">
          <ShieldAlert className="mt-1 size-5 shrink-0 text-destructive" />
          <div className="space-y-1 text-sm leading-7">
            <p className="font-bold">{tr("Unsupported browser.")}</p>
            <p className="text-muted-foreground">کالیبره و تست کامل دسته‌های پلی‌استیشن فقط در Chrome یا Edge روی کامپیوتر (ویندوز، مک یا لینوکس) کار می‌کند. روی گوشی و تبلت پشتیبانی نمی‌شود.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const locked = !!dev && (dev.disableBits & 3) !== 0;
  const actionsDisabled = locked || busy !== null;
  const mainInfo = dev?.info.filter((i) => !i.isExtra) ?? [];
  const extraInfo = dev?.info.filter((i) => i.isExtra) ?? [];

  return (
    <div className="space-y-4 text-start">
      {notices.map((n) => (
        <Alert key={n.id} variant={n.variant}>
          <span className="flex items-start justify-between gap-3">
            <span>{n.text}</span>
            <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setNotices((x) => x.filter((y) => y.id !== n.id))} aria-label="بستن">✕</button>
          </span>
        </Alert>
      ))}

      {phase !== "connected" || !dev ? (
        <Card>
          <CardContent className="space-y-4 py-8 text-center">
            <Plug className="mx-auto size-10 text-brand-green-deep" aria-hidden />
            <p className="leading-8">{tr("Please connect a DualShock 4, a DualSense, DualSense Edge or VR2 controller to your computer and press Connect.")}</p>
            <p className="text-sm text-muted-foreground">دسته را حتماً با <b>کابل USB</b> وصل کنید (نه بلوتوث). اگر پنجرهٔ انتخاب دستگاه باز شد، دسته را انتخاب کنید.</p>
            <Button size="lg" className="w-full max-w-sm" loading={phase === "connecting"} onClick={connect}><Plug /> {tr("Connect")}</Button>
            <Alert variant="info" className="text-start">
              <p className="font-bold">{tr("This utility cannot fix stick drift.")}</p>
              <p>{tr("Drift is caused by mechanical parts in the joystick being worn out, and they need to be replaced to fix the drift.")} {tr("After they have been replaced, this utility can be used to calibrate the controller to work with the new joysticks.")}</p>
              <p className="font-semibold text-warning">{tr("Calibrating without replacing the joysticks may help temporarily, but it may also make the problem worse, with no way to undo it.")}</p>
            </Alert>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-bold">
                  {dev.name} <Badge variant="success">متصل</Badge>
                  {hasChanges ? <Badge variant="warning">تغییرات ذخیره‌نشده</Badge> : null}
                </p>
                <p className="ltr text-start text-xs text-muted-foreground">{dev.ids}</p>
              </div>
              <div className="flex items-center gap-3">
                {battery ? <BatteryBadge {...battery} /> : null}
                <Button variant="outline" size="sm" onClick={disconnect}><Unplug /> {tr("Disconnect")}</Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Info className="size-5" /> {tr("Controller Info")}</CardTitle></CardHeader>
                <CardContent>
                  <InfoList items={mainInfo} />
                  {dev.nv ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      حافظهٔ دسته (NVS): <b className={dev.nv === "locked" ? "text-success" : "text-destructive"}>{dev.nv === "locked" ? "قفل" : dev.nv === "unlocked" ? "باز" : dev.nv}</b>
                    </p>
                  ) : null}
                  {extraInfo.length ? (
                    <details className="mt-3 rounded-lg border p-3">
                      <summary className="cursor-pointer text-sm font-semibold">{tr("Show all")}</summary>
                      <div className="mt-2"><InfoList items={extraInfo} /></div>
                    </details>
                  ) : null}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <ControllerPicture model={pictureFor(dev.model, pid)} buttons={toStandard(states)} axes={[states.sticks.left.x, states.sticks.left.y, states.sticks.right.x, states.sticks.right.y]} />
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Wrench className="size-5" /> {tr("Calibration")}</CardTitle></CardHeader>
                <CardContent className="grid gap-2">
                  <div className="flex gap-2">
                    <Button className="flex-1" disabled={actionsDisabled} onClick={() => setDialog("center")}>{tr("Calibrate stick center")}</Button>
                    {dev.ui.showQuickCalib ? (
                      <select className="h-10 rounded-xl border bg-surface px-2 text-sm" value={centerMethod} onChange={(e) => setCenterMethod(e.target.value as "four-step" | "quick")} aria-label="روش کالیبرهٔ مرکز">
                        <option value="four-step">{tr("Use four-step calibration")}</option>
                        <option value="quick">{tr("Use quick calibration")}</option>
                      </select>
                    ) : null}
                  </div>
                  <Button disabled={actionsDisabled} onClick={() => setDialog("range")}>{tr("Calibrate stick range")}</Button>
                  <hr className="my-2" />
                  <Button variant={hasChanges ? "default" : "outline"} disabled={actionsDisabled || !hasChanges} loading={busy === "save"} onClick={save}><Save /> {tr("Save changes permanently")}</Button>
                  <p className="text-xs leading-6 text-muted-foreground">تا «ذخیرهٔ دائمی» را نزنید، با جدا کردن یا راه‌اندازی دوبارهٔ دسته، کالیبرهٔ قبلی برمی‌گردد. قبل از ذخیره کالیبره را امتحان کنید؛ موقع ذخیره کابل نباید قطع شود.</p>
                  <Button variant="destructive" disabled={busy !== null} loading={busy === "reboot"} onClick={() => setDialog("reboot")}><Power /> {tr("Reboot controller")}</Button>
                  <Button
                    variant="ghost"
                    className="justify-start"
                    onClick={() => onAdvanced(disconnect)}
                  >
                    <Settings2 /> قابلیت‌های پیشرفته: {dev.ui.showFinetune ? "تنظیم دقیق، " : ""}تست سریع{dev.ui.showCalibrationHistory ? "، بازگردانی کالیبره" : ""}، عیب‌یابی
                  </Button>
                  {edgeProgress !== null ? (
                    <div className="h-2 overflow-hidden rounded-full bg-secondary" aria-label="پیشرفت ذخیره">
                      <div className="h-full bg-brand-green transition-[width]" style={{ width: `${edgeProgress}%` }} />
                    </div>
                  ) : null}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                    {tr("Joystick Info")}
                    <span className="flex overflow-hidden rounded-lg border text-xs font-semibold">
                      {([["normal", tr("Normal")], ["zoom", tr("10x zoom")], ["circle", tr("Check circularity")]] as const).map(([k, label]) => (
                        <button key={k} type="button" onClick={() => { clearCircle(); setView(k); }} className={cn("px-3 py-1.5", view === k ? "bg-strong text-strong-foreground" : "hover:bg-secondary")}>{label}</button>
                      ))}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <StickDials left={states.sticks.left} right={states.sticks.right} single={dev.sticks === 1} zoom={view === "zoom"} circularity={view === "circle" ? { left: snap.ll, right: snap.rr } : null} />
                  {view === "circle" ? <p className="mt-2 text-xs text-muted-foreground">{tr("Aim for a circularity error of around 7-9 % for the best playing experience.")}</p> : null}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {dev ? (
        <>
          {dialog === "center" ? <CenterCalibration
            open
            quick={centerMethod === "quick" && !!dev.ui.showQuickCalib}
            manager={manager}
            onClose={(msg, ok) => {
              setDialog(null);
              clearCircle();
              if (msg) notify(ok ? "success" : "destructive", msg);
            }}
          /> : null}
          {dialog === "range" ? <RangeCalibration
            open
            single={dev.sticks === 1}
            manager={manager}
            ll={ll}
            rr={rr}
            states={states}
            circle={{ left: snap.ll, right: snap.rr }}
            onOpenChange={(o) => (rangeOpen.current = o)}
            onClose={(msg, ok) => {
              setDialog(null);
              clearCircle();
              setView("circle");
              shownRangeWarning.current = false;
              if (msg) notify(ok ? "success" : "destructive", msg);
            }}
          /> : null}
          <ConfirmDialog
            open={dialog === "reboot"}
            onOpenChange={(o) => !o && setDialog(null)}
            destructive
            title={`${tr("Reboot controller")}؟`}
            description={hasChanges ? tr("This controller has unsaved changes that will be lost when the controller is rebooted.") : "دسته خاموش و دوباره روشن می‌شود و اتصال قطع می‌شود."}
            confirmLabel={tr("Reboot controller")}
            onConfirm={reboot}
          />
        </>
      ) : null}
    </div>
  );
}

function BatteryBadge({ level, charging, error }: { level: number; charging: boolean; error: boolean }) {
  if (error) return <Badge variant="destructive">باتری: {tr("error")}</Badge>;
  const Icon = charging ? BatteryCharging : level < 25 ? BatteryLow : level < 70 ? BatteryMedium : BatteryFull;
  return (
    <span className={cn("flex items-center gap-1 text-sm font-semibold", level < 20 && !charging ? "text-destructive" : "text-muted-foreground")} title={charging ? "در حال شارژ" : "باتری"}>
      <Icon className="size-5" aria-hidden /> {fa(level)}٪
    </span>
  );
}

function InfoList({ items }: { items: InfoItem[] }) {
  return (
    <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
      {items.map((i, n) => {
        const value = plain(tr(i.value));
        return (
          <React.Fragment key={`${i.key}-${n}`}>
            <dt className="text-muted-foreground">{tr(plain(i.key))}</dt>
            <dd className={cn("flex items-center justify-end gap-1.5 font-mono", i.severity === "danger" && "font-bold text-destructive", i.severity === "success" && "font-bold text-success")} dir="ltr">
              <span className="truncate">{value}</span>
              {i.copyable ? (
                <button type="button" aria-label={`کپی ${tr(plain(i.key))}`} className="text-muted-foreground hover:text-foreground" onClick={() => navigator.clipboard?.writeText(value).then(() => toast.success(tr("The item has been copied to the clipboard.")))}>
                  <Copy className="size-3.5" />
                </button>
              ) : null}
            </dd>
          </React.Fragment>
        );
      })}
    </dl>
  );
}

const CORNERS = ["بالا-چپ", "بالا-راست", "پایین-چپ", "پایین-راست"];

/** Stick centre calibration: same steps as calib-center-modal.js (begin → 4 samples → end), or the quick automatic run. */
function CenterCalibration({ open, quick, manager, onClose }: { open: boolean; quick: boolean; manager: React.RefObject<Manager>; onClose: (message: string | null, ok: boolean) => void }) {
  const [step, setStep] = React.useState(1); // 1 welcome · 2–5 corners · 6 done
  const [working, setWorking] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const running = step > 1 && step < 6;

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  async function next() {
    const m = manager.current;
    if (!m) return;
    setError(null);
    try {
      if (step === 1) {
        setWorking(tr("Initializing..."));
        await wait(100);
        await m.calibrateSticksBegin();
        setStep(2);
      } else if (step >= 2 && step <= 4) {
        setWorking(tr("Sampling..."));
        await wait(150);
        await m.calibrateSticksSample();
        setStep(step + 1);
      } else if (step === 5) {
        setWorking(tr("Sampling..."));
        await m.calibrateSticksSample();
        await wait(200);
        setWorking(tr("Storing calibration..."));
        await wait(500);
        await m.calibrateSticksEnd();
        setStep(6);
      } else {
        onClose(tr("Stick calibration completed"), true);
      }
    } catch (e) {
      setError(tr((e as Error)?.message) || tr("Stick calibration failed"));
      setStep(1);
    } finally {
      await wait(200);
      setWorking(null);
    }
  }

  async function runQuick() {
    const m = manager.current;
    if (!m) return;
    setError(null);
    setStep(0);
    setProgress(0);
    try {
      await wait(1000);
      setProgress(10);
      const res = await m.calibrateSticks((p: number) => setProgress(p));
      await wait(500);
      onClose(tr(res?.message) || tr("Stick calibration completed"), true);
    } catch (e) {
      setError(tr((e as Error)?.message) || tr("Stick calibration failed"));
      setStep(1);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !running && !working && step !== 0 && onClose(null, false)}>
      <DialogContent className="max-w-lg" showClose={!running && !working && step !== 0} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{tr(running || working ? "Calibration in progress" : "Stick center calibration")}</DialogTitle>
          <DialogDescription>{step === 0 ? tr("Quick calibrate") : step === 1 ? "راهنما" : step === 6 ? "پایان" : `مرحلهٔ ${fa(step - 1)} از ۴`}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm leading-7">
          {step === 0 ? (
            <>
              <p>به آنالوگ‌ها دست نزنید؛ کالیبرهٔ خودکار در حال انجام است…</p>
              <div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-brand-green transition-[width]" style={{ width: `${progress}%` }} /></div>
            </>
          ) : step === 1 ? (
            <>
              <p>این راهنما مرکز آنالوگ‌های دسته را دوباره تنظیم می‌کند. چهار مرحله دارد: در هر مرحله هر دو آنالوگ را به یک جهت می‌برید و رها می‌کنید.</p>
              <p className="font-semibold text-warning">بعد از شروع، کالیبره را نمی‌شود لغو کرد. تا پایان کار صفحه را نبندید و دسته را جدا نکنید.</p>
              <p>برای شروع «شروع» را بزنید.</p>
            </>
          ) : step <= 5 ? (
            <>
              <p className="text-base font-bold">هر دو آنالوگ را به گوشهٔ <span className="text-link">{CORNERS[step - 2]}</span> ببرید و رها کنید.</p>
              <p>وقتی آنالوگ‌ها به مرکز برگشتند، «ادامه» را بزنید.</p>
              <div className="flex gap-1" aria-hidden>{[2, 3, 4, 5].map((s) => <span key={s} className={cn("h-1.5 flex-1 rounded-full", s <= step ? "bg-brand-green" : "bg-secondary")} />)}</div>
            </>
          ) : (
            <p className="flex items-center gap-2 font-bold text-success"><CheckCircle2 className="size-5" /> کالیبره با موفقیت انجام شد. برای ماندگاری، «ذخیرهٔ دائمی تغییرات» را بزنید.</p>
          )}
          {error ? <Alert variant="destructive">{error}</Alert> : null}
        </div>
        {step !== 0 ? (
          <DialogFooter>
            {step === 1 && quick ? <Button variant="outline" disabled={!!working} onClick={runQuick}>{tr("Quick calibrate")}</Button> : null}
            <Button loading={!!working} onClick={next}>{working ?? (step === 1 ? "شروع" : step === 6 ? "تمام" : "ادامه")}</Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Stick range calibration: same rules as calib-range-modal.js (4 full turns per stick, Done after ≤ 15 s). */
function RangeCalibration({
  open,
  single,
  manager,
  ll,
  rr,
  states,
  circle,
  onOpenChange,
  onClose,
}: {
  open: boolean;
  single: boolean;
  manager: React.RefObject<Manager>;
  ll: React.RefObject<number[]>;
  rr: React.RefObject<number[]>;
  states: { sticks: { left: Stick; right: Stick } };
  circle: { left: number[]; right: number[] };
  onOpenChange: (open: boolean) => void;
  onClose: (message: string | null, ok: boolean) => void;
}) {
  const [seconds, setSeconds] = React.useState(RANGE_UNLOCK_SECONDS);
  const [cycles, setCycles] = React.useState({ l: 0, r: 0, lFill: 0, rFill: 0 });
  const [closing, setClosing] = React.useState(false);
  const [started, setStarted] = React.useState(false);
  const cyc = React.useRef({ l: 0, r: 0 });

  React.useEffect(() => {
    onOpenChange(open);
    if (!open) return;
    let alive = true;
    ll.current.fill(0);
    rr.current.fill(0);
    cyc.current = { l: 0, r: 0 };
    const begin = setTimeout(async () => {
      try {
        await manager.current?.calibrateRangeBegin();
        if (alive) setStarted(true);
      } catch (e) {
        if (alive) onClose(tr((e as Error)?.message), false);
      }
    }, 1000);
    // Progress check every 100 ms (thresholds from the original: 80 % deflection, 95 % of the circle).
    const progress = setInterval(() => {
      const count = (d: number[]) => d.filter((v) => v > 0.8).length;
      let l = count(ll.current);
      let r = count(rr.current);
      if (l / CIRC_N >= 0.95) {
        cyc.current.l++;
        ll.current.fill(0);
        l = 0;
      }
      if (!single && r / CIRC_N >= 0.95) {
        cyc.current.r++;
        rr.current.fill(0);
        r = 0;
      }
      setCycles({ l: cyc.current.l, r: cyc.current.r, lFill: l, rFill: r });
    }, 100);
    const timer = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => {
      alive = false;
      clearTimeout(begin);
      clearInterval(progress);
      clearInterval(timer);
      onOpenChange(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per opening
  }, [open]);

  const part = (c: number, fill: number) => Math.min(50, Math.min(1, c / RANGE_CYCLES) * 50 + (fill / CIRC_N) * (50 / RANGE_CYCLES));
  const total = Math.round(single ? Math.min(100, 2 * part(cycles.l, cycles.lFill)) : part(cycles.l, cycles.lFill) + part(cycles.r, cycles.rFill));
  const cycleProgress = (c: number) => Math.min(1, c / RANGE_CYCLES) * 50;
  const doneUnlocked = seconds <= 0 || cycleProgress(cycles.l) + (single ? cycleProgress(cycles.l) : cycleProgress(cycles.r)) >= 100;
  const elapsed = RANGE_UNLOCK_SECONDS - seconds;
  const slow = cycleProgress(cycles.l) < 10 || (!single && cycleProgress(cycles.r) < 10);

  async function finish() {
    setClosing(true);
    try {
      const res = await manager.current?.calibrateRangeOnClose();
      onClose(res?.message ? tr(res.message) : null, !!res?.success);
    } catch (e) {
      onClose(tr((e as Error)?.message), false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !closing && finish()}>
      <DialogContent className="max-w-lg" showClose={false} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{tr("Calibrate stick range")}</DialogTitle>
          <DialogDescription>{tr("Rotate the sticks slowly at least 2 times in one direction and 2 times in the other direction to cover the whole range.")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <StickDials left={states.sticks.left} right={states.sticks.right} single={single} circularity={circle} showErrors={false} />
          <div className="space-y-1">
            <div className="h-2.5 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-brand-green transition-[width]" style={{ width: `${total}%` }} /></div>
            <p className="ltr text-center font-mono text-xs text-muted-foreground">{total}% (L:{cycles.l}/{RANGE_CYCLES}{single ? "" : `, R:${cycles.r}/${RANGE_CYCLES}`})</p>
          </div>
          {!started ? <p className="text-muted-foreground">در حال آماده‌سازی…</p> : null}
          {elapsed >= 5 && slow && !doneUnlocked ? (
            <Alert variant="warning"><span className={elapsed >= 7 ? "animate-pulse font-bold" : ""}>{tr("Keep rotating the sticks even if you see no progress!")}</span></Alert>
          ) : null}
          <p className="text-xs leading-6 text-muted-foreground">{plain(tr("The <b>Done</b> button will unlock after at most 15 seconds. If you press <b>Done</b> without rotating the sticks, the calibration will be incomplete and you will need to repeat it."))}</p>
        </div>
        <DialogFooter>
          <Button disabled={!doneUnlocked || closing} loading={closing} onClick={finish}>
            {tr("Done")}{!doneUnlocked && seconds > 0 ? ` (${fa(seconds)})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


"use client";

import * as React from "react";
import { calculateCircularityError, draw_stick_dial } from "@ds-tools/js/stick-renderer.js";

export type Stick = { x: number; y: number };

/**
 * The two stick dials, drawn by the original tool's renderer (vendor/dualshock-tools/js/stick-renderer.js):
 * position, 10× centre zoom, and the circularity map collected while rotating the sticks.
 */
export function StickDials({
  left,
  right,
  single = false,
  zoom = false,
  circularity = null,
  showErrors = true,
}: {
  left: Stick;
  right: Stick;
  single?: boolean;
  zoom?: boolean;
  circularity?: { left: number[]; right: number[] } | null;
  /** Circularity error under the dials (hidden while range calibration is running). */
  showErrors?: boolean;
}) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const sz = 60;
    const yb = 15 + sz;
    const w = c.width;
    const hb = single ? w / 2 : 20 + sz;
    ctx.clearRect(0, 0, c.width, c.height);
    draw_stick_dial(ctx, hb, yb, sz, left.x, left.y, { circularity_data: circularity?.left ?? null, enable_zoom_center: zoom, highlight: false });
    if (!single) draw_stick_dial(ctx, w - hb, yb, sz, right.x, right.y, { circularity_data: circularity?.right ?? null, enable_zoom_center: zoom, highlight: false });
  });
  const p = zoom ? 3 : 2;
  const fmt = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(p);
  const err = (d: number[] | undefined) => (d ? calculateCircularityError(d) : 0);
  return (
    <div className="space-y-2" dir="ltr">
      <canvas ref={ref} width={single ? 180 : 360} height={150} className="mx-auto block h-auto w-full max-w-[360px]" aria-hidden />
      <div className={single ? "grid grid-cols-2 text-center" : "grid grid-cols-4 text-center"}>
        {[
          ["LX", left.x],
          ["LY", left.y],
          ...(single ? [] : ([["RX", right.x], ["RY", right.y]] as const)),
        ].map(([k, v]) => (
          <div key={k as string}>
            <p className="text-xs font-bold text-muted-foreground">{k}</p>
            <p className="font-mono text-sm">{fmt(v as number)}</p>
          </div>
        ))}
      </div>
      {circularity && showErrors ? (
        <div className={single ? "grid grid-cols-1 text-center" : "grid grid-cols-2 text-center"} dir="rtl">
          {[["چپ", circularity.left], ...(single ? [] : [["راست", circularity.right] as const])].map(([k, d]) => {
            const e = err(d as number[]);
            return (
              <p key={k as string} className="text-xs text-muted-foreground">
                خطای دایره‌ای بودن {k as string}: <span className="ltr font-mono font-bold text-foreground">{e ? `${e.toFixed(1)}%` : "—"}</span>
                {e && e < 5 ? <span className="ms-1 font-bold text-warning">(خیلی کم — حدود ۷ تا ۹٪ بهتر است)</span> : null}
              </p>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

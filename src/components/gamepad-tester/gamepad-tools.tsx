"use client";

import * as React from "react";
import { Gamepad2, Wrench } from "lucide-react";
import { GamepadTester } from "./gamepad-tester";
import { cn } from "@/lib/utils";

type Tab = "playstation" | "all";
const noop = () => () => {};

/**
 * Two tools: the full PlayStation tool (DualShock 4 / DualSense / Edge over WebHID: info, stick
 * calibration, fine-tuning, permanent save, quick tests) and the browser test for Xbox and other pads.
 */
export function GamepadTools() {
  const [tab, setTab] = React.useState<Tab>("playstation");
  const hid = React.useSyncExternalStore(noop, () => "hid" in navigator, () => true);
  return (
    <div className="space-y-4 text-start">
      <div role="tablist" aria-label="ابزار دسته" className="flex flex-wrap gap-2">
        {([
          ["playstation", "پلی‌استیشن — کالیبره و تست کامل", Wrench],
          ["all", "ایکس‌باکس و سایر دسته‌ها — تست", Gamepad2],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn("flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors", tab === key ? "border-brand-green bg-brand-green/10" : "bg-surface hover:bg-secondary")}
          >
            <Icon className="size-4" aria-hidden /> {label}
          </button>
        ))}
      </div>
      {tab === "playstation" ? (
        <div className="space-y-2">
          {!hid ? (
            <p className="rounded-lg bg-warning-soft p-3 text-sm text-warning">کالیبره فقط در Chrome یا Edge روی کامپیوتر (ویندوز، مک یا لینوکس) کار می‌کند؛ دسته را با کابل USB وصل کنید.</p>
          ) : (
            <p className="text-sm leading-7 text-muted-foreground">DualShock 4، DualSense، DualSense Edge یا VR2 را با کابل USB وصل کنید و «اتصال» را بزنید. قبل از کالیبره، هشدارهای ابزار را بخوانید: کالیبرهٔ دائمی روی خود دسته ذخیره می‌شود.</p>
          )}
          <iframe
            title="تست و کالیبره دستهٔ پلی‌استیشن"
            src="/gamepad-tools/index.html"
            allow="hid"
            className="h-[calc(100dvh-10rem)] min-h-[640px] w-full rounded-xl border bg-background shadow-card"
          />
        </div>
      ) : (
        <GamepadTester />
      )}
    </div>
  );
}

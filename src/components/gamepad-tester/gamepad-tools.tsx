"use client";

import * as React from "react";
import { ArrowRight, Gamepad2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GamepadTester } from "./gamepad-tester";
import { PlayStationTool } from "./playstation/ps-tool";

type Tab = "playstation" | "all";

/**
 * Gamepad tools, all part of the site: PlayStation (DS4 / DualSense / Edge / VR2 over WebHID: info,
 * stick centre + range calibration, permanent save, reboot) and the test for Xbox and other pads.
 * «قابلیت‌های پیشرفته» (fine-tuning, quick tests, restore, debug) opens the full original tool until
 * those screens are rebuilt natively.
 */
export function GamepadTools() {
  const [tab, setTab] = React.useState<Tab>("playstation");
  const [advanced, setAdvanced] = React.useState(false);
  return (
    <div className="space-y-4 text-start">
      <div role="tablist" aria-label="ابزار دسته" className="flex flex-wrap gap-2">
        {([
          ["playstation", "پلی‌استیشن — کالیبره و تست", Wrench],
          ["all", "ایکس‌باکس و سایر دسته‌ها — تست", Gamepad2],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => {
              setTab(key);
              setAdvanced(false);
            }}
            className={cn("flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors", tab === key ? "border-brand-green bg-brand-green/10" : "bg-surface hover:bg-secondary")}
          >
            <Icon className="size-4" aria-hidden /> {label}
          </button>
        ))}
      </div>
      {tab === "all" ? (
        <GamepadTester />
      ) : advanced ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">نسخهٔ کامل ابزار: تنظیم دقیق، تست سریع، بازگردانی کالیبره و عیب‌یابی. دسته را دوباره «اتصال» کنید.</p>
            <Button variant="outline" size="sm" onClick={() => setAdvanced(false)}><ArrowRight /> بازگشت</Button>
          </div>
          <iframe
            title="قابلیت‌های پیشرفتهٔ دستهٔ پلی‌استیشن"
            src="/gamepad-tools/index.html"
            allow="hid"
            className="h-[calc(100dvh-10rem)] min-h-[640px] w-full rounded-xl border bg-background shadow-card"
          />
        </div>
      ) : (
        <PlayStationTool
          onAdvanced={async (release) => {
            await release(); // only one page should drive the controller at a time
            setAdvanced(true);
          }}
        />
      )}
    </div>
  );
}

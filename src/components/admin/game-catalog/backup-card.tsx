"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DatabaseBackup, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatDateTime, formatNumber } from "@/lib/format";

interface ImportResult {
  ok: boolean;
  error?: string;
  summary?: { games: { PS4: number; PS5: number }; categories: number; skipped: { name: string; reason: string }[] };
}

/** ZIP backup download and restore from an original catalog.db file. */
export function BackupCard({ lastImport }: { lastImport: { at: string; fileName: string; games: number } | null }) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [result, setResult] = React.useState<ImportResult | null>(null);

  async function restore() {
    if (!file) return;
    setResult(null);
    try {
      const res = await fetch("/api/admin/catalog/import", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream", "X-File-Name": encodeURIComponent(file.name) },
        body: file,
      });
      const data = (await res.json().catch(() => ({ ok: false, error: "پاسخ نامعتبر از سرور." }))) as ImportResult;
      setResult(data);
      if (data.ok) {
        toast.success("کاتالوگ بازیابی شد.");
        router.refresh();
      } else toast.error(data.error ?? "بازیابی ناموفق بود.");
    } catch {
      toast.error("ارسال فایل ناموفق بود.");
    } finally {
      setFile(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><DatabaseBackup className="size-5" /> پشتیبان‌گیری</CardTitle>
        <CardDescription>خروجی ZIP شامل فایل catalog.json و تصاویر همهٔ بازی‌هاست.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button asChild variant="outline" className="w-full">
          <a href="/api/admin/catalog/export" download><Download /> دانلود خروجی ZIP</a>
        </Button>
        <Button variant="outline" className="w-full" onClick={() => inputRef.current?.click()}><Upload /> بازیابی از فایل ‎.db</Button>
        <input
          ref={inputRef}
          type="file"
          accept=".db,.sqlite,application/octet-stream"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) setFile(f);
          }}
        />
        <p className="text-xs leading-6 text-muted-foreground">
          فایل catalog.db نرم‌افزار قبلی کاتالوگ را می‌پذیرد. بازیابی، کاتالوگ فعلی هر دو پلتفرم را جایگزین می‌کند؛ قبل از آن یک خروجی ZIP بگیرید.
        </p>
        {lastImport ? (
          <p className="text-xs text-muted-foreground">
            آخرین بازیابی: {formatDateTime(new Date(lastImport.at))} — <span className="ltr">{lastImport.fileName}</span> ({formatNumber(lastImport.games)} بازی)
          </p>
        ) : null}
        {result?.ok && result.summary ? (
          <Alert variant="success">
            بازیابی انجام شد: PS4 {formatNumber(result.summary.games.PS4)}، PS5 {formatNumber(result.summary.games.PS5)} بازی، {formatNumber(result.summary.categories)} دسته.
            {result.summary.skipped.length > 0 ? ` ${formatNumber(result.summary.skipped.length)} بازی به‌دلیل تصویر نامعتبر رد شد.` : null}
          </Alert>
        ) : null}
        {result && !result.ok ? <Alert variant="destructive">{result.error}</Alert> : null}
      </CardContent>
      <ConfirmDialog
        open={file !== null}
        onOpenChange={(o) => !o && setFile(null)}
        destructive
        title="کاتالوگ فعلی جایگزین شود؟"
        description={file ? `همهٔ بازی‌ها و دسته‌های فعلی (PS4 و PS5) حذف و با محتوای «${file.name}» جایگزین می‌شوند.` : undefined}
        confirmLabel="بله، بازیابی شود"
        onConfirm={restore}
      />
    </Card>
  );
}

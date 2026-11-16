"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createApiKey, revokeApiKey } from "@/features/api/admin-actions";
import { API_SCOPES } from "@/features/api/scopes";

export function CreateApiKeyDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [scopes, setScopes] = React.useState<string[]>(API_SCOPES.map((s) => s.key));
  const [key, setKey] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setKey(null); setName(""); router.refresh(); } }}>
      <DialogTrigger asChild><Button><KeyRound /> کلید جدید</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{key ? "کلید ساخته شد" : "ساخت کلید API"}</DialogTitle>
          <DialogDescription>{key ? "این کلید فقط همین یک بار نمایش داده می‌شود. کپی کنید و در تنظیمات برنامه‌تان بگذارید؛ آن را در چت یا جای عمومی نفرستید." : "برای هر برنامه یک کلید جدا بسازید تا هر وقت لازم شد فقط همان را باطل کنید."}</DialogDescription>
        </DialogHeader>
        {key ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input readOnly dir="ltr" value={key} className="min-w-0 flex-1 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} aria-label="کلید API" />
              <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(key).then(() => toast.success("کپی شد."))}><Copy /> کپی</Button>
            </div>
            <DialogFooter><Button onClick={() => setOpen(false)}>کپی کردم، ببند</Button></DialogFooter>
          </div>
        ) : (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await createApiKey({ name, scopes });
                if (!res.ok) return void toast.error(res.error);
                setKey(res.data.key);
              });
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="k-name">نام کلید</Label>
              <Input id="k-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="مثلاً برنامهٔ صندوق" />
            </div>
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">دسترسی‌ها</legend>
              {API_SCOPES.map((s) => (
                <label key={s.key} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={scopes.includes(s.key)} onChange={(e) => setScopes(e.target.checked ? [...scopes, s.key] : scopes.filter((x) => x !== s.key))} className="size-4 accent-[var(--brand-green-dark)]" />
                  {s.label} <span className="ltr font-mono text-xs text-muted-foreground" dir="ltr">{s.key}</span>
                </label>
              ))}
            </fieldset>
            <DialogFooter><Button type="submit" loading={pending} disabled={name.trim().length < 2 || scopes.length === 0}>ساخت کلید</Button></DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function RevokeButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      className="text-destructive"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`کلید «${name}» باطل شود؟ برنامه‌ای که از آن استفاده می‌کند دیگر کار نمی‌کند.`)) return;
        start(async () => {
          const res = await revokeApiKey(id);
          if (!res.ok) return void toast.error(res.error);
          toast.success(res.message);
          router.refresh();
        });
      }}
    >
      باطل کردن
    </Button>
  );
}

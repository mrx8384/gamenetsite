"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Building2, Clock, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { submitPartnerLogo, withdrawPartnerLogo } from "@/features/partners/logo-actions";

function LogoBox({ url, label }: { url: string | null; label: string }) {
  return (
    <figure className="space-y-1 text-center">
      <span className="relative flex size-24 items-center justify-center overflow-hidden rounded-xl border bg-white">
        {url ? <Image src={url} alt={label} fill sizes="96px" unoptimized className="object-contain p-1.5" /> : <Building2 className="size-8 text-muted-foreground" aria-hidden />}
      </span>
      <figcaption className="text-xs text-muted-foreground">{label}</figcaption>
    </figure>
  );
}

/** Partner sends their own logo; it replaces the Atom logo in their area after admin approval. */
export function PartnerLogoCard({ logoUrl, pendingUrl, rejectReason, whiteLabel }: { logoUrl: string | null; pendingUrl: string | null; rejectReason: string | null; whiteLabel: boolean }) {
  const router = useRouter();
  const ref = React.useRef<HTMLInputElement>(null);
  const [pending, startTransition] = React.useTransition();

  const send = (file: File) => {
    if (file.size > 5 * 1024 * 1024) return void toast.error("حجم تصویر باید حداکثر ۵ مگابایت باشد.");
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const res = await submitPartnerLogo(fd);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4 text-sm">
      <p className="leading-7 text-muted-foreground">
        با اشتراک فعال، پنل شما با نام و لوگوی خودتان نمایش داده می‌شود و لوگوی اتم در آن نیست. لوگوی خود را بفرستید؛ بعد از تأیید ما جایگزین می‌شود.
        {whiteLabel ? null : " (نمایش اختصاصی بعد از فعال شدن اشتراک شروع می‌شود.)"}
      </p>
      <div className="flex flex-wrap gap-4">
        <LogoBox url={logoUrl} label={logoUrl ? "لوگوی فعلی" : "بدون لوگو (نام شما نمایش داده می‌شود)"} />
        {pendingUrl ? (
          <div className="space-y-1">
            <LogoBox url={pendingUrl} label="ارسال‌شده" />
            <Badge variant="secondary" className="mx-auto flex w-fit items-center gap-1"><Clock className="size-3" /> در انتظار تأیید</Badge>
          </div>
        ) : null}
      </div>
      {rejectReason && !pendingUrl ? <Alert variant="destructive">لوگوی قبلی تأیید نشد: {rejectReason}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" loading={pending} onClick={() => ref.current?.click()}>
          <ImagePlus /> {pendingUrl ? "ارسال لوگوی دیگر" : logoUrl ? "ارسال لوگوی جدید" : "ارسال لوگو"}
        </Button>
        {pendingUrl ? (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await withdrawPartnerLogo();
                if (!res.ok) return void toast.error(res.error);
                toast.success(res.message);
                router.refresh();
              })
            }
          >
            پس گرفتن
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">PNG با پس‌زمینهٔ شفاف یا سفید بهتر است؛ حداکثر ۵ مگابایت.</p>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) send(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

"use client";

import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface QrItem {
  platform: string;
  url: string;
  /** SVG generated on the server by the `qrcode` package from APP_URL (trusted input). */
  svg: string;
}

/** QR codes of the public catalog pages, for printing in the game café. */
export function QrCard({ items }: { items: QrItem[] }) {
  function download(item: QrItem) {
    const url = URL.createObjectURL(new Blob([item.svg], { type: "image/svg+xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `atom-catalog-${item.platform.toLowerCase()}-qr.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function print(item: QrItem) {
    const w = window.open("", "_blank", "width=480,height=640");
    if (!w) return;
    const doc = w.document;
    doc.title = `QR ${item.platform}`;
    const style = doc.createElement("style");
    style.textContent = "body{font-family:sans-serif;text-align:center;padding:24px}svg{width:320px;height:320px}h1{font-size:40px;margin:8px 0}p{direction:ltr;font-size:13px;color:#444}";
    doc.head.appendChild(style);
    const h = doc.createElement("h1");
    h.textContent = item.platform;
    const box = doc.createElement("div");
    box.innerHTML = item.svg;
    const p = doc.createElement("p");
    p.textContent = item.url;
    doc.body.append(h, box, p);
    w.focus();
    w.print();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>QR کاتالوگ</CardTitle>
        <CardDescription>مشتریان با اسکن این کد، کاتالوگ را روی گوشی خود می‌بینند.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        {items.map((item) => (
          <figure key={item.platform} className="space-y-2 text-center">
            <div className="mx-auto aspect-square w-full max-w-36 rounded-lg border bg-white p-1 [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: item.svg }} role="img" aria-label={`QR کد کاتالوگ ${item.platform}`} />
            <figcaption className="ltr text-center text-sm font-bold">{item.platform}</figcaption>
            <div className="flex justify-center gap-1">
              <Button variant="ghost" size="icon-sm" aria-label={`چاپ QR ${item.platform}`} onClick={() => print(item)}><Printer /></Button>
              <Button variant="ghost" size="icon-sm" aria-label={`دانلود QR ${item.platform}`} onClick={() => download(item)}><Download /></Button>
            </div>
          </figure>
        ))}
        <p className="ltr col-span-2 break-all text-center text-xs text-muted-foreground">{items[0]?.url.replace(/\/[^/]+$/, "/…")}</p>
      </CardContent>
    </Card>
  );
}

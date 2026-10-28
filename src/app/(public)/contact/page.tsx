import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { Clock, Mail, MapPin, Phone, Smartphone } from "lucide-react";
import { ContactForm } from "@/components/contact/contact-form";
import { OpenSupportButton } from "@/components/support/open-support-button";
import { Container } from "@/components/layout/container";
import { SocialLinks } from "@/components/layout/social-links";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSiteSettings } from "@/features/settings/site";
import { toPersianDigits } from "@/lib/format";

export const metadata: Metadata = pageMetadata({ title: "تماس با ما", description: "نشانی، تلفن، ساعات کاری و راه‌های ارتباط با اتم گیم کلاب؛ پیام خود را از همین صفحه بفرستید.", path: "/contact" });

export default async function ContactPage() {
  const c = await getSiteSettings("contact");
  const rows = [
    c.phone ? { icon: Phone, label: "تلفن", value: <a href={`tel:${c.phone}`} className="ltr hover:text-link">{toPersianDigits(c.phone)}</a> } : null,
    c.mobile ? { icon: Smartphone, label: "موبایل", value: <a href={`tel:${c.mobile}`} className="ltr hover:text-link">{toPersianDigits(c.mobile)}</a> } : null,
    c.email ? { icon: Mail, label: "ایمیل", value: <a href={`mailto:${c.email}`} className="ltr hover:text-link">{c.email}</a> } : null,
    c.address ? { icon: MapPin, label: "نشانی", value: c.address } : null,
    c.hours ? { icon: Clock, label: "ساعات کاری", value: c.hours } : null,
  ].filter((r) => r !== null);

  return (
    <Container className="py-8 sm:py-12">
      <h1 className="mb-2 flex items-center gap-3 text-3xl font-black"><span className="h-8 w-1.5 rounded-full bg-brand-green" aria-hidden />تماس با ما</h1>
      <p className="mb-8 text-muted-foreground">سؤال، پیشنهاد یا درخواست همکاری دارید؟ پیام بگذارید.</p>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader><CardTitle>ارسال پیام</CardTitle></CardHeader>
          <CardContent><ContactForm /></CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3">
              <p className="text-sm leading-7 text-muted-foreground">پاسخ سریع‌تر می‌خواهید؟ با پشتیبانی آنلاین گفت‌وگو کنید.</p>
              <OpenSupportButton className="w-full" />
            </CardContent>
          </Card>
          {rows.length > 0 ? (
            <Card>
              <CardContent className="space-y-4">
                {rows.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-green/15 text-brand-green-deep"><Icon className="size-5" aria-hidden /></span>
                    <div className="min-w-0 text-sm"><p className="text-muted-foreground">{label}</p><div className="leading-7 font-medium">{value}</div></div>
                  </div>
                ))}
                {c.mapUrl ? <Button asChild variant="outline" className="w-full"><a href={c.mapUrl} target="_blank" rel="noopener noreferrer"><MapPin /> مسیریابی روی نقشه</a></Button> : null}
              </CardContent>
            </Card>
          ) : null}
          <SocialLinks contact={c} />
        </div>
      </div>
    </Container>
  );
}

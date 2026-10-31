import Link from "next/link";
import { cacheLife } from "next/cache";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/logo";
import { getSectionVisibility } from "@/features/settings/sections";
import { visibleLinks } from "@/features/settings/sections-schema";
import { getSiteSettings } from "@/features/settings/site";
import { siteConfig } from "@/lib/brand";
import { toPersianDigits } from "@/lib/format";
import { mainNav } from "@/lib/nav";
import { Container } from "./container";
import { SocialLinks } from "./social-links";

async function CopyrightYear() {
  "use cache";
  cacheLife("days");
  const year = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", timeZone: "Asia/Tehran" }).format(new Date());
  return <>{year}</>;
}

const serviceLinks = [
  { href: "/game-catalog/ps5", label: "بازی‌های PS5" },
  { href: "/game-catalog/ps4", label: "بازی‌های PS4" },
  { href: "/tournaments/gamepad-tester", label: "تست دسته" },
  { href: "/partners", label: "درخواست همکاری" },
];

export async function SiteFooter() {
  const [general, contact, visibility] = await Promise.all([getSiteSettings("general"), getSiteSettings("contact"), getSectionVisibility()]);
  const hasContact = contact.phone || contact.mobile || contact.email || contact.address || contact.hours;
  return (
    <footer className="mt-auto bg-brand-black text-brand-cream">
      <Container className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Logo size={52} />
            <div>
              <p className="ltr text-start font-black tracking-wide">{siteConfig.name}</p>
              <p className="text-sm text-brand-cream/65">{siteConfig.nameFa}</p>
            </div>
          </div>
          <p className="max-w-sm text-sm leading-7 text-brand-cream/70">{general.footerDescription}</p>
          <p className="text-xs text-brand-cream/50">{general.footerSince}</p>
        </div>
        <FooterColumn title="دسترسی سریع" links={visibleLinks(mainNav, visibility)} />
        <FooterColumn title="خدمات" links={visibleLinks(serviceLinks, visibility)} />
        <div>
          <p className="mb-4 text-sm font-bold">ارتباط با ما</p>
          {hasContact ? (
            <ul className="space-y-2.5 text-sm text-brand-cream/75">
              {contact.phone ? <li className="flex items-center gap-2"><Phone className="size-4 shrink-0" aria-hidden /><a href={`tel:${contact.phone}`} className="ltr hover:text-brand-green">{toPersianDigits(contact.phone)}</a></li> : null}
              {contact.mobile ? <li className="flex items-center gap-2"><Phone className="size-4 shrink-0" aria-hidden /><a href={`tel:${contact.mobile}`} className="ltr hover:text-brand-green">{toPersianDigits(contact.mobile)}</a></li> : null}
              {contact.email ? <li className="flex items-center gap-2"><Mail className="size-4 shrink-0" aria-hidden /><a href={`mailto:${contact.email}`} className="ltr hover:text-brand-green">{contact.email}</a></li> : null}
              {contact.address ? <li className="flex items-start gap-2"><MapPin className="mt-1 size-4 shrink-0" aria-hidden /><span className="leading-7">{contact.address}</span></li> : null}
              {contact.hours ? <li className="flex items-center gap-2"><Clock className="size-4 shrink-0" aria-hidden />{contact.hours}</li> : null}
            </ul>
          ) : (
            <Link href="/contact" className="text-sm text-brand-cream/70 hover:text-brand-green">صفحهٔ تماس با ما</Link>
          )}
          <SocialLinks contact={contact} className="mt-4" tone="dark" />
        </div>
      </Container>
      <div className="border-t border-white/10">
        <Container className="flex flex-col items-center justify-between gap-2 py-5 text-xs text-brand-cream/55 sm:flex-row">
          <p>© <CopyrightYear /> {general.copyright}</p>
          <Link href="/contact" className="transition-colors hover:text-brand-green">ارتباط با ما</Link>
        </Container>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <p className="mb-4 text-sm font-bold text-brand-cream">{title}</p>
      <ul className="space-y-2.5 text-sm">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-brand-cream/70 transition-colors hover:text-brand-green">{l.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

import Link from "next/link";
import { cacheLife } from "next/cache";
import { Logo } from "@/components/logo";
import { siteConfig } from "@/lib/brand";
import { toPersianDigits } from "@/lib/format";
import { mainNav } from "@/lib/nav";
import { Container } from "./container";

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

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-brand-black text-brand-cream">
      <Container className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Logo size={52} />
            <div>
              <p className="ltr text-start font-black tracking-wide">{siteConfig.name}</p>
              <p className="text-sm text-brand-cream/65">{siteConfig.nameFa}</p>
            </div>
          </div>
          <p className="max-w-sm text-sm leading-7 text-brand-cream/70">{siteConfig.description}</p>
          <p className="text-xs text-brand-cream/50">فعالیت از سال {toPersianDigits(2021)}</p>
        </div>

        <FooterColumn title="دسترسی سریع" links={mainNav} />
        <FooterColumn title="خدمات" links={serviceLinks} />
      </Container>
      <div className="border-t border-white/10">
        <Container className="flex flex-col items-center justify-between gap-2 py-5 text-xs text-brand-cream/55 sm:flex-row">
          <p>
            © <CopyrightYear /> {siteConfig.nameFa} — تمامی حقوق محفوظ است.
          </p>
          <Link href="/contact" className="transition-colors hover:text-brand-green">
            ارتباط با ما
          </Link>
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
            <Link href={l.href} className="text-brand-cream/70 transition-colors hover:text-brand-green">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

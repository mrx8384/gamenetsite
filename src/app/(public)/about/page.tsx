import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { Logo } from "@/components/logo";
import { Container } from "@/components/layout/container";
import { RichTextContent } from "@/components/rich-text/rich-text-content";
import { getPage } from "@/features/pages/queries";
import { getSiteSettings } from "@/features/settings/site";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("about");
  const home = await getSiteSettings("home");
  return pageMetadata({ title: page?.title ?? "درباره ما", description: home.aboutBody.slice(0, 160) || undefined, path: "/about" });
}

export default async function AboutPage() {
  const [page, home] = await Promise.all([getPage("about"), getSiteSettings("home")]);
  return (
    <Container className="py-10 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Logo size={120} />
          <h1 className="text-3xl font-black sm:text-4xl">{page?.title ?? home.aboutTitle}</h1>
        </div>
        {page?.contentHtml ? (
          <RichTextContent html={page.contentHtml} className="text-[1.05rem]" />
        ) : (
          <p className="text-center leading-9 text-muted-foreground">{home.aboutBody}</p>
        )}
      </div>
    </Container>
  );
}

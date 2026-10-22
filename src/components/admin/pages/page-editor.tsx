"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { savePage } from "@/features/pages/actions";
import { useHydrated } from "@/lib/hooks/use-hydrated";

export function PageEditor({ slug, publicHref, initialTitle, initialContent }: { slug: string; publicHref: string; initialTitle: string; initialContent: JSONContent | null }) {
  const router = useRouter();
  const [title, setTitle] = React.useState(initialTitle);
  const [content, setContent] = React.useState<JSONContent | null>(initialContent);
  const [error, setError] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();
  const hydrated = useHydrated();

  return (
    <form
      noValidate
      className="max-w-4xl space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await savePage(slug, { title, content: content ?? { type: "doc" } });
          if (!res.ok) {
            setError(res.fieldErrors?.title);
            return void toast.error(res.error);
          }
          setError(undefined);
          toast.success(res.message);
          router.refresh();
        });
      }}
    >
      <fieldset disabled={!hydrated} className="contents">
      <div className="grid gap-1.5">
        <Label htmlFor="page-title">عنوان صفحه</Label>
        <Input id="page-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} aria-invalid={!!error} />
        {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
      </div>
      <div className="grid gap-1.5">
        <Label>محتوا</Label>
        <RichTextEditor value={content} onChange={setContent} label="محتوای صفحه" />
      </div>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending} disabled={!hydrated}>ذخیرهٔ صفحه</Button>
        <Button asChild variant="outline">
          <Link href={publicHref} target="_blank"><ExternalLink /> مشاهدهٔ صفحه</Link>
        </Button>
      </div>
    </form>
  );
}

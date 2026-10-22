"use client";

import * as React from "react";
import { EditorContent, useEditor, useEditorState, type JSONContent } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered,
  Minus, Quote, Redo2, Strikethrough, Underline, Undo2, Unlink,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadImages } from "@/features/media/actions";
import { mediaUrl } from "@/lib/media";
import { richTextExtensions, SAFE_LINK_RE } from "@/lib/rich-text/extensions";
import { cn } from "@/lib/utils";

function ToolButton({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-foreground/75 transition-colors hover:bg-secondary disabled:opacity-40 [&_svg]:size-4",
        active && "bg-brand-green/20 text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** Rich-text editor (Tiptap). Emits ProseMirror JSON; the server sanitizes and renders it. */
export function RichTextEditor({
  value,
  onChange,
  placeholder = "متن را اینجا بنویسید…",
  imageFolder = "news",
  label,
}: {
  value: JSONContent | null;
  onChange: (doc: JSONContent) => void;
  placeholder?: string;
  imageFolder?: "news" | "products" | "categories";
  label?: string;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [href, setHref] = React.useState("");
  const [uploading, setUploading] = React.useState(false);

  const editor = useEditor({
    extensions: [...richTextExtensions(), Placeholder.configure({ placeholder })],
    content: value ?? undefined,
    immediatelyRender: false, // avoid SSR hydration mismatch
    editorProps: { attributes: { class: "prose-atom min-h-64 px-4 py-3 outline-none", dir: "rtl", ...(label ? { "aria-label": label } : {}) } },
    // ProseMirror attrs are null-prototype objects, which React cannot send to Server Actions.
    // Emit a plain JSON copy instead.
    onUpdate: ({ editor: e }) => onChange(JSON.parse(JSON.stringify(e.getJSON())) as JSONContent),
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"), italic: e.isActive("italic"), underline: e.isActive("underline"), strike: e.isActive("strike"),
            h2: e.isActive("heading", { level: 2 }), h3: e.isActive("heading", { level: 3 }),
            bullet: e.isActive("bulletList"), ordered: e.isActive("orderedList"), quote: e.isActive("blockquote"), link: e.isActive("link"),
            right: e.isActive({ textAlign: "right" }), center: e.isActive({ textAlign: "center" }), left: e.isActive({ textAlign: "left" }),
            canUndo: e.can().undo(), canRedo: e.can().redo(),
          }
        : null,
  });

  async function uploadImage(file: File) {
    if (!editor) return;
    setUploading(true);
    const fd = new FormData();
    fd.set("folder", imageFolder);
    fd.append("files", file);
    const res = await uploadImages(fd);
    setUploading(false);
    if (!res.ok) return void toast.error(res.error);
    editor.chain().focus().setImage({ src: mediaUrl(res.data[0].storageKey), alt: "" }).run();
  }

  function applyLink() {
    if (!editor) return;
    const url = href.trim();
    if (!url) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else if (!SAFE_LINK_RE.test(url)) return void toast.error("لینک باید با https:// یا / شروع شود.");
    else if (editor.state.selection.empty && !editor.isActive("link")) {
      // Nothing selected: insert the address itself as linked text.
      editor.chain().focus().insertContent({ type: "text", text: url, marks: [{ type: "link", attrs: { href: url } }] }).run();
    } else {
      // Apply, then collapse the selection after the link so the next insert doesn't replace it.
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
      editor.commands.setTextSelection(editor.state.selection.to);
    }
    setLinkOpen(false);
    setHref("");
  }

  const c = () => editor!.chain().focus();
  return (
    <div className="overflow-hidden rounded-xl border border-input bg-surface focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25">
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-secondary/40 p-1.5" role="toolbar" aria-label="ابزارهای ویرایش">
        <ToolButton label="تیتر" active={state?.h2} onClick={() => c().toggleHeading({ level: 2 }).run()}><Heading2 /></ToolButton>
        <ToolButton label="زیرتیتر" active={state?.h3} onClick={() => c().toggleHeading({ level: 3 }).run()}><Heading3 /></ToolButton>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <ToolButton label="پررنگ" active={state?.bold} onClick={() => c().toggleBold().run()}><Bold /></ToolButton>
        <ToolButton label="کج" active={state?.italic} onClick={() => c().toggleItalic().run()}><Italic /></ToolButton>
        <ToolButton label="زیرخط" active={state?.underline} onClick={() => c().toggleUnderline().run()}><Underline /></ToolButton>
        <ToolButton label="خط‌خورده" active={state?.strike} onClick={() => c().toggleStrike().run()}><Strikethrough /></ToolButton>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <ToolButton label="فهرست نقطه‌ای" active={state?.bullet} onClick={() => c().toggleBulletList().run()}><List /></ToolButton>
        <ToolButton label="فهرست شماره‌دار" active={state?.ordered} onClick={() => c().toggleOrderedList().run()}><ListOrdered /></ToolButton>
        <ToolButton label="نقل‌قول" active={state?.quote} onClick={() => c().toggleBlockquote().run()}><Quote /></ToolButton>
        <ToolButton label="خط جداکننده" onClick={() => c().setHorizontalRule().run()}><Minus /></ToolButton>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <ToolButton label="راست‌چین" active={state?.right} onClick={() => c().setTextAlign("right").run()}><AlignRight /></ToolButton>
        <ToolButton label="وسط‌چین" active={state?.center} onClick={() => c().setTextAlign("center").run()}><AlignCenter /></ToolButton>
        <ToolButton label="چپ‌چین" active={state?.left} onClick={() => c().setTextAlign("left").run()}><AlignLeft /></ToolButton>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <ToolButton label="افزودن لینک" active={state?.link} onClick={() => { setHref(editor?.getAttributes("link").href ?? ""); setLinkOpen((o) => !o); }}><Link2 /></ToolButton>
        {state?.link ? <ToolButton label="حذف لینک" onClick={() => c().unsetLink().run()}><Unlink /></ToolButton> : null}
        <ToolButton label="افزودن تصویر" disabled={uploading} onClick={() => fileRef.current?.click()}><ImagePlus /></ToolButton>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <ToolButton label="واگرد" disabled={!state?.canUndo} onClick={() => c().undo().run()}><Undo2 /></ToolButton>
        <ToolButton label="ازنو" disabled={!state?.canRedo} onClick={() => c().redo().run()}><Redo2 /></ToolButton>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadImage(f); e.target.value = ""; }}
        />
      </div>
      {linkOpen ? (
        <div className="flex gap-2 border-b bg-surface p-2">
          <Input value={href} onChange={(e) => setHref(e.target.value)} dir="ltr" className="h-9 text-start" placeholder="https://..." aria-label="آدرس لینک" autoFocus onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), applyLink())} />
          <Button type="button" size="sm" onClick={applyLink}>اعمال</Button>
        </div>
      ) : null}
      {uploading ? <p className="border-b px-3 py-1.5 text-xs text-muted-foreground">در حال بارگذاری تصویر…</p> : null}
      <EditorContent editor={editor} />
    </div>
  );
}

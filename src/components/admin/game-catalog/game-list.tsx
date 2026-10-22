"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, ImageUp, Pencil, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/states";
import { deleteCatalogGame, replaceCatalogGameImage, updateCatalogGame } from "@/features/game-catalog/admin-actions";
import type { AdminCatalogGame } from "@/features/game-catalog/admin-queries";
import { CATEGORY_MAX, GAME_NAME_MAX, type Platform } from "@/features/game-catalog/constants";
import { formatNumber } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { normalizePersian } from "@/lib/text";
import { cn } from "@/lib/utils";
import { resizeForUpload } from "./resize-image";

export function GameList({ platform, games, categoryNames }: { platform: Platform; games: AdminCatalogGame[]; categoryNames: string[] }) {
  const [query, setQuery] = React.useState("");
  const [onlyRename, setOnlyRename] = React.useState(false);
  const renameCount = games.filter((g) => g.needsRename).length;
  const q = normalizePersian(query).toLowerCase();
  const shown = games.filter((g) => (!onlyRename || g.needsRename) && (!q || normalizePersian(`${g.name} ${g.categoryName}`).toLowerCase().includes(q)));

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>بازی‌های <span className="ltr">{platform}</span> <span className="text-sm font-normal text-muted-foreground">({formatNumber(games.length)})</span></CardTitle>
          {renameCount > 0 ? (
            <button type="button" onClick={() => setOnlyRename((v) => !v)} aria-pressed={onlyRename} className="cursor-pointer">
              <Badge variant={onlyRename ? "strong" : "warning"}>{formatNumber(renameCount)} مورد نیاز به تغییر نام</Badge>
            </button>
          ) : null}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جستجو در نام یا دسته…" aria-label="جستجوی بازی" className="ps-9" />
        </div>
      </CardHeader>
      <CardContent>
        {games.length === 0 ? (
          <EmptyState title="هنوز بازی‌ای ثبت نشده" description="از کادر بالا اولین بازی را اضافه کنید." />
        ) : shown.length === 0 ? (
          <EmptyState title="موردی پیدا نشد" />
        ) : (
          <ul className="divide-y">
            {shown.map((g) => (
              <GameRow key={g.id} game={g} platform={platform} categoryNames={categoryNames} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function GameRow({ game, platform, categoryNames }: { game: AdminCatalogGame; platform: Platform; categoryNames: string[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [confirm, setConfirm] = React.useState<"delete" | "move" | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const other: Platform = platform === "PS4" ? "PS5" : "PS4";

  async function replaceImage(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.set("id", game.id);
    fd.set("file", await resizeForUpload(file));
    const res = await replaceCatalogGameImage(fd).catch(() => null);
    setUploading(false);
    if (!res?.ok) return void toast.error(res?.error ?? "ارسال ناموفق بود.");
    toast.success(res.message);
    router.refresh();
  }

  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="relative h-16 w-12 shrink-0 overflow-hidden rounded-md border bg-secondary">
        <Image src={mediaUrl(game.imageKey)} alt="" fill unoptimized sizes="48px" className="object-cover" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{game.name}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>{game.categoryName}</span>
          {game.needsRename ? <Badge variant="warning">نیاز به تغییر نام</Badge> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center">
        <Button variant="ghost" size="icon-sm" aria-label={`ویرایش ${game.name}`} onClick={() => setEditing(true)}><Pencil /></Button>
        <Button variant="ghost" size="icon-sm" aria-label={`جایگزینی تصویر ${game.name}`} loading={uploading} onClick={() => fileRef.current?.click()}><ImageUp /></Button>
        <Button variant="ghost" size="icon-sm" aria-label={`انتقال ${game.name} به ${other}`} onClick={() => setConfirm("move")}><ArrowLeftRight /></Button>
        <Button variant="ghost" size="icon-sm" aria-label={`حذف ${game.name}`} className="text-destructive" onClick={() => setConfirm("delete")}><Trash2 /></Button>
        <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void replaceImage(f); }} />
      </div>

      <EditGameDialog open={editing} onOpenChange={setEditing} game={game} categoryNames={categoryNames} />
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive={confirm === "delete"}
        title={confirm === "delete" ? `حذف «${game.name}»؟` : `انتقال «${game.name}» به ${other}؟`}
        description={confirm === "delete" ? "بازی و تصویر آن حذف می‌شود و قابل بازگشت نیست." : "دستهٔ بازی با همان نام در پلتفرم مقصد قرار می‌گیرد."}
        confirmLabel={confirm === "delete" ? "بله، حذف شود" : "انتقال"}
        onConfirm={async () => {
          const res = confirm === "delete" ? await deleteCatalogGame(game.id) : await updateCatalogGame(game.id, { platform: other });
          if (!res.ok) return void toast.error(res.error);
          toast.success(res.message);
          router.refresh();
        }}
      />
    </li>
  );
}

function EditGameDialog({ open, onOpenChange, game, categoryNames }: { open: boolean; onOpenChange: (o: boolean) => void; game: AdminCatalogGame; categoryNames: string[] }) {
  const router = useRouter();
  const [name, setName] = React.useState(game.name);
  const [category, setCategory] = React.useState(game.categoryName);
  const [pending, startTransition] = React.useTransition();
  const listId = `cats-${game.id}`;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateCatalogGame(game.id, { name, category });
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (o) { setName(game.name); setCategory(game.categoryName); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>ویرایش بازی</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor={`name-${game.id}`}>نام بازی</Label>
            <Input id={`name-${game.id}`} value={name} maxLength={GAME_NAME_MAX} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`cat-${game.id}`}>دسته‌بندی</Label>
            <Input id={`cat-${game.id}`} list={listId} value={category} maxLength={CATEGORY_MAX} onChange={(e) => setCategory(e.target.value)} />
            <datalist id={listId}>{categoryNames.map((n) => <option key={n} value={n} />)}</datalist>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {categoryNames.map((n) => (
                <button key={n} type="button" onClick={() => setCategory(n)} className={cn("cursor-pointer rounded-full border px-2.5 py-0.5 text-xs", category === n ? "border-brand-black bg-brand-black text-brand-cream" : "hover:bg-secondary")}>{n}</button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">خالی = «بدون دسته»؛ نام جدید = ساخت دستهٔ جدید.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>انصراف</Button>
            <Button type="submit" loading={pending} disabled={!name.trim()}>ذخیره</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { connection } from "next/server";
import { Newspaper } from "lucide-react";
import { NewsCard } from "@/components/news/news-card";
import { EmptyState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { getLatestNews } from "@/features/news/queries";

export async function LatestNews() {
  await connection();
  const posts = await getLatestNews(3);
  if (posts.length === 0) {
    return <EmptyState icon={Newspaper} title="هنوز خبری منتشر نشده" description="اخبار و رویدادهای آتم به‌زودی اینجا منتشر می‌شوند." />;
  }
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {posts.map((p) => (
        <NewsCard key={p.id} post={p} />
      ))}
    </div>
  );
}

export function NewsGridSkeleton() {
  return (
    <div className="grid gap-5 md:grid-cols-3" role="status" aria-label="در حال بارگذاری">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="space-y-3 rounded-xl border bg-surface p-3">
          <Skeleton className="aspect-[16/9] w-full" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-5 w-5/6" />
        </div>
      ))}
    </div>
  );
}

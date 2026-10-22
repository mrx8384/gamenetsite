import Image from "next/image";
import Link from "next/link";
import { Newspaper } from "lucide-react";
import { formatDate } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import type { NewsCardData } from "@/features/news/queries";

export function NewsCard({ post }: { post: NewsCardData }) {
  return (
    <Link
      href={`/news/${encodeURIComponent(post.slug)}`}
      className="group flex flex-col overflow-hidden rounded-xl border bg-surface shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative aspect-[16/9] bg-secondary">
        {post.coverKey ? (
          <Image src={mediaUrl(post.coverKey)} alt="" fill unoptimized sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Newspaper className="size-8" aria-hidden />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {post.categoryName ? <span className="font-medium text-link">{post.categoryName}</span> : null}
          {post.categoryName && post.publishedAt ? <span aria-hidden>•</span> : null}
          {post.publishedAt ? <time dateTime={post.publishedAt.toISOString()}>{formatDate(post.publishedAt)}</time> : null}
        </div>
        <h3 className="line-clamp-2 text-lg leading-8 font-bold group-hover:text-link">{post.title}</h3>
        {post.excerpt ? <p className="line-clamp-2 text-sm leading-7 text-muted-foreground">{post.excerpt}</p> : null}
      </div>
    </Link>
  );
}

"use client";

import * as React from "react";
import { ChevronDown, Lightbulb, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { recordFaqFeedback } from "@/features/support/faq-actions";
import { indexFaqs, matchFaqs, type FaqItem } from "@/features/support/faq-match";
import { cn } from "@/lib/utils";

/** One FAQ with an expandable answer and "solved" / "not solved" buttons. */
function FaqEntry({ faq, open, onToggle, onSolved, onNotSolved }: { faq: FaqItem; open: boolean; onToggle: () => void; onSolved?: () => void; onNotSolved?: () => void }) {
  const id = React.useId();
  return (
    <li className="rounded-xl border bg-surface">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={onToggle} className="flex w-full items-start justify-between gap-2 px-3 py-2 text-start text-sm font-medium">
        {faq.question}
        <ChevronDown className={cn("mt-1 size-4 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div id={id} className="space-y-2 border-t px-3 py-2">
          <p className="text-sm leading-7 whitespace-pre-wrap text-muted-foreground">{faq.answer}</p>
          {onSolved || onNotSolved ? (
            <div className="flex flex-wrap gap-2">
              {onSolved ? (
                <Button type="button" size="sm" onClick={onSolved}>
                  <ThumbsUp /> مشکلم حل شد
                </Button>
              ) : null}
              {onNotSolved ? (
                <Button type="button" size="sm" variant="outline" onClick={onNotSolved}>
                  نه، پیامم را بفرستم
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

const track = (id: string, kind: "open" | "helpful") => void recordFaqFeedback(id, kind).catch(() => {});

/**
 * Answers that match what the user is typing (matched in the browser, no external AI).
 * `onSolved` clears the draft; `onDismiss` hides suggestions for the current text.
 */
export function FaqSuggestions({ faqs, query, onSolved, onDismiss, className }: { faqs: FaqItem[]; query: string; onSolved?: () => void; onDismiss?: () => void; className?: string }) {
  const index = React.useMemo(() => indexFaqs(faqs), [faqs]);
  const deferred = React.useDeferredValue(query);
  const matches = React.useMemo(() => (deferred.trim().length >= 3 ? matchFaqs(index, deferred) : []), [index, deferred]);
  const [openId, setOpenId] = React.useState<string | null>(null);
  if (matches.length === 0) return null;
  return (
    <section aria-label="پیشنهاد پاسخ" className={cn("space-y-2 border-t bg-brand-yellow/10 p-2", className)}>
      <p className="flex items-center gap-1.5 px-1 text-xs font-bold">
        <Lightbulb className="size-4 text-warning" aria-hidden /> شاید جواب سؤالتان این باشد:
      </p>
      <ul className="max-h-48 space-y-1.5 overflow-y-auto">
        {matches.map((f) => (
          <FaqEntry
            key={f.id}
            faq={f}
            open={openId === f.id}
            onToggle={() => {
              if (openId !== f.id) track(f.id, "open");
              setOpenId(openId === f.id ? null : f.id);
            }}
            onSolved={
              onSolved
                ? () => {
                    track(f.id, "helpful");
                    setOpenId(null);
                    onSolved();
                  }
                : undefined
            }
            onNotSolved={onDismiss}
          />
        ))}
      </ul>
    </section>
  );
}

/** The first few FAQs as a quick list (shown before the first message and to guests). */
export function FaqQuickList({ faqs, max = 4 }: { faqs: FaqItem[]; max?: number }) {
  const [openId, setOpenId] = React.useState<string | null>(null);
  if (faqs.length === 0) return null;
  return (
    <section aria-label="سؤالات متداول" className="w-full space-y-1.5">
      <p className="px-1 text-xs font-bold text-muted-foreground">سؤالات متداول</p>
      <ul className="space-y-1.5">
        {faqs.slice(0, max).map((f) => (
          <FaqEntry
            key={f.id}
            faq={f}
            open={openId === f.id}
            onToggle={() => {
              if (openId !== f.id) track(f.id, "open");
              setOpenId(openId === f.id ? null : f.id);
            }}
          />
        ))}
      </ul>
    </section>
  );
}

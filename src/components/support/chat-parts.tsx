"use client";

import * as React from "react";
import { SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SUPPORT_MAX_LENGTH, type ChatMessage } from "@/features/support/constants";
import { cn } from "@/lib/utils";

const timeFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { hour: "2-digit", minute: "2-digit" });
const dateTimeFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString() ? timeFmt.format(d) : dateTimeFmt.format(d);
}

export { mergeMessages } from "@/features/support/merge";

/**
 * Message bubbles. `mine` decides which side a message is on: the customer's own messages
 * (customer view) or staff messages (admin view) sit at the start (right in RTL).
 */
export function ChatMessages({ messages, mineIsStaff, intro, className }: { messages: ChatMessage[]; mineIsStaff: boolean; intro?: React.ReactNode; className?: string }) {
  const endRef = React.useRef<HTMLDivElement>(null);
  const last = messages.at(-1)?.id;
  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [last]);

  return (
    // tabIndex: keyboard users can focus the list and scroll it with the arrow keys.
    <div tabIndex={0} className={cn("flex flex-col gap-2 overflow-y-auto p-3 focus-visible:outline-2 focus-visible:outline-ring", className)} role="log" aria-live="polite" aria-label="پیام‌ها">
      {intro}
      {messages.map((m) => {
        const mine = m.fromStaff === mineIsStaff;
        return (
          <div key={m.id} className={cn("flex max-w-[85%] flex-col gap-0.5", mine ? "self-start items-start" : "self-end items-end")}>
            {m.senderName ? <span className="px-1 text-[11px] text-muted-foreground">{m.senderName}</span> : null}
            <div
              className={cn(
                "rounded-2xl px-3 py-2 text-sm leading-7 break-words whitespace-pre-wrap",
                mine ? "rounded-ss-sm bg-brand-green/20 text-foreground" : "rounded-se-sm border bg-surface text-foreground",
              )}
            >
              {m.body}
            </div>
            <time dateTime={m.createdAt} className="px-1 text-[11px] text-muted-foreground">
              {formatWhen(m.createdAt)}
            </time>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

/** Text box + send button. Enter sends, Shift+Enter adds a line. Returns true from `onSend` to clear. */
export function ChatComposer({
  onSend,
  disabled,
  placeholder = "پیام خود را بنویسید…",
  autoFocus,
  value,
  onValueChange,
}: {
  onSend: (text: string) => Promise<boolean>;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  /** Optional controlled text (the chat widget reads it to suggest FAQ answers). */
  value?: string;
  onValueChange?: (text: string) => void;
}) {
  const [own, setOwn] = React.useState("");
  const text = value ?? own;
  const setText = (t: string) => (onValueChange ? onValueChange(t) : setOwn(t));
  const [pending, setPending] = React.useState(false);
  const ref = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  async function submit() {
    const value = text.trim();
    if (!value || pending) return;
    setPending(true);
    const sent = await onSend(value);
    setPending(false);
    if (sent) setText("");
    ref.current?.focus();
  }

  return (
    <form
      className="flex items-end gap-2 border-t p-2"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void submit();
          }
        }}
        rows={1}
        maxLength={SUPPORT_MAX_LENGTH}
        placeholder={placeholder}
        aria-label="متن پیام"
        disabled={disabled}
        className="max-h-32 min-h-10 resize-none"
      />
      <Button type="submit" size="icon" aria-label="ارسال پیام" loading={pending} disabled={disabled || !text.trim()}>
        <SendHorizontal className="rtl:-scale-x-100" />
      </Button>
    </form>
  );
}

/** Calls `fn` every `ms` while the tab is visible (and once when it becomes visible again). */
export function usePolling(fn: () => void | Promise<void>, ms: number, enabled = true) {
  const fnRef = React.useRef(fn);
  React.useEffect(() => {
    fnRef.current = fn;
  });
  React.useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      if (document.visibilityState === "visible") await Promise.resolve(fnRef.current()).catch(() => {});
      if (!stopped) timer = setTimeout(tick, ms);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        void tick();
      }
    };
    void tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ms, enabled]);
}

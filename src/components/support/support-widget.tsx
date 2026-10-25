"use client";

import * as React from "react";
import Link from "next/link";
import { Headset, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { sendSupportMessage } from "@/features/support/actions";
import { OPEN_SUPPORT_EVENT, POLL_CLOSED_MS, POLL_OPEN_MS, type ChatMessage } from "@/features/support/constants";
import type { FaqItem } from "@/features/support/faq-match";
import { cn } from "@/lib/utils";
import { ChatComposer, ChatMessages, mergeMessages, usePolling } from "./chat-parts";
import { FaqQuickList, FaqSuggestions } from "./faq-suggestions";

export interface SupportTexts {
  title: string;
  welcome: string;
  hours: string;
  loginText: string;
}

type State =
  | { kind: "loading" }
  | { kind: "guest" }
  | { kind: "user"; status: "OPEN" | "CLOSED" | null; unread: number; messages: ChatMessage[]; loaded: boolean };

type ApiResponse = { auth: false } | { auth: true; status: "OPEN" | "CLOSED" | null; unread: number; messages: ChatMessage[] };

/** Floating support chat for every public page. Guests are asked to log in. */
export function SupportWidget({ texts, faqs }: { texts: SupportTexts; faqs: FaqItem[] }) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [guestQuery, setGuestQuery] = React.useState("");
  // Text for which the user said "not solved" (suggestions stay hidden until the text changes).
  const [dismissedFor, setDismissedFor] = React.useState<string | null>(null);
  const [state, setState] = React.useState<State>({ kind: "loading" });
  const panelId = React.useId();
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const last = state.kind === "user" ? state.messages.at(-1)?.createdAt : undefined;
  const loaded = state.kind === "user" && state.loaded;

  const poll = React.useCallback(async () => {
    const params = new URLSearchParams();
    if (open) params.set("open", "1");
    if (open && loaded && last) params.set("after", last);
    const res = await fetch(`/api/support?${params}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as ApiResponse;
    if (!data.auth) return setState({ kind: "guest" });
    setState((prev) => {
      const base = prev.kind === "user" ? prev.messages : [];
      return {
        kind: "user",
        status: data.status,
        unread: data.unread,
        messages: open ? (loaded ? mergeMessages(base, data.messages) : data.messages) : base,
        loaded: loaded || open,
      };
    });
  }, [open, loaded, last]);

  // Guests are detected on the first request and not polled again.
  usePolling(poll, open ? POLL_OPEN_MS : POLL_CLOSED_MS, state.kind !== "guest");

  // Open from anywhere (contact page button) or from an email link (?support=open).
  React.useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_SUPPORT_EVENT, onOpen);
    // Deferred so the first render stays identical to the server's.
    const fromLink = new URLSearchParams(window.location.search).get("support") === "open" ? setTimeout(onOpen, 0) : undefined;
    return () => {
      clearTimeout(fromLink);
      window.removeEventListener(OPEN_SUPPORT_EVENT, onOpen);
    };
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function send(text: string) {
    const res = await sendSupportMessage(text);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    setDismissedFor(null);
    setState((prev) =>
      prev.kind === "user"
        ? { ...prev, status: "OPEN", messages: mergeMessages(prev.messages, [res.data]) }
        : { kind: "user", status: "OPEN", unread: 0, messages: [res.data], loaded: true },
    );
    return true;
  }

  const unread = state.kind === "user" && !open ? state.unread : 0;
  const returnTo = typeof window === "undefined" ? "/" : window.location.pathname;

  return (
    <div className="fixed bottom-4 end-4 z-40 flex flex-col items-end gap-3 print:hidden">
      {open ? (
        <section
          id={panelId}
          role="dialog"
          aria-label={texts.title}
          className="fixed inset-x-2 bottom-20 flex h-[min(34rem,calc(100dvh-7rem))] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl sm:static sm:inset-auto sm:w-96"
        >
          <header className="flex items-start justify-between gap-3 bg-brand-black p-4 text-brand-cream">
            <div>
              <h2 className="flex items-center gap-2 font-bold">
                <Headset className="size-5 text-brand-green" aria-hidden /> {texts.title}
              </h2>
              {texts.hours ? <p className="mt-1 text-xs text-brand-cream/70">{texts.hours}</p> : null}
            </div>
            <Button variant="ghost" size="icon-sm" className="text-brand-cream hover:bg-white/10 hover:text-brand-cream" aria-label="بستن پشتیبانی" onClick={() => setOpen(false)}>
              <X />
            </Button>
          </header>

          {state.kind === "loading" || (state.kind === "user" && !state.loaded) ? (
            <div className="flex flex-1 items-center justify-center">
              <Spinner />
            </div>
          ) : state.kind === "guest" ? (
            <div className="flex flex-1 flex-col items-center gap-4 overflow-y-auto p-4 text-center">
              {faqs.length > 0 ? (
                <div className="w-full space-y-2 text-start">
                  <label className="sr-only" htmlFor={`${panelId}-q`}>جست‌وجو در سؤالات متداول</label>
                  <input
                    id={`${panelId}-q`}
                    value={guestQuery}
                    onChange={(e) => setGuestQuery(e.target.value)}
                    placeholder="سؤالتان را بنویسید تا جوابش را پیدا کنیم…"
                    className="h-10 w-full rounded-lg border bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  {guestQuery.trim().length >= 3 ? <FaqSuggestions faqs={faqs} query={guestQuery} className="rounded-xl border" /> : <FaqQuickList faqs={faqs} />}
                </div>
              ) : null}
              <p className="text-sm leading-7 text-muted-foreground">{texts.loginText}</p>
              <div className="flex gap-2">
                <Button asChild>
                  <Link href={`/login?next=${encodeURIComponent(`${returnTo}?support=open`)}`}>ورود</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/register">ثبت‌نام</Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <ChatMessages
                className="flex-1"
                messages={state.messages}
                mineIsStaff={false}
                intro={
                  <>
                    <div className="max-w-[85%] self-end rounded-2xl rounded-se-sm border bg-surface px-3 py-2 text-sm leading-7">{texts.welcome}</div>
                    {state.messages.length === 0 && faqs.length > 0 && draft.trim().length < 3 ? (
                      <div className="self-stretch">
                        <FaqQuickList faqs={faqs} />
                      </div>
                    ) : null}
                    {state.status === "CLOSED" ? (
                      <p className="my-1 text-center text-xs text-muted-foreground">این گفت‌وگو بسته شده است؛ با ارسال پیام جدید دوباره باز می‌شود.</p>
                    ) : null}
                  </>
                }
              />
              {dismissedFor !== draft ? (
                <FaqSuggestions
                  faqs={faqs}
                  query={draft}
                  onSolved={() => {
                    setDraft("");
                    toast.success("خوشحالیم که مشکلتان حل شد!");
                  }}
                  onDismiss={() => setDismissedFor(draft)}
                />
              ) : null}
              <ChatComposer onSend={send} autoFocus value={draft} onValueChange={setDraft} />
            </>
          )}
        </section>
      ) : null}

      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={unread ? `پشتیبانی آنلاین — ${unread.toLocaleString("fa-IR")} پیام جدید` : "پشتیبانی آنلاین"}
        className={cn(
          "relative flex size-14 items-center justify-center rounded-full bg-brand-green text-brand-black shadow-lg transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        )}
      >
        {open ? <X className="size-6" aria-hidden /> : <Headset className="size-6" aria-hidden />}
        {unread ? (
          <span className="absolute -top-1 -end-1 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-white" aria-hidden>
            {unread.toLocaleString("fa-IR")}
          </span>
        ) : null}
      </button>
    </div>
  );
}

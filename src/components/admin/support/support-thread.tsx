"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { ChatComposer, ChatMessages, mergeMessages, usePolling } from "@/components/support/chat-parts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { replySupport, setSupportStatus } from "@/features/support/actions";
import { POLL_OPEN_MS, USER_ONLINE_WINDOW_MS, type ChatMessage } from "@/features/support/constants";

type Status = "OPEN" | "CLOSED";

/** Staff conversation view: live messages, reply box, close/reopen. */
export function SupportThread({ id, initialStatus }: { id: string; initialStatus: Status }) {
  const router = useRouter();
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [status, setStatus] = React.useState<Status>(initialStatus);
  const [online, setOnline] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const last = messages.at(-1)?.createdAt;

  usePolling(async () => {
    const qs = loaded && last ? `?after=${encodeURIComponent(last)}` : "";
    const res = await fetch(`/api/admin/support/${id}${qs}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { status: Status; userLastSeenAt: string | null; messages: ChatMessage[] };
    setMessages((cur) => (loaded ? mergeMessages(cur, data.messages) : data.messages));
    setLoaded(true);
    setStatus(data.status);
    setOnline(!!data.userLastSeenAt && Date.now() - new Date(data.userLastSeenAt).getTime() < USER_ONLINE_WINDOW_MS);
  }, POLL_OPEN_MS);

  async function send(text: string) {
    const res = await replySupport(id, text);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    setMessages((cur) => mergeMessages(cur, [res.data]));
    setStatus("OPEN");
    return true;
  }

  async function toggle() {
    const next: Status = status === "OPEN" ? "CLOSED" : "OPEN";
    setBusy(true);
    const res = await setSupportStatus(id, next);
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(res.message);
    setStatus(next);
    router.refresh();
  }

  return (
    <div className="flex h-[min(40rem,calc(100dvh-12rem))] flex-col overflow-hidden rounded-xl border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
        <div className="flex items-center gap-2 text-sm">
          {status === "OPEN" ? <Badge variant="success">باز</Badge> : <Badge variant="secondary">بسته</Badge>}
          <span className={online ? "text-success" : "text-muted-foreground"}>{online ? "کاربر الان در سایت است" : "کاربر در سایت نیست — پاسخ با پیامک/ایمیل اطلاع داده می‌شود"}</span>
        </div>
        <Button variant="outline" size="sm" loading={busy} onClick={() => void toggle()}>
          {status === "OPEN" ? <><CheckCircle2 /> بستن گفت‌وگو</> : <><RotateCcw /> باز کردن دوباره</>}
        </Button>
      </div>
      {loaded ? (
        <ChatMessages className="flex-1 bg-secondary/30" messages={messages} mineIsStaff />
      ) : (
        <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">در حال بارگذاری…</p>
      )}
      <ChatComposer onSend={send} placeholder="پاسخ خود را بنویسید… (Enter ارسال، Shift+Enter خط جدید)" autoFocus />
    </div>
  );
}

/** Refreshes the inbox list periodically while visible. */
export function InboxRefresh({ ms = 10_000 }: { ms?: number }) {
  const router = useRouter();
  usePolling(() => router.refresh(), ms);
  return null;
}

import { subscribe } from "@/atom-world/server/rooms";
import { json, validCode } from "@/atom-world/server/http";

/**
 * GET ?token=… → Server-Sent Events: "hello" (my seat, game, friend's name), "peer" (friend joined /
 * online / offline), "msg" (a message from the friend), and a comment every 20 s to keep proxies open.
 */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  if (!validCode(code)) return json({ error: "not-found" }, 404);
  const token = new URL(req.url).searchParams.get("token");
  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (s: string) => {
        try {
          controller.enqueue(enc.encode(s));
        } catch {
          cleanup();
        }
      };
      const sub = subscribe(code, token, (event, data) => {
        if (event === "bye") {
          write("event: bye\ndata: {}\n\n");
          cleanup();
          return;
        }
        write(`event: ${event}\ndata: ${data}\n\n`);
      });
      if ("error" in sub) {
        write(`event: fail\ndata: ${JSON.stringify(sub)}\n\n`);
        controller.close();
        return;
      }
      write(`retry: 2000\nevent: hello\ndata: ${JSON.stringify({ seat: sub.seat, game: sub.game, peer: sub.peer })}\n\n`);
      const ping = setInterval(() => write(": ping\n\n"), 20_000);
      let done = false;
      cleanup = () => {
        if (done) return;
        done = true;
        clearInterval(ping);
        sub.close();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
      // nginx and similar proxies: do not buffer the stream
      "x-accel-buffering": "no",
    },
  });
}

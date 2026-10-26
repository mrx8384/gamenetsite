import { beforeEach, describe, expect, it } from "vitest";
import { _reset, cleanName, createRoom, joinRoom, send, subscribe } from "../../../src/atom-world/server/rooms";

beforeEach(() => _reset());

function created() {
  const r = createRoom("foot-pool", "علی");
  if ("error" in r) throw new Error(r.error);
  return r;
}

describe("online rooms", () => {
  it("creates a 5-digit room and lets one friend join", () => {
    const host = created();
    expect(host.code).toMatch(/^\d{5}$/);
    const guest = joinRoom(host.code, "سارا");
    expect("error" in guest).toBe(false);
    if (!("error" in guest)) {
      expect(guest.game).toBe("foot-pool");
      expect(guest.hostName).toBe("علی");
    }
    expect(joinRoom(host.code, "سوم")).toEqual({ error: "full" });
    expect(joinRoom("00000", "x")).toEqual({ error: "not-found" });
  });

  it("only known games", () => {
    expect(createRoom("poker", "x")).toEqual({ error: "bad-request" });
  });

  it("passes messages to the other seat only, queued until it listens", () => {
    const host = created();
    const guest = joinRoom(host.code, "سارا") as { token: string };
    const got: string[] = [];
    // host gets the "joined" note even before listening
    const hostSub = subscribe(host.code, host.token, (e, d) => got.push(`${e}:${d}`));
    expect(got.some((g) => g.includes('"joined"'))).toBe(true);
    expect(send(host.code, guest.token, [{ t: "kick", p: 0.5 }])).toEqual({ ok: true });
    expect(got.at(-1)).toBe('msg:{"t":"kick","p":0.5}');
    // the guest receives what the host sent before the guest connected
    send(host.code, host.token, [{ t: "start" }]);
    const guestGot: string[] = [];
    subscribe(host.code, guest.token, (e, d) => guestGot.push(`${e}:${d}`));
    expect(guestGot).toContain('msg:{"t":"start"}');
    if (!("error" in hostSub)) hostSub.close();
  });

  it("rejects wrong tokens, oversized and too many messages", () => {
    const host = created();
    joinRoom(host.code, "سارا");
    expect(send(host.code, "nope", [{ t: 1 }])).toEqual({ error: "forbidden" });
    expect(send(host.code, host.token, [{ big: "x".repeat(5000) }])).toEqual({ error: "bad-request" });
    expect(send(host.code, host.token, [])).toEqual({ error: "bad-request" });
    let rate = false;
    for (let i = 0; i < 10 && !rate; i++) rate = "error" in send(host.code, host.token, Array.from({ length: 30 }, () => ({ t: "x" })));
    expect(rate).toBe(true);
  });

  it("tells a player when the friend goes offline", () => {
    const host = created();
    const guest = joinRoom(host.code, "سارا") as { token: string };
    const got: string[] = [];
    subscribe(host.code, host.token, (e, d) => got.push(`${e}:${d}`));
    const g = subscribe(host.code, guest.token, () => {});
    if (!("error" in g)) g.close();
    expect(got.at(-1)).toBe('peer:{"t":"offline"}');
  });

  it("cleans names", () => {
    expect(cleanName("<script>  علی ")).toBe("script علی");
    expect(cleanName("")).toBe("دوست");
  });
});

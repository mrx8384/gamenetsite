import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/features/support/constants";
import { mergeMessages } from "@/features/support/merge";
import { messageBodySchema, parseCursor } from "@/features/support/schemas";

const msg = (id: string, at: string, fromStaff = false): ChatMessage => ({ id, body: id, fromStaff, senderName: null, createdAt: at });

describe("support message body", () => {
  it("trims, normalizes line breaks and rejects empty text", () => {
    expect(messageBodySchema.parse("  سلام\r\nخوبید؟  ")).toBe("سلام\nخوبید؟");
    expect(messageBodySchema.parse("a\n\n\n\n\n\nb")).toBe("a\n\n\nb");
    expect(messageBodySchema.safeParse("   \n ").success).toBe(false);
    expect(messageBodySchema.safeParse(123).success).toBe(false);
  });
  it("limits length to 2000 characters", () => {
    expect(messageBodySchema.safeParse("x".repeat(2000)).success).toBe(true);
    expect(messageBodySchema.safeParse("x".repeat(2001)).success).toBe(false);
  });
});

describe("cursor parsing", () => {
  it("accepts ISO timestamps only", () => {
    expect(parseCursor("2026-10-25T10:00:00.000Z")?.toISOString()).toBe("2026-10-25T10:00:00.000Z");
    expect(parseCursor(null)).toBeUndefined();
    expect(parseCursor("not a date")).toBeUndefined();
    expect(parseCursor("x".repeat(50))).toBeUndefined();
  });
});

describe("mergeMessages", () => {
  const a = msg("a", "2026-10-25T10:00:00.000Z");
  const b = msg("b", "2026-10-25T10:00:01.000Z", true);
  it("skips duplicates from the inclusive polling cursor", () => {
    const cur = [a, b];
    expect(mergeMessages(cur, [b])).toBe(cur); // unchanged reference → no re-render
  });
  it("appends new messages in time order", () => {
    const c = msg("c", "2026-10-25T10:00:00.500Z");
    expect(mergeMessages([a, b], [b, c]).map((m) => m.id)).toEqual(["a", "c", "b"]);
  });
});

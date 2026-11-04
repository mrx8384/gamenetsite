import { describe, expect, it } from "vitest";
import { botLink, checkPreCheckout, codeFromMessage, invoiceParams, transactionResult } from "@/features/payments/providers/bale/logic";

const CODE = "ATOMabcdefghijklmnop1234";

describe("bale wallet gateway rules", () => {
  it("reads the payment code from /start, a deep-link start or the pasted code", () => {
    expect(codeFromMessage(`/start ${CODE}`)).toBe(CODE);
    expect(codeFromMessage(`/start@AtomBot ${CODE}`)).toBe(CODE);
    expect(codeFromMessage(` ${CODE} `)).toBe(CODE);
    expect(codeFromMessage("/start")).toBeNull();
    expect(codeFromMessage("سلام")).toBeNull();
    expect(codeFromMessage("/start ATOM<script>")).toBeNull();
  });

  it("builds a valid invoice in Rials with the code as payload", () => {
    const p = invoiceParams({ chatId: 42, code: CODE, title: "سفارش AT-1405-00012", amountRial: BigInt(12_500_000), providerToken: "WALLET-TEST-1111111111111111", siteName: "اتم گیم کلاب" });
    expect(p.payload).toBe(CODE);
    expect(p.prices).toEqual([{ label: "سفارش AT-1405-00012", amount: 12_500_000 }]);
    expect(p.title.length).toBeLessThanOrEqual(32);
    expect(Buffer.byteLength(p.payload)).toBeLessThanOrEqual(128);
    expect(() => invoiceParams({ chatId: 1, code: CODE, title: "x", amountRial: BigInt(0), providerToken: "t", siteName: "s" })).toThrow();
  });

  it("approves pre-checkout only for an open order with the exact amount", () => {
    const state = { paymentStatus: "INITIATED", open: true, amountRial: BigInt(1000) };
    expect(checkPreCheckout(state, { currency: "IRR", total_amount: 1000 })).toEqual({ ok: true });
    expect(checkPreCheckout(state, { currency: "IRR", total_amount: 999 }).ok).toBe(false);
    expect(checkPreCheckout({ ...state, open: false }, { total_amount: 1000 }).ok).toBe(false);
    expect(checkPreCheckout({ ...state, paymentStatus: "SUCCEEDED" }, { total_amount: 1000 }).ok).toBe(false);
    expect(checkPreCheckout(null, { total_amount: 1000 }).ok).toBe(false);
  });

  it("counts a payment only when Bale says paid for the same amount", () => {
    expect(transactionResult({ status: "paid", amount: 1000 }, BigInt(1000))).toEqual({ ok: true });
    expect(transactionResult({ status: "paid", amount: 10 }, BigInt(1000))).toMatchObject({ ok: false, reason: "amount_mismatch" });
    expect(transactionResult({ status: "pending", amount: 1000 }, BigInt(1000))).toMatchObject({ ok: false, pending: true });
    expect(transactionResult({ status: "failed" }, BigInt(1000))).toMatchObject({ ok: false, reason: "status_failed" });
    expect(transactionResult(null, BigInt(1000))).toMatchObject({ ok: false, pending: true });
  });

  it("links to the bot with the code", () => {
    expect(botLink("@AtomShopBot", CODE)).toBe(`https://ble.ir/AtomShopBot?start=${CODE}`);
  });
});

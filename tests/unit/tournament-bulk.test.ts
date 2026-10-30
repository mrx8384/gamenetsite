import { describe, expect, it } from "vitest";
import { parseBulkNames, participantKey } from "@/features/tournaments/bulk";

describe("parseBulkNames", () => {
  it("splits lines and Persian commas, trims and drops empty lines", () => {
    expect(parseBulkNames("ارش\n\n  امیر  \r\nسینا، رضا;  مهدی  ").names).toEqual(["ارش", "امیر", "سینا", "رضا", "مهدی"]);
  });

  it("removes list markers but keeps names that start with digits", () => {
    expect(parseBulkNames("1. Arash\n۲- امیر\n12) Sina\n- رضا\n• Mahdi\n3:Ali\n50 Cent\n2Pac").names).toEqual(["Arash", "امیر", "Sina", "رضا", "Mahdi", "Ali", "50 Cent", "2Pac"]);
  });

  it("drops repeats regardless of spacing, case and Arabic letter variants", () => {
    const r = parseBulkNames("Ali Reza\nali  reza\nعلي\nعلی\nکاوه\nكاوه");
    expect(r.names).toEqual(["Ali Reza", "علي", "کاوه"]);
    expect(r.repeated).toEqual(["ali reza", "علی", "كاوه"]);
  });

  it("builds the same key for equivalent names", () => {
    expect(participantKey(" Ali   REZA ")).toBe(participantKey("ali reza"));
    expect(participantKey("يزدان")).toBe(participantKey("یزدان"));
  });
});

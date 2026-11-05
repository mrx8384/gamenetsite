import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";
import { predictionSummary, predictorName } from "@/features/tournaments/predictions";
import { claimSchema, readAnswers, readSignupQuestions, signupSchema, tournamentSchema } from "@/features/tournaments/schemas";

describe("sign-up form", () => {
  const team = signupSchema({ teamSize: 3, questions: [{ label: "آیدی PSN", required: true }, { label: "شهر", required: false }] });

  it("needs every team member and the required answers", () => {
    const r = team.safeParse({ name: "تیم اتم", members: ["علی", ""], answers: [""] });
    expect(r.success).toBe(false);
    const paths = r.success ? [] : r.error.issues.map((i) => i.path[0]);
    expect(paths).toContain("members");
    expect(paths).toContain("answers");
  });

  it("keeps the answers with their question and drops empty optional ones", () => {
    const r = team.parse({ name: "تیم اتم", members: ["علی", "رضا", "اضافی"], answers: ["atom_psn", ""] });
    expect(r).toEqual({ name: "تیم اتم", members: ["علی", "رضا"], answers: [{ q: "آیدی PSN", a: "atom_psn" }] });
  });

  it("individual tournaments ignore members", () => {
    expect(signupSchema({ teamSize: null, questions: [] }).parse({ name: "سینا", members: ["x"] })).toEqual({ name: "سینا", members: [], answers: [] });
  });

  it("reads stored JSON defensively", () => {
    expect(readSignupQuestions([{ label: "a", required: true }, { nope: 1 }, "x", { label: "b" }])).toEqual([{ label: "a", required: true }, { label: "b", required: false }]);
    expect(readSignupQuestions(null)).toEqual([]);
    expect(readAnswers([{ q: "a", a: "1" }, { q: 2 }])).toEqual([{ q: "a", a: "1" }]);
  });

  it("tournament settings validate questions and team size", () => {
    const base = { name: "جام تست", game: "FC", format: "SINGLE_ELIMINATION" as const };
    expect(tournamentSchema.parse(base)).toMatchObject({ signupQuestions: [], allowPlayerReports: false, allowPredictions: false, waitlistEnabled: true });
    expect(tournamentSchema.safeParse({ ...base, teamSize: "1" }).success).toBe(false);
    expect(tournamentSchema.parse({ ...base, teamSize: "۲" }).teamSize).toBe(2);
    expect(tournamentSchema.safeParse({ ...base, signupQuestions: Array.from({ length: 6 }, () => ({ label: "سؤال", required: false })) }).success).toBe(false);
    expect(tournamentSchema.safeParse({ ...base, signupQuestions: [{ label: "", required: true }] }).success).toBe(false);
  });
});

describe("player result report", () => {
  it("score or set scores, never a forfeit", () => {
    expect(claimSchema.parse({ score1: "۲", score2: "1" })).toMatchObject({ score1: 2, score2: 1, setScores: null });
    expect(claimSchema.parse({ setScores: "3-1, 1-3, 3-2" })).toMatchObject({ score1: 2, score2: 1, setScores: "3-1,1-3,3-2" });
    expect(claimSchema.safeParse({ score1: "2" }).success).toBe(false);
    expect(claimSchema.parse({ score1: 1, score2: 0, forfeit: true })).not.toHaveProperty("forfeit");
  });
});

describe("predictions", () => {
  const matches = [
    { id: "m1", player1Id: "a", player2Id: "b", status: "COMPLETED", winnerId: "a", forfeit: false },
    { id: "m2", player1Id: "c", player2Id: "d", status: "COMPLETED", winnerId: "d", forfeit: true },
    { id: "m3", player1Id: "a", player2Id: "d", status: "PENDING", winnerId: null, forfeit: false },
  ];
  it("counts only current players, scores decided non-forfeit matches", () => {
    const { counts, ranking } = predictionSummary(matches, [
      { matchId: "m1", userId: "u1", participantId: "a" },
      { matchId: "m1", userId: "u2", participantId: "b" },
      { matchId: "m2", userId: "u2", participantId: "d" },
      { matchId: "m3", userId: "u1", participantId: "a" },
      { matchId: "m3", userId: "u2", participantId: "c" }, // stale: c is no longer in m3
    ]);
    expect(counts).toEqual({ m1: { a: 1, b: 1 }, m2: { d: 1 }, m3: { a: 1 } });
    expect(ranking).toEqual([
      { userId: "u1", correct: 1, decided: 1 },
      { userId: "u2", correct: 0, decided: 1 },
    ]);
  });
  it("public name is the first word only", () => {
    expect(predictorName("  رضا یوسفی ")).toBe("رضا");
    expect(predictorName("")).toBe("کاربر");
  });
});

describe("csv", () => {
  it("BOM, quoting and formula protection", () => {
    const out = toCsv([["نام", "a,b", 'x"y'], ["=HYPERLINK(1)", -5, "+98"], [null, "@cmd", " pad"]]);
    expect(out.startsWith("﻿")).toBe(true);
    expect(out).toBe('﻿نام,"a,b","x""y"\r\n\'=HYPERLINK(1),-5,\'+98\r\n,\'@cmd," pad"\r\n');
  });
});

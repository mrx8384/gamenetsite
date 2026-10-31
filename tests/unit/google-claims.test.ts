import { describe, expect, it } from "vitest";
import { checkGoogleClaims } from "@/features/auth/google-claims";

const token = (claims: Record<string, unknown>) => `x.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`;
const good = { iss: "https://accounts.google.com", aud: "client-1", sub: "1234", email: "Ali@Gmail.com", email_verified: true, name: "  علی   رضایی ", nonce: "n1", exp: 2000 };
const opts = { clientId: "client-1", nonce: "n1", nowSeconds: 1000 };

describe("checkGoogleClaims", () => {
  it("accepts a valid token and normalises email and name", () => {
    expect(checkGoogleClaims(token(good), opts)).toEqual({ ok: true, claims: { sub: "1234", email: "ali@gmail.com", name: "علی رضایی" } });
  });

  it.each([
    [{ iss: "https://evil.example" }, "issuer"],
    [{ aud: "someone-else" }, "audience"],
    [{ exp: 100 }, "expired"],
    [{ nonce: "other" }, "nonce"],
    [{ email_verified: false }, "email_unverified"],
    [{ sub: "" }, "malformed"],
  ])("rejects %j", (patch, error) => {
    expect(checkGoogleClaims(token({ ...good, ...patch }), opts)).toEqual({ ok: false, error });
  });

  it("rejects garbage", () => {
    expect(checkGoogleClaims("not-a-jwt", opts)).toEqual({ ok: false, error: "malformed" });
  });

  it("falls back to the email name when Google gives no name", () => {
    const r = checkGoogleClaims(token({ ...good, name: undefined }), opts);
    expect(r.ok && r.claims.name).toBe("ali");
  });
});

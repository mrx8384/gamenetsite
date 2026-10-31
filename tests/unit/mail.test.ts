import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: { MAIL_PROVIDER: "log", SMTP_PORT: 465 } }));
const { mailHtml, smtpOptions } = await import("@/lib/notify/mail");

describe("smtpOptions", () => {
  it("reads separate values; 465 = TLS, 587 = STARTTLS required", () => {
    const a = smtpOptions({ SMTP_URL: undefined, SMTP_HOST: "mail.x.ir", SMTP_PORT: 465, SMTP_USER: "info@x.ir", SMTP_PASSWORD: "p" });
    expect(a).toMatchObject({ host: "mail.x.ir", port: 465, secure: true, requireTLS: false, auth: { user: "info@x.ir", pass: "p" } });
    const b = smtpOptions({ SMTP_URL: undefined, SMTP_HOST: "mail.x.ir", SMTP_PORT: 587, SMTP_USER: "u", SMTP_PASSWORD: "p" });
    expect(b).toMatchObject({ secure: false, requireTLS: true });
  });

  it("decodes URL credentials with special characters", () => {
    const o = smtpOptions({ SMTP_URL: "smtps://info%40x.ir:p%40ss%3Aw%2Frd@mail.x.ir", SMTP_HOST: undefined, SMTP_PORT: 465, SMTP_USER: undefined, SMTP_PASSWORD: undefined });
    expect(o).toMatchObject({ host: "mail.x.ir", port: 465, secure: true, auth: { user: "info@x.ir", pass: "p@ss:w/rd" } });
    expect(smtpOptions({ SMTP_URL: "smtp://u:p@h", SMTP_HOST: undefined, SMTP_PORT: 465, SMTP_USER: undefined, SMTP_PASSWORD: undefined })).toMatchObject({ port: 587, secure: false, requireTLS: true });
  });

  it("always bounds waits", () => {
    const o = smtpOptions({ SMTP_URL: "smtp://u:p@h:2525", SMTP_HOST: undefined, SMTP_PORT: 465, SMTP_USER: undefined, SMTP_PASSWORD: undefined });
    expect(o.socketTimeout).toBeGreaterThan(0);
    expect(o.connectionTimeout).toBeGreaterThan(0);
  });
});

describe("mailHtml", () => {
  it("is right-to-left and escapes HTML", () => {
    const html = mailHtml("کد شما: 123\n<b>x</b>");
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).not.toContain("<b>x</b>");
  });
});

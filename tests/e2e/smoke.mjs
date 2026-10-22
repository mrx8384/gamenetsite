/**
 * Read-only smoke test for a running site (local production build or the live server).
 * Checks every public page for: HTTP 200, security headers, fa/RTL document, no console errors,
 * no CSP violations, no serious/critical accessibility issues (axe, WCAG 2 A/AA), and no
 * horizontal overflow on mobile. Writes nothing.
 *
 *   BASE_URL=http://localhost:3000 pnpm test:e2e
 *   CHROMIUM_PATH=/path/to/chrome  (optional; defaults to Playwright's browser lookup)
 */
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright-core";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const PAGES = ["/", "/shop", "/news", "/game-catalog", "/game-catalog/ps4", "/game-catalog/ps5", "/partners", "/tournaments", "/tournaments/gamepad-tester", "/about", "/contact", "/cart", "/login", "/register", "/forgot-password"];

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const failures = [];
let passed = 0;
const check = (name, ok, detail = "") => (ok ? passed++ : failures.push(`${name}${detail ? ` — ${detail}` : ""}`));

const page = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(e.message));

for (const path of PAGES) {
  errors.length = 0;
  const res = await page.goto(BASE + path, { waitUntil: "networkidle" });
  const h = res?.headers() ?? {};
  check(`${path} status 200`, res?.status() === 200, String(res?.status()));
  check(`${path} security headers`, (h["content-security-policy"] ?? "").includes("frame-ancestors 'none'") && h["x-content-type-options"] === "nosniff" && h["x-frame-options"] === "DENY");
  check(`${path} fa/rtl`, await page.evaluate(() => document.documentElement.lang === "fa" && document.documentElement.dir === "rtl"));
  check(`${path} no console errors / CSP violations`, errors.length === 0, errors.join(" ; ").slice(0, 300));
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  check(`${path} accessibility`, serious.length === 0, serious.map((v) => `${v.id}: ${v.nodes[0]?.target}`).join(" | "));
}

const mobile = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
for (const path of ["/", "/shop", "/game-catalog/ps4", "/partners", "/contact"]) {
  await mobile.goto(BASE + path, { waitUntil: "networkidle" });
  check(`${path} mobile overflow`, !(await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)));
}

const missing = await page.goto(BASE + "/__smoke-test-missing-page__");
check("unknown route → 404", missing?.status() === 404, String(missing?.status()));
const robots = await page.request.get(BASE + "/robots.txt");
check("robots.txt", robots.ok() && (await robots.text()).includes("Disallow: /admin"));
const sitemap = await page.request.get(BASE + "/sitemap.xml");
check("sitemap.xml", sitemap.ok() && (await sitemap.text()).includes("<urlset"));
const health = await page.request.get(BASE + "/api/health");
check("/api/health", health.ok());

await browser.close();
console.log(`${passed} passed, ${failures.length} failed`);
for (const f of failures) console.log(`FAIL  ${f}`);
process.exit(failures.length ? 1 : 0);

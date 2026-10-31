/**
 * Daily maintenance (run from cron). Safe to run repeatedly.
 *
 *   pnpm maintenance                 # routine cleanup
 *   pnpm maintenance --media         # also prune unused uploads older than 24 h
 *   pnpm maintenance --dry-run ...   # only report
 *
 * Routine: expired sessions, old one-time codes, finished rate-limit windows, expired guest carts,
 * unpaid orders past their payment window (stock returned), ACTIVE subscriptions past their end
 * date → EXPIRED.
 */
import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";

try {
  process.loadEnvFile(".env");
} catch {
  /* use real environment */
}

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const pruneMedia = args.has("--media");
const DAY = 86_400_000;

async function main() {
  const { db } = await import("../src/lib/db");
  const now = new Date();
  const report: Record<string, number> = {};

  const count = async (key: string, run: () => Promise<number>, preview: () => Promise<number>) => {
    report[key] = dryRun ? await preview() : await run();
  };

  await count("expiredSessions", async () => (await db.session.deleteMany({ where: { expiresAt: { lt: now } } })).count, () => db.session.count({ where: { expiresAt: { lt: now } } }));
  // Keep codes for a day after expiry (useful when investigating abuse), then delete.
  const codeCutoff = new Date(now.getTime() - DAY);
  await count("oldVerificationCodes", async () => (await db.verificationCode.deleteMany({ where: { expiresAt: { lt: codeCutoff } } })).count, () => db.verificationCode.count({ where: { expiresAt: { lt: codeCutoff } } }));
  await count("finishedRateLimitWindows", async () => (await db.rateLimitBucket.deleteMany({ where: { resetAt: { lt: now } } })).count, () => db.rateLimitBucket.count({ where: { resetAt: { lt: now } } }));
  await count(
    "expiredGuestCarts",
    async () => (await db.cart.deleteMany({ where: { userId: null, expiresAt: { lt: now } } })).count,
    () => db.cart.count({ where: { userId: null, expiresAt: { lt: now } } }),
  );
  await count(
    "expiredUnpaidOrders",
    async () => {
      const { expireStaleOrders } = await import("../src/features/orders/service");
      let total = 0;
      for (let n = await expireStaleOrders(); n > 0; n = await expireStaleOrders()) total += n;
      return total;
    },
    () => db.order.count({ where: { status: "AWAITING_PAYMENT", paymentDeadline: { lt: now } } }),
  );
  await count(
    "endedSubscriptions",
    async () => (await db.partnerSubscription.updateMany({ where: { status: "ACTIVE", endsAt: { lt: now } }, data: { status: "EXPIRED" } })).count,
    () => db.partnerSubscription.count({ where: { status: "ACTIVE", endsAt: { lt: now } } }),
  );

  if (pruneMedia) {
    const { uploadRoot } = await import("../src/features/media/storage");
    const root = uploadRoot();
    const cutoff = new Date(now.getTime() - DAY); // never touch uploads from a form that is still open
    // Unreferenced rows: no relation and not used inside rich-text content (news posts, pages).
    const candidates = await db.media.findMany({
      where: { createdAt: { lt: cutoff }, catalogGames: { none: {} }, productImages: { none: {} }, newsCovers: { none: {} }, categoryImages: { none: {} }, organizations: { none: {} } },
      select: { id: true, storageKey: true },
    });
    const unused: { id: string; storageKey: string }[] = [];
    for (const m of candidates) {
      const needle = `%${m.storageKey}%`;
      const rows = await db.$queryRaw<{ n: bigint }[]>`
        SELECT (SELECT count(*) FROM news_posts WHERE "contentHtml" LIKE ${needle} OR "contentJson"::text LIKE ${needle})
             + (SELECT count(*) FROM pages WHERE "contentHtml" LIKE ${needle} OR "contentJson"::text LIKE ${needle}) AS n`;
      if (Number(rows[0]?.n ?? 0) === 0) unused.push(m);
    }
    if (!dryRun) {
      for (const m of unused) await unlink(path.join(root, m.storageKey)).catch(() => {});
      await db.media.deleteMany({ where: { id: { in: unused.map((m) => m.id) } } });
    }
    report.unusedMedia = unused.length;

    // Files on disk without a database row (e.g. an interrupted upload).
    const known = new Set((await db.media.findMany({ select: { storageKey: true } })).map((m) => m.storageKey));
    let strayFiles = 0;
    const walk = async (dir: string): Promise<void> => {
      for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) await walk(full);
        else if (entry.isFile()) {
          const key = path.relative(root, full).split(path.sep).join("/");
          if (known.has(key) || (await stat(full)).mtime > cutoff) continue;
          strayFiles++;
          if (!dryRun) await unlink(full).catch(() => {});
        }
      }
    };
    await walk(root);
    report.strayFiles = strayFiles;
  }

  console.log(`${dryRun ? "[dry-run] " : ""}maintenance ${now.toISOString()}`);
  for (const [k, v] of Object.entries(report)) console.log(`  ${k}: ${v}`);
  await db.$disconnect();
}

main().catch((e: unknown) => {
  console.error("✗ maintenance failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});

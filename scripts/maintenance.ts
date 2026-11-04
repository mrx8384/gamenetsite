/**
 * Daily maintenance (run from cron). Safe to run repeatedly.
 *
 *   pnpm maintenance                 # routine cleanup
 *   pnpm maintenance --media         # also prune unused uploads older than 24 h
 *   pnpm maintenance --dry-run ...   # only report
 *
 * Routine: expired sessions, old one-time codes, finished rate-limit windows, expired guest carts,
 * unpaid orders past their payment window (stock returned), ACTIVE subscriptions past their end
 * date → EXPIRED; accounts without activity for the period set in Admin → کاربران (off by default).
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
    "expiredTournamentEntries",
    async () => (await db.tournamentEntry.updateMany({ where: { status: "AWAITING_PAYMENT", paymentDeadline: { lt: now } }, data: { status: "CANCELLED", note: "مهلت پرداخت تمام شد" } })).count,
    () => db.tournamentEntry.count({ where: { status: "AWAITING_PAYMENT", paymentDeadline: { lt: now } } }),
  );
  {
    // Same rule as SUBSCRIPTION_PAYMENT_MINUTES (src/features/subscriptions/purchase.ts).
    const where = { status: "INACTIVE" as const, paymentId: { not: null }, payment: { status: "INITIATED" as const, createdAt: { lt: new Date(now.getTime() - 20 * 60_000) } } };
    await count(
      "expiredSubscriptionPurchases",
      async () => (await db.partnerSubscription.updateMany({ where, data: { status: "CANCELLED", note: "مهلت پرداخت تمام شد" } })).count,
      () => db.partnerSubscription.count({ where }),
    );
  }
  await count(
    "endedSubscriptions",
    async () => (await db.partnerSubscription.updateMany({ where: { status: "ACTIVE", endsAt: { lt: now } }, data: { status: "EXPIRED" } })).count,
    () => db.partnerSubscription.count({ where: { status: "ACTIVE", endsAt: { lt: now } } }),
  );

  // «حذف خودکار حساب‌های بدون فعالیت» (Admin → کاربران). Off unless the admin chose a period.
  {
    const { ACCOUNTS_SETTINGS_KEY, accountsSettingsSchema, inactiveCutoff, inactiveUsersWhere } = await import("../src/features/users/cleanup");
    const row = await db.siteSetting.findUnique({ where: { key: ACCOUNTS_SETTINGS_KEY } });
    const months = accountsSettingsSchema.safeParse(row?.value ?? {}).data?.inactiveDeleteMonths ?? 0;
    if (months > 0) {
      const where = inactiveUsersWhere(inactiveCutoff(months, now));
      await count(
        "inactiveAccountsDeleted",
        async () => {
          // At most 500 a night, so a wrong setting can be noticed and changed before much is removed.
          const ids = (await db.user.findMany({ where, select: { id: true }, orderBy: { createdAt: "asc" }, take: 500 })).map((u) => u.id);
          if (ids.length === 0) return 0;
          const { count: n } = await db.user.deleteMany({ where: { AND: [where, { id: { in: ids } }] } });
          await db.auditLog.create({ data: { action: "users.auto_deleted", entity: "user", meta: { count: n, months } } });
          return n;
        },
        () => db.user.count({ where }),
      );
    }
  }

  if (pruneMedia) {
    const { uploadRoot } = await import("../src/features/media/storage");
    const root = uploadRoot();
    const cutoff = new Date(now.getTime() - DAY); // never touch uploads from a form that is still open
    // Unreferenced rows: no relation and not used inside rich-text content (news posts, pages).
    const candidates = await db.media.findMany({
      where: { createdAt: { lt: cutoff }, catalogGames: { none: {} }, productImages: { none: {} }, newsCovers: { none: {} }, categoryImages: { none: {} }, organizations: { none: {} }, parkAttractions: { none: {} } },
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

/**
 * Creates (or promotes) an ADMIN account. There is no default admin password.
 *
 * Interactive:      pnpm admin:create
 * Non-interactive:  ADMIN_NAME=... ADMIN_IDENTIFIER=09121234567 ADMIN_PASSWORD=... pnpm admin:create
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { parseIdentifier } from "../src/lib/identifiers";
import { passwordSchema } from "../src/lib/auth/password-policy";

try {
  process.loadEnvFile(".env");
} catch {
  /* use real environment */
}

async function ask(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  return (await rl.question(question)).trim();
}

/** Reads a password without echoing it (shows one * per character). Falls back to a plain line when not a terminal. */
function askHidden(question: string): Promise<string> {
  if (!stdin.isTTY) {
    const rl = createInterface({ input: stdin, output: stdout });
    return rl.question(question).finally(() => rl.close());
  }
  return new Promise((resolve) => {
    stdout.write(question);
    let value = "";
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    stdin.resume();
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          return resolve(value);
        }
        if (ch === "\u0003") {
          stdin.setRawMode(false);
          stdout.write("\n");
          process.exit(130); // Ctrl+C
        }
        if (ch === "\u007f" || ch === "\b") {
          if (value) {
            value = value.slice(0, -1);
            stdout.write("\b \b");
          }
        } else if (ch >= " ") {
          value += ch;
          stdout.write("*");
        }
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });
  const name = process.env.ADMIN_NAME ?? (await ask(rl, "Admin name: "));
  const identifierRaw = process.env.ADMIN_IDENTIFIER ?? (await ask(rl, "Mobile (09...) or email: "));
  rl.close();
  const password = process.env.ADMIN_PASSWORD ?? (await askHidden("Password (min 8, letters + digits): "));

  const id = parseIdentifier(identifierRaw);
  if (!id) throw new Error("Invalid mobile number or email.");
  if (name.trim().length < 2) throw new Error("Name is too short.");
  const pw = passwordSchema.safeParse(password);
  if (!pw.success) throw new Error(`Weak password: ${pw.error.issues[0]?.message}`);

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    const where = id.kind === "phone" ? { phone: id.value } : { email: id.value };
    const verified = id.kind === "phone" ? { phoneVerifiedAt: new Date() } : { emailVerifiedAt: new Date() };
    const passwordHash = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
    const existing = await db.user.findUnique({ where, select: { id: true } });
    const user = existing
      ? await db.user.update({ where: { id: existing.id }, data: { role: "ADMIN", isActive: true, passwordHash, name: name.trim(), ...verified, sessionVersion: { increment: 1 } } })
      : await db.user.create({ data: { ...where, ...verified, name: name.trim(), passwordHash, role: "ADMIN" } });
    if (existing) await db.session.deleteMany({ where: { userId: user.id } });
    await db.auditLog.create({ data: { actorId: null, action: existing ? "cli.admin_promoted" : "cli.admin_created", entity: "user", entityId: user.id } });
    console.log(`✓ Admin ${existing ? "updated" : "created"}: ${user.name} (${id.value})`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e: unknown) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});

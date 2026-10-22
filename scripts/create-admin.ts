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

async function ask(rl: ReturnType<typeof createInterface>, question: string, hidden = false): Promise<string> {
  if (!hidden) return (await rl.question(question)).trim();
  // Hide typed characters for passwords.
  const output = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WritableStream };
  const original = output._writeToOutput;
  stdout.write(question);
  output._writeToOutput = () => {};
  const answer = await rl.question("");
  output._writeToOutput = original;
  stdout.write("\n");
  return answer;
}

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });
  const name = process.env.ADMIN_NAME ?? (await ask(rl, "Admin name: "));
  const identifierRaw = process.env.ADMIN_IDENTIFIER ?? (await ask(rl, "Mobile (09...) or email: "));
  const password = process.env.ADMIN_PASSWORD ?? (await ask(rl, "Password (min 8, letters + digits): ", true));
  rl.close();

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

import "server-only";
import { hash, verify } from "@node-rs/argon2";

// argon2id with OWASP-recommended parameters (19 MiB, 2 iterations, 1 lane).
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

// Used when the account does not exist, so response time doesn't reveal it.
let dummyHash: Promise<string> | null = null;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hash("atom-dummy-password-for-timing", OPTIONS);
  await verifyPassword(await dummyHash, password);
}

import { defineConfig, env } from "prisma/config";

// Prisma 7 does not load .env automatically. Use Node's built-in loader (no dotenv dependency).
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file (e.g. CI/production): rely on real environment variables.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});

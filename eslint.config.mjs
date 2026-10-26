import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
    "services/**", // original Python Game Catalog (kept unchanged)
    "public/atom-world/**", // 3D world: third-party decoders (minified) and the generated offline worker
  ]),
]);

export default eslintConfig;

import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  { ignores: [".next/**", "dist/**", "next-env.d.ts", "lib/db/generated/**", "coverage/**", "test-results/**", "playwright-report/**", "blob-report/**", "e2e/.auth/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default config;

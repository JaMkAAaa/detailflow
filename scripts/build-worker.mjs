import { build } from "esbuild";

await build({
  entryPoints: ["worker/index.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: "dist/worker.mjs",
  // BullMQ, pg i SMTP używają require() do modułów Node również w bundlu ESM.
  banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' },
});

// Bundles the API into one self-contained Netlify function (netlify-functions/api.mjs).
// netlify.toml publishes frontend/dist and rewrites /api/* to this function.
// Run `npm run build` first so frontend/dist exists.
import { existsSync, rmSync } from "node:fs";
import { build } from "esbuild";

if (!existsSync("frontend/dist/index.html")) {
  throw new Error("frontend/dist is missing; run `npm run build` first");
}

rmSync("netlify-functions", { recursive: true, force: true });

await build({
  entryPoints: { api: "backend/src/netlify.ts" },
  outdir: "netlify-functions",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  external: ["pg-native"],
  // pg and other CommonJS dependencies call require() for Node built-ins.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: "info",
});

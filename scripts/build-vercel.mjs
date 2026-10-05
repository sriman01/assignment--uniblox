// Writes Vercel's Build Output API (v3) layout to .vercel/output:
//   static/             the built React app, served by the CDN
//   functions/api.func  one Node function that serves every /api/* route
//   config.json         routing: /api/* to the function, real files from the CDN, everything else to index.html
// Run `npm run build` first so frontend/dist exists.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { build } from "esbuild";

const output = ".vercel/output";
const functionDir = `${output}/functions/api.func`;

if (!existsSync("frontend/dist/index.html")) {
  throw new Error("frontend/dist is missing; run `npm run build` first");
}

rmSync(output, { recursive: true, force: true });
mkdirSync(functionDir, { recursive: true });
cpSync("frontend/dist", `${output}/static`, { recursive: true });

await build({
  entryPoints: ["backend/src/vercel.ts"],
  outfile: `${functionDir}/index.mjs`,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  external: ["pg-native"],
  // pg and other CommonJS dependencies call require() for Node built-ins.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: "info",
});

writeFileSync(
  `${functionDir}/.vc-config.json`,
  JSON.stringify(
    {
      runtime: "nodejs22.x",
      handler: "index.mjs",
      launcherType: "Nodejs",
      shouldAddHelpers: false,
      supportsResponseStreaming: true,
      maxDuration: 30,
    },
    null,
    2,
  ),
);

writeFileSync(
  `${output}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: "^/assets/(.*)$", headers: { "cache-control": "public, max-age=31536000, immutable" }, continue: true },
        { src: "^/api(?:/.*)?$", dest: "/api" },
        { handle: "filesystem" },
        { src: "^/(.*)$", dest: "/index.html" },
      ],
    },
    null,
    2,
  ),
);

console.log(`wrote ${output}`);

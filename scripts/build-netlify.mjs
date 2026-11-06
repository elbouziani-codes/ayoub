import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Netlify's OpenNext adapter consumes native Next.js output in .next.
// Keep the existing Vinext build for Sites/Cloudflare deployments.
const nextCli = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const result = spawnSync(process.execPath, [
  nextCli, "build", "--webpack", ...process.argv.slice(2),
], {
  stdio: "inherit",
  env: { ...process.env, AYOUB_RUNTIME: "netlify" },
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);

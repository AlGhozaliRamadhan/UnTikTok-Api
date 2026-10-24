#!/usr/bin/env node

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// The entry point fires a background update check on import; keep it
// offline/no-op the same way CI does.
process.env.CI = "true";

const entry = resolve(process.cwd(), "dist", "esm", "index.js");

try {
  const mod = await import(pathToFileURL(entry).href);
  if (typeof mod.TikTokApi !== "function") {
    throw new Error(`TikTokApi export missing (got ${typeof mod.TikTokApi})`);
  }
  console.log(`[check-esm] OK: ${entry}`);
} catch (err) {
  console.error(`[check-esm] FAILED: cannot import ${entry}`);
  console.error(err);
  process.exitCode = 1;
}

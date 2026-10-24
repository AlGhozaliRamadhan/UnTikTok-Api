#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = resolve(root, "package.json");
const target = resolve(root, "src", "version.ts");
const check = process.argv.includes("--check");

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
if (typeof pkg.version !== "string" || pkg.version.length === 0) {
  console.error("[sync-version] package.json has no string `version` field");
  process.exit(2);
}

const expected = `// Generated from package.json by scripts/sync-version.mjs. Do not edit.
export const PACKAGE_VERSION = "${pkg.version}";
`;

let current = "";
try {
  current = readFileSync(target, "utf8");
} catch {
  // Missing file counts as stale.
}

if (check) {
  if (current !== expected) {
    console.error(
      `[sync-version] src/version.ts is stale (package.json is ${pkg.version}). ` +
        `Run \`npm run sync-version\`.`,
    );
    process.exit(1);
  }
  console.log(`[sync-version] OK: src/version.ts matches package.json (${pkg.version})`);
  process.exit(0);
}

if (current === expected) {
  console.log(`[sync-version] up to date (${pkg.version})`);
  process.exit(0);
}

writeFileSync(target, expected);
console.log(`[sync-version] wrote src/version.ts (${pkg.version})`);

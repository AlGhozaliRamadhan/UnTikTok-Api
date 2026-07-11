// scripts/write-esm-package.mjs
// After the ESM tsc pass runs, drop a `dist/esm/package.json` with `"type": "module"`
// so Node treats the emitted `.js` files as ESM. See ADR-006.

import { copyFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const src = resolve(root, "scripts", "esm-package-template.json");
const dest = resolve(root, "dist", "esm", "package.json");

await mkdir(dirname(dest), { recursive: true });
await copyFile(src, dest);
console.log(`ESM package.json written to ${dest}`);
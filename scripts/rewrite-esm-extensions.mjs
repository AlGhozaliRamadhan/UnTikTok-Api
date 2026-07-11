// scripts/rewrite-esm-extensions.mjs
// After the ESM tsc pass emits extensionless `import "./tiktok"` statements,
// walk dist/esm and rewrite them so Node's strict ESM resolver can load them.
// - `from "./tiktok"` -> `from "./tiktok.js"` (file exists)
// - `from "./stealth"` -> `from "./stealth/index.js"` (directory with index.js)
// See ADR-006.

import { readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { extname, join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const esmDir = resolve(root, "dist", "esm");

// Matches `from "./...path"` or `from "../...path"` where path has no extension.
const RE = /(from\s+)(["'])(\.{1,2}\/[^"'\n]*?)(["'])/g;

async function* walk(dir) {
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) yield* walk(p);
    else if (extname(ent.name) === ".js") yield p;
  }
}

function resolveSpecifier(fromFile, rel) {
  if (/\.[a-z0-9]+$/i.test(rel) || rel.includes("?") || rel.includes("#")) return rel;
  const absdir = dirname(fromFile);
  const abs = resolve(absdir, rel);
  if (existsSync(`${abs}.js`)) return `${rel}.js`;
  if (existsSync(join(abs, "index.js"))) return `${rel}/index.js`;
  return `${rel}.js`;
}

let rewritten = 0;
for await (const file of walk(esmDir)) {
  const src = await readFile(file, "utf8");
  const out = src.replace(RE, (m, pre, q1, rel, q2) => {
    return `${pre}${q1}${resolveSpecifier(file, rel)}${q2}`;
  });
  if (out !== src) {
    await writeFile(file, out);
    rewritten++;
  }
}
console.log(`ESM specifier extensions rewritten in ${rewritten} file(s) under ${esmDir}`);
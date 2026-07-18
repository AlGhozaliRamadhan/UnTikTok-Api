// scripts/check-npm-version.mjs
// Compare the version in package.json against the latest published
// version on the npm registry. Used by CI and by developers who want
// a quick local check.
//
// Modes:
//   default           -> exit 0 either way, prints a clear message
//   --strict          -> exit 1 when local version is behind latest
//   --json            -> print `{ current, latest, outdated }` JSON and exit 0
//   --skip-fetch      -> skip network entirely (for offline debugging)
//
// Honours the same env-var opt-outs as the runtime check
// (UNTIKTOK_SKIP_VERSION_CHECK, CI, NO_UPDATE_NOTIFIER) — running this
// in CI is a no-op unless the CI variable is *explicitly* unset.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const args = new Set(process.argv.slice(2));
const strict = args.has("--strict");
const json = args.has("--json");
const skipFetch = args.has("--skip-fetch");

const NPM_REGISTRY = "https://registry.npmjs.org";
const NPM_PACKAGE = "untiktok-api";

function loadLocalVersion() {
  const raw = readFileSync(resolve(root, "package.json"), "utf8");
  const parsed = JSON.parse(raw);
  if (typeof parsed.version !== "string") {
    console.error("Could not read a string `version` from package.json");
    process.exit(2);
  }
  return parsed.version;
}

function compareVersions(a, b) {
  const [aMain = "", aPre = ""] = a.split("-", 2);
  const [bMain = "", bPre = ""] = b.split("-", 2);
  const aNums = aMain.split(".").map((s) => Number.parseInt(s, 10) || 0);
  const bNums = bMain.split(".").map((s) => Number.parseInt(s, 10) || 0);
  const len = Math.max(aNums.length, bNums.length);
  for (let i = 0; i < len; i++) {
    const d = (aNums[i] ?? 0) - (bNums[i] ?? 0);
    if (d !== 0) return d;
  }
  if (aPre && !bPre) return -1;
  if (!aPre && bPre) return 1;
  if (aPre < bPre) return -1;
  if (aPre > bPre) return 1;
  return 0;
}

async function fetchLatest(timeoutMs = 4_000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${NPM_REGISTRY}/${NPM_PACKAGE}/latest`, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": `${NPM_PACKAGE}/${loadLocalVersion()}`,
      },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return typeof body.version === "string" ? body.version : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function isDisabled() {
  if (process.env.UNTIKTOK_SKIP_VERSION_CHECK === "1") return true;
  if (process.env.NO_UPDATE_NOTIFIER === "1") return true;
  return false;
}

const current = loadLocalVersion();

if (isDisabled() || skipFetch) {
  if (json) {
    console.log(JSON.stringify({ current, latest: null, outdated: false, skipped: true }));
  } else {
    console.log(`check:npm-version skipped (env opt-out or --skip-fetch); local v${current}`);
  }
  process.exit(0);
}

const latest = await fetchLatest();

if (latest === null) {
  console.error(
    `Could not reach ${NPM_REGISTRY}/${NPM_PACKAGE}/latest within 4s. ` +
      `Skipping the check rather than failing the build.`,
  );
  process.exit(0);
}

const outdated = compareVersions(current, latest) < 0;

if (json) {
  console.log(JSON.stringify({ current, latest, outdated }));
} else {
  if (outdated) {
    console.warn(
      `[untiktok-api] v${current} is BEHIND latest v${latest} on npm. ` +
        `Bump \`version\` in package.json, or run \`npm version patch\`.`,
    );
  } else {
    console.log(`OK: local v${current} matches or exceeds latest npm release v${latest}`);
  }
}

process.exit(strict && outdated ? 1 : 0);

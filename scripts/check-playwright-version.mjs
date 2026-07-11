// scripts/check-playwright-version.mjs
// Fails the build if the Dockerfile base image's pinned Playwright version
// doesn't match the npm-installed playwright driver version. See ADR-004.

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const dockerfile = readFileSync(resolve(root, "Dockerfile"), "utf8");
const imageMatch = dockerfile.match(/mcr\.microsoft\.com\/playwright:v(\d+\.\d+(?:\.\d+)?)/);
if (!imageMatch) {
  console.error("Could not find Playwright base image version in Dockerfile");
  process.exit(1);
}
const imageVersion = imageMatch[1];

const driverVersion = execSync("npm ls playwright --depth=0", { cwd: root, encoding: "utf8" })
  .split("\n")
  .find((l) => l.includes("playwright@"))
  ?.match(/playwright@(\d+\.\d+(?:\.\d+)?)/)?.[1];

if (!driverVersion) {
  console.error("Could not determine installed playwright driver version");
  process.exit(1);
}

if (imageVersion !== driverVersion) {
  console.error(
    `Playwright version drift detected (ADR-004): ` +
    `Dockerfile base image pins v${imageVersion} ` +
    `but the npm playwright driver resolves to v${driverVersion}. ` +
    `Align both to the same version.`,
  );
  process.exit(1);
}

console.log(`OK: Playwright base image v${imageVersion} matches npm driver v${driverVersion}`);

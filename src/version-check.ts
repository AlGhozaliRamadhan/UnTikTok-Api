import { PACKAGE_VERSION } from "./version";

const NPM_REGISTRY = "https://registry.npmjs.org";
const NPM_PACKAGE = "untiktok-api";
const DEFAULT_TIMEOUT_MS = 4_000;

export interface OutdatedInfo {
  current: string;
  latest: string;
  registry: "npm";
  releaseUrl?: string;
}

export interface VersionCheckOptions {
  /**
   * Override the registry/package (used by tests). Defaults to npm + `untiktok-api`.
   */
  registry?: { npmUrl?: string; packageName?: string };
  /**
   * Network timeout in ms. Defaults to 4s.
   */
  timeoutMs?: number;
  /**
   * Optional AbortSignal for cancellation (useful in tests).
   */
  signal?: AbortSignal;
  /**
   * If set, skip the check entirely (same shape as the env-var escape hatch).
   */
  disabled?: boolean;
}

/**
 * Resolve the package version. The value lives in `src/version.ts` so the
 * same source compiles to both CJS and ESM; tests keep it in sync with
 * package.json.
 */
export function getCurrentVersion(): string {
  return PACKAGE_VERSION || "0.0.0";
}

/**
 * True when the env var opt-out is set. Respects:
 *   - UNTIKTOK_SKIP_VERSION_CHECK=1   (canonical, package-specific)
 *   - CI=true                        (generic CI escape hatch)
 *   - NO_UPDATE_NOTIFIER=1           (update-notifier convention)
 */
export function isVersionCheckDisabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.UNTIKTOK_SKIP_VERSION_CHECK === "1") return true;
  if (env.NO_UPDATE_NOTIFIER === "1") return true;
  if (env.CI === "true") return true;
  return false;
}

/**
 * Fetch the `version` field of `<pkg>/latest` from the npm registry.
 * Returns null on non-2xx, timeout, or abort (callers decide).
 */
export async function fetchLatestNpmVersion(
  currentVersion: string,
  opts: VersionCheckOptions = {},
): Promise<OutdatedInfo | null> {
  const base = opts.registry?.npmUrl ?? NPM_REGISTRY;
  const pkg = opts.registry?.packageName ?? NPM_PACKAGE;
  const url = `${base.replace(/\/$/, "")}/${encodeURIComponent(pkg)}/latest`;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  const signal = opts.signal ?? controller.signal;

  try {
    const res = await fetch(url, {
      signal,
      headers: { accept: "application/json", "user-agent": `${pkg}/${currentVersion}` },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { version?: string };
    if (!body.version) return null;
    return {
      current: currentVersion,
      latest: body.version,
      registry: "npm",
      releaseUrl: `https://www.npmjs.com/package/${pkg}/v/${body.version}`,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Compare two `a.b.c[.d][-prerelease]` strings. Returns:
 *   <0 if a < b, 0 if equal, >0 if a > b.
 *
 * Numeric segments sort numerically; a version without a pre-release
 * tag sorts higher than one with (`1.0.0` > `1.0.0-rc.1`).
 */
export function compareVersions(a: string, b: string): number {
  const [aMain = "", aPre = ""] = a.split("-", 2);
  const [bMain = "", bPre = ""] = b.split("-", 2);
  const aNums = aMain.split(".").map((s) => Number.parseInt(s, 10) || 0);
  const bNums = bMain.split(".").map((s) => Number.parseInt(s, 10) || 0);
  const len = Math.max(aNums.length, bNums.length);
  for (let i = 0; i < len; i++) {
    const diff = (aNums[i] ?? 0) - (bNums[i] ?? 0);
    if (diff !== 0) return diff;
  }
  if (aPre && !bPre) return -1;
  if (!aPre && bPre) return 1;
  if (aPre < bPre) return -1;
  if (aPre > bPre) return 1;
  return 0;
}

/**
 * High-level helper: returns the `OutdatedInfo` if `current` < `latest`, else null.
 * Never throws; all failures degrade to `null` so callers can `await` freely.
 */
export async function checkForUpdate(
  currentVersion: string,
  opts: VersionCheckOptions = {},
): Promise<OutdatedInfo | null> {
  if (opts.disabled) return null;
  if (isVersionCheckDisabled()) return null;
  const info = await fetchLatestNpmVersion(currentVersion, opts);
  if (!info) return null;
  if (compareVersions(currentVersion, info.latest) < 0) return info;
  return null;
}

/**
 * Emit a soft, ANSI-coloured `console.warn` for an outdated install.
 * No-op if `info` is null.
 */
export function warnIfOutdated(info: OutdatedInfo | null): void {
  if (!info) return;
  const yellow = "\u001b[33m";
  const reset = "\u001b[0m";
  const release = info.releaseUrl ? ` (${info.releaseUrl})` : "";
  console.warn(
    `${yellow}[untiktok-api]${reset} ` +
      `v${info.current} is behind the latest ${info.registry} release v${info.latest}` +
      `${release}. Run \`npm i -g untiktok-api\` (or \`npm update untiktok-api\`) to upgrade.`,
  );
}

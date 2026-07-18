import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  compareVersions,
  fetchLatestNpmVersion,
  checkForUpdate,
  isVersionCheckDisabled,
  warnIfOutdated,
} from "../src/version-check";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.restoreAllMocks();
  for (const k of Object.keys(process.env)) delete process.env[k];
  Object.assign(process.env, ORIGINAL_ENV);
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe("compareVersions", () => {
  it("orders numerically per segment", () => {
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
    expect(compareVersions("1.2.3", "1.2.4")).toBeLessThan(0);
    expect(compareVersions("1.2.4", "1.2.3")).toBeGreaterThan(0);
    expect(compareVersions("1.10.0", "1.9.0")).toBeGreaterThan(0);
  });

  it("treats missing segments as 0", () => {
    expect(compareVersions("1", "1.0.0")).toBe(0);
    expect(compareVersions("1.0", "1.0.1")).toBeLessThan(0);
  });

  it("orders pre-release below the equivalent stable version", () => {
    expect(compareVersions("1.0.0-rc.1", "1.0.0")).toBeLessThan(0);
    expect(compareVersions("1.0.0", "1.0.0-rc.1")).toBeGreaterThan(0);
  });

  it("orders pre-release identifiers lexically (sufficient for tag comparison)", () => {
    expect(compareVersions("1.0.0-alpha", "1.0.0-beta")).toBeLessThan(0);
  });

  it("falls back gracefully on garbage input", () => {
    expect(Number.isNaN(compareVersions("not", "a version"))).toBe(false);
  });
});

describe("isVersionCheckDisabled", () => {
  it("respects UNTIKTOK_SKIP_VERSION_CHECK", () => {
    expect(isVersionCheckDisabled({ UNTIKTOK_SKIP_VERSION_CHECK: "1" })).toBe(true);
    expect(isVersionCheckDisabled({ UNTIKTOK_SKIP_VERSION_CHECK: "0" })).toBe(false);
  });

  it("respects NO_UPDATE_NOTIFIER (update-notifier convention)", () => {
    expect(isVersionCheckDisabled({ NO_UPDATE_NOTIFIER: "1" })).toBe(true);
  });

  it("respects CI=true", () => {
    expect(isVersionCheckDisabled({ CI: "true" })).toBe(true);
    expect(isVersionCheckDisabled({ CI: "false" })).toBe(false);
  });

  it("defaults to enabled when no opt-out is set", () => {
    expect(isVersionCheckDisabled({})).toBe(false);
  });
});

describe("fetchLatestNpmVersion", () => {
  it("returns OutdatedInfo on 200 with a version field", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ version: "9.9.9" }), { status: 200 }),
    ) as unknown as typeof fetch;

    const info = await fetchLatestNpmVersion("1.2.0", { timeoutMs: 200 });
    expect(info).not.toBeNull();
    expect(info?.latest).toBe("9.9.9");
    expect(info?.current).toBe("1.2.0");
    expect(info?.registry).toBe("npm");
    expect(info?.releaseUrl).toContain("/v/9.9.9");
  });

  it("returns null on non-2xx", async () => {
    globalThis.fetch = vi.fn(async () => new Response("", { status: 500 })) as unknown as typeof fetch;

    const info = await fetchLatestNpmVersion("1.2.0", { timeoutMs: 200 });
    expect(info).toBeNull();
  });

  it("returns null when body has no version field", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ nope: true }), { status: 200 }),
    ) as unknown as typeof fetch;

    const info = await fetchLatestNpmVersion("1.2.0", { timeoutMs: 200 });
    expect(info).toBeNull();
  });

  it("returns null on abort/timeout", async () => {
    globalThis.fetch = vi.fn(async (_url, init) => {
      return await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    }) as unknown as typeof fetch;

    const info = await fetchLatestNpmVersion("1.2.0", { timeoutMs: 50 });
    expect(info).toBeNull();
  });
});

describe("checkForUpdate", () => {
  it("returns null when local >= latest", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ version: "1.0.0" }), { status: 200 }),
    ) as unknown as typeof fetch;

    const info = await checkForUpdate("2.0.0", { timeoutMs: 200 });
    expect(info).toBeNull();
  });

  it("returns info when local < latest", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ version: "2.0.0" }), { status: 200 }),
    ) as unknown as typeof fetch;

    const info = await checkForUpdate("1.0.0", { timeoutMs: 200 });
    expect(info).not.toBeNull();
    expect(info?.latest).toBe("2.0.0");
  });

  it("honours opts.disabled", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ version: "9.9.9" }), { status: 200 }),
    ) as unknown as typeof fetch;

    const info = await checkForUpdate("1.0.0", { disabled: true, timeoutMs: 200 });
    expect(info).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("honours the env-var opt-out (CI)", async () => {
    process.env.CI = "true";
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ version: "9.9.9" }), { status: 200 }),
    ) as unknown as typeof fetch;

    const info = await checkForUpdate("1.0.0", { timeoutMs: 200 });
    expect(info).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe("warnIfOutdated", () => {
  it("logs a warn line with the outdated version", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnIfOutdated({
      current: "1.2.0",
      latest: "1.3.0",
      registry: "npm",
      releaseUrl: "https://example.invalid",
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const msg = String(spy.mock.calls[0]?.[0] ?? "");
    expect(msg).toContain("v1.2.0");
    expect(msg).toContain("v1.3.0");
    expect(msg).toContain("untiktok-api");
  });

  it("is a no-op for null", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnIfOutdated(null);
    expect(spy).not.toHaveBeenCalled();
  });
});

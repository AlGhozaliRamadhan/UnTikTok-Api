// tests/search.integration.test.ts
// Vitest version of tests/test_search.ts (ADR-002).
// Gated by CI_NETWORK — skipped by default to avoid spinning up Playwright.

import { describe, it, expect } from "vitest";
import { TikTokApi } from "../src";

const msToken = process.env.ms_token ?? undefined;
const headless = (process.env.headless ?? "true").toLowerCase() === "true";
const browser = (process.env.TIKTOK_BROWSER as "chromium" | "firefox" | "webkit") ?? "chromium";

describe.skipIf(!process.env.CI_NETWORK)("integration: search.users", () => {
  it("returns at least 1 user result for a known query", async () => {
    const api = new TikTokApi();
    try {
      await api.createSessions({
        msTokens: msToken ? [msToken] : null,
        numSessions: 1,
        sleepAfter: 3,
        browser,
        headless,
      });

      let userCount = 0;
      for await (const user of api.search.users("david teather", 5)) {
        expect(user.username).toBeDefined();
        userCount++;
      }
      expect(userCount).toBeGreaterThan(0);
    } finally {
      await api.closeSessions();
    }
  });
});

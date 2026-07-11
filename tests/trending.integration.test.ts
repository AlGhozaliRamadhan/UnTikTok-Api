// tests/trending.integration.test.ts
// Vitest version of tests/test_trending.ts (ADR-002).
// Gated by CI_NETWORK — skipped by default to avoid spinning up Playwright.

import { describe, it, expect } from "vitest";
import { TikTokApi } from "../src";

const msToken = process.env.ms_token ?? undefined;
const headless = (process.env.headless ?? "true").toLowerCase() === "true";
const browser = (process.env.TIKTOK_BROWSER as "chromium" | "firefox" | "webkit") ?? "chromium";

describe.skipIf(!process.env.CI_NETWORK)("integration: trending.videos", () => {
  it("returns at least 100 videos from the trending feed", async () => {
    const api = new TikTokApi();
    try {
      await api.createSessions({
        msTokens: msToken ? [msToken] : undefined,
        numSessions: 1,
        sleepAfter: 3,
        browser,
        headless,
      });

      let count = 0;
      for await (const video of api.trending.videos(100)) {
        expect(video.id).toBeDefined();
        count++;
      }

      expect(count).toBeGreaterThanOrEqual(100);
    } finally {
      await api.closeSessions();
    }
  });
});

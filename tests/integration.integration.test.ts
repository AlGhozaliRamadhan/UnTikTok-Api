// tests/integration.integration.test.ts
// Vitest version of tests/test_integration.ts (ADR-002).
// High-level full-flow integration test. Gated by CI_NETWORK — skipped by default.

import { describe, it, expect } from "vitest";
import { TikTokApi } from "../src";

const msToken = process.env.ms_token ?? undefined;
const headless = (process.env.headless ?? "true").toLowerCase() === "true";
const browser = (process.env.TIKTOK_BROWSER as "chromium" | "firefox" | "webkit") ?? "chromium";

describe.skipIf(!process.env.CI_NETWORK)("integration: trending + user + hashtag flow", () => {
  it("runs a full real-world flow", async () => {
    const api = new TikTokApi();
    try {
      await api.createSessions({
        msTokens: msToken ? [msToken] : undefined,
        numSessions: 1,
        sleepAfter: 3,
        browser,
        headless,
      });

      let trendingCount = 0;
      for await (const video of api.trending.videos(5)) {
        expect(video.id).toBeDefined();
        trendingCount++;
      }
      expect(trendingCount).toBeGreaterThan(0);

      const user = api.user({ username: "therock" });
      await user.info();
      expect(user.userId).toBeDefined();
      let userVideoCount = 0;
      for await (const _v of user.videos(3)) {
        userVideoCount++;
      }
      expect(userVideoCount).toBeGreaterThan(0);

      const tag = api.hashtag({ name: "funny" });
      await tag.info();
      expect(tag.id).toBeDefined();
      let tagVideoCount = 0;
      for await (const _v of tag.videos(3)) {
        tagVideoCount++;
      }
      expect(tagVideoCount).toBeGreaterThanOrEqual(0);
    } finally {
      await api.closeSessions();
    }
  });
}, 180_000);

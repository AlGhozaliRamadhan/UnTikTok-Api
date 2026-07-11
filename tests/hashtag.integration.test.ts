// tests/hashtag.integration.test.ts
// Vitest version of tests/test_hashtag.ts (ADR-002).
// Gated by CI_NETWORK — skipped by default to avoid spinning up Playwright.

import { describe, it, expect } from "vitest";
import { TikTokApi } from "../src";

const msToken = process.env.ms_token ?? undefined;
const headless = (process.env.headless ?? "true").toLowerCase() === "true";
const browser = (process.env.TIKTOK_BROWSER as "chromium" | "firefox" | "webkit") ?? "chromium";

describe.skipIf(!process.env.CI_NETWORK)("integration: hashtag.info + hashtag.videos", () => {
  it("returns info and at least 1 video for a known hashtag", async () => {
    const api = new TikTokApi();
    try {
      await api.createSessions({
        msTokens: msToken ? [msToken] : undefined,
        numSessions: 1,
        sleepAfter: 3,
        browser,
        headless,
      });

      const tag = api.hashtag({ name: "funny" });
      const info = await tag.info();
      expect(info).not.toBeNull();
      expect(tag.id).toBeDefined();
      expect(tag.name).toBeDefined();

      let videoCount = 0;
      for await (const video of tag.videos(30)) {
        expect(video.id).toBeDefined();
        videoCount++;
      }
      expect(videoCount).toBeGreaterThan(0);
    } finally {
      await api.closeSessions();
    }
  });
});

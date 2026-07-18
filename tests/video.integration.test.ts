// tests/video.integration.test.ts
// Vitest version of tests/test_video.ts (ADR-002).
// Gated by CI_NETWORK — skipped by default to avoid spinning up Playwright.

import { describe, it, expect } from "vitest";
import { TikTokApi } from "../src";

const msToken = process.env.ms_token ?? undefined;
const headless = (process.env.headless ?? "true").toLowerCase() === "true";
const browser = (process.env.TIKTOK_BROWSER as "chromium" | "firefox" | "webkit") ?? "chromium";

describe.skipIf(!process.env.CI_NETWORK)("integration: video.info + comments + relatedVideos", () => {
  it("extracts video metadata, comments, and related videos", async () => {
    const api = new TikTokApi({ loggingLevel: "debug" });
    try {
      await api.createSessions({
        msTokens: msToken ? [msToken] : null,
        numSessions: 1,
        sleepAfter: 3,
        browser,
        headless,
      });

      const videoUrl = process.env.TEST_VIDEO_URL
        ?? "https://www.tiktok.com/@mrbeast/video/7391910609341680927";
      const video = api.video({ url: videoUrl });
      const info = await video.info();
      expect(info).not.toBeNull();
      expect(video.id).toBeDefined();
      expect(video.author).toBeDefined();
      expect(video.plays).toBeGreaterThan(0);
      expect(video.likes).toBeGreaterThan(0);
      expect(video.commentsCount).toBeGreaterThan(0);

      let commentCount = 0;
      for await (const comment of video.comments(5)) {
        expect(comment.id).toBeDefined();
        expect(comment.text).toBeDefined();
        commentCount++;
      }
      expect(commentCount).toBeGreaterThan(0);

      let relatedCount = 0;
      for await (const _related of video.relatedVideos(5)) {
        relatedCount++;
      }
      expect(relatedCount).toBeGreaterThanOrEqual(0);
    } finally {
      await api.closeSessions();
    }
  });
}, 120_000);

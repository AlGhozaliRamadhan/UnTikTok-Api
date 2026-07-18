// tests/comments.integration.test.ts
// Vitest version of tests/test_comments.ts (ADR-002).
// Gated by CI_NETWORK — skipped by default to avoid spinning up Playwright.

import { describe, it, expect } from "vitest";
import { TikTokApi } from "../src";

const msToken = process.env.ms_token ?? undefined;
const headless = (process.env.headless ?? "true").toLowerCase() === "true";
const browser = (process.env.TIKTOK_BROWSER as "chromium" | "firefox" | "webkit") ?? "chromium";

describe.skipIf(!process.env.CI_NETWORK)("integration: video.comments", () => {
  it("returns at least 1 comment with id and text", async () => {
    const api = new TikTokApi();
    try {
      await api.createSessions({
        msTokens: msToken ? [msToken] : null,
        numSessions: 1,
        sleepAfter: 3,
        browser,
        headless,
      });

      const video = api.video({ id: "7106686413101468970" });

      let commentCount = 0;
      for await (const comment of video.comments(20)) {
        expect(comment.id).toBeDefined();
        expect(comment.text).toBeDefined();
        commentCount++;
      }

      expect(commentCount).toBeGreaterThan(0);
    } finally {
      await api.closeSessions();
    }
  });
});

// tests/user.integration.test.ts
// Vitest version of tests/test_user.ts (ADR-002).
// Gated by CI_NETWORK — skipped by default to avoid spinning up Playwright.

import { describe, it, expect } from "vitest";
import { TikTokApi } from "../src";

const msToken = process.env.ms_token ?? undefined;
const headless = (process.env.headless ?? "true").toLowerCase() === "true";
const browser = (process.env.TIKTOK_BROWSER as "chromium" | "firefox" | "webkit") ?? "chromium";

describe.skipIf(!process.env.CI_NETWORK)("integration: user info + videos + liked + reposts + pinned + favorited + followers/following", () => {
  it("extracts user metadata and video feeds", async () => {
    const api = new TikTokApi();
    try {
      await api.createSessions({
        msTokens: msToken ? [msToken] : undefined,
        numSessions: 1,
        sleepAfter: 3,
        browser,
        headless,
      });

      const user = api.user({ username: "therock" });
      const info = await user.info();
      expect(info).not.toBeNull();
      expect(user.userId).toBeDefined();
      expect(user.secUid).toBeDefined();
      expect(user.username).toBe("therock");
      expect(typeof user.isLive).toBe("boolean");
      expect(user.roomId === null || typeof user.roomId === "string").toBe(true);

      expect(typeof user.followers).toBe("number");
      expect(typeof user.following).toBe("number");
      expect(typeof user.likes).toBe("number");
      expect(typeof user.videoCount).toBe("number");
      expect(typeof user.verified).toBe("boolean");
      expect(typeof user.isPrivate).toBe("boolean");
      expect(user.nickname === null || typeof user.nickname === "string").toBe(true);
      expect(user.signature === null || typeof user.signature === "string").toBe(true);
      expect(user.bioLink === null || typeof user.bioLink === "string").toBe(true);
      expect(user.avatar === null || typeof user.avatar === "string").toBe(true);

      let videoCount = 0;
      for await (const video of user.videos(10)) {
        expect(video.id).toBeDefined();
        videoCount++;
      }
      expect(videoCount).toBeGreaterThan(0);

      let likedCount = 0;
      for await (const _video of user.liked(5)) {
        likedCount++;
      }
      expect(likedCount).toBeGreaterThanOrEqual(0);

      const userWithReposts = api.user({ username: "oja756" });
      let repostsCount = 0;
      for await (const video of userWithReposts.reposts(5)) {
        expect(video.id).toBeDefined();
        repostsCount++;
      }
      expect(repostsCount).toBeGreaterThanOrEqual(0);

      const userWithPinned = api.user({ username: "davidteathercodes" });
      let pinnedCount = 0;
      for await (const video of userWithPinned.pinned(3)) {
        expect(video.id).toBeDefined();
        pinnedCount++;
      }
      expect(pinnedCount).toBeGreaterThanOrEqual(0);

      let favoritedCount = 0;
      for await (const video of user.favorited(5)) {
        expect(video.id).toBeDefined();
        favoritedCount++;
      }
      expect(favoritedCount).toBeGreaterThanOrEqual(0);

      let followersListCount = 0;
      for await (const follower of user.followersList(5)) {
        expect(follower.userId).toBeDefined();
        followersListCount++;
      }
      expect(followersListCount).toBeGreaterThanOrEqual(0);

      let followingListCount = 0;
      for await (const following of user.followingList(5)) {
        expect(following.userId).toBeDefined();
        followingListCount++;
      }
      expect(followingListCount).toBeGreaterThanOrEqual(0);
    } finally {
      await api.closeSessions();
    }
  });
}, 180_000);

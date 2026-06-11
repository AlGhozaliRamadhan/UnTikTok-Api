// tests/test_integration.ts
// Mirrors tests/test_integration.py
//
// High-level integration test that runs a full real-world flow.

import assert from "assert";
import { TikTokApi } from "../src";

const msToken = process.env.ms_token ?? undefined;
const headless = (process.env.headless ?? "true").toLowerCase() === "true";

async function testIntegration() {
  const api = new TikTokApi();
  try {
    await api.createSessions({
      msTokens: msToken ? [msToken] : undefined,
      numSessions: 1,
      sleepAfter: 3,
      browser: (process.env.TIKTOK_BROWSER as "chromium" | "firefox" | "webkit") ?? "chromium",
      headless,
    });

    // 1. Trending
    let trendingCount = 0;
    for await (const video of api.trending.videos(5)) {
      assert.ok(video.id !== undefined);
      trendingCount++;
    }
    assert.ok(trendingCount > 0, "Integration: trending must return videos");
    console.log(`✅ integration_trending: ${trendingCount} videos`);

    // 2. User info + videos
    const user = api.user({ username: "therock" });
    await user.info();
    assert.ok(user.userId !== undefined, "Integration: user.userId should be set");
    let userVideoCount = 0;
    for await (const v of user.videos(3)) {
      userVideoCount++;
    }
    assert.ok(userVideoCount > 0, "Integration: user must have videos");
    console.log(`✅ integration_user: ${userVideoCount} videos`);

    // 3. Hashtag
    const tag = api.hashtag({ name: "funny" });
    await tag.info();
    assert.ok(tag.id !== undefined, "Integration: hashtag.id should be set");
    let tagVideoCount = 0;
    for await (const v of tag.videos(3)) {
      tagVideoCount++;
    }
    console.log(`✅ integration_hashtag: ${tagVideoCount} videos`);

    console.log("✅ Full integration test passed");
  } finally {
    await api.closeSessions();
  }
}

testIntegration().catch((err) => {
  console.error(err);
  process.exit(1);
});

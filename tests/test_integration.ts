// tests/test_integration.ts
// Mirrors tests/test_integration.py
//
// High-level integration test that runs a full real-world flow.

import { TikTokApi } from "../src";

const msToken = process.env.ms_token ?? undefined;
const headless = (process.env.headless ?? "true").toLowerCase() === "true";

async function testIntegration() {
  const api = new TikTokApi();
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
    console.assert(video.id !== undefined);
    trendingCount++;
  }
  console.assert(trendingCount > 0, "Integration: trending must return videos");
  console.log(`✅ integration_trending: ${trendingCount} videos`);

  // 2. User info + videos
  const user = api.user({ username: "therock" });
  await user.info();
  console.assert(user.userId !== undefined, "Integration: user.userId should be set");
  let userVideoCount = 0;
  for await (const v of user.videos(3)) {
    userVideoCount++;
  }
  console.assert(userVideoCount > 0, "Integration: user must have videos");
  console.log(`✅ integration_user: ${userVideoCount} videos`);

  // 3. Hashtag
  const tag = api.hashtag({ name: "funny" });
  await tag.info();
  console.assert(tag.id !== undefined, "Integration: hashtag.id should be set");
  let tagVideoCount = 0;
  for await (const v of tag.videos(3)) {
    tagVideoCount++;
  }
  console.log(`✅ integration_hashtag: ${tagVideoCount} videos`);

  await api.closeSessions();
  console.log("✅ Full integration test passed");
}

testIntegration().catch(console.error);

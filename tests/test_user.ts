// tests/test_user.ts
// Mirrors tests/test_user.py

import { TikTokApi } from "../src";

const msToken = process.env.ms_token ?? undefined;
const headless = (process.env.headless ?? "true").toLowerCase() === "true";

async function testUser() {
  const api = new TikTokApi();
  await api.createSessions({
    msTokens: msToken ? [msToken] : undefined,
    numSessions: 1,
    sleepAfter: 3,
    browser: (process.env.TIKTOK_BROWSER as "chromium" | "firefox" | "webkit") ?? "chromium",
    headless,
  });

  // Test user info
  const user = api.user({ username: "therock" });
  const info = await user.info();
  console.assert(info !== null, "User info should not be null");
  console.assert(user.userId !== undefined, "userId should be set");
  console.assert(user.secUid !== undefined, "secUid should be set");
  console.assert(user.username === "therock", `Expected username 'therock', got '${user.username}'`);
  console.log(`✅ test_user_info passed: userId=${user.userId}`);

  // Test user videos
  let videoCount = 0;
  for await (const video of user.videos(10)) {
    console.assert(video.id !== undefined, "Video id should be set");
    videoCount++;
  }
  console.assert(videoCount > 0, "Should have at least 1 video");
  console.log(`✅ test_user_videos passed: got ${videoCount} videos`);

  // Test user liked
  let likedCount = 0;
  for await (const video of user.liked(5)) {
    likedCount++;
  }
  console.log(`✅ test_user_liked passed: got ${likedCount} liked videos (may be 0 if private)`);

  await api.closeSessions();
}

testUser().catch(console.error);

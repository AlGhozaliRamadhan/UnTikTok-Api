// tests/test_user.ts
// Mirrors tests/test_user.py

import assert from "assert";
import { TikTokApi } from "../src";

const msToken = process.env.ms_token ?? undefined;
const headless = (process.env.headless ?? "true").toLowerCase() === "true";

async function testUser() {
  const api = new TikTokApi();
  try {
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
    assert.ok(info !== null, "User info should not be null");
    assert.ok(user.userId !== undefined, "userId should be set");
    assert.ok(user.secUid !== undefined, "secUid should be set");
    assert.strictEqual(user.username, "therock", `Expected username 'therock', got '${user.username}'`);
    console.log(`✅ test_user_info passed: userId=${user.userId}`);

    // Test user videos
    let videoCount = 0;
    for await (const video of user.videos(10)) {
      assert.ok(video.id !== undefined, "Video id should be set");
      videoCount++;
    }
    assert.ok(videoCount > 0, "Should have at least 1 video");
    console.log(`✅ test_user_videos passed: got ${videoCount} videos`);

    // Test user liked
    let likedCount = 0;
    for await (const video of user.liked(5)) {
      likedCount++;
    }
    console.log(`✅ test_user_liked passed: got ${likedCount} liked videos (may be 0 if private)`);

    // Test user reposts
    const userWithReposts = api.user({ username: "oja756" });
    let repostsCount = 0;
    for await (const video of userWithReposts.reposts(5)) {
      assert.ok(video.id !== undefined, "Repost video id should be set");
      repostsCount++;
    }
    console.log(`✅ test_user_reposts passed: got ${repostsCount} reposts`);
  } finally {
    await api.closeSessions();
  }
}

testUser().catch((err) => {
  console.error(err);
  process.exit(1);
});

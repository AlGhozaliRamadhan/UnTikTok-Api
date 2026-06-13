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
    assert.strictEqual(typeof user.isLive, "boolean", "isLive should be a boolean");
    assert.ok(user.roomId === null || typeof user.roomId === "string", "roomId should be null or string");
    
    // New metadata getters
    assert.strictEqual(typeof user.followers, "number", "followers should be a number");
    assert.strictEqual(typeof user.following, "number", "following should be a number");
    assert.strictEqual(typeof user.likes, "number", "likes should be a number");
    assert.strictEqual(typeof user.videoCount, "number", "videoCount should be a number");
    assert.strictEqual(typeof user.verified, "boolean", "verified should be a boolean");
    assert.strictEqual(typeof user.isPrivate, "boolean", "isPrivate should be a boolean");
    assert.ok(user.nickname === null || typeof user.nickname === "string", "nickname should be string or null");
    assert.ok(user.signature === null || typeof user.signature === "string", "signature should be string or null");
    assert.ok(user.bioLink === null || typeof user.bioLink === "string", "bioLink should be string or null");
    assert.ok(user.avatar === null || typeof user.avatar === "string", "avatar should be string or null");
    
    console.log(`[SUCCESS] test_user_info passed: userId=${user.userId}, followers=${user.followers}, isLive=${user.isLive}`);

    // Test user videos
    let videoCount = 0;
    for await (const video of user.videos(10)) {
      assert.ok(video.id !== undefined, "Video id should be set");
      videoCount++;
    }
    assert.ok(videoCount > 0, "Should have at least 1 video");
    console.log(`[SUCCESS] test_user_videos passed: got ${videoCount} videos`);

    // Test user liked
    let likedCount = 0;
    for await (const video of user.liked(5)) {
      likedCount++;
    }
    console.log(`[SUCCESS] test_user_liked passed: got ${likedCount} liked videos (may be 0 if private)`);

    // Test user reposts
    const userWithReposts = api.user({ username: "oja756" });
    let repostsCount = 0;
    for await (const video of userWithReposts.reposts(5)) {
      assert.ok(video.id !== undefined, "Repost video id should be set");
      repostsCount++;
    }
    console.log(`[SUCCESS] test_user_reposts passed: got ${repostsCount} reposts`);

    // Test user pinned
    const userWithPinned = api.user({ username: "davidteathercodes" });
    let pinnedCount = 0;
    for await (const video of userWithPinned.pinned(3)) {
      assert.ok(video.id !== undefined, "Pinned video id should be set");
      pinnedCount++;
    }
    console.log(`[SUCCESS] test_user_pinned passed: got ${pinnedCount} pinned videos`);

    // Test user favorited
    let favoritedCount = 0;
    for await (const video of user.favorited(5)) {
      assert.ok(video.id !== undefined, "Favorited video id should be set");
      favoritedCount++;
    }
    console.log(`[SUCCESS] test_user_favorited passed: got ${favoritedCount} favorited videos (may be 0 if private)`);

    // Test followersList (expecting 0 without cookies, but ensuring it doesn't crash)
    let followersListCount = 0;
    for await (const follower of user.followersList(5)) {
      assert.ok(follower.userId !== undefined, "Follower user id should be set");
      followersListCount++;
    }
    console.log(`[SUCCESS] test_user_followersList passed: got ${followersListCount} followers (requires auth)`);

    // Test followingList (expecting 0 without cookies, but ensuring it doesn't crash)
    let followingListCount = 0;
    for await (const following of user.followingList(5)) {
      assert.ok(following.userId !== undefined, "Following user id should be set");
      followingListCount++;
    }
    console.log(`[SUCCESS] test_user_followingList passed: got ${followingListCount} following (requires auth)`);
  } finally {
    await api.closeSessions();
  }
}

testUser().catch((err) => {
  console.error(err);
  process.exit(1);
});


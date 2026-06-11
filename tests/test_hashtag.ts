// tests/test_hashtag.ts
// Mirrors tests/test_hashtag.py

import assert from "assert";
import { TikTokApi } from "../src";

const msToken = process.env.ms_token ?? undefined;
const headless = (process.env.headless ?? "true").toLowerCase() === "true";

async function testHashtag() {
  const api = new TikTokApi();
  try {
    await api.createSessions({
      msTokens: msToken ? [msToken] : undefined,
      numSessions: 1,
      sleepAfter: 3,
      browser: (process.env.TIKTOK_BROWSER as "chromium" | "firefox" | "webkit") ?? "chromium",
      headless,
    });

    const tag = api.hashtag({ name: "funny" });
    const info = await tag.info();
    assert.ok(info !== null, "Hashtag info should not be null");
    assert.ok(tag.id !== undefined, "Hashtag id should be set");
    assert.ok(tag.name !== undefined, "Hashtag name should be set");
    console.log(`✅ test_hashtag_info passed: id=${tag.id} name=${tag.name}`);

    let videoCount = 0;
    for await (const video of tag.videos(30)) {
      assert.ok(video.id !== undefined, "Video id should be set");
      videoCount++;
    }
    assert.ok(videoCount > 0, "Should have at least 1 video");
    console.log(`✅ test_hashtag_videos passed: got ${videoCount} videos`);
  } finally {
    await api.closeSessions();
  }
}

testHashtag().catch((err) => {
  console.error(err);
  process.exit(1);
});

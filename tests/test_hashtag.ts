// tests/test_hashtag.ts
// Mirrors tests/test_hashtag.py

import { TikTokApi } from "../src";

const msToken = process.env.ms_token ?? undefined;
const headless = (process.env.headless ?? "true").toLowerCase() === "true";

async function testHashtag() {
  const api = new TikTokApi();
  await api.createSessions({
    msTokens: msToken ? [msToken] : undefined,
    numSessions: 1,
    sleepAfter: 3,
    browser: (process.env.TIKTOK_BROWSER as "chromium" | "firefox" | "webkit") ?? "chromium",
    headless,
  });

  const tag = api.hashtag({ name: "funny" });
  const info = await tag.info();
  console.assert(info !== null, "Hashtag info should not be null");
  console.assert(tag.id !== undefined, "Hashtag id should be set");
  console.assert(tag.name !== undefined, "Hashtag name should be set");
  console.log(`✅ test_hashtag_info passed: id=${tag.id} name=${tag.name}`);

  let videoCount = 0;
  for await (const video of tag.videos(30)) {
    console.assert(video.id !== undefined, "Video id should be set");
    videoCount++;
  }
  console.assert(videoCount > 0, "Should have at least 1 video");
  console.log(`✅ test_hashtag_videos passed: got ${videoCount} videos`);

  await api.closeSessions();
}

testHashtag().catch(console.error);

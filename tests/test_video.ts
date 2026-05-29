// tests/test_video.ts
// Mirrors tests/test_video.py

import { TikTokApi } from "../src";

const msToken = process.env.ms_token ?? undefined;
const headless = (process.env.headless ?? "true").toLowerCase() === "true";

async function testVideo() {
  const api = new TikTokApi();
  await api.createSessions({
    msTokens: msToken ? [msToken] : undefined,
    numSessions: 1,
    sleepAfter: 3,
    browser: (process.env.TIKTOK_BROWSER as "chromium" | "firefox" | "webkit") ?? "chromium",
    headless,
  });

  // Test video by URL
  const videoUrl = "https://www.tiktok.com/@davidteathercodes/video/7106686413101468970";
  const video = api.video({ url: videoUrl });
  const info = await video.info();
  console.assert(info !== null, "Video info should not be null");
  console.assert(video.id !== undefined, "Video id should be set");
  console.assert(video.author !== undefined, "Video author should be set");
  console.log(`✅ test_video_info passed: id=${video.id}`);

  // Test video comments
  let commentCount = 0;
  for await (const comment of video.comments(5)) {
    console.assert(comment.id !== undefined, "Comment id should be set");
    console.assert(comment.text !== undefined, "Comment text should be set");
    commentCount++;
  }
  console.assert(commentCount > 0, "Should have at least 1 comment");
  console.log(`✅ test_video_comments passed: got ${commentCount} comments`);

  // Test related videos
  let relatedCount = 0;
  for await (const related of video.relatedVideos(5)) {
    relatedCount++;
  }
  console.log(`✅ test_video_related passed: got ${relatedCount} related videos`);

  await api.closeSessions();
}

testVideo().catch(console.error);

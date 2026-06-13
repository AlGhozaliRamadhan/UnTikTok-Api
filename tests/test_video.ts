// tests/test_video.ts
// Mirrors tests/test_video.py

import assert from "assert";
import { TikTokApi } from "../src";

const msToken = process.env.ms_token ?? undefined;
const headless = (process.env.headless ?? "true").toLowerCase() === "true";

async function testVideo() {
  const api = new TikTokApi({ loggingLevel: "debug" });
  try {
    await api.createSessions({
      msTokens: msToken ? [msToken] : undefined,
      numSessions: 1,
      sleepAfter: 3,
      browser: (process.env.TIKTOK_BROWSER as "chromium" | "firefox" | "webkit") ?? "chromium",
      headless,
    });

    const videoUrl = "https://www.tiktok.com/@mrbeast/video/7391910609341680927";
    const video = api.video({ url: videoUrl });
    const info = await video.info();
    assert.ok(info !== null, "Video info should not be null");
    assert.ok(video.id !== undefined, "Video id should be set");
    assert.ok(video.author !== undefined, "Video author should be set");
    assert.ok(video.plays > 0, "Video plays should be extracted");
    assert.ok(video.likes > 0, "Video likes should be extracted");
    assert.ok(video.commentsCount > 0, "Video comments should be extracted");
    console.log(`[SUCCESS] test_video_info passed: id=${video.id}, views=${video.plays}, likes=${video.likes}`);

    // Test video comments
    let commentCount = 0;
    for await (const comment of video.comments(5)) {
      assert.ok(comment.id !== undefined, "Comment id should be set");
      assert.ok(comment.text !== undefined, "Comment text should be set");
      commentCount++;
    }
    assert.ok(commentCount > 0, "Should have at least 1 comment");
    console.log(`[SUCCESS] test_video_comments passed: got ${commentCount} comments`);

    // Test related videos
    let relatedCount = 0;
    for await (const related of video.relatedVideos(5)) {
      relatedCount++;
    }
    console.log(`[SUCCESS] test_video_related passed: got ${relatedCount} related videos`);
  } finally {
    await api.closeSessions();
  }
}

testVideo().catch((err) => {
  console.error(err);
  process.exit(1);
});


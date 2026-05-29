// tests/test_comments.ts
// Mirrors tests/test_comments.py

import { TikTokApi } from "../src";

const msToken = process.env.ms_token ?? undefined;
const headless = (process.env.headless ?? "true").toLowerCase() === "true";

async function testComments() {
  const api = new TikTokApi();
  await api.createSessions({
    msTokens: msToken ? [msToken] : undefined,
    numSessions: 1,
    sleepAfter: 3,
    browser: (process.env.TIKTOK_BROWSER as "chromium" | "firefox" | "webkit") ?? "chromium",
    headless,
  });

  const video = api.video({ id: "7041997751718137094" });

  let commentCount = 0;
  for await (const comment of video.comments(20)) {
    console.assert(comment.id !== undefined, "Comment id should be set");
    console.assert(comment.text !== undefined || comment.text === "", "Comment text should be defined");
    commentCount++;
  }

  console.assert(commentCount > 0, "Should have at least 1 comment");
  console.log(`✅ test_comments passed: got ${commentCount} comments`);

  await api.closeSessions();
}

testComments().catch(console.error);

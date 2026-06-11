// tests/test_comments.ts
// Mirrors tests/test_comments.py

import assert from "assert";
import { TikTokApi } from "../src";

const msToken = process.env.ms_token ?? undefined;
const headless = (process.env.headless ?? "true").toLowerCase() === "true";

async function testComments() {
  const api = new TikTokApi();
  try {
    await api.createSessions({
      msTokens: msToken ? [msToken] : undefined,
      numSessions: 1,
      sleepAfter: 3,
      browser: (process.env.TIKTOK_BROWSER as "chromium" | "firefox" | "webkit") ?? "chromium",
      headless,
    });

    const video = api.video({ id: "7106686413101468970" });

    let commentCount = 0;
    for await (const comment of video.comments(20)) {
      assert.ok(comment.id !== undefined, "Comment id should be set");
      assert.ok(comment.text !== undefined || comment.text === "", "Comment text should be defined");
      commentCount++;
    }

    assert.ok(commentCount > 0, "Should have at least 1 comment");
    console.log(`✅ test_comments passed: got ${commentCount} comments`);
  } finally {
    await api.closeSessions();
  }
}

testComments().catch((err) => {
  console.error(err);
  process.exit(1);
});

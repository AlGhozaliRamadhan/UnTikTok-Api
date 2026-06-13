// tests/test_sound.ts
// Mirrors tests/test_sound.py

import assert from "assert";
import { TikTokApi } from "../src";

const msToken = process.env.ms_token ?? undefined;
const headless = (process.env.headless ?? "true").toLowerCase() === "true";

async function testSound() {
  const api = new TikTokApi();
  try {
    await api.createSessions({
      msTokens: msToken ? [msToken] : undefined,
      numSessions: 1,
      sleepAfter: 3,
      browser: (process.env.TIKTOK_BROWSER as "chromium" | "firefox" | "webkit") ?? "chromium",
      headless,
    });

    const sound = api.sound({ id: "7016547803243022337" });
    const info = await sound.info();
    assert.ok(info !== null, "Sound info should not be null");
    assert.ok(sound.id !== undefined, "Sound id should be set");
    assert.ok(sound.title !== undefined, "Sound title should be set");
    console.log(`[SUCCESS] test_sound_info passed: id=${sound.id} title=${sound.title}`);

    let videoCount = 0;
    for await (const video of sound.videos(30)) {
      assert.ok(video.id !== undefined, "Video id should be set");
      videoCount++;
    }
    assert.ok(videoCount > 0, "Should have at least 1 video");
    console.log(`[SUCCESS] test_sound_videos passed: got ${videoCount} videos`);
  } finally {
    await api.closeSessions();
  }
}

testSound().catch((err) => {
  console.error(err);
  process.exit(1);
});


// tests/test_sound.ts
// Mirrors tests/test_sound.py

import { TikTokApi } from "../src";

const msToken = process.env.ms_token ?? undefined;
const headless = (process.env.headless ?? "true").toLowerCase() === "true";

async function testSound() {
  const api = new TikTokApi();
  await api.createSessions({
    msTokens: msToken ? [msToken] : undefined,
    numSessions: 1,
    sleepAfter: 3,
    browser: (process.env.TIKTOK_BROWSER as "chromium" | "firefox" | "webkit") ?? "chromium",
    headless,
  });

  const sound = api.sound({ id: "7016547803243022337" });
  const info = await sound.info();
  console.assert(info !== null, "Sound info should not be null");
  console.assert(sound.id !== undefined, "Sound id should be set");
  console.assert(sound.title !== undefined, "Sound title should be set");
  console.log(`✅ test_sound_info passed: id=${sound.id} title=${sound.title}`);

  let videoCount = 0;
  for await (const video of sound.videos(30)) {
    console.assert(video.id !== undefined, "Video id should be set");
    videoCount++;
  }
  console.assert(videoCount > 0, "Should have at least 1 video");
  console.log(`✅ test_sound_videos passed: got ${videoCount} videos`);

  await api.closeSessions();
}

testSound().catch(console.error);

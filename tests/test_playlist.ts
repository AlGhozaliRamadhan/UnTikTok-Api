// tests/test_playlist.ts
// Mirrors tests/test_playlist.py

import assert from "assert";
import { TikTokApi } from "../src";

const msToken = process.env.ms_token ?? undefined;
const headless = (process.env.headless ?? "true").toLowerCase() === "true";

async function testPlaylist() {
  const api = new TikTokApi();
  try {
    await api.createSessions({
      msTokens: msToken ? [msToken] : undefined,
      numSessions: 1,
      sleepAfter: 3,
      browser: (process.env.TIKTOK_BROWSER as "chromium" | "firefox" | "webkit") ?? "chromium",
      headless,
    });

    const playlist = api.playlist({ id: "7426714779919797038" });
    const info = await playlist.info();
    assert.ok(info !== null, "Playlist info should not be null");
    assert.ok(playlist.id !== undefined, "Playlist id should be set");
    assert.ok(playlist.name !== undefined, "Playlist name should be set");
    console.log(`[SUCCESS] test_playlist_info passed: id=${playlist.id} name=${playlist.name}`);

    let videoCount = 0;
    for await (const video of playlist.videos(10)) {
      assert.ok(video.id !== undefined, "Video id should be set");
      videoCount++;
    }
    assert.ok(videoCount > 0, "Should have at least 1 video");
    console.log(`[SUCCESS] test_playlist_videos passed: got ${videoCount} videos`);
  } finally {
    await api.closeSessions();
  }
}

testPlaylist().catch((err) => {
  console.error(err);
  process.exit(1);
});


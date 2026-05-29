// tests/test_playlist.ts
// Mirrors tests/test_playlist.py

import { TikTokApi } from "../src";

const msToken = process.env.ms_token ?? undefined;
const headless = (process.env.headless ?? "true").toLowerCase() === "true";

async function testPlaylist() {
  const api = new TikTokApi();
  await api.createSessions({
    msTokens: msToken ? [msToken] : undefined,
    numSessions: 1,
    sleepAfter: 3,
    browser: (process.env.TIKTOK_BROWSER as "chromium" | "firefox" | "webkit") ?? "chromium",
    headless,
  });

  const playlist = api.playlist({ id: "7426714779919797038" });
  const info = await playlist.info();
  console.assert(info !== null, "Playlist info should not be null");
  console.assert(playlist.id !== undefined, "Playlist id should be set");
  console.assert(playlist.name !== undefined, "Playlist name should be set");
  console.log(`✅ test_playlist_info passed: id=${playlist.id} name=${playlist.name}`);

  let videoCount = 0;
  for await (const video of playlist.videos(10)) {
    console.assert(video.id !== undefined, "Video id should be set");
    videoCount++;
  }
  console.assert(videoCount > 0, "Should have at least 1 video");
  console.log(`✅ test_playlist_videos passed: got ${videoCount} videos`);

  await api.closeSessions();
}

testPlaylist().catch(console.error);

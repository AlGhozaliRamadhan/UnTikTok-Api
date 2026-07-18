// examples/playlist.ts
// Mirrors examples/playlist_example.py

import { TikTokApi } from "../src";

const msToken = process.env.ms_token ?? undefined;

async function playlistExample() {
  const api = new TikTokApi();
  await api.createSessions({
    msTokens: msToken ? [msToken] : null,
    numSessions: 1,
    sleepAfter: 3,
    browser: (process.env.TIKTOK_BROWSER as "chromium" | "firefox" | "webkit") ?? "chromium",
  });

  const playlist = api.playlist({ id: "7426714779919797038" });
  const playlistInfo = await playlist.info();
  console.log("Playlist info:", playlistInfo);
  console.log("Name:", playlist.name, "VideoCount:", playlist.videoCount);

  for await (const video of playlist.videos(30)) {
    console.log(video.toString());
    console.log(video.asDict);
  }

  // Also demonstrate fetching user playlists
  const user = api.user({ username: "davidteathercodes" });
  for await (const pl of user.playlists(5)) {
    console.log("Playlist:", pl.name);
  }

  await api.closeSessions();
}

playlistExample();

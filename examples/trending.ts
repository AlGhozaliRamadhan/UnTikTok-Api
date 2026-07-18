// examples/trending.ts
// Mirrors examples/trending_example.py

import { TikTokApi } from "../src";

const msToken = process.env.ms_token ?? undefined;

async function trendingVideos() {
  const api = new TikTokApi();
  await api.createSessions({
    msTokens: msToken ? [msToken] : null,
    numSessions: 1,
    sleepAfter: 3,
    browser: (process.env.TIKTOK_BROWSER as "chromium" | "firefox" | "webkit") ?? "chromium",
  });

  for await (const video of api.trending.videos(30)) {
    console.log(video.toString());
    console.log(video.asDict);
  }

  await api.closeSessions();
}

trendingVideos();

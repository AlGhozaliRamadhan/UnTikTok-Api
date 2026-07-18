// examples/video_keyword_search.ts
// Mirrors examples/video_keyword_search_example.py

import { TikTokApi } from "../src";

const msToken = process.env.ms_token ?? undefined;

async function videoKeywordSearchExample() {
  const api = new TikTokApi();
  await api.createSessions({
    msTokens: msToken ? [msToken] : null,
    numSessions: 1,
    sleepAfter: 3,
    browser: (process.env.TIKTOK_BROWSER as "chromium" | "firefox" | "webkit") ?? "chromium",
  });

  // Search for videos by keyword
  for await (const video of api.search.searchType("funny cat", "item", 10)) {
    console.log(video.toString());
  }

  await api.closeSessions();
}

videoKeywordSearchExample();

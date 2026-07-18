// examples/hashtag.ts
// Mirrors examples/hashtag_example.py

import { TikTokApi } from "../src";

const msToken = process.env.ms_token ?? undefined;

async function hashtagExample() {
  const api = new TikTokApi();
  await api.createSessions({
    msTokens: msToken ? [msToken] : null,
    numSessions: 1,
    sleepAfter: 3,
    browser: (process.env.TIKTOK_BROWSER as "chromium" | "firefox" | "webkit") ?? "chromium",
  });

  const tag = api.hashtag({ name: "funny" });
  await tag.info();
  console.log("Hashtag info:", tag.id, tag.name, tag.stats);

  for await (const video of tag.videos(30)) {
    console.log(video.toString());
    console.log(video.asDict);
  }

  await api.closeSessions();
}

hashtagExample();

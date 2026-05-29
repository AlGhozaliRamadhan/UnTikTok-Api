// examples/user.ts
// Mirrors examples/user_example.py

import { TikTokApi } from "../src";

const msToken = process.env.ms_token ?? undefined;

async function userVideos() {
  const api = new TikTokApi();
  await api.createSessions({
    msTokens: msToken ? [msToken] : undefined,
    numSessions: 1,
    sleepAfter: 3,
    browser: (process.env.TIKTOK_BROWSER as "chromium" | "firefox" | "webkit") ?? "chromium",
  });

  const user = api.user({ username: "therock" });
  const userInfo = await user.info();
  console.log("User info:", userInfo);

  for await (const video of user.videos(10)) {
    console.log(video.toString());
    console.log(video.asDict);
  }

  await api.closeSessions();
}

userVideos();

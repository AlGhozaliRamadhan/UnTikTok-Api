// examples/sound.ts
// Mirrors examples/sound_example.py

import { TikTokApi } from "../src";

const msToken = process.env.ms_token ?? undefined;

async function soundExample() {
  const api = new TikTokApi();
  await api.createSessions({
    msTokens: msToken ? [msToken] : undefined,
    numSessions: 1,
    sleepAfter: 3,
    browser: (process.env.TIKTOK_BROWSER as "chromium" | "firefox" | "webkit") ?? "chromium",
  });

  const sound = api.sound({ id: "7016547803243022337" });
  await sound.info();
  console.log("Sound:", sound.id, sound.title, sound.author?.toString());

  for await (const video of sound.videos(30)) {
    console.log(video.toString());
    console.log(video.asDict);
  }

  await api.closeSessions();
}

soundExample();

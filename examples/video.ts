// examples/video.ts
// Mirrors examples/video_example.py

import { TikTokApi } from "../src";
import fs from "fs";

const msToken = process.env.ms_token ?? undefined;

async function videoExample() {
  const api = new TikTokApi();
  await api.createSessions({
    msTokens: msToken ? [msToken] : undefined,
    numSessions: 1,
    sleepAfter: 3,
    browser: (process.env.TIKTOK_BROWSER as "chromium" | "firefox" | "webkit") ?? "chromium",
  });

  // Get video by URL
  const videoUrl = "https://www.tiktok.com/@davidteathercodes/video/7106686413101468970";
  const video = await TikTokApi.prototype.video.call(api, {
    url: videoUrl,
  });

  const videoInfo = await video.info();
  console.log("Video info:", videoInfo);

  // Download the video
  const bytes = await video.bytes() as Buffer;
  fs.writeFileSync("saved_video.mp4", bytes);
  console.log("Video saved to saved_video.mp4");

  // Stream the video
  console.log("Streaming video...");
  const stream = await video.bytes({ stream: true }) as AsyncGenerator<Buffer>;
  let totalBytes = 0;
  for await (const chunk of stream) {
    totalBytes += chunk.length;
  }
  console.log(`Streamed ${totalBytes} bytes`);

  await api.closeSessions();
}

videoExample();

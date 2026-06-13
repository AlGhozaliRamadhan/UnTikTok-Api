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

  // Instead of a hardcoded URL which can get flagged by captchas, 
  // let's grab the absolute latest video from a user's feed dynamically!
  const user = api.user({ username: "mrbeast" });
  let video: any = null;
  
  for await (const v of user.videos(1)) {
    video = v;
  }

  if (!video) {
    console.error("Could not find any videos for this user.");
    return;
  }

  console.log("\n--- Latest Video Metadata ---");
  console.log(`Video ID: ${video.id}`);
  console.log(`Caption: ${video.description}`);
  console.log(`Views: ${video.plays}`);
  console.log(`Likes: ${video.likes}`);
  console.log(`Comments: ${video.commentsCount}`);
  console.log(`Shares: ${video.shares}`);
  console.log(`Saves/Bookmarks: ${video.saves}`);
  console.log(`Pinned by creator: ${video.isPinned}`);

  console.log("\n--- Fetching Comments ---");

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

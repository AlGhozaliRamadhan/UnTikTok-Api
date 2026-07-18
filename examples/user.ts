// examples/user.ts
// Mirrors examples/user_example.py

import { TikTokApi } from "../src";

const msToken = process.env.ms_token ?? undefined;

async function userVideos() {
  const api = new TikTokApi();
  await api.createSessions({
    msTokens: msToken ? [msToken] : null,
    numSessions: 1,
    sleepAfter: 3,
    browser: (process.env.TIKTOK_BROWSER as "chromium" | "firefox" | "webkit") ?? "chromium",
  });

  const user = api.user({ username: "therock" });
  await user.info();
  console.log("User info loaded.");
  
  console.log("\n--- Profile Info ---");
  console.log(`Nickname: ${user.nickname}`);
  console.log(`Bio: ${user.signature}`);
  console.log(`Link in Bio: ${user.bioLink}`);
  console.log(`Profile Picture: ${user.avatar}`);
  console.log(`Verified: ${user.verified}`);
  console.log(`Followers: ${user.followers}`);
  console.log(`Following: ${user.following}`);
  console.log(`Likes (Hearts): ${user.likes}`);
  console.log(`Video Count: ${user.videoCount}`);
  console.log(`Private Account: ${user.isPrivate}`);
  
  console.log("\n--- Live Status ---");
  if (user.isLive) {
    console.log(`[LIVE] ${user.username} is currently LIVE! Room ID: ${user.roomId}`);
  } else {
    console.log(`[OFFLINE] ${user.username} is offline.`);
  }

  console.log("\n--- User Videos ---");
  for await (const video of user.videos(5)) {
    console.log(video.toString());
  }

  console.log("\n--- User Liked Videos (if public) ---");
  for await (const video of user.liked(5)) {
    console.log(video.toString());
  }

  console.log("\n--- User Favorited Videos (Collections) (if public) ---");
  for await (const video of user.favorited(5)) {
    console.log(`[FAVORITED] ${video.toString()}`);
  }

  // To see reposts, we might want to check a user who is known to have reposts.
  console.log("\n--- User Reposts ---");
  const repostUser = api.user({ username: "oja756" });
  for await (const video of repostUser.reposts(5)) {
    console.log(video.toString());
  }

  // To see pinned videos, check a user who is known to have pinned videos.
  console.log("\n--- User Pinned Videos ---");
  const pinnedUser = api.user({ username: "davidteathercodes" });
  for await (const video of pinnedUser.pinned(3)) {
    console.log(`[PINNED] ${video.toString()}`);
  }

  await api.closeSessions();
}

userVideos();

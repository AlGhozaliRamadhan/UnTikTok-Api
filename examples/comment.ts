// examples/comment.ts
// Mirrors examples/comment_example.py

import { TikTokApi } from "../src";

const msToken = process.env.ms_token ?? undefined;

async function commentExample() {
  const api = new TikTokApi();
  await api.createSessions({
    msTokens: msToken ? [msToken] : null,
    numSessions: 1,
    sleepAfter: 3,
    browser: (process.env.TIKTOK_BROWSER as "chromium" | "firefox" | "webkit") ?? "chromium",
  });

  const video = api.video({ id: "7041997751718137094" });

  for await (const comment of video.comments(20)) {
    console.log(comment.toString());
    console.log("Text:", comment.text, "Likes:", comment.likesCount);
    console.log("Author:", comment.author.toString());

    // Fetch replies
    for await (const reply of comment.replies(5)) {
      console.log("  Reply:", reply.text);
    }
  }

  await api.closeSessions();
}

commentExample();

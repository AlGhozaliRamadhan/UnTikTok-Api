// examples/search.ts
// Mirrors examples/search_example.py

import { TikTokApi } from "../src";

const msToken = process.env.ms_token ?? undefined;

async function searchExample() {
  const api = new TikTokApi();
  await api.createSessions({
    msTokens: msToken ? [msToken] : undefined,
    numSessions: 1,
    sleepAfter: 3,
    browser: (process.env.TIKTOK_BROWSER as "chromium" | "firefox" | "webkit") ?? "chromium",
  });

  for await (const user of api.search.users("david teather", 10)) {
    console.log(user.toString());
    console.log(user.asDict);
  }

  await api.closeSessions();
}

searchExample();

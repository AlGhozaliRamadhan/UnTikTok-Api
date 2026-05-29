// tests/test_trending.ts
// Mirrors tests/test_trending.py

import { TikTokApi } from "../src";

const msToken = process.env.ms_token ?? undefined;
const headless = (process.env.headless ?? "true").toLowerCase() === "true";

async function testTrending() {
  const api = new TikTokApi();
  await api.createSessions({
    msTokens: msToken ? [msToken] : undefined,
    numSessions: 1,
    sleepAfter: 3,
    browser: (process.env.TIKTOK_BROWSER as "chromium" | "firefox" | "webkit") ?? "chromium",
    headless,
  });

  let count = 0;
  for await (const video of api.trending.videos(100)) {
    count++;
  }

  console.assert(count >= 100, `Expected >= 100 videos, got ${count}`);
  console.log(`✅ test_trending passed: got ${count} videos`);

  await api.closeSessions();
}

testTrending().catch(console.error);

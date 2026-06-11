// tests/test_search.ts
// Mirrors tests/test_search.py

import assert from "assert";
import { TikTokApi } from "../src";

const msToken = process.env.ms_token ?? undefined;
const headless = (process.env.headless ?? "true").toLowerCase() === "true";

async function testSearch() {
  const api = new TikTokApi();
  try {
    await api.createSessions({
      msTokens: msToken ? [msToken] : undefined,
      numSessions: 1,
      sleepAfter: 3,
      browser: (process.env.TIKTOK_BROWSER as "chromium" | "firefox" | "webkit") ?? "chromium",
      headless,
    });

    let userCount = 0;
    for await (const user of api.search.users("david teather", 5)) {
      assert.ok(user.username !== undefined, "User username should be set");
      userCount++;
    }
    assert.ok(userCount > 0, "Should have at least 1 user result");
    console.log(`✅ test_search_users passed: got ${userCount} users`);
  } finally {
    await api.closeSessions();
  }
}

testSearch().catch((err) => {
  console.error(err);
  process.exit(1);
});

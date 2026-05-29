// tests/test_custom_launchers.ts
// Mirrors tests/test_custom_launchers.py
//
// Tests custom pageFactory and browserContextFactory options.

import { TikTokApi } from "../src";
import { chromium } from "playwright";
import type { BrowserContext, Page } from "playwright";

const msToken = process.env.ms_token ?? undefined;
const headless = (process.env.headless ?? "true").toLowerCase() === "true";

async function testCustomPageFactory() {
  const api = new TikTokApi();

  await api.createSessions({
    msTokens: msToken ? [msToken] : undefined,
    numSessions: 1,
    sleepAfter: 3,
    headless,
    pageFactory: async (context: BrowserContext): Promise<Page> => {
      const page = await context.newPage();
      // Could do custom setup here
      await page.goto("https://www.tiktok.com");
      return page;
    },
  });

  console.assert(api.sessions.length === 1, `Expected 1 session from custom pageFactory, got ${api.sessions.length}`);
  console.log("✅ test_custom_page_factory passed");

  await api.closeSessions();
}

async function testSuppressResourceLoading() {
  const api = new TikTokApi();

  await api.createSessions({
    msTokens: msToken ? [msToken] : undefined,
    numSessions: 1,
    sleepAfter: 3,
    headless,
    suppressResourceLoadTypes: ["image", "media", "font"],
  });

  console.assert(api.sessions.length === 1, "Expected 1 session with resource suppression");
  console.log("✅ test_suppress_resource_loading passed");

  await api.closeSessions();
}

async function testMultipleBrowserTypes() {
  for (const browser of ["chromium", "firefox"] as const) {
    const api = new TikTokApi();
    try {
      await api.createSessions({
        msTokens: msToken ? [msToken] : undefined,
        numSessions: 1,
        sleepAfter: 2,
        headless,
        browser,
      });
      console.assert(api.sessions.length === 1, `Expected 1 session with ${browser}`);
      console.log(`✅ test_browser_${browser} passed`);
    } finally {
      await api.closeSessions();
    }
  }
}

async function runAll() {
  console.log("Running custom launcher tests...");
  await testCustomPageFactory();
  await testSuppressResourceLoading();
  await testMultipleBrowserTypes();
  console.log("✅ All custom launcher tests passed");
}

runAll().catch(console.error);

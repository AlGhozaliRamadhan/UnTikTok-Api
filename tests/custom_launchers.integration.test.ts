// tests/custom_launchers.integration.test.ts
// Vitest version of tests/test_custom_launchers.ts (ADR-002).
// Gated by CI_NETWORK — skipped by default to avoid spinning up Playwright.

import { describe, it, expect } from "vitest";
import { TikTokApi } from "../src";
import type { BrowserContext, Page } from "playwright";

const msToken = process.env.ms_token ?? undefined;
const headless = (process.env.headless ?? "true").toLowerCase() === "true";

describe.skipIf(!process.env.CI_NETWORK)("integration: custom pageFactory + suppressResourceLoadTypes + browser types", () => {
  it("custom pageFactory creates exactly 1 session", async () => {
    const api = new TikTokApi();
    try {
      await api.createSessions({
        msTokens: msToken ? [msToken] : null,
        numSessions: 1,
        sleepAfter: 3,
        headless,
        pageFactory: async (context: BrowserContext): Promise<Page> => {
          const page = await context.newPage();
          await page.goto("https://www.tiktok.com");
          return page;
        },
      });

      expect(api.sessions.length).toBe(1);
    } finally {
      await api.closeSessions();
    }
  });

  it("suppressResourceLoadTypes creates exactly 1 session", async () => {
    const api = new TikTokApi();
    try {
      await api.createSessions({
        msTokens: msToken ? [msToken] : null,
        numSessions: 1,
        sleepAfter: 3,
        headless,
        suppressResourceLoadTypes: ["image", "media", "font"],
      });

      expect(api.sessions.length).toBe(1);
    } finally {
      await api.closeSessions();
    }
  });

  it.each(["chromium", "firefox"] as const)("creates 1 session with %s browser", async (browser) => {
    const api = new TikTokApi();
    try {
      await api.createSessions({
        msTokens: msToken ? [msToken] : null,
        numSessions: 1,
        sleepAfter: 2,
        headless,
        browser,
      });
      expect(api.sessions.length).toBe(1);
    } finally {
      await api.closeSessions();
    }
  });
});

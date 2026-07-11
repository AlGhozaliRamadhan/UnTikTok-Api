// tests/session_recovery.integration.test.ts
// Vitest version of tests/test_session_recovery.ts (ADR-002).
// Gated by CI_NETWORK — skipped by default to avoid spinning up Playwright.

import { describe, it, expect } from "vitest";
import { TikTokApi } from "../src";

const msToken = process.env.ms_token ?? undefined;
const headless = (process.env.headless ?? "true").toLowerCase() === "true";

describe.skipIf(!process.env.CI_NETWORK)("integration: session recovery + health + auto-cleanup", () => {
  it("getResourceStats reports correct session counts", async () => {
    const api = new TikTokApi();
    try {
      await api.createSessions({
        msTokens: msToken ? [msToken] : undefined,
        numSessions: 2,
        sleepAfter: 3,
        headless,
      });

      const stats = api.getResourceStats();
      expect(stats.totalSessions).toBe(2);
      expect(stats.validSessions).toBe(2);
      expect(stats.invalidSessions).toBe(0);
      expect(stats.hasBrowser).toBe(true);
      expect(stats.cleanupCalled).toBe(false);
    } finally {
      await api.closeSessions();
    }

    const statsAfter = api.getResourceStats();
    expect(statsAfter.totalSessions).toBe(0);
    expect(statsAfter.cleanupCalled).toBe(true);
  });

  it("healthCheck reports the created session as healthy", async () => {
    const api = new TikTokApi();
    try {
      await api.createSessions({
        msTokens: msToken ? [msToken] : undefined,
        numSessions: 1,
        sleepAfter: 3,
        headless,
      });

      const health = await api.healthCheck();
      expect(health.totalSessions).toBe(1);
      expect(health.healthySessions).toBe(1);
    } finally {
      await api.closeSessions();
    }
  });

  it("allowPartialSessions creates at least minSessions", async () => {
    const api = new TikTokApi();
    try {
      await api.createSessions({
        msTokens: msToken ? [msToken] : undefined,
        numSessions: 2,
        sleepAfter: 1,
        headless,
        allowPartialSessions: true,
        minSessions: 1,
      });

      const stats = api.getResourceStats();
      expect(stats.totalSessions).toBeGreaterThanOrEqual(1);
    } finally {
      await api.closeSessions();
    }
  });

  it("autoCleanupDeadSessions removes an invalidated session", async () => {
    const api = new TikTokApi();
    try {
      await api.createSessions({
        msTokens: msToken ? [msToken] : undefined,
        numSessions: 1,
        sleepAfter: 3,
        headless,
      });

      expect(api.sessions.length).toBe(1);
      const session = api.sessions[0]!;
      await api._markSessionInvalid(session);
      expect(api.sessions.length).toBe(0);
    } finally {
      await api.closeSessions();
    }
  });
});

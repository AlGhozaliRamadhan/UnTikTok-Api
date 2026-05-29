// tests/test_session_recovery.ts
// Mirrors tests/test_session_recovery.py
//
// Tests the session recovery, health check, and auto-cleanup features of TikTokApi.

import { TikTokApi } from "../src";

const msToken = process.env.ms_token ?? undefined;
const headless = (process.env.headless ?? "true").toLowerCase() === "true";

async function testGetResourceStats() {
  const api = new TikTokApi();
  await api.createSessions({
    msTokens: msToken ? [msToken] : undefined,
    numSessions: 2,
    sleepAfter: 3,
    headless,
  });

  const stats = api.getResourceStats();
  console.assert(stats.totalSessions === 2, `Expected 2 sessions, got ${stats.totalSessions}`);
  console.assert(stats.validSessions === 2, `Expected 2 valid sessions, got ${stats.validSessions}`);
  console.assert(stats.invalidSessions === 0, `Expected 0 invalid sessions, got ${stats.invalidSessions}`);
  console.assert(stats.hasBrowser === true, "Browser should be open");
  console.assert(stats.cleanupCalled === false, "Cleanup should not have been called");
  console.log("✅ test_get_resource_stats passed");

  await api.closeSessions();

  const statsAfter = api.getResourceStats();
  console.assert(statsAfter.totalSessions === 0, "Sessions should be cleared after close");
  console.assert(statsAfter.cleanupCalled === true, "Cleanup should be marked as called");
  console.log("✅ test_stats_after_close passed");
}

async function testHealthCheck() {
  const api = new TikTokApi();
  await api.createSessions({
    msTokens: msToken ? [msToken] : undefined,
    numSessions: 1,
    sleepAfter: 3,
    headless,
  });

  const health = await api.healthCheck();
  console.assert(health.totalSessions === 1, `Expected 1 session, got ${health.totalSessions}`);
  console.assert(health.healthySessions === 1, `Expected 1 healthy session, got ${health.healthySessions}`);
  console.log("✅ test_health_check passed");
  console.log("Health:", JSON.stringify(health, null, 2));

  await api.closeSessions();
}

async function testAllowPartialSessions() {
  const api = new TikTokApi();

  // Create 2 out of 3 sessions with bad proxy on 1 (simulating partial failure)
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
    console.assert(stats.totalSessions >= 1, "Should have at least 1 session with allowPartialSessions");
    console.log(`✅ test_allow_partial_sessions passed: ${stats.totalSessions} sessions created`);
  } finally {
    await api.closeSessions();
  }
}

async function testAutoCleanupDeadSessions() {
  const api = new TikTokApi();
  await api.createSessions({
    msTokens: msToken ? [msToken] : undefined,
    numSessions: 1,
    sleepAfter: 3,
    headless,
  });

  const initialCount = api.sessions.length;
  console.assert(initialCount === 1, `Expected 1 session, got ${initialCount}`);

  // Manually mark a session as invalid to simulate a dead session
  const session = api.sessions[0];
  await api._markSessionInvalid(session);

  // With autoCleanup enabled (default), the session should be removed
  console.assert(api.sessions.length === 0, `Expected 0 sessions after marking invalid, got ${api.sessions.length}`);
  console.log("✅ test_auto_cleanup_dead_sessions passed");

  await api.closeSessions();
}

async function runAll() {
  console.log("Running session recovery tests...");
  await testGetResourceStats();
  await testHealthCheck();
  await testAllowPartialSessions();
  await testAutoCleanupDeadSessions();
  console.log("✅ All session recovery tests passed");
}

runAll().catch(console.error);

// ============================================================
// health/HealthMonitor.ts — resource stats + healthCheck (ADR-009)
// ============================================================

import type { Browser } from "playwright";
import type { HealthCheckResult, ResourceStats, TikTokPlaywrightSession } from "../types";

export interface HealthMonitorHost {
  getSessions(): TikTokPlaywrightSession[];
  getBrowser(): Browser | null;
  getPlaywright(): { stop: () => Promise<void> } | null;
  isCleanupCalled(): boolean;
  isAutoCleanupEnabled(): boolean;
  isRecoveryEnabled(): boolean;
  isSessionValid(session: TikTokPlaywrightSession): Promise<boolean>;
}

export class HealthMonitor {
  constructor(private readonly host: HealthMonitorHost) {}

  getResourceStats(): ResourceStats {
    const sessions = this.host.getSessions();
    const validSessions = sessions.filter((s) => s.isValid).length;
    const browser = this.host.getBrowser();
    const playwright = this.host.getPlaywright();
    return {
      totalSessions: sessions.length,
      validSessions,
      invalidSessions: sessions.length - validSessions,
      hasBrowser: browser != null,
      // Real detection: browser or playwright stop-handle is present.
      hasPlaywright: browser != null || playwright != null,
      cleanupCalled: this.host.isCleanupCalled(),
      autoCleanupEnabled: this.host.isAutoCleanupEnabled(),
      recoveryEnabled: this.host.isRecoveryEnabled(),
    };
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const health = this.getResourceStats() as HealthCheckResult;
    const sessions = this.host.getSessions();
    const sessionDetails = await Promise.all(
      sessions.map(async (s, i) => ({
        index: i,
        valid: await this.host.isSessionValid(s),
        markedValid: s.isValid,
      }))
    );
    health.sessionDetails = sessionDetails;
    health.healthySessions = sessionDetails.filter((s) => s.valid).length;

    if (health.invalidSessions > 0 && !this.host.isAutoCleanupEnabled()) {
      health.warning = `${health.invalidSessions} invalid sessions accumulating (auto-cleanup disabled)`;
    }
    return health;
  }
}

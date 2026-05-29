// ============================================================
// types.ts
// Shared TypeScript interfaces and types
// ============================================================

import type { BrowserContext, Page } from "playwright";

// ---------------------------------------------------------------------------
// Proxy settings type (playwright's ProxySettings is internal; we define ours)
// ---------------------------------------------------------------------------
export interface ProxySettings {
  server: string;
  bypass?: string;
  username?: string;
  password?: string;
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------
export interface TikTokPlaywrightSession {
  context: BrowserContext;
  page: Page;
  proxy?: ProxySettings | string | null;
  params?: Record<string, string> | null;
  headers?: Record<string, string> | null;
  msToken?: string | null;
  baseUrl: string;
  isValid: boolean;
}

// ---------------------------------------------------------------------------
// create_sessions() options
// ---------------------------------------------------------------------------
export interface CreateSessionsOptions {
  numSessions?: number;
  headless?: boolean;
  msTokens?: string[] | null;
  /** @deprecated Use proxyProvider instead */
  proxies?: (ProxySettings | string)[] | null;
  sleepAfter?: number;
  startingUrl?: string;
  contextOptions?: Record<string, unknown>;
  overrideBrowserArgs?: string[] | null;
  cookies?: Record<string, string>[] | null;
  suppressResourceLoadTypes?: string[] | null;
  browser?: "chromium" | "firefox" | "webkit";
  executablePath?: string | null;
  pageFactory?: ((context: BrowserContext) => Promise<Page>) | null;
  browserContextFactory?: ((playwright: unknown) => Promise<BrowserContext>) | null;
  timeout?: number;
  enableSessionRecovery?: boolean;
  allowPartialSessions?: boolean;
  minSessions?: number | null;
}

// ---------------------------------------------------------------------------
// Generic response shapes from TikTok
// ---------------------------------------------------------------------------
export type TikTokResponse = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Resource stats
// ---------------------------------------------------------------------------
export interface ResourceStats {
  totalSessions: number;
  validSessions: number;
  invalidSessions: number;
  hasBrowser: boolean;
  hasPlaywright: boolean;
  cleanupCalled: boolean;
  autoCleanupEnabled: boolean;
  recoveryEnabled: boolean;
}

export interface HealthCheckResult extends ResourceStats {
  sessionDetails: Array<{ index: number; valid: boolean; markedValid: boolean }>;
  healthySessions: number;
  warning?: string;
}

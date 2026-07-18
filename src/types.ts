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
  username?: string | undefined;
  password?: string | undefined;
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------
export interface TikTokPlaywrightSession {
  context: BrowserContext;
  page: Page;
  proxy?: ProxySettings | string | null | undefined;
  params?: Record<string, string> | null | undefined;
  headers?: Record<string, string> | null | undefined;
  msToken?: string | null | undefined;
  baseUrl: string;
  isValid: boolean;
}

// ---------------------------------------------------------------------------
// create_sessions() options
// ---------------------------------------------------------------------------
export interface CreateSessionsOptions {
  numSessions?: number | undefined;
  headless?: boolean | undefined;
  msTokens?: string[] | null | undefined;
  /** @deprecated Use proxyProvider instead */
  proxies?: (ProxySettings | string)[] | null | undefined;
  sleepAfter?: number | undefined;
  startingUrl?: string | undefined;
  contextOptions?: Record<string, unknown> | undefined;
  overrideBrowserArgs?: string[] | null | undefined;
  cookies?: Record<string, string>[] | null | undefined;
  suppressResourceLoadTypes?: string[] | null | undefined;
  browser?: "chromium" | "firefox" | "webkit" | undefined;
  executablePath?: string | null | undefined;
  pageFactory?: ((context: BrowserContext) => Promise<Page>) | null | undefined;
  browserContextFactory?: ((playwright: unknown) => Promise<BrowserContext>) | null | undefined;
  timeout?: number | undefined;
  enableSessionRecovery?: boolean | undefined;
  allowPartialSessions?: boolean | undefined;
  minSessions?: number | null | undefined;
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

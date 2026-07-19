// ============================================================
// types.ts
// Shared TypeScript interfaces and types
// ============================================================

import type { BrowserContext, Page } from "playwright";
import type { z } from "zod";
import type { Logger } from "./logger";
import type { User, UserOptions } from "./api/user";
import type { Video, VideoOptions } from "./api/video";
import type { Sound, SoundOptions } from "./api/sound";
import type { Hashtag, HashtagOptions } from "./api/hashtag";
import type { Comment } from "./api/comment";
import type { Playlist, PlaylistOptions } from "./api/playlist";

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
// makeRequest options (ADR-007 / ADR-009)
// ---------------------------------------------------------------------------
export interface MakeRequestOptions {
  url: string;
  headers?: Record<string, string> | null | undefined;
  params?: Record<string, unknown> | null | undefined;
  retries?: number;
  exponentialBackoff?: boolean;
  sessionIndex?: number | undefined;
  schema?: z.ZodType | undefined;
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

// ---------------------------------------------------------------------------
// ITikTokApi — surface that api/* modules depend on (ADR-009)
// Breaks the bidirectional type edge: api/* no longer import TikTokApi.
// ---------------------------------------------------------------------------
export interface ITikTokApi {
  readonly logger: Logger;

  makeRequest<S extends z.ZodType>(
    options: MakeRequestOptions & { schema: S }
  ): Promise<z.infer<S>>;
  makeRequest(options: MakeRequestOptions): Promise<Record<string, unknown>>;

  user(options: UserOptions): User;
  video(options: VideoOptions): Video;
  sound(options: SoundOptions): Sound;
  hashtag(options: HashtagOptions): Hashtag;
  comment(options: { data?: Record<string, unknown> }): Comment;
  playlist(options: PlaylistOptions): Playlist;

  /** Resolve a live session (validates / recovers). Prefer over any sync lookup. */
  _getValidSessionIndex(
    kwargs?: { sessionIndex?: number | undefined }
  ): Promise<[number, TikTokPlaywrightSession]>;

  setSessionCookies(
    session: TikTokPlaywrightSession,
    cookies: Record<string, unknown>[]
  ): Promise<void>;

  getSessionCookies(session: TikTokPlaywrightSession): Promise<Record<string, string>>;
}

// ============================================================
// tiktok.ts
// TikTokApi — thin composer + public API surface (ADR-009)
// Session validation, signing, dispatch, health, and session-creation
// lifecycle live in session/, request/, health/ modules.
// ============================================================

import type { Browser } from "playwright";
import type { z } from "zod";

import type {
  TikTokPlaywrightSession,
  CreateSessionsOptions,
  ResourceStats,
  HealthCheckResult,
  MakeRequestOptions,
  ITikTokApi,
} from "./types";
import { Logger, type LogLevel } from "./logger";
import { SessionManager } from "./session/SessionManager";
import { SessionFactory } from "./session/SessionFactory";
import { Signer } from "./request/Signer";
import { RequestDispatcher } from "./request/RequestDispatcher";
import { HealthMonitor } from "./health/HealthMonitor";

import { User, type UserOptions } from "./api/user";
import { Video, type VideoOptions } from "./api/video";
import { Sound, type SoundOptions } from "./api/sound";
import { Hashtag, type HashtagOptions } from "./api/hashtag";
import { Comment } from "./api/comment";
import { Trending } from "./api/trending";
import { Search } from "./api/search";
import { Playlist, type PlaylistOptions } from "./api/playlist";

// Re-export for any external consumers that imported from tiktok.ts
export type { MakeRequestOptions } from "./types";
export { Logger } from "./logger";
export type { LogLevel } from "./logger";

// ---------------------------------------------------------------------------
// TikTokApi
// ---------------------------------------------------------------------------
export class TikTokApi implements ITikTokApi {
  readonly trending: Trending;
  readonly search: Search;

  sessions: TikTokPlaywrightSession[] = [];
  browser: Browser | null = null;
  playwright: { stop: () => Promise<void> } | null = null;

  private _sessionRecoveryEnabled = true;
  private _sessionCreationLock = false;
  private _cleanupCalled = false;
  private _autoCleanupDeadSessions = true;
  private _userAgent: string | null = null;

  readonly logger: Logger;

  private readonly _sessionManager: SessionManager;
  private readonly _sessionFactory: SessionFactory;
  private readonly _signer: Signer;
  private readonly _dispatcher: RequestDispatcher;
  private readonly _health: HealthMonitor;

  constructor(options: { loggingLevel?: LogLevel; loggerName?: string } = {}) {
    const { loggingLevel = "warn", loggerName } = options;
    this.logger = new Logger(loggerName ?? "TikTokApi", loggingLevel);

    this.trending = new Trending(this);
    this.search = new Search(this);

    // Compose focused modules. Arrow host methods keep `this` lexical without
    // a no-this-alias local, and without circular imports of TikTokApi.
    this._sessionManager = new SessionManager({
      getLogger: () => this.logger,
      getSessions: () => this.sessions,
      isSessionRecoveryEnabled: () => this._sessionRecoveryEnabled,
      isAutoCleanupDeadSessions: () => this._autoCleanupDeadSessions,
      getSessionCreationLock: () => this._sessionCreationLock,
      setSessionCreationLock: (v: boolean) => {
        this._sessionCreationLock = v;
      },
    });

    this._sessionFactory = new SessionFactory({
      getLogger: () => this.logger,
      getSessions: () => this.sessions,
      getBrowser: () => this.browser,
      setBrowser: (b) => {
        this.browser = b;
      },
      getUserAgent: () => this._userAgent,
      setUserAgent: (ua) => {
        this._userAgent = ua;
      },
      setSessionRecoveryEnabled: (v) => {
        this._sessionRecoveryEnabled = v;
      },
      setSessionParams: (s) => this._sessionManager.setSessionParams(s),
      getSessionCookies: (s) => this._sessionManager.getSessionCookies(s),
    });

    this._signer = new Signer({
      getLogger: () => this.logger,
      getValidSessionIndex: (kwargs) => this._getValidSessionIndex(kwargs),
      markSessionInvalid: (session) => this._markSessionInvalid(session),
    });

    this._dispatcher = new RequestDispatcher({
      getLogger: () => this.logger,
      getValidSessionIndex: (kwargs) => this._getValidSessionIndex(kwargs),
      markSessionInvalid: (session) => this._markSessionInvalid(session),
      getSessionCookies: (session) => this.getSessionCookies(session),
      signUrl: (url, kwargs) => this.signUrl(url, kwargs),
      runFetchScript: (url, headers, kwargs) => this.runFetchScript(url, headers, kwargs),
    });

    this._health = new HealthMonitor({
      getSessions: () => this.sessions,
      getBrowser: () => this.browser,
      getPlaywright: () => this.playwright,
      isCleanupCalled: () => this._cleanupCalled,
      isAutoCleanupEnabled: () => this._autoCleanupDeadSessions,
      isRecoveryEnabled: () => this._sessionRecoveryEnabled,
      isSessionValid: (session) => this._isSessionValid(session),
    });
  }

  // ── Factory methods ──

  user(options: UserOptions): User {
    return new User(this, options);
  }

  video(options: VideoOptions): Video {
    return new Video(this, options);
  }

  sound(options: SoundOptions): Sound {
    return new Sound(this, options);
  }

  hashtag(options: HashtagOptions): Hashtag {
    return new Hashtag(this, options);
  }

  comment(options: { data?: Record<string, unknown> }): Comment {
    return new Comment(this, options.data);
  }

  playlist(options: PlaylistOptions): Playlist {
    return new Playlist(this, options);
  }

  // ── Session validation (delegated) ──

  async _isSessionValid(session: TikTokPlaywrightSession): Promise<boolean> {
    return this._sessionManager.isSessionValid(session);
  }

  async _markSessionInvalid(session: TikTokPlaywrightSession): Promise<void> {
    return this._sessionManager.markSessionInvalid(session);
  }

  async _getValidSessionIndex(
    kwargs: { sessionIndex?: number | undefined } = {}
  ): Promise<[number, TikTokPlaywrightSession]> {
    return this._sessionManager.getValidSessionIndex(kwargs);
  }

  // ── Create sessions (delegated to SessionFactory) ──

  async createSessions(options: CreateSessionsOptions = {}): Promise<void> {
    return this._sessionFactory.createSessions(options);
  }

  // ── Cookie helpers (delegated) ──

  async setSessionCookies(
    session: TikTokPlaywrightSession,
    cookies: Record<string, unknown>[]
  ): Promise<void> {
    return this._sessionManager.setSessionCookies(session, cookies);
  }

  async getSessionCookies(session: TikTokPlaywrightSession): Promise<Record<string, string>> {
    return this._sessionManager.getSessionCookies(session);
  }

  // ── JS fetch / XBogus / Sign (delegated) ──

  async runFetchScript(
    url: string,
    headers: Record<string, string>,
    kwargs: { sessionIndex?: number } = {}
  ): Promise<string> {
    return this._signer.runFetchScript(url, headers, kwargs);
  }

  async generateXBogus(
    url: string,
    kwargs: { sessionIndex?: number } = {}
  ): Promise<Record<string, string>> {
    return this._signer.generateXBogus(url, kwargs);
  }

  async signUrl(url: string, kwargs: { sessionIndex?: number } = {}): Promise<string> {
    return this._signer.signUrl(url, kwargs);
  }

  // ── Session Storage ──

  /**
   * Saves the current Playwright browser context state (cookies, local storage) to a file.
   * You can load this state back by passing `contextOptions: { storageState: "path.json" }` to `createSessions`.
   */
  async saveSessionState(path: string, sessionIndex = 0): Promise<void> {
    return this._sessionManager.saveSessionState(path, sessionIndex);
  }

  // ── makeRequest (delegated) ──

  async makeRequest<S extends z.ZodType>(
    options: MakeRequestOptions & { schema: S }
  ): Promise<z.infer<S>>;
  async makeRequest(options: MakeRequestOptions): Promise<Record<string, unknown>>;
  async makeRequest(options: MakeRequestOptions & { schema?: z.ZodType }): Promise<unknown> {
    return this._dispatcher.makeRequest(options as MakeRequestOptions);
  }

  // ── Close / cleanup ──

  async closeSessions(): Promise<void> {
    this.logger.debug(`Closing ${this.sessions.length} sessions...`);

    for (const session of this.sessions) {
      try {
        await session.page.close();
      } catch (e) {
        this.logger.debug(`Error closing page: ${e}`);
      }
      try {
        await session.context.close();
      } catch (e) {
        this.logger.debug(`Error closing context: ${e}`);
      }
    }
    this.sessions = [];

    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    } catch (e) {
      this.logger.debug(`Error closing browser: ${e}`);
    }

    this._cleanupCalled = true;
    this.logger.debug("All sessions and browser resources closed successfully");
  }

  async stopPlaywright(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    } catch (e) {
      this.logger.debug(`Error closing browser: ${e}`);
    }
  }

  async getSessionContent(
    url: string,
    kwargs: { sessionIndex?: number } = {}
  ): Promise<string> {
    const [, session] = await this._getValidSessionIndex(kwargs);
    try {
      return await session.page.content();
    } catch (e) {
      this.logger.error(`Session died during getSessionContent: ${e}`);
      await this._markSessionInvalid(session);
      throw e;
    }
  }

  // ── Resource stats / health (delegated) ──

  getResourceStats(): ResourceStats {
    return this._health.getResourceStats();
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return this._health.healthCheck();
  }

  // ── Context manager (using/Symbol.asyncDispose) ──

  async [Symbol.asyncDispose](): Promise<void> {
    await this.closeSessions();
  }
}

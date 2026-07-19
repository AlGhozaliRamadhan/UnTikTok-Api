// ============================================================
// tiktok.ts
// TikTokApi — thin composer + public API surface (ADR-009)
// Session validation, signing, dispatch, and health live in
// session/, request/, health/ modules.
// ============================================================

import {
  Browser,
  BrowserContext,
  Page,
} from "playwright";
import { randomInt } from "crypto";
import { URL } from "url";
import type { z } from "zod";

import type {
  TikTokPlaywrightSession,
  CreateSessionsOptions,
  ResourceStats,
  HealthCheckResult,
  ProxySettings,
  MakeRequestOptions,
  ITikTokApi,
} from "./types";
import { InvalidParameterException } from "./exceptions";
import { randomChoice, sleep } from "./helpers";
import { stealthAsync } from "./stealth";
import { Logger, type LogLevel } from "./logger";
import {
  DEFAULT_NUM_SESSIONS,
  DEFAULT_SLEEP_AFTER,
  DEFAULT_TIMEOUT_MS,
} from "./constants";
import { SessionManager } from "./session/SessionManager";
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

  // ── Create sessions (lifecycle stays on the composer for now) ──

  async createSessions(options: CreateSessionsOptions = {}): Promise<void> {
    const {
      numSessions = DEFAULT_NUM_SESSIONS,
      headless = true,
      msTokens = null,
      proxies = null,
      sleepAfter = DEFAULT_SLEEP_AFTER,
      startingUrl = "https://www.tiktok.com",
      contextOptions = {},
      overrideBrowserArgs = null,
      cookies = null,
      suppressResourceLoadTypes = null,
      browser: browserName = "chromium",
      executablePath = null,
      pageFactory = null,
      browserContextFactory = null,
      timeout = DEFAULT_TIMEOUT_MS,
      enableSessionRecovery = true,
      allowPartialSessions = false,
      minSessions = null,
    } = options;

    this._sessionRecoveryEnabled = enableSessionRecovery;

    const { chromium: pw_chromium, firefox: pw_firefox, webkit: pw_webkit } = await import("playwright");

    if (browserContextFactory) {
      const factoryResult = await browserContextFactory(null);
      this.browser = factoryResult as unknown as Browser;
    } else {
      let launchArgs = overrideBrowserArgs ?? undefined;

      const pwProxy = proxyToPlaywright(randomChoice(proxies));
      const launchOpts: Record<string, unknown> = { headless };
      if (launchArgs != null) launchOpts.args = launchArgs;
      if (pwProxy != null) launchOpts.proxy = pwProxy;
      if (executablePath != null) launchOpts.executablePath = executablePath;

      if (browserName === "chromium") {
        if (headless && !overrideBrowserArgs) {
          launchArgs = ["--headless=new"];
          launchOpts.args = launchArgs;
          launchOpts.headless = false;
        }
        this.browser = await pw_chromium.launch(launchOpts as Parameters<typeof pw_chromium.launch>[0]);
      } else if (browserName === "firefox") {
        this.browser = await pw_firefox.launch(launchOpts as Parameters<typeof pw_firefox.launch>[0]);
      } else if (browserName === "webkit") {
        this.browser = await pw_webkit.launch(launchOpts as Parameters<typeof pw_webkit.launch>[0]);
      } else {
        throw new InvalidParameterException(
          null,
          "Invalid browser argument. Use 'chromium', 'firefox', or 'webkit'."
        );
      }
    }

    let resolvedUA =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
    if (this.browser && browserName === "chromium") {
      try {
        const tempContext = await this.browser.newContext();
        const tempPage = await tempContext.newPage();
        const rawUA = (await tempPage.evaluate("navigator.userAgent")) as string;
        resolvedUA = rawUA.replace("HeadlessChrome", "Chrome");
        await tempPage.close();
        await tempContext.close();
      } catch {
        // Use hardcoded fallback
      }
    }
    this._userAgent = resolvedUA;

    const createOne = () =>
      this._createSession({
        url: startingUrl,
        msToken: randomChoice(msTokens),
        proxy: randomChoice(proxies),
        contextOptions,
        sleepAfter,
        cookies: randomChoice(cookies),
        suppressResourceLoadTypes,
        timeout,
        pageFactory,
        browserContextFactory,
      });

    if (allowPartialSessions) {
      const results = await Promise.allSettled(
        Array.from({ length: numSessions }, createOne)
      );

      const failed = results.filter((r) => r.status === "rejected").length;
      const succeeded = this.sessions.length;
      const minRequired = minSessions ?? 1;

      if (succeeded < minRequired) {
        const errors = results
          .filter((r): r is PromiseRejectedResult => r.status === "rejected")
          .slice(0, 3)
          .map((r) => String(r.reason));
        throw new InvalidParameterException(
          null,
          `Failed to create minimum required sessions. Created ${succeeded}/${numSessions}, needed ${minRequired}.\n` +
            `Errors: ${errors.join("; ")}`
        );
      }
      if (failed > 0) {
        this.logger.warn(`Created ${succeeded}/${numSessions} sessions. ${failed} failed.`);
      }
    } else {
      await Promise.all(Array.from({ length: numSessions }, createOne));
    }
  }

  private async _createSession(options: {
    url?: string | undefined;
    msToken?: string | null | undefined;
    proxy?: unknown;
    contextOptions?: Record<string, unknown> | undefined;
    sleepAfter?: number | undefined;
    cookies?: Record<string, string> | null | undefined;
    suppressResourceLoadTypes?: string[] | null | undefined;
    timeout?: number | undefined;
    pageFactory?: ((ctx: BrowserContext) => Promise<Page>) | null | undefined;
    browserContextFactory?: ((pw: unknown) => Promise<BrowserContext>) | null | undefined;
  }): Promise<void> {
    const {
      url = "https://www.tiktok.com",
      msToken = null,
      proxy,
      contextOptions = {},
      sleepAfter = DEFAULT_SLEEP_AFTER,
      suppressResourceLoadTypes = null,
      timeout = DEFAULT_TIMEOUT_MS,
      pageFactory = null,
    } = options;
    let { cookies = null } = options;

    let context: BrowserContext;
    let page: Page;

    try {
      if (msToken != null) {
        cookies = cookies ?? {};
        cookies["msToken"] = msToken;
      }

      let defaultUA = this._userAgent;
      if (!defaultUA) {
        defaultUA =
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
      }
      const ctxOpts: Record<string, unknown> = { userAgent: defaultUA, ...contextOptions };
      const pwProxyOpt = proxyToPlaywright(proxy);
      if (pwProxyOpt) ctxOpts.proxy = pwProxyOpt;
      context = await this.browser!.newContext(
        ctxOpts as Parameters<Browser["newContext"]>[0]
      );

      if (cookies) {
        const hostname = new URL(url).hostname;
        const formattedCookies = Object.entries(cookies)
          .filter(([, v]) => v != null)
          .map(([name, value]) => ({
            name,
            value,
            domain: hostname,
            path: "/",
          }));
        await context.addCookies(formattedCookies);
      }

      const applySuppression = async (p: Page) => {
        if (!suppressResourceLoadTypes) return;
        await p.route("**/*", (route, request) => {
          if (suppressResourceLoadTypes.includes(request.resourceType())) {
            void route.abort();
          } else {
            void route.continue();
          }
        });
      };

      if (pageFactory) {
        page = await pageFactory(context);
      } else {
        page = await context.newPage();
        await stealthAsync(page);
        await applySuppression(page);
        await page.goto(url);
      }

      if (!page.url().includes("tiktok")) {
        await page.goto("https://www.tiktok.com");
      }

      let requestHeaders: Record<string, string> | null = null;
      page.once("request", (request) => {
        requestHeaders = request.headers() as Record<string, string>;
      });

      if (pageFactory) {
        await applySuppression(page);
      }

      page.setDefaultNavigationTimeout(timeout);

      const x = randomInt(0, 51);
      const y = randomInt(0, 51);
      const a = randomInt(1, 51);
      const b = randomInt(100, 201);

      await page.mouse.move(x, y);
      try {
        await page.waitForLoadState("networkidle", { timeout: 15000 });
      } catch {
        this.logger.debug(`networkidle timeout during session creation, continuing...`);
      }
      await page.mouse.move(a, b);

      const session: TikTokPlaywrightSession = {
        context,
        page,
        msToken: msToken ?? null,
        proxy: (proxy ?? null) as string | ProxySettings | null | undefined,
        headers: requestHeaders,
        baseUrl: url,
        isValid: true,
      };

      let finalMsToken = msToken;
      if (finalMsToken == null) {
        await sleep(sleepAfter * 1000);
        const sessionCookies = await this.getSessionCookies(session);
        finalMsToken = sessionCookies["msToken"] ?? null;
        session.msToken = finalMsToken;
        if (!finalMsToken) {
          this.logger.info(
            `Failed to get msToken on session index ${this.sessions.length}, consider specifying ms_tokens`
          );
        }
      }

      this.sessions.push(session);
      await this._sessionManager.setSessionParams(session);
    } catch (e) {
      this.logger.error(`Failed to create session: ${e}`);
      throw e;
    }
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

// ---------------------------------------------------------------------------
// Helper: convert proxy string or object to Playwright proxy format
// ---------------------------------------------------------------------------
function proxyToPlaywright(
  proxy: unknown
): { server: string; username?: string; password?: string } | undefined {
  if (!proxy) return undefined;
  if (typeof proxy === "string") return { server: proxy };
  if (typeof proxy === "object") {
    const p = proxy as Record<string, string>;
    return {
      server: p["server"] ?? p["http"] ?? p["https"] ?? "",
      ...(p["username"] !== undefined ? { username: p["username"] } : {}),
      ...(p["password"] !== undefined ? { password: p["password"] } : {}),
    };
  }
  return undefined;
}

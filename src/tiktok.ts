// ============================================================
// tiktok.ts
// Mirrors TikTokApi/tiktok.py
// ============================================================

import {
  Browser,
  BrowserContext,
  Page,
} from "playwright";
import { randomInt } from "crypto";
import { URL } from "url";

import type { TikTokPlaywrightSession, CreateSessionsOptions, ResourceStats, HealthCheckResult } from "./types";
import { EmptyResponseException, InvalidJSONException } from "./exceptions";
import { randomChoice, sleep } from "./helpers";
import { stealthAsync } from "./stealth";

import { User, type UserOptions } from "./api/user";
import { Video, type VideoOptions } from "./api/video";
import { Sound, type SoundOptions } from "./api/sound";
import { Hashtag, type HashtagOptions } from "./api/hashtag";
import { Comment } from "./api/comment";
import { Trending } from "./api/trending";
import { Search } from "./api/search";
import { Playlist, type PlaylistOptions } from "./api/playlist";

// ---------------------------------------------------------------------------
// Logger (simple console-based)
// ---------------------------------------------------------------------------
type LogLevel = "debug" | "info" | "warn" | "error";

export class Logger {
  private level: LogLevel;
  private name: string;

  constructor(name: string, level: LogLevel = "warn") {
    this.name = name;
    this.level = level;
  }

  private _levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

  private _log(severity: LogLevel, message: string): void {
    if (this._levels[severity] >= this._levels[this.level]) {
      const ts = new Date().toISOString();
      console[severity === "warn" ? "warn" : severity](`${ts} - ${this.name} - ${severity.toUpperCase()} - ${message}`);
    }
  }

  debug(msg: string): void { this._log("debug", msg); }
  info(msg: string): void { this._log("info", msg); }
  warn(msg: string): void { this._log("warn", msg); }
  error(msg: string): void { this._log("error", msg); }
}

// ---------------------------------------------------------------------------
// makeRequest options
// ---------------------------------------------------------------------------
export interface MakeRequestOptions {
  url: string;
  headers?: Record<string, string> | null;
  params?: Record<string, unknown> | null;
  retries?: number;
  exponentialBackoff?: boolean;
  sessionIndex?: number;
}

// ---------------------------------------------------------------------------
// TikTokApi
// ---------------------------------------------------------------------------
export class TikTokApi {
  // ── Static sub-module references (mirrors Python class-level attributes) ──
  readonly trending: Trending;
  readonly search: Search;

  // ── State ──
  sessions: TikTokPlaywrightSession[] = [];
  browser: Browser | null = null;
  playwright: { stop: () => Promise<void> } | null = null;

  private _sessionRecoveryEnabled = true;
  private _sessionCreationLock = false;
  private _cleanupCalled = false;
  private _autoCleanupDeadSessions = true;
  private _playwrightInstance: { stop: () => Promise<void> } | null = null;
  private _userAgent: string | null = null;

  readonly logger: Logger;

  constructor(options: { loggingLevel?: LogLevel; loggerName?: string } = {}) {
    const { loggingLevel = "warn", loggerName } = options;
    this.logger = new Logger(loggerName ?? "TikTokApi", loggingLevel);

    this.trending = new Trending(this);
    this.search = new Search(this);


    // Wire static parent references
  }

  // ── Factory methods (mirror Python's api.user(), api.video(), etc.) ──

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

  // ── Session params ──

  private async _setSessionParams(session: TikTokPlaywrightSession): Promise<void> {
    const page = session.page;
    // Pass as string expressions so TypeScript never sees browser-only globals
    const userAgent: string = await page.evaluate("navigator.userAgent") as string;
    const language: string = await page.evaluate(
      "navigator.language || navigator.userLanguage || 'en'"
    ) as string;
    const platform: string = await page.evaluate("navigator.platform") as string;
    const timezone: string = await page.evaluate(
      "Intl.DateTimeFormat().resolvedOptions().timeZone"
    ) as string;

    const deviceId = String(BigInt(randomInt(2 ** 30)) * BigInt(2 ** 30) + BigInt(randomInt(2 ** 30)));
    const historyLen = String(randomInt(1, 11));
    const screenHeight = String(randomInt(600, 1081));
    const screenWidth = String(randomInt(800, 1921));

    session.params = {
      aid: "1988",
      app_language: language,
      app_name: "tiktok_web",
      browser_language: language,
      browser_name: "Mozilla",
      browser_online: "true",
      browser_platform: platform,
      browser_version: userAgent,
      channel: "tiktok_web",
      cookie_enabled: "true",
      device_id: deviceId,
      device_platform: "web_pc",
      focus_state: "true",
      from_page: "user",
      history_len: historyLen,
      is_fullscreen: "false",
      is_page_visible: "true",
      language,
      os: platform,
      priority_region: "",
      referer: "",
      region: "US",
      screen_height: screenHeight,
      screen_width: screenWidth,
      tz_name: timezone,
      webcast_language: language,
    };
  }

  // ── Session validation ──

  async _isSessionValid(session: TikTokPlaywrightSession): Promise<boolean> {
    if (!session.isValid) return false;
    try {
      // Accessing .url throws if page/context is closed
      void session.page.url();
      return true;
    } catch (e) {
      this.logger.warn(`Session validation failed: ${e}`);
      session.isValid = false;
      return false;
    }
  }

  async _markSessionInvalid(session: TikTokPlaywrightSession): Promise<void> {
    session.isValid = false;

    try { await session.page.close(); } catch (e) {
      this.logger.debug(`Error closing page during invalidation: ${e}`);
    }
    try { await session.context.close(); } catch (e) {
      this.logger.debug(`Error closing context during invalidation: ${e}`);
    }

    if (this._autoCleanupDeadSessions) {
      const idx = this.sessions.indexOf(session);
      if (idx !== -1) {
        this.sessions.splice(idx, 1);
        this.logger.debug(`Automatically removed dead session. Remaining: ${this.sessions.length}`);
      }
    }
  }

  async _getValidSessionIndex(kwargs: { sessionIndex?: number } = {}): Promise<[number, TikTokPlaywrightSession]> {
    const maxAttempts = 3;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (kwargs.sessionIndex != null) {
        const i = kwargs.sessionIndex;
        if (i < this.sessions.length) {
          const session = this.sessions[i];
          if (await this._isSessionValid(session)) return [i, session];
          this.logger.warn(`Requested session ${i} is invalid`);
        }
      } else {
        const validSessions: Array<[number, TikTokPlaywrightSession]> = [];
        for (let idx = 0; idx < this.sessions.length; idx++) {
          if (await this._isSessionValid(this.sessions[idx])) {
            validSessions.push([idx, this.sessions[idx]]);
          }
        }
        if (validSessions.length > 0) {
          return validSessions[Math.floor(Math.random() * validSessions.length)];
        }
      }

      if (this._sessionRecoveryEnabled && attempt < maxAttempts - 1) {
        this.logger.warn(`No valid sessions found, attempting recovery (attempt ${attempt + 1}/${maxAttempts})`);
        await this._recoverSessions();
      } else {
        break;
      }
    }

    throw new Error(
      "No valid sessions available. All sessions appear to be dead. " +
      "Please call createSessions() again."
    );
  }

  private async _recoverSessions(): Promise<void> {
    if (this._sessionCreationLock) return;
    this._sessionCreationLock = true;
    try {
      this.logger.info("Starting session recovery...");
      const initial = this.sessions.length;
      const validSessions: TikTokPlaywrightSession[] = [];
      for (const s of this.sessions) {
        if (await this._isSessionValid(s)) validSessions.push(s);
      }
      this.sessions = validSessions;
      const removed = initial - this.sessions.length;
      if (removed > 0) this.logger.info(`Removed ${removed} dead session(s)`);
    } finally {
      this._sessionCreationLock = false;
    }
  }

  // ── _getSession (deprecated but kept for compat) ──

  _getSession(kwargs: { sessionIndex?: number } = {}): [number, TikTokPlaywrightSession] {
    if (this.sessions.length === 0) {
      throw new Error("No sessions created, please create sessions first");
    }
    const i = kwargs.sessionIndex ?? Math.floor(Math.random() * this.sessions.length);
    return [i, this.sessions[i]];
  }

  // ── Create sessions ──

  async createSessions(options: CreateSessionsOptions = {}): Promise<void> {
    const {
      numSessions = 5,
      headless = true,
      msTokens = null,
      proxies = null,
      sleepAfter = 1,
      startingUrl = "https://www.tiktok.com",
      contextOptions = {},
      overrideBrowserArgs = null,
      cookies = null,
      suppressResourceLoadTypes = null,
      browser: browserName = "chromium",
      executablePath = null,
      pageFactory = null,
      browserContextFactory = null,
      timeout = 30000,
      enableSessionRecovery = true,
      allowPartialSessions = false,
      minSessions = null,
    } = options;

    this._sessionRecoveryEnabled = enableSessionRecovery;

    // Start Playwright
    const { chromium: pw_chromium, firefox: pw_firefox, webkit: pw_webkit } = await import("playwright");

    if (browserContextFactory) {
      // Custom factory: call it and store the returned context/browser
      const factoryResult = await browserContextFactory(null);
      // browserContextFactory returns a BrowserContext, but we store it as Browser
      // so that _createSession can call newContext() on it — however when
      // browserContextFactory is provided, _createSession skips newContext().
      this.browser = factoryResult as unknown as Browser;
    } else {
      let launchArgs = overrideBrowserArgs ?? undefined;
      let finalHeadless = headless;

      if (browserName === "chromium") {
        if (headless && !overrideBrowserArgs) {
          launchArgs = ["--headless=new"];
          finalHeadless = false;
        }
        this.browser = await pw_chromium.launch({
          headless: finalHeadless,
          args: launchArgs,
          proxy: proxyToPlaywright(randomChoice(proxies)),
          executablePath: executablePath ?? undefined,
        });
      } else if (browserName === "firefox") {
        this.browser = await pw_firefox.launch({
          headless: finalHeadless,
          args: launchArgs,
          proxy: proxyToPlaywright(randomChoice(proxies)),
          executablePath: executablePath ?? undefined,
        });
      } else if (browserName === "webkit") {
        this.browser = await pw_webkit.launch({
          headless: finalHeadless,
          args: launchArgs,
          proxy: proxyToPlaywright(randomChoice(proxies)),
          executablePath: executablePath ?? undefined,
        });
      } else {
        throw new Error("Invalid browser argument. Use 'chromium', 'firefox', or 'webkit'.");
      }
    }

    // Detect dynamic User-Agent to avoid Chrome version mismatches in headless mode
    let resolvedUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
    if (this.browser && browserName === "chromium") {
      try {
        const tempContext = await this.browser.newContext();
        const tempPage = await tempContext.newPage();
        const rawUA = await tempPage.evaluate("navigator.userAgent") as string;
        resolvedUA = rawUA.replace("HeadlessChrome", "Chrome");
        await tempPage.close();
        await tempContext.close();
      } catch (e) {
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
        throw new Error(
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
    url?: string;
    msToken?: string | null;
    proxy?: unknown;
    contextOptions?: Record<string, unknown>;
    sleepAfter?: number;
    cookies?: Record<string, string> | null;
    suppressResourceLoadTypes?: string[] | null;
    timeout?: number;
    pageFactory?: ((ctx: BrowserContext) => Promise<Page>) | null;
    browserContextFactory?: ((pw: unknown) => Promise<BrowserContext>) | null;
  }): Promise<void> {
    const {
      url = "https://www.tiktok.com",
      msToken = null,
      proxy,
      contextOptions = {},
      sleepAfter = 1,
      suppressResourceLoadTypes = null,
      timeout = 30000,
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
        defaultUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
      }
      context = await this.browser!.newContext({
        proxy: proxyToPlaywright(proxy),
        userAgent: defaultUA,
        ...contextOptions,
      });

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
        await stealthAsync(page);  // apply anti-bot stealth scripts
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

      // Simulate scrolling to avoid bot detection
      const x = randomInt(0, 51);
      const y = randomInt(0, 51);
      const a = randomInt(1, 51);
      const b = randomInt(100, 201);

      await page.mouse.move(x, y);
      try {
        await page.waitForLoadState("networkidle", { timeout: 15000 });
      } catch (e) {
        this.logger.debug(`networkidle timeout during session creation, continuing...`);
      }
      await page.mouse.move(a, b);

      const session: TikTokPlaywrightSession = {
        context,
        page,
        msToken,
        proxy: proxy as string | undefined,
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
      await this._setSessionParams(session);
    } catch (e) {
      this.logger.error(`Failed to create session: ${e}`);
      throw e;
    }
  }

  // ── Cookie helpers ──

  async setSessionCookies(
    session: TikTokPlaywrightSession,
    cookies: Record<string, unknown>[]
  ): Promise<void> {
    // Cast via unknown to satisfy Playwright's strict cookie type
    await session.context.addCookies(cookies as unknown as Parameters<BrowserContext["addCookies"]>[0]);
  }

  async getSessionCookies(session: TikTokPlaywrightSession): Promise<Record<string, string>> {
    const cookies = await session.context.cookies();
    return Object.fromEntries(cookies.map((c) => [c.name, c.value]));
  }

  // ── JS fetch / XBogus / Sign ──

  generateJsFetch(method: string, url: string, headers: Record<string, string>): string {
    const headersJs = JSON.stringify(headers);
    return `
      new Promise((resolve, reject) => {
        fetch('${url}', { method: '${method}', headers: ${headersJs} })
          .then(response => response.text())
          .then(data => resolve(data))
          .catch(error => reject(error.message));
      })
    `;
  }

  async runFetchScript(url: string, headers: Record<string, string>, kwargs: { sessionIndex?: number } = {}): Promise<string> {
    const jsScript = this.generateJsFetch("GET", url, headers);
    let session: TikTokPlaywrightSession;

    try {
      [, session] = await this._getValidSessionIndex(kwargs);
    } catch {
      [, session] = this._getSession(kwargs);
    }

    try {
      return (await session.page.evaluate(jsScript)) as string;
    } catch (e) {
      this.logger.error(`Session failed during fetch: ${e}`);
      await this._markSessionInvalid(session);
      throw e;
    }
  }

  async generateXBogus(url: string, kwargs: { sessionIndex?: number } = {}): Promise<Record<string, string>> {
    let session: TikTokPlaywrightSession;
    try {
      [, session] = await this._getValidSessionIndex(kwargs);
    } catch {
      [, session] = this._getSession(kwargs);
    }

    const maxAttempts = 5;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const timeoutMs = randomInt(5000, 20001);
        await session.page.waitForFunction(
          "typeof window !== 'undefined' && window.byted_acrawler !== undefined",
          { timeout: timeoutMs }
        );
        break;
      } catch (e) {
        if (attempt === maxAttempts - 1) {
          // eslint-disable-next-line preserve-caught-error
          throw new Error(
            `Failed to load tiktok after ${maxAttempts} attempts, consider using a proxy`
          );
        }
        const tryUrls = [
          "https://www.tiktok.com/foryou",
          "https://www.tiktok.com",
          "https://www.tiktok.com/@tiktok",
        ];
        await session.page.goto(tryUrls[Math.floor(Math.random() * tryUrls.length)]);
      }
    }

    try {
      const result = await session.page.evaluate(
        `window.byted_acrawler.frontierSign("${url}")`
      ) as Record<string, string>;
      return result;
    } catch (e) {
      this.logger.error(`Session died during x-bogus evaluation: ${e}`);
      await this._markSessionInvalid(session);
      throw e;
    }
  }

  async signUrl(url: string, kwargs: { sessionIndex?: number } = {}): Promise<string> {
    let i: number;
    let session: TikTokPlaywrightSession;

    try {
      [i, session] = await this._getValidSessionIndex(kwargs);
    } catch {
      [i, session] = this._getSession(kwargs);
    }

    const xBogus = (await this.generateXBogus(url, { sessionIndex: i }))["X-Bogus"];
    if (!xBogus) throw new Error("Failed to generate X-Bogus");

    return url + (url.includes("?") ? "&" : "?") + `X-Bogus=${xBogus}`;
  }

  // ── makeRequest ──

  async makeRequest(options: MakeRequestOptions): Promise<Record<string, unknown>> {
    const {
      url,
      headers: extraHeaders = null,
      params: extraParams = null,
      retries = 3,
      exponentialBackoff = true,
      sessionIndex,
    } = options;

    let i: number;
    let session: TikTokPlaywrightSession;

    try {
      [i, session] = await this._getValidSessionIndex({ sessionIndex });
    } catch {
      [i, session] = this._getSession({ sessionIndex });
    }

    // Python: if session.params is not None: params = {**session.params, **params}
    // Always merge — extraParams may be null/undefined
    const params: Record<string, unknown> = {
      ...(session.params ?? {}),
      ...(extraParams ?? {}),
    };
    // Python: if headers is not None: headers = {**session.headers, **headers} else: headers = session.headers
    const headers: Record<string, string> = extraHeaders
      ? { ...(session.headers ?? {}), ...extraHeaders }
      : { ...(session.headers ?? {}) };

    // Ensure msToken
    if (!params["msToken"]) {
      if (session.msToken) {
        params["msToken"] = session.msToken;
      } else {
        const cookieMap = await this.getSessionCookies(session);
        const msTok = cookieMap["msToken"];
        if (!msTok) {
          // Python uses self.logger.warn (same as .warning in Python logging)
          this.logger.warn("Failed to get msToken from cookies, trying to make the request anyway (probably will fail)");
        }
        params["msToken"] = msTok;
      }
    }

    const encodedParams = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params)
          .filter(([, v]) => v != null)
          .map(([k, v]) => [k, String(v)])
      )
    ).toString();

    const fullUrl = `${url}?${encodedParams}`;
    const signedUrl = await this.signUrl(fullUrl, { sessionIndex: i });

    let retryCount = 0;
    while (retryCount < retries) {
      retryCount++;
      try {
        const result = await this.runFetchScript(signedUrl, headers, { sessionIndex: i });

        if (result == null) throw new Error("runFetchScript returned null");
        if (result === "") {
          throw new EmptyResponseException(
            result,
            "TikTok returned an empty response. They are detecting you're a bot. " +
            "Try: headless=false, browser='webkit', or a proxy."
          );
        }

        try {
          const data = JSON.parse(result) as Record<string, unknown>;
          if (data["status_code"] !== 0) {
            this.logger.error(`Got unexpected status code: ${JSON.stringify(data)}`);
          }
          return data;
        } catch {
          if (retryCount === retries) {
            this.logger.error(`Failed to decode JSON response: ${result}`);
            throw new InvalidJSONException(result);
          }
          this.logger.info(`Failed a request, retrying (${retryCount}/${retries})`);
          if (exponentialBackoff) {
            await sleep(2 ** retryCount * 1000);
          } else {
            await sleep(1000);
          }
        }
      } catch (e) {
        if (e instanceof EmptyResponseException || e instanceof InvalidJSONException) throw e;

        this.logger.error(`Playwright error during request: ${e}`);
        await this._markSessionInvalid(session);

        if (retryCount < retries) {
          this.logger.info(`Retrying with a new session (${retryCount}/${retries})`);
          try {
            [i, session] = await this._getValidSessionIndex({ sessionIndex });
          } catch (sessionErr) {
            this.logger.error(`Failed to get valid session: ${sessionErr}`);
            throw sessionErr;
          }
        } else {
          throw e;
        }
      }
    }

    throw new Error("makeRequest: exhausted all retries");
  }

  // ── Close / cleanup ──

  async closeSessions(): Promise<void> {
    this.logger.debug(`Closing ${this.sessions.length} sessions...`);

    for (const session of this.sessions) {
      try { await session.page.close(); } catch (e) {
        this.logger.debug(`Error closing page: ${e}`);
      }
      try { await session.context.close(); } catch (e) {
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
    // Python also calls self.playwright.stop() — we store it on this.playwright
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    } catch (e) {
      this.logger.debug(`Error closing browser: ${e}`);
    }
    // Python also stops playwright instance (equivalent of playwright.stop())
    // We don't hold the playwright instance separately, browser.close() covers it.
  }

  async getSessionContent(url: string, kwargs: { sessionIndex?: number } = {}): Promise<string> {
    let session: TikTokPlaywrightSession;
    try {
      [, session] = await this._getValidSessionIndex(kwargs);
    } catch {
      [, session] = this._getSession(kwargs);
    }
    try {
      return await session.page.content();
    } catch (e) {
      this.logger.error(`Session died during getSessionContent: ${e}`);
      await this._markSessionInvalid(session);
      throw e;
    }
  }

  // ── Resource stats / health ──

  getResourceStats(): ResourceStats {
    const validSessions = this.sessions.filter((s) => s.isValid).length;
    return {
      totalSessions: this.sessions.length,
      validSessions,
      invalidSessions: this.sessions.length - validSessions,
      hasBrowser: this.browser != null,
      hasPlaywright: false,
      cleanupCalled: this._cleanupCalled,
      autoCleanupEnabled: this._autoCleanupDeadSessions,
      recoveryEnabled: this._sessionRecoveryEnabled,
    };
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const health = this.getResourceStats() as HealthCheckResult;
    const sessionDetails = await Promise.all(
      this.sessions.map(async (s, i) => ({
        index: i,
        valid: await this._isSessionValid(s),
        markedValid: s.isValid,
      }))
    );
    health.sessionDetails = sessionDetails;
    health.healthySessions = sessionDetails.filter((s) => s.valid).length;

    if (health.invalidSessions > 0 && !this._autoCleanupDeadSessions) {
      health.warning = `${health.invalidSessions} invalid sessions accumulating (auto-cleanup disabled)`;
    }
    return health;
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
      username: p["username"],
      password: p["password"],
    };
  }
  return undefined;
}

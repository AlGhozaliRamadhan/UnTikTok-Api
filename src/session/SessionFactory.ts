// ============================================================
// session/SessionFactory.ts — createSessions lifecycle (ADR-9 follow-up)
//
// Moves the browser-launch + per-session-context/page bootstrap out of
// tiktok.ts. TikTokApi still owns the public `createSessions()` entry point
// and the session array, but all of the "how do I bring up a Playwright
// browser and one session inside it" logic lives here.
// ============================================================

import { randomInt } from "crypto";
import { URL } from "url";
import type { Browser, BrowserContext, Page } from "playwright";
import type { Logger } from "../logger";
import type {
  CreateSessionsOptions,
  ProxySettings,
  TikTokPlaywrightSession,
} from "../types";
import { InvalidParameterException } from "../exceptions";
import { randomChoice, sleep } from "../helpers";
import { stealthAsync } from "../stealth";
import {
  DEFAULT_NUM_SESSIONS,
  DEFAULT_SLEEP_AFTER,
  DEFAULT_TIMEOUT_MS,
} from "../constants";

export interface SessionFactoryHost {
  getLogger(): Logger;
  getSessions(): TikTokPlaywrightSession[];
  getBrowser(): Browser | null;
  setBrowser(browser: Browser | null): void;
  getUserAgent(): string | null;
  setUserAgent(ua: string | null): void;
  setSessionRecoveryEnabled(v: boolean): void;
  /** Set additional TikTok request params on the session after creation. */
  setSessionParams(session: TikTokPlaywrightSession): Promise<void>;
  /** Read cookies from a live session (used to harvest msToken). */
  getSessionCookies(session: TikTokPlaywrightSession): Promise<Record<string, string>>;
}

/** Internal per-session options used by `SessionFactory._createSession`. */
export interface CreateOneSessionOptions {
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
}

export class SessionFactory {
  constructor(private readonly host: SessionFactoryHost) {}

  private get logger(): Logger {
    return this.host.getLogger();
  }

  /**
   * Bring up the browser (if not provided via factory) and `numSessions`
   * Playwright contexts/pages. Mutates `host.getSessions()` (via
   * `setSessionParams` / push) and `host.setBrowser(...)`.
   */
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

    this.host.setSessionRecoveryEnabled(enableSessionRecovery);

    await this._launchBrowser({
      browserName,
      headless,
      overrideBrowserArgs,
      proxies,
      executablePath,
      browserContextFactory,
    });

    await this._resolveUserAgent(browserName);

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
      const succeeded = this.host.getSessions().length;
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

  // ── Internals ──

  private async _launchBrowser(opts: {
    browserName: "chromium" | "firefox" | "webkit";
    headless: boolean;
    overrideBrowserArgs: string[] | null;
    proxies: (ProxySettings | string)[] | null;
    executablePath: string | null;
    browserContextFactory: ((pw: unknown) => Promise<BrowserContext>) | null;
  }): Promise<void> {
    const {
      browserName,
      headless,
      overrideBrowserArgs,
      proxies,
      executablePath,
      browserContextFactory,
    } = opts;

    const { chromium: pw_chromium, firefox: pw_firefox, webkit: pw_webkit } = await import("playwright");

    if (browserContextFactory) {
      const factoryResult = await browserContextFactory(null);
      this.host.setBrowser(factoryResult as unknown as Browser);
      return;
    }

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
      this.host.setBrowser(
        await pw_chromium.launch(launchOpts as Parameters<typeof pw_chromium.launch>[0])
      );
    } else if (browserName === "firefox") {
      this.host.setBrowser(
        await pw_firefox.launch(launchOpts as Parameters<typeof pw_firefox.launch>[0])
      );
    } else if (browserName === "webkit") {
      this.host.setBrowser(
        await pw_webkit.launch(launchOpts as Parameters<typeof pw_webkit.launch>[0])
      );
    } else {
      throw new InvalidParameterException(
        null,
        "Invalid browser argument. Use 'chromium', 'firefox', or 'webkit'."
      );
    }
  }

  private async _resolveUserAgent(browserName: "chromium" | "firefox" | "webkit"): Promise<void> {
    let resolvedUA =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
    const browser = this.host.getBrowser();
    if (browser && browserName === "chromium") {
      try {
        const tempContext = await browser.newContext();
        const tempPage = await tempContext.newPage();
        const rawUA = (await tempPage.evaluate("navigator.userAgent")) as string;
        resolvedUA = rawUA.replace("HeadlessChrome", "Chrome");
        await tempPage.close();
        await tempContext.close();
      } catch {
        // Use hardcoded fallback
      }
    }
    this.host.setUserAgent(resolvedUA);
  }

  private async _createSession(options: CreateOneSessionOptions): Promise<void> {
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

      let defaultUA = this.host.getUserAgent();
      if (!defaultUA) {
        defaultUA =
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
      }
      const ctxOpts: Record<string, unknown> = { userAgent: defaultUA, ...contextOptions };
      const pwProxyOpt = proxyToPlaywright(proxy);
      if (pwProxyOpt) ctxOpts.proxy = pwProxyOpt;
      const browser = this.host.getBrowser();
      if (!browser) {
        throw new InvalidParameterException(null, "Browser is not initialized.");
      }
      context = await browser.newContext(
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
        const sessionCookies = await this.host.getSessionCookies(session);
        finalMsToken = sessionCookies["msToken"] ?? null;
        session.msToken = finalMsToken;
        if (!finalMsToken) {
          this.logger.info(
            `Failed to get msToken on session index ${this.host.getSessions().length}, consider specifying ms_tokens`
          );
        }
      }

      this.host.getSessions().push(session);
      await this.host.setSessionParams(session);
    } catch (e) {
      this.logger.error(`Failed to create session: ${e}`);
      throw e;
    }
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

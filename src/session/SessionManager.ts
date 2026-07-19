// ============================================================
// session/SessionManager.ts — validation, recovery, cookies (ADR-009)
// ============================================================

import { randomInt } from "crypto";
import type { Logger } from "../logger";
import type { TikTokPlaywrightSession } from "../types";
import { SessionUnavailableException } from "../exceptions";
import {
  SESSION_HISTORY_LEN,
  SESSION_SCREEN,
  SESSION_VALID_MAX_ATTEMPTS,
} from "../constants";

export interface SessionManagerHost {
  getLogger(): Logger;
  getSessions(): TikTokPlaywrightSession[];
  isSessionRecoveryEnabled(): boolean;
  isAutoCleanupDeadSessions(): boolean;
  getSessionCreationLock(): boolean;
  setSessionCreationLock(v: boolean): void;
}

export class SessionManager {
  constructor(private readonly host: SessionManagerHost) {}

  private get logger(): Logger {
    return this.host.getLogger();
  }

  private get sessions(): TikTokPlaywrightSession[] {
    return this.host.getSessions();
  }

  async setSessionParams(session: TikTokPlaywrightSession): Promise<void> {
    const page = session.page;
    const userAgent: string = (await page.evaluate("navigator.userAgent")) as string;
    const language: string = (await page.evaluate(
      "navigator.language || navigator.userLanguage || 'en'"
    )) as string;
    const platform: string = (await page.evaluate("navigator.platform")) as string;
    const timezone: string = (await page.evaluate(
      "Intl.DateTimeFormat().resolvedOptions().timeZone"
    )) as string;

    const deviceId = String(
      BigInt(randomInt(2 ** 30)) * BigInt(2 ** 30) + BigInt(randomInt(2 ** 30))
    );
    const historyLen = String(
      randomInt(SESSION_HISTORY_LEN.min, SESSION_HISTORY_LEN.max + 1)
    );
    const screenHeight = String(
      randomInt(SESSION_SCREEN.height.min, SESSION_SCREEN.height.max + 1)
    );
    const screenWidth = String(
      randomInt(SESSION_SCREEN.width.min, SESSION_SCREEN.width.max + 1)
    );

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

  async isSessionValid(session: TikTokPlaywrightSession): Promise<boolean> {
    if (!session.isValid) return false;
    try {
      void session.page.url();
      return true;
    } catch (e) {
      this.logger.warn(`Session validation failed: ${e}`);
      session.isValid = false;
      return false;
    }
  }

  async markSessionInvalid(session: TikTokPlaywrightSession): Promise<void> {
    session.isValid = false;

    try {
      await session.page.close();
    } catch (e) {
      this.logger.debug(`Error closing page during invalidation: ${e}`);
    }
    try {
      await session.context.close();
    } catch (e) {
      this.logger.debug(`Error closing context during invalidation: ${e}`);
    }

    if (this.host.isAutoCleanupDeadSessions()) {
      const idx = this.sessions.indexOf(session);
      if (idx !== -1) {
        this.sessions.splice(idx, 1);
        this.logger.debug(
          `Automatically removed dead session. Remaining: ${this.sessions.length}`
        );
      }
    }
  }

  async getValidSessionIndex(
    kwargs: { sessionIndex?: number | undefined } = {}
  ): Promise<[number, TikTokPlaywrightSession]> {
    for (let attempt = 0; attempt < SESSION_VALID_MAX_ATTEMPTS; attempt++) {
      if (kwargs.sessionIndex != null) {
        const i = kwargs.sessionIndex;
        if (i < this.sessions.length) {
          const session = this.sessions[i]!;
          if (await this.isSessionValid(session)) return [i, session];
          this.logger.warn(`Requested session ${i} is invalid`);
        }
      } else {
        const validSessions: Array<[number, TikTokPlaywrightSession]> = [];
        for (let idx = 0; idx < this.sessions.length; idx++) {
          if (await this.isSessionValid(this.sessions[idx]!)) {
            validSessions.push([idx, this.sessions[idx]!]);
          }
        }
        if (validSessions.length > 0) {
          return validSessions[randomInt(0, validSessions.length)]!;
        }
      }

      if (this.host.isSessionRecoveryEnabled() && attempt < SESSION_VALID_MAX_ATTEMPTS - 1) {
        this.logger.warn(
          `No valid sessions found, attempting recovery (attempt ${attempt + 1}/${SESSION_VALID_MAX_ATTEMPTS})`
        );
        await this.recoverSessions();
      } else {
        break;
      }
    }

    throw new SessionUnavailableException(
      null,
      "No valid sessions available. All sessions appear to be dead. " +
        "Please call createSessions() again."
    );
  }

  async recoverSessions(): Promise<void> {
    if (this.host.getSessionCreationLock()) return;
    this.host.setSessionCreationLock(true);
    try {
      this.logger.info("Starting session recovery...");
      const initial = this.sessions.length;
      const validSessions: TikTokPlaywrightSession[] = [];
      for (const s of this.sessions) {
        if (await this.isSessionValid(s)) validSessions.push(s);
      }
      this.sessions.length = 0;
      this.sessions.push(...validSessions);
      const removed = initial - this.sessions.length;
      if (removed > 0) this.logger.info(`Removed ${removed} dead session(s)`);
    } finally {
      this.host.setSessionCreationLock(false);
    }
  }

  async setSessionCookies(
    session: TikTokPlaywrightSession,
    cookies: Record<string, unknown>[]
  ): Promise<void> {
    await session.context.addCookies(
      cookies as unknown as Parameters<TikTokPlaywrightSession["context"]["addCookies"]>[0]
    );
  }

  async getSessionCookies(
    session: TikTokPlaywrightSession
  ): Promise<Record<string, string>> {
    const cookies = await session.context.cookies();
    return Object.fromEntries(cookies.map((c) => [c.name, c.value]));
  }

  async saveSessionState(path: string, sessionIndex = 0): Promise<void> {
    if (this.sessions.length <= sessionIndex) {
      throw new SessionUnavailableException(
        null,
        `Session index ${sessionIndex} does not exist`
      );
    }
    const session = this.sessions[sessionIndex]!;
    if (session.context) {
      await session.context.storageState({ path });
      this.logger.info(`Session state saved to ${path}`);
    }
  }
}

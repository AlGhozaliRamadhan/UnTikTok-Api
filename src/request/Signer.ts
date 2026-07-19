// ============================================================
// request/Signer.ts — JS fetch + X-Bogus signing (ADR-009)
// ============================================================

import { randomInt } from "crypto";
import type { Logger } from "../logger";
import type { TikTokPlaywrightSession } from "../types";
import { EmptyResponseException } from "../exceptions";
import {
  XBOGUS_MAX_ATTEMPTS,
  XBOGUS_RECOVERY_URLS,
  XBOGUS_WAIT_TIMEOUT_MS,
} from "../constants";

export interface SignerHost {
  getLogger(): Logger;
  getValidSessionIndex(
    kwargs?: { sessionIndex?: number | undefined }
  ): Promise<[number, TikTokPlaywrightSession]>;
  markSessionInvalid(session: TikTokPlaywrightSession): Promise<void>;
}

export class Signer {
  constructor(private readonly host: SignerHost) {}

  async runFetchScript(
    url: string,
    headers: Record<string, string>,
    kwargs: { sessionIndex?: number } = {}
  ): Promise<string> {
    const [, session] = await this.host.getValidSessionIndex(kwargs);

    try {
      return (await session.page.evaluate(
        async ({ fetchUrl, fetchHeaders }) => {
          const response = await fetch(fetchUrl, { method: "GET", headers: fetchHeaders });
          return await response.text();
        },
        { fetchUrl: url, fetchHeaders: headers }
      )) as string;
    } catch (e) {
      this.host.getLogger().error(`Session failed during fetch: ${e}`);
      await this.host.markSessionInvalid(session);
      throw e;
    }
  }

  async generateXBogus(
    url: string,
    kwargs: { sessionIndex?: number } = {}
  ): Promise<Record<string, string>> {
    const [, session] = await this.host.getValidSessionIndex(kwargs);

    for (let attempt = 0; attempt < XBOGUS_MAX_ATTEMPTS; attempt++) {
      try {
        const timeoutMs = randomInt(XBOGUS_WAIT_TIMEOUT_MS.min, XBOGUS_WAIT_TIMEOUT_MS.max + 1);
        await session.page.waitForFunction(
          "typeof window !== 'undefined' && window.byted_acrawler !== undefined",
          { timeout: timeoutMs }
        );
        break;
      } catch {
        if (attempt === XBOGUS_MAX_ATTEMPTS - 1) {
          throw new EmptyResponseException(
            { url },
            `Failed to load tiktok after ${XBOGUS_MAX_ATTEMPTS} attempts, consider using a proxy`,
            undefined
          );
        }
        const tryUrls = XBOGUS_RECOVERY_URLS;
        await session.page.goto(tryUrls[randomInt(0, tryUrls.length)]!);
      }
    }

    try {
      // Pass URL via the evaluate args object (never template-literal inject).
      const result = (await session.page.evaluate(
        (signedUrl) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (window as any).byted_acrawler.frontierSign(signedUrl);
        },
        url
      )) as Record<string, string>;
      return result;
    } catch (e) {
      this.host.getLogger().error(`Session died during x-bogus evaluation: ${e}`);
      await this.host.markSessionInvalid(session);
      throw e;
    }
  }

  async signUrl(url: string, kwargs: { sessionIndex?: number } = {}): Promise<string> {
    const [i] = await this.host.getValidSessionIndex(kwargs);
    const xBogus = (await this.generateXBogus(url, { sessionIndex: i }))["X-Bogus"];
    if (!xBogus) throw new EmptyResponseException({ url }, "Failed to generate X-Bogus");
    return url + (url.includes("?") ? "&" : "?") + `X-Bogus=${xBogus}`;
  }
}

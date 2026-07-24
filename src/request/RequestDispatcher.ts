// ============================================================
// request/RequestDispatcher.ts — makeRequest + retry (ADR-009)
// ============================================================

import { URLSearchParams } from "url";
import type { z } from "zod";
import type { Logger } from "../logger";
import type { MakeRequestOptions, TikTokPlaywrightSession } from "../types";
import {
  EmptyResponseException,
  InvalidJSONException,
  InvalidResponseException,
  CaptchaException,
  NotFoundException,
  SoundRemovedException,
} from "../exceptions";
import { sleep } from "../helpers";
import { DEFAULT_MAKE_REQUEST_RETRIES } from "../constants";
import {
  isCaptchaResponse,
  isNotFoundResponse,
  isSoundRemovedResponse,
} from "../status_codes";

export interface RequestDispatcherHost {
  getLogger(): Logger;
  getValidSessionIndex(
    kwargs?: { sessionIndex?: number | undefined }
  ): Promise<[number, TikTokPlaywrightSession]>;
  markSessionInvalid(session: TikTokPlaywrightSession): Promise<void>;
  getSessionCookies(session: TikTokPlaywrightSession): Promise<Record<string, string>>;
  signUrl(url: string, kwargs?: { sessionIndex?: number }): Promise<string>;
  runFetchScript(
    url: string,
    headers: Record<string, string>,
    kwargs?: { sessionIndex?: number }
  ): Promise<string>;
}

export class RequestDispatcher {
  constructor(private readonly host: RequestDispatcherHost) {}

  async makeRequest<S extends z.ZodType>(
    options: MakeRequestOptions & { schema: S }
  ): Promise<z.infer<S>>;
  async makeRequest(options: MakeRequestOptions): Promise<Record<string, unknown>>;
  async makeRequest(options: MakeRequestOptions & { schema?: z.ZodType }): Promise<unknown> {
    const {
      url,
      headers: extraHeaders = null,
      params: extraParams = null,
      retries = DEFAULT_MAKE_REQUEST_RETRIES,
      exponentialBackoff = true,
      sessionIndex,
      schema,
    } = options;

    let i: number;
    let session: TikTokPlaywrightSession;

    [i, session] = await this.host.getValidSessionIndex({ sessionIndex });

    const params: Record<string, unknown> = {
      ...(session.params ?? {}),
      ...(extraParams ?? {}),
    };
    const headers: Record<string, string> = extraHeaders
      ? { ...(session.headers ?? {}), ...extraHeaders }
      : { ...(session.headers ?? {}) };

    if (!params["msToken"]) {
      if (session.msToken) {
        params["msToken"] = session.msToken;
      } else {
        const cookieMap = await this.host.getSessionCookies(session);
        const msTok = cookieMap["msToken"];
        if (!msTok) {
          this.host
            .getLogger()
            .warn(
              "Failed to get msToken from cookies, trying to make the request anyway (probably will fail)"
            );
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
    const signedUrl = await this.host.signUrl(fullUrl, { sessionIndex: i });

    let retryCount = 0;
    while (retryCount < retries) {
      retryCount++;
      try {
        const result = await this.host.runFetchScript(signedUrl, headers, { sessionIndex: i });

        if (result == null) {
          throw new EmptyResponseException({ url }, "runFetchScript returned null");
        }
        if (result === "") {
          throw new EmptyResponseException(
            { url },
            "TikTok returned an empty response. They are detecting you're a bot. " +
              "Try: headless=false, browser='webkit', or a proxy."
          );
        }

        let data: Record<string, unknown>;
        try {
          data = JSON.parse(result) as Record<string, unknown>;
        } catch {
          throw new InvalidJSONException({ url, body: result });
        }

        const statusCode = data["status_code"];
        if (statusCode !== 0 && statusCode !== undefined) {
          if (isCaptchaResponse(data)) {
            throw new CaptchaException(
              { url, ...data },
              `TikTok served a captcha challenge`,
              Number(data["error_code"]) || undefined
            );
          }
          if (isNotFoundResponse(data)) {
            throw new NotFoundException(
              { url, ...data },
              `TikTok: ${String(data["status_msg"] ?? "not found")} (${statusCode})`,
              Number(data["error_code"]) || undefined
            );
          }
          if (isSoundRemovedResponse(data)) {
            throw new SoundRemovedException(
              { url, ...data },
              `TikTok: music removed or not found (${statusCode})`,
              Number(data["error_code"]) || undefined
            );
          }
          this.host.getLogger().error(`Got unexpected status code: ${JSON.stringify(data)}`);
        }

        if (schema) {
          const parsed = schema.safeParse(data);
          if (!parsed.success) {
            throw new InvalidResponseException(
              { url, data, issues: parsed.error.issues },
              `TikTok response did not match the expected schema: ${parsed.error.message}`
            );
          }
          return parsed.data;
        }

        return data;
      } catch (e) {
        if (
          e instanceof EmptyResponseException ||
          e instanceof InvalidJSONException ||
          e instanceof CaptchaException ||
          e instanceof NotFoundException ||
          e instanceof SoundRemovedException
        ) {
          throw e;
        }

        this.host.getLogger().error(`Playwright error during request: ${e}`);
        await this.host.markSessionInvalid(session);

        if (retryCount < retries) {
          this.host.getLogger().info(`Retrying with a new session (${retryCount}/${retries})`);
          if (exponentialBackoff) {
            await sleep(2 ** retryCount * 1000);
          } else {
            await sleep(1000);
          }
          try {
            [i, session] = await this.host.getValidSessionIndex({ sessionIndex });
          } catch (sessionErr) {
            this.host.getLogger().error(`Failed to get valid session: ${sessionErr}`);
            throw sessionErr;
          }
        } else {
          throw e;
        }
      }
    }

    throw new EmptyResponseException({ url }, "makeRequest: exhausted all retries");
  }
}

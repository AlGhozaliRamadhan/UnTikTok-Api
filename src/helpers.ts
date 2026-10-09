// ============================================================
// helpers.ts
// Mirrors TikTokApi/helpers.py
// ============================================================

import { randomInt } from "crypto";
import { InvalidParameterException } from "./exceptions";
import { resolveTikTokUrl } from "./request/fetchScope";

/**
 * Extract the video ID from a TikTok URL, following redirects.
 *
 * Fetch scope (ADR-014): the URL and every redirect hop must be an https
 * TikTok host — validated BEFORE any fetch — so session headers never leave
 * the trust boundary. Throws `InvalidParameterException` otherwise.
 */
export async function extractVideoIdFromUrl(
  url: string,
  headers: Record<string, string> = {},
  // Reserved for future proxy support — axios does not accept a raw proxy
  // string the same way requests does; the caller would configure an
  // httpsAgent instead. Prefixed with _ to mark as intentionally unused.
  _proxy?: string | null
): Promise<string> {
  // Redirects are followed hop-by-hop with per-hop allowlisting inside;
  // `headers` only ever egress toward allowlisted TikTok hops.
  const finalUrl: string = await resolveTikTokUrl(url, { ...headers });

  if (finalUrl.includes("@") && finalUrl.includes("/video/")) {
    return finalUrl.split("/video/")[1]!.split("?")[0]!;
  }

  throw new InvalidParameterException(
    null,
    "URL format not supported. Example of a supported URL:\n" +
      "https://www.tiktok.com/@therock/video/6829267836783971589"
  );
}

/**
 * Return a random element from an array, or undefined if empty/null.
 */
export function randomChoice<T>(choices: T[] | null | undefined): T | undefined {
  if (!choices || choices.length === 0) return undefined;
  return choices[randomInt(choices.length)];
}

/**
 * Convert an axios/http cookie object to the Playwright cookie format.
 */
export function cookieToPlaywrightCookie(cookie: {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  expires?: number;
}): Record<string, unknown> {
  const c: Record<string, unknown> = {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain ?? "",
    path: cookie.path ?? "/",
    secure: cookie.secure ?? false,
  };
  if (cookie.expires) {
    c["expires"] = cookie.expires;
  }
  return c;
}

/**
 * Sleep for `ms` milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

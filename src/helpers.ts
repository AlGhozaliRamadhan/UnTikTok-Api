// ============================================================
// helpers.ts
// Mirrors TikTokApi/helpers.py
// ============================================================

import axios from "axios";
import { randomInt } from "crypto";
import { InvalidParameterException } from "./exceptions";

/**
 * Extract the video ID from a TikTok URL, following redirects.
 */
export async function extractVideoIdFromUrl(
  url: string,
  headers: Record<string, string> = {},
  proxy?: string | null
): Promise<string> {
  const response = await axios.head(url, {
    headers,
    maxRedirects: 10,
    // axios does not accept a raw proxy string the same way requests does —
    // the caller should configure an httpsAgent if a proxy is needed.
  });

  // axios stores the final URL in response.request?.res?.responseUrl
  // or we can use response.request.path on some versions.
  // The safest approach is to use the `responseUrl` from the underlying http request.
  const finalUrl: string =
    (response.request as { res?: { responseUrl?: string } })?.res?.responseUrl ??
    url;

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

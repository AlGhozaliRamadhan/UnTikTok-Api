// ============================================================
// request/fetchScope.ts — server-side fetch scope gates (ADR-014)
//
// The library performs server-side fetches (axios HEAD/GET, page.goto) and
// attaches live session headers/cookies to them. Nothing validated the fetch
// target before this module: a caller-supplied video URL flowed straight into
// `axios.head(url, { headers: session.headers })` with the host/shape check
// running only on the post-fetch URL, and a TikTok-supplied `downloadAddr`
// flowed into `axios.get` with the full cookie jar attached
// (VideoFromUrl-SSRF-HeaderForward-v1,
// VideoBytes-DownloadAddr-CookieForward-v1,
// VideoInfo-NavFallback-CookieStore-v1).
//
// Rules enforced here:
//   - Page fetches (video pages, short-link resolution): the URL — and every
//     redirect hop — must be https on an allowlisted TikTok host. Anything
//     else throws `InvalidParameterException` BEFORE any fetch or header
//     egress. Redirects are followed manually (fetch redirect:"manual") so a
//     hop off the allowlist fails closed instead of carrying credentials.
//   - Media fetches (downloadAddr/playAddr): TikTok CDN hosts change over
//     time, so an unknown host does NOT fail the download — it fetches
//     WITHOUT session credentials (cookie + session headers stripped).
//     Secrets stay in scope; availability degrades gracefully.
// ============================================================

import { InvalidParameterException } from "../exceptions";

/** Hosts (and their subdomains) allowed to receive credentialed page fetches. */
const TRUSTED_PAGE_HOST_SUFFIXES = ["tiktok.com"] as const;

/** Hosts allowed to receive session credentials on media (bytes) fetches. */
const TRUSTED_MEDIA_HOST_SUFFIXES = [
  "tiktok.com",
  "tiktokcdn.com",
  "tiktokcdn-us.com",
  "tiktokcdn-eu.com",
] as const;

/** Maximum redirect hops followed while resolving a video URL. */
export const MAX_REDIRECT_HOPS = 10;

/** Cap on response bytes discarded while probing a HEAD-unsupported hop. */
const MAX_PROBE_BODY_BYTES = 256 * 1024;

/** Parsed https URL, or null when the value is not an absolute https URL. */
function parseHttpsUrl(url: string): URL | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    return parsed;
  } catch {
    return null;
  }
}

function hostMatchesSuffix(host: string, suffixes: readonly string[]): boolean {
  const lower = host.toLowerCase();
  return suffixes.some((s) => lower === s || lower.endsWith(`.${s}`));
}

/** True when `url` is an https URL on an allowlisted TikTok page host. */
export function isTrustedTikTokUrl(url: string): boolean {
  const parsed = parseHttpsUrl(url);
  if (!parsed) return false;
  return hostMatchesSuffix(parsed.hostname, TRUSTED_PAGE_HOST_SUFFIXES);
}

/** True when `url` is an https URL on a host allowed media credentials. */
export function isTrustedMediaUrl(url: string): boolean {
  const parsed = parseHttpsUrl(url);
  if (!parsed) return false;
  return hostMatchesSuffix(parsed.hostname, TRUSTED_MEDIA_HOST_SUFFIXES);
}

/**
 * Throw `InvalidParameterException` unless `url` is fetchable with session
 * credentials. Call BEFORE any fetch or header egress. `what` names the
 * caller input for the error message (never echoes secrets — urls only).
 */
export function assertTrustedTikTokUrl(url: string, what: string): void {
  if (!isTrustedTikTokUrl(url)) {
    throw new InvalidParameterException(
      null,
      `${what}: refusing to fetch non-TikTok URL (host must be tiktok.com): ${url.slice(0, 200)}`
    );
  }
}

export interface HeadResult {
  status: number;
  location: string | null;
}

/** Single fetch used per redirect hop — injectable in unit tests. */
export type HeadFetch = (
  url: string,
  headers: Record<string, string>,
  method: "HEAD" | "GET"
) => Promise<HeadResult>;

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function isHeadUnsupported(status: number): boolean {
  return status === 405 || status === 501 || status === 505;
}

async function discardBoundedBody(res: Response): Promise<void> {
  const body = res.body;
  if (!body) return;
  const reader = body.getReader();
  let seen = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      seen += value.byteLength;
      if (seen > MAX_PROBE_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** Default hop fetch: global fetch with manual redirect handling. */
async function defaultHeadFetch(
  url: string,
  headers: Record<string, string>,
  method: "HEAD" | "GET"
): Promise<HeadResult> {
  const res = await fetch(url, { method, headers, redirect: "manual" });
  const location = res.headers.get("location");
  try {
    return { status: res.status, location };
  } finally {
    // Never retain a probe body: HEAD has none, GET probes are discarded
    // bounded so a malicious hop cannot inflate the caller heap.
    if (method === "GET") await discardBoundedBody(res);
  }
}

/**
 * Resolve `startUrl` to its final URL, following redirects hop by hop.
 * Every hop (including the start) must pass `assertTrustedTikTokUrl` BEFORE
 * it is fetched, and session headers only ever leave the host toward
 * allowlisted hops. Some servers reject HEAD: those hops are re-probed once
 * with GET (body discarded bounded). Throws `InvalidParameterException` on a
 * non-allowlisted hop or hop exhaustion; propagates transport errors.
 */
export async function resolveTikTokUrl(
  startUrl: string,
  headers: Record<string, string>,
  headFetch: HeadFetch = defaultHeadFetch
): Promise<string> {
  assertTrustedTikTokUrl(startUrl, "Video URL");
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    let result = await headFetch(current, headers, "HEAD");
    if (isHeadUnsupported(result.status)) {
      result = await headFetch(current, headers, "GET");
    }
    if (result.location && isRedirect(result.status)) {
      let next: string;
      try {
        next = new URL(result.location, current).toString();
      } catch {
        throw new InvalidParameterException(
          null,
          `Video URL: redirect target is not a valid URL at hop ${hop}`
        );
      }
      // Fail closed BEFORE fetching the hop: no request, no headers egress.
      assertTrustedTikTokUrl(next, "Video URL redirect target");
      current = next;
      continue;
    }
    return current;
  }
  throw new InvalidParameterException(
    null,
    `Video URL: too many redirects (>${MAX_REDIRECT_HOPS})`
  );
}

export interface MediaHeaders {
  headers: Record<string, string>;
  /** True when session credentials were stripped (untrusted media host). */
  stripped: boolean;
}

/**
 * Build the header set for a `downloadAddr`/`playAddr` fetch. Allowlisted
 * media hosts get the full credentialed set; anything else fetches WITHOUT
 * the session cookie or session headers (range/accept-encoding/referer are
 * non-secret and retained so the download still works).
 */
export function headersForMediaFetch(
  downloadAddr: string,
  sessionHeaders: Record<string, string>,
  cookieString: string
): MediaHeaders {
  const nonSecret: Record<string, string> = {
    range: "bytes=0-",
    "accept-encoding": "identity;q=1, *;q=0",
    referer: "https://www.tiktok.com/",
  };
  if (!isTrustedMediaUrl(downloadAddr)) {
    return { headers: nonSecret, stripped: true };
  }
  return {
    headers: { ...sessionHeaders, ...nonSecret, cookie: cookieString },
    stripped: false,
  };
}

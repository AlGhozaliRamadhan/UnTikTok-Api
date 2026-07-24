// ============================================================
// status_codes.ts — TikTok `status_code` / `status_msg` dispatch map
// (ADR-010 follow-up)
//
// makeRequest previously inlined placeholder codes (10201/10202/5) and
// ad-hoc `status_msg` string matches. This module canonizes the dispatch as
// data, so new endpoint-specific codes are a one-line entry instead of a
// new branch in RequestDispatcher.
//
// The shape is deliberately simple: each detector describes one failure mode
// (`captcha`, `notFound`, `soundRemoved`). RequestDispatcher walks the
// categories in order and throws the matching exception subclass on the
// first hit. Unknown shapes still log-and-return-data as before.
// ============================================================

/**
 * Numeric `status_code` values TikTok returns when the requested resource
 * does not exist (video / user / music). Captured from live traffic and the
 * original Python port; treat as best-effort — TikTok may add codes.
 */
export const NOT_FOUND_STATUS_CODES = new Set<number>([10201, 10202, 2155]);

/**
 * `status_msg` strings that indicate a not-found resource. Case-sensitive
 * against TikTok's literal payloads.
 */
export const NOT_FOUND_STATUS_MESSAGES = new Set<string>([
  "Video not found",
  "User not found",
]);

/**
 * `status_msg` strings that indicate a removed/unavailable sound.
 */
export const SOUND_REMOVED_STATUS_MESSAGES = new Set<string>([
  "Music not found",
]);

/**
 * Detects whether a TikTok response payload represents a captcha challenge.
 *
 * TikTok signals this two ways observed in the wild:
 *   - `status_code` is the *string* "captcha" (lowercase); or
 *   - a top-level `captcha` object is present in the body.
 */
export function isCaptchaResponse(data: Record<string, unknown>): boolean {
  const statusCode = data["status_code"];
  if (typeof statusCode === "string" && statusCode.toLowerCase().includes("captcha")) {
    return true;
  }
  return data["captcha"] != null;
}

/**
 * Detects whether a TikTok response payload represents a not-found resource
 * (video, user, or other entity). Combines numeric `status_code` and
 * `status_msg` heuristics.
 */
export function isNotFoundResponse(data: Record<string, unknown>): boolean {
  const statusCode = data["status_code"];
  if (typeof statusCode === "number" && NOT_FOUND_STATUS_CODES.has(statusCode)) {
    return true;
  }
  const statusMsg = data["status_msg"];
  if (typeof statusMsg === "string" && NOT_FOUND_STATUS_MESSAGES.has(statusMsg)) {
    return true;
  }
  return false;
}

/**
 * Detects whether a TikTok response payload represents a removed sound.
 */
export function isSoundRemovedResponse(data: Record<string, unknown>): boolean {
  const statusMsg = data["status_msg"];
  if (typeof statusMsg === "string" && SOUND_REMOVED_STATUS_MESSAGES.has(statusMsg)) {
    return true;
  }
  return data["music"] === null;
}

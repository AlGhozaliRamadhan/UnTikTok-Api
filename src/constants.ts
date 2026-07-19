// ============================================================
// constants.ts — magic numbers / recovery URLs (ADR-009)
// ============================================================

/** Random history_len for session fingerprint params (inclusive range). */
export const SESSION_HISTORY_LEN = { min: 1, max: 10 } as const;

/** Random screen dimensions for session fingerprint params. */
export const SESSION_SCREEN = {
  height: { min: 600, max: 1080 },
  width: { min: 800, max: 1920 },
} as const;

/** How many times generateXBogus waits for byted_acrawler before giving up. */
export const XBOGUS_MAX_ATTEMPTS = 5;

/** waitForFunction timeout range (ms) while waiting for byted_acrawler. */
export const XBOGUS_WAIT_TIMEOUT_MS = { min: 5000, max: 20000 } as const;

/** Fallback navigations when byted_acrawler is not yet available. */
export const XBOGUS_RECOVERY_URLS = [
  "https://www.tiktok.com/foryou",
  "https://www.tiktok.com",
  "https://www.tiktok.com/@tiktok",
] as const;

/** Attempts to find a valid session before throwing SessionUnavailableException. */
export const SESSION_VALID_MAX_ATTEMPTS = 3;

/** Default createSessions / makeRequest knobs (documented defaults). */
export const DEFAULT_NUM_SESSIONS = 5;
export const DEFAULT_SLEEP_AFTER = 1;
export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_MAKE_REQUEST_RETRIES = 3;

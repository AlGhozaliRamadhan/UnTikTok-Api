// ============================================================
// exceptions.ts
// Three failure categories, three subclasses — ADR-010.
// ============================================================

/**
 * Base class for every error this library raises intentionally.
 * Callers can `catch (e) { if (e instanceof TikTokException) {...} }`
 * against the whole taxonomy.
 *
 * Subclass slots:
 *   - Caller passed an invalid argument → {@link InvalidParameterException}
 *   - Library state is bad (no/dead session, Playwright unavailable) → {@link SessionUnavailableException}
 *   - TikTok response is unusable (null, malformed, captcha, 404, sound removed) →
 *     {@link EmptyResponseException} | {@link InvalidJSONException} |
 *     {@link InvalidResponseException} | {@link CaptchaException} |
 *     {@link NotFoundException} | {@link SoundRemovedException}
 */
export class TikTokException extends Error {
  errorCode: number | undefined;
  rawResponse: unknown;

  constructor(rawResponse: unknown, message: string, errorCode?: number) {
    super(message);
    this.name = "TikTokException";
    this.rawResponse = rawResponse;
    this.errorCode = errorCode;
  }

  override toString(): string {
    return `${this.errorCode} -> ${this.message}`;
  }
}

/**
 * Caller passed an invalid argument (missing username/hashtag/id, unsupported
 * URL format, bad browser name, etc.). Extends {@link TikTokException} so
 * `catch (e if e instanceof TikTokException)` still works.
 */
export class InvalidParameterException extends TikTokException {
  constructor(rawResponse: unknown = null, message: string = "Invalid parameter", errorCode?: number) {
    super(rawResponse, message, errorCode);
    this.name = "InvalidParameterException";
  }

  override toString(): string {
    return `[InvalidParameterException]: ${this.message}`;
  }
}

/**
 * Library state is bad — no sessions exist, all sessions are dead, Playwright
 * is not initialised, or session recovery failed. Distinct from argument errors
 * because the *inputs* are fine; the runtime can't service them right now.
 */
export class SessionUnavailableException extends TikTokException {
  constructor(rawResponse: unknown = null, message: string = "No usable session available", errorCode?: number) {
    super(rawResponse, message, errorCode);
    this.name = "SessionUnavailableException";
  }

  override toString(): string {
    return `[SessionUnavailableException]: ${this.message}`;
  }
}

/**
 * TikTok served a CAPCHA challenge. Callers can `instanceof`-check this to
 * trigger proxy rotation, headless-off, or backoff retries.
 */
export class CaptchaException extends TikTokException {
  constructor(rawResponse: unknown, message: string, errorCode?: number) {
    super(rawResponse, message, errorCode);
    this.name = "CaptchaException";
  }

  override toString(): string {
    return `[CaptchaException]: url=${(this.rawResponse as { url?: string })?.url ?? "?"}`;
  }
}

/**
 * TikTok returned a "not found" signal — video, user, hashtag, or sound
 * doesn't exist (or is private and the response shape indicates absence).
 */
export class NotFoundException extends TikTokException {
  constructor(rawResponse: unknown, message: string, errorCode?: number) {
    super(rawResponse, message, errorCode);
    this.name = "NotFoundException";
  }

  override toString(): string {
    return `[NotFoundException]: url=${(this.rawResponse as { url?: string })?.url ?? "?"}`;
  }
}

/**
 * `makeRequest` got back an empty body — usually means TikTok has bot-detected
 * the session. Retry with a fresh session / proxy / different browser.
 */
export class EmptyResponseException extends TikTokException {
  constructor(rawResponse: unknown, message: string, errorCode?: number) {
    super(rawResponse, message, errorCode);
    this.name = "EmptyResponseException";
  }

  override toString(): string {
    return `[EmptyResponseException]: url=${(this.rawResponse as { url?: string })?.url ?? "?"}`;
  }
}

/** The sound/music has been deleted from TikTok. */
export class SoundRemovedException extends TikTokException {
  constructor(rawResponse: unknown, message: string, errorCode?: number) {
    super(rawResponse, message, errorCode);
    this.name = "SoundRemovedException";
  }

  override toString(): string {
    return `[SoundRemovedException]: url=${(this.rawResponse as { url?: string })?.url ?? "?"}`;
  }
}

/** TikTok returned something that wasn't JSON (HTML interstitial, malformed body). */
export class InvalidJSONException extends TikTokException {
  constructor(rawResponse?: unknown, message?: string, errorCode?: number) {
    super(rawResponse, message ?? "TikTok returned invalid JSON", errorCode);
    this.name = "InvalidJSONException";
  }

  override toString(): string {
    return `[InvalidJSONException]: url=${(this.rawResponse as { url?: string })?.url ?? "?"}`;
  }
}

/** Generic fallback for "TikTok response is unusable" (e.g. unexpected status code). */
export class InvalidResponseException extends TikTokException {
  constructor(rawResponse: unknown, message: string, errorCode?: number) {
    super(rawResponse, message, errorCode);
    this.name = "InvalidResponseException";
  }

  override toString(): string {
    return `[InvalidResponseException]: url=${(this.rawResponse as { url?: string })?.url ?? "?"}`;
  }
}

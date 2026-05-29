// ============================================================
// exceptions.ts
// Mirrors TikTokApi/exceptions.py
// ============================================================

export class TikTokException extends Error {
  errorCode: number | undefined;
  rawResponse: unknown;

  constructor(rawResponse: unknown, message: string, errorCode?: number) {
    super(message);
    this.name = "TikTokException";
    this.rawResponse = rawResponse;
    this.errorCode = errorCode;
  }

  toString(): string {
    return `${this.errorCode} -> ${this.message}`;
  }
}

export class CaptchaException extends TikTokException {
  constructor(rawResponse: unknown, message: string, errorCode?: number) {
    super(rawResponse, message, errorCode);
    this.name = "CaptchaException";
  }
}

export class NotFoundException extends TikTokException {
  constructor(rawResponse: unknown, message: string, errorCode?: number) {
    super(rawResponse, message, errorCode);
    this.name = "NotFoundException";
  }
}

export class EmptyResponseException extends TikTokException {
  constructor(rawResponse: unknown, message: string, errorCode?: number) {
    super(rawResponse, message, errorCode);
    this.name = "EmptyResponseException";
  }
}

export class SoundRemovedException extends TikTokException {
  constructor(rawResponse: unknown, message: string, errorCode?: number) {
    super(rawResponse, message, errorCode);
    this.name = "SoundRemovedException";
  }
}

export class InvalidJSONException extends TikTokException {
  constructor(rawResponse?: unknown, message?: string, errorCode?: number) {
    super(rawResponse, message ?? "TikTok returned invalid JSON", errorCode);
    this.name = "InvalidJSONException";
  }
}

export class InvalidResponseException extends TikTokException {
  constructor(rawResponse: unknown, message: string, errorCode?: number) {
    super(rawResponse, message, errorCode);
    this.name = "InvalidResponseException";
  }
}

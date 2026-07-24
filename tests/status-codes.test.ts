import { describe, it, expect } from "vitest";
import {
  NOT_FOUND_STATUS_CODES,
  NOT_FOUND_STATUS_MESSAGES,
  SOUND_REMOVED_STATUS_MESSAGES,
  isCaptchaResponse,
  isNotFoundResponse,
  isSoundRemovedResponse,
} from "../src/status_codes";

describe("status_codes (ADR-010)", () => {
  describe("isCaptchaResponse", () => {
    it("matches status_code === 'captcha'", () => {
      expect(isCaptchaResponse({ status_code: "captcha" })).toBe(true);
    });

    it("matches a top-level captcha field even with non-captcha status_code", () => {
      expect(isCaptchaResponse({ status_code: 1, captcha: { url: "x" } })).toBe(true);
    });

    it("matches status_code containing 'captcha' as a substring", () => {
      expect(isCaptchaResponse({ status_code: "verify_captcha" })).toBe(true);
    });

    it("does not match when no captcha signals are present", () => {
      expect(isCaptchaResponse({ status_code: 0 })).toBe(false);
      expect(isCaptchaResponse({ status_code: 10201 })).toBe(false);
    });
  });

  describe("isNotFoundResponse", () => {
    it.each([...NOT_FOUND_STATUS_CODES])(
      "matches numeric not-found codes — %d",
      (code) => {
        expect(isNotFoundResponse({ status_code: code })).toBe(true);
      }
    );

    it.each([...NOT_FOUND_STATUS_MESSAGES])(
      "matches status_msg literal — %s",
      (msg) => {
        expect(isNotFoundResponse({ status_code: 9999, status_msg: msg })).toBe(true);
      }
    );

    it("does not match unknown codes without a known msg", () => {
      expect(isNotFoundResponse({ status_code: 10203, status_msg: "other" })).toBe(false);
    });

    it("does not match a successful payload", () => {
      expect(isNotFoundResponse({ status_code: 0, status_msg: "OK" })).toBe(false);
    });
  });

  describe("isSoundRemovedResponse", () => {
    it("matches status_msg 'Music not found'", () => {
      expect(isSoundRemovedResponse({ status_msg: "Music not found" })).toBe(true);
    });

    it.each([...SOUND_REMOVED_STATUS_MESSAGES])(
      "matches known sound-removed messages — %s",
      (msg) => {
        expect(isSoundRemovedResponse({ status_msg: msg })).toBe(true);
      }
    );

    it("matches when `music` is explicitly null", () => {
      expect(isSoundRemovedResponse({ music: null })).toBe(true);
    });

    it("does not match a successful payload", () => {
      expect(isSoundRemovedResponse({ status_code: 0 })).toBe(false);
    });
  });
});

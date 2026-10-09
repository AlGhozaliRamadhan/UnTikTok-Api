import { describe, it, expect, vi } from "vitest";
import {
  assertTrustedTikTokUrl,
  headersForMediaFetch,
  isTrustedMediaUrl,
  isTrustedTikTokUrl,
  resolveTikTokUrl,
} from "../src/request/fetchScope";
import { InvalidParameterException } from "../src/exceptions";

describe("fetch scope gates (ADR-014)", () => {
  describe("isTrustedTikTokUrl", () => {
    it.each([
      "https://www.tiktok.com/@therock/video/6829267836783971589",
      "https://vm.tiktok.com/abc123/",
      "https://vt.tiktok.com/abc123/",
      "https://m.tiktok.com/@user",
      "https://tiktok.com/foryou",
      "https://WWW.TIKTOK.COM/@user/video/1",
    ])("accepts %s", (url) => {
      expect(isTrustedTikTokUrl(url)).toBe(true);
    });

    it.each([
      // Substring bypass: shape matches but host is attacker-controlled.
      "https://evil.com/@therock/video/6829267836783971589",
      "https://evil.com/?x=/video/1",
      // Non-https.
      "http://www.tiktok.com/@user/video/1",
      // Lookalike / suffix-confused hosts.
      "https://tiktok.com.evil.com/@user/video/1",
      "https://eviltiktok.com/@user/video/1",
      // Not URLs at all.
      "",
      "not-a-url",
      "/video/123",
    ])("rejects %s", (url) => {
      expect(isTrustedTikTokUrl(url)).toBe(false);
    });
  });

  describe("assertTrustedTikTokUrl", () => {
    it("throws InvalidParameterException before any fetch on untrusted hosts", () => {
      expect(() =>
        assertTrustedTikTokUrl("https://evil.com/@u/video/1", "Video url")
      ).toThrow(InvalidParameterException);
    });

    it("passes TikTok hosts through", () => {
      expect(() =>
        assertTrustedTikTokUrl("https://www.tiktok.com/@u/video/1", "Video url")
      ).not.toThrow();
    });
  });

  describe("isTrustedMediaUrl", () => {
    it("keeps credentials on TikTok page + CDN hosts", () => {
      expect(isTrustedMediaUrl("https://www.tiktok.com/x.mp4")).toBe(true);
      expect(isTrustedMediaUrl("https://v16m-default.tiktokcdn.com/x.mp4")).toBe(true);
      expect(isTrustedMediaUrl("https://v19-web-newkey.tiktokcdn-us.com/x.mp4")).toBe(true);
    });

    it("drops untrusted and non-https hosts", () => {
      expect(isTrustedMediaUrl("https://evil-cdn.example/x.mp4")).toBe(false);
      expect(isTrustedMediaUrl("http://v16m-default.tiktokcdn.com/x.mp4")).toBe(false);
    });
  });

  describe("resolveTikTokUrl", () => {
    const headers = { "user-agent": "dummy" };

    it("returns the start URL when there is no redirect", async () => {
      const head = vi.fn().mockResolvedValue({ status: 200, location: null });
      const out = await resolveTikTokUrl("https://vm.tiktok.com/abc/", headers, head);
      expect(out).toBe("https://vm.tiktok.com/abc/");
      expect(head).toHaveBeenCalledTimes(1);
    });

    it("follows allowlisted hops and forwards headers to them", async () => {
      const head = vi
        .fn()
        .mockResolvedValueOnce({ status: 301, location: "https://www.tiktok.com/@u/video/1" })
        .mockResolvedValueOnce({ status: 200, location: null });
      const out = await resolveTikTokUrl("https://vm.tiktok.com/abc/", headers, head);
      expect(out).toBe("https://www.tiktok.com/@u/video/1");
      expect(head).toHaveBeenCalledTimes(2);
      expect(head.mock.calls[1]![1]).toEqual(headers);
    });

    it("rejects an off-allowlist redirect WITHOUT fetching it", async () => {
      const head = vi
        .fn()
        .mockResolvedValueOnce({ status: 302, location: "https://evil.example/collect" })
        .mockResolvedValue({ status: 200, location: null });
      await expect(
        resolveTikTokUrl("https://vm.tiktok.com/abc/", headers, head)
      ).rejects.toThrow(InvalidParameterException);
      // Only the allowlisted start hop was fetched; evil never saw headers.
      expect(head).toHaveBeenCalledTimes(1);
    });

    it("rejects a non-allowlisted start URL with zero fetches", async () => {
      const head = vi.fn();
      await expect(
        resolveTikTokUrl("https://evil.example/@u/video/1", headers, head)
      ).rejects.toThrow(InvalidParameterException);
      expect(head).not.toHaveBeenCalled();
    });

    it("stops after too many redirects", async () => {
      const head = vi.fn().mockResolvedValue({
        status: 302,
        location: "https://www.tiktok.com/loop",
      });
      await expect(
        resolveTikTokUrl("https://vm.tiktok.com/abc/", headers, head)
      ).rejects.toThrow(/too many redirects/);
      expect(head.mock.calls.length).toBeLessThanOrEqual(11);
    });

    it("retries HEAD-unsupported hops once with GET", async () => {
      const head = vi
        .fn()
        .mockResolvedValueOnce({ status: 405, location: null })
        .mockResolvedValueOnce({ status: 200, location: null });
      const out = await resolveTikTokUrl("https://vm.tiktok.com/abc/", headers, head);
      expect(out).toBe("https://vm.tiktok.com/abc/");
      expect(head.mock.calls[0]![2]).toBe("HEAD");
      expect(head.mock.calls[1]![2]).toBe("GET");
    });

    it("resolves relative redirect targets against the current hop", async () => {
      const head = vi
        .fn()
        .mockResolvedValueOnce({ status: 302, location: "/@u/video/1" })
        .mockResolvedValueOnce({ status: 200, location: null });
      const out = await resolveTikTokUrl("https://vm.tiktok.com/abc/", headers, head);
      expect(out).toBe("https://vm.tiktok.com/@u/video/1");
    });
  });

  describe("headersForMediaFetch", () => {
    const sessionHeaders = { "user-agent": "dummy", cookie: "msToken=secret" };

    it("attaches the full credentialed set on trusted media hosts", () => {
      const { headers, stripped } = headersForMediaFetch(
        "https://v16m-default.tiktokcdn.com/x.mp4",
        sessionHeaders,
        "msToken=secret"
      );
      expect(stripped).toBe(false);
      expect(headers["cookie"]).toBe("msToken=secret");
      expect(headers["user-agent"]).toBe("dummy");
    });

    it("strips session credentials on untrusted hosts but keeps the download working", () => {
      const { headers, stripped } = headersForMediaFetch(
        "https://evil.example/x.mp4",
        sessionHeaders,
        "msToken=secret"
      );
      expect(stripped).toBe(true);
      expect(headers).not.toHaveProperty("cookie");
      expect(headers).not.toHaveProperty("user-agent");
      expect(headers["range"]).toBe("bytes=0-");
      expect(headers["referer"]).toBe("https://www.tiktok.com/");
    });
  });
});

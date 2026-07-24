import { describe, it, expect, vi } from "vitest";
import {
  RequestDispatcher,
  type RequestDispatcherHost,
} from "../src/request/RequestDispatcher";
import {
  EmptyResponseException,
  InvalidJSONException,
  CaptchaException,
  NotFoundException,
  SoundRemovedException,
} from "../src/exceptions";
import type { TikTokPlaywrightSession } from "../src/types";
import { fakeLogger, fakeSession } from "./_fakes";

interface DispatcherHostOptions {
  session?: TikTokPlaywrightSession;
  fetchResult?: string;
  fetchError?: Error;
  signedUrl?: string;
  cookies?: Record<string, string>;
}

function makeDispatcherHost(
  opts: DispatcherHostOptions
): RequestDispatcherHost & {
  markSessionInvalid: ReturnType<typeof vi.fn>;
  runFetchScript: ReturnType<typeof vi.fn>;
  signUrl: ReturnType<typeof vi.fn>;
} {
  const session = opts.session ?? fakeSession();
  const markSessionInvalid = vi.fn();
  const runFetchScript = opts.fetchError
    ? vi.fn().mockRejectedValue(opts.fetchError)
    : vi.fn().mockResolvedValue(
        "fetchResult" in opts ? opts.fetchResult : "{}"
      );
  return {
    getLogger: () => fakeLogger(),
    getValidSessionIndex: vi.fn().mockResolvedValue([0, session]),
    markSessionInvalid,
    getSessionCookies: vi.fn().mockResolvedValue(opts.cookies ?? {}),
    signUrl: vi.fn().mockResolvedValue(opts.signedUrl ?? "https://signed.test"),
    runFetchScript,
  };
}

describe("RequestDispatcher (ADR-009)", () => {
  it("returns parsed JSON for a status_code=0 payload", async () => {
    const host = makeDispatcherHost({
      fetchResult: JSON.stringify({ status_code: 0, data: "ok" }),
    });
    const d = new RequestDispatcher(host);
    const out = await d.makeRequest({ url: "https://x" });
    expect(out).toEqual({ status_code: 0, data: "ok" });
  });

  it("throws EmptyResponseException when runFetchScript returns null", async () => {
    const host = makeDispatcherHost({ fetchResult: null as unknown as string });
    const d = new RequestDispatcher(host);
    await expect(d.makeRequest({ url: "https://x" })).rejects.toThrow(
      EmptyResponseException
    );
  });

  it("throws EmptyResponseException when runFetchScript returns empty string", async () => {
    const host = makeDispatcherHost({ fetchResult: "" });
    const d = new RequestDispatcher(host);
    await expect(d.makeRequest({ url: "https://x" })).rejects.toThrow(
      EmptyResponseException
    );
  });

  it("throws InvalidJSONException when the body is not parseable", async () => {
    const host = makeDispatcherHost({ fetchResult: "<html>oops</html>" });
    const d = new RequestDispatcher(host);
    await expect(d.makeRequest({ url: "https://x" })).rejects.toThrow(InvalidJSONException);
  });

  it("dispatches to CaptchaException when status_code is the string 'captcha'", async () => {
    const host = makeDispatcherHost({
      fetchResult: JSON.stringify({ status_code: "captcha" }),
    });
    const d = new RequestDispatcher(host);
    await expect(d.makeRequest({ url: "https://x" })).rejects.toThrow(CaptchaException);
  });

  it("dispatches to CaptchaException when a top-level `captcha` field is present", async () => {
    const host = makeDispatcherHost({
      fetchResult: JSON.stringify({ status_code: 1, captcha: { url: "…" } }),
    });
    const d = new RequestDispatcher(host);
    await expect(d.makeRequest({ url: "https://x" })).rejects.toThrow(CaptchaException);
  });

  it("dispatches to NotFoundException for status_code 10201", async () => {
    const host = makeDispatcherHost({
      fetchResult: JSON.stringify({ status_code: 10201, status_msg: "Video not found" }),
    });
    const d = new RequestDispatcher(host);
    await expect(d.makeRequest({ url: "https://x" })).rejects.toThrow(NotFoundException);
  });

  it("dispatches to NotFoundException for status_msg 'User not found' even with unknown numeric code", async () => {
    const host = makeDispatcherHost({
      fetchResult: JSON.stringify({ status_code: 9999, status_msg: "User not found" }),
    });
    const d = new RequestDispatcher(host);
    await expect(d.makeRequest({ url: "https://x" })).rejects.toThrow(NotFoundException);
  });

  it("dispatches to SoundRemovedException for status_msg 'Music not found'", async () => {
    const host = makeDispatcherHost({
      fetchResult: JSON.stringify({ status_code: 5, status_msg: "Music not found" }),
    });
    const d = new RequestDispatcher(host);
    await expect(d.makeRequest({ url: "https://x" })).rejects.toThrow(SoundRemovedException);
  });

  it("dispatches to SoundRemovedException when `music` is explicitly null", async () => {
    const host = makeDispatcherHost({
      fetchResult: JSON.stringify({ status_code: 5, music: null }),
    });
    const d = new RequestDispatcher(host);
    await expect(d.makeRequest({ url: "https://x" })).rejects.toThrow(SoundRemovedException);
  });

  it("returns data when status_code is 0 (with schema omitted)", async () => {
    const host = makeDispatcherHost({
      fetchResult: JSON.stringify({ status_code: 0, itemList: [1, 2] }),
    });
    const d = new RequestDispatcher(host);
    const out = await d.makeRequest({ url: "https://x" });
    expect(out).toEqual({ status_code: 0, itemList: [1, 2] });
  });

  it("uses session.msToken as a param when present", async () => {
    const session = fakeSession({ msToken: "tok-abc" });
    const host = makeDispatcherHost({
      session,
      fetchResult: JSON.stringify({ status_code: 0 }),
    });
    const d = new RequestDispatcher(host);
    await d.makeRequest({ url: "https://x" });
    const calledWith = host.signUrl.mock.calls[0]![0] as string;
    expect(calledWith).toContain("msToken=tok-abc");
  });

  it("falls back to cookies for msToken when session.msToken is null", async () => {
    const session = fakeSession({ msToken: null });
    const host = makeDispatcherHost({
      session,
      cookies: { msToken: "tok-from-cookie" },
      fetchResult: JSON.stringify({ status_code: 0 }),
    });
    const d = new RequestDispatcher(host);
    await d.makeRequest({ url: "https://x" });
    const calledWith = host.signUrl.mock.calls[0]![0] as string;
    expect(calledWith).toContain("msToken=tok-from-cookie");
  });

  it("retries on transport error and marks the session invalid", async () => {
    const session = fakeSession();
    const transportErr = new Error("connection reset");
    const host = makeDispatcherHost({ session, fetchError: transportErr });
    // First call fails, second succeeds
    host.runFetchScript
      .mockRejectedValueOnce(transportErr)
      .mockResolvedValueOnce(JSON.stringify({ status_code: 0, ok: true }));
    const d = new RequestDispatcher(host);
    const out = await d.makeRequest({ url: "https://x", retries: 2 });
    expect(out).toEqual({ status_code: 0, ok: true });
    expect(host.markSessionInvalid).toHaveBeenCalledWith(session);
  });

  it("does not retry on EmptyResponseException — rethrows immediately", async () => {
    const session = fakeSession();
    const host = makeDispatcherHost({ session, fetchResult: "" });
    const d = new RequestDispatcher(host);
    await expect(d.makeRequest({ url: "https://x", retries: 5 })).rejects.toThrow(
      EmptyResponseException
    );
    expect(host.runFetchScript).toHaveBeenCalledTimes(1);
    expect(host.markSessionInvalid).not.toHaveBeenCalled();
  });
});

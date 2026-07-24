import { describe, it, expect, vi } from "vitest";
import { Signer, type SignerHost } from "../src/request/Signer";
import { EmptyResponseException } from "../src/exceptions";
import type { TikTokPlaywrightSession } from "../src/types";
import { fakeLogger, fakeSession } from "./_fakes";

function makeSignerHost(
  session: TikTokPlaywrightSession
): SignerHost & { markSessionInvalid: ReturnType<typeof vi.fn> } {
  const markSessionInvalid = vi.fn();
  return {
    getLogger: () => fakeLogger(),
    getValidSessionIndex: vi.fn().mockResolvedValue([0, session]),
    markSessionInvalid,
  };
}

describe("Signer (ADR-009)", () => {
  it("runFetchScript returns the response text from page.evaluate", async () => {
    const session = fakeSession();
    (session.page.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue("hello world");
    const signer = new Signer(makeSignerHost(session));
    const result = await signer.runFetchScript("https://x", {});
    expect(result).toBe("hello world");
  });

  it("runFetchScript marks session invalid and rethrows on evaluate error", async () => {
    const session = fakeSession();
    const err = new Error("evaluate exploded");
    (session.page.evaluate as ReturnType<typeof vi.fn>).mockRejectedValue(err);
    const host = makeSignerHost(session);
    const signer = new Signer(host);
    await expect(signer.runFetchScript("https://x", {})).rejects.toThrow(err);
    expect(host.markSessionInvalid).toHaveBeenCalledWith(session);
  });

  it("generateXBogus returns the frontierSign payload when byted_acrawler is available", async () => {
    const session = fakeSession();
    (session.page.waitForFunction as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (session.page.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue({
      "X-Bogus": "DFSzswVLQ1XANSH7t0",
    });
    const signer = new Signer(makeSignerHost(session));
    const out = await signer.generateXBogus("https://x");
    expect(out["X-Bogus"]).toBe("DFSzswVLQ1XANSH7t0");
  });

  it("generateXBogus throws EmptyResponseException after max attempts if byted_acrawler never loads", async () => {
    const session = fakeSession();
    (session.page.waitForFunction as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("timeout")
    );
    const signer = new Signer(makeSignerHost(session));
    await expect(signer.generateXBogus("https://x")).rejects.toThrow(EmptyResponseException);
  });

  it("generateXBogus marks session invalid and rethrows on evaluate error", async () => {
    const session = fakeSession();
    (session.page.waitForFunction as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const err = new Error("evaluate exploded");
    (session.page.evaluate as ReturnType<typeof vi.fn>).mockRejectedValue(err);
    const host = makeSignerHost(session);
    const signer = new Signer(host);
    await expect(signer.generateXBogus("https://x")).rejects.toThrow(err);
    expect(host.markSessionInvalid).toHaveBeenCalledWith(session);
  });

  it("signUrl appends X-Bogus as a query param", async () => {
    const session = fakeSession();
    (session.page.waitForFunction as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (session.page.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue({
      "X-Bogus": "ABCDEF",
    });
    const signer = new Signer(makeSignerHost(session));
    const out = await signer.signUrl("https://www.tiktok.com/api/user/detail/?secUid=abc");
    expect(out).toBe("https://www.tiktok.com/api/user/detail/?secUid=abc&X-Bogus=ABCDEF");
  });

  it("signUrl uses ? when the URL has no existing query string", async () => {
    const session = fakeSession();
    (session.page.waitForFunction as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (session.page.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue({
      "X-Bogus": "ZZ",
    });
    const signer = new Signer(makeSignerHost(session));
    const out = await signer.signUrl("https://www.tiktok.com/path");
    expect(out).toBe("https://www.tiktok.com/path?X-Bogus=ZZ");
  });

  it("signUrl throws EmptyResponseException when frontierSign returns no X-Bogus", async () => {
    const session = fakeSession();
    (session.page.waitForFunction as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (session.page.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const signer = new Signer(makeSignerHost(session));
    await expect(signer.signUrl("https://x")).rejects.toThrow(EmptyResponseException);
  });
});

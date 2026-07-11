import { describe, it, expect } from "vitest";
import {
  TikTokException,
  InvalidParameterException,
  SessionUnavailableException,
  CaptchaException,
  NotFoundException,
  EmptyResponseException,
  SoundRemovedException,
  InvalidJSONException,
  InvalidResponseException,
} from "../src";
import { randomChoice } from "../src/helpers";

describe("exception hierarchy (ADR-010)", () => {
  it.each([
    ["InvalidParameterException", InvalidParameterException],
    ["SessionUnavailableException", SessionUnavailableException],
    ["CaptchaException", CaptchaException],
    ["NotFoundException", NotFoundException],
    ["EmptyResponseException", EmptyResponseException],
    ["SoundRemovedException", SoundRemovedException],
    ["InvalidJSONException", InvalidJSONException],
    ["InvalidResponseException", InvalidResponseException],
  ] as const)("%s extends TikTokException (catchable as the base)", (_label, Ctor) => {
    const args = [null, "msg"] as const;
    const err = new (Ctor as unknown as new (...a: typeof args) => TikTokException)(...args);
    expect(err).toBeInstanceOf(TikTokException);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe(Ctor.name);
    expect(typeof err.toString()).toBe("string");
  });

  it("InvalidParameterException has a sensible default and supports (null, msg) shorthand", () => {
    const e = new InvalidParameterException(null, "missing username");
    expect(e).toBeInstanceOf(InvalidParameterException);
    expect(e.message).toBe("missing username");
    // toString() prepends [InvalidParameterException]: — assert both pieces
    expect(e.toString()).toContain("InvalidParameterException");
    expect(e.toString()).toContain("missing username");

    // Default args produce the canonical message
    const def = new InvalidParameterException();
    expect(def.message).toBe("Invalid parameter");
  });

  it("SessionUnavailableException distinguishes session-state from argument errors", () => {
    const a = new InvalidParameterException(null, "bad arg");
    const s = new SessionUnavailableException(null, "no live sessions");
    expect(a).not.toBeInstanceOf(SessionUnavailableException);
    expect(s).not.toBeInstanceOf(InvalidParameterException);
    // Both still catchable as TikTokException
    expect(a).toBeInstanceOf(TikTokException);
    expect(s).toBeInstanceOf(TikTokException);
  });

  it("dispatch: callers can switch on the subclass for retry logic", () => {
    function classify(e: unknown): string {
      if (e instanceof CaptchaException) return "rotate-proxy";
      if (e instanceof NotFoundException) return "skip";
      if (e instanceof SoundRemovedException) return "music-removed";
      if (e instanceof EmptyResponseException) return "switch-browser";
      if (e instanceof InvalidJSONException) return "retry";
      if (e instanceof SessionUnavailableException) return "create-sessions";
      if (e instanceof InvalidParameterException) return "bug-in-caller";
      return "unknown";
    }
    expect(classify(new CaptchaException({ url: "u" }, "x"))).toBe("rotate-proxy");
    expect(classify(new NotFoundException({ url: "u" }, "x"))).toBe("skip");
    expect(classify(new SoundRemovedException({ url: "u" }, "x"))).toBe("music-removed");
    expect(classify(new EmptyResponseException({ url: "u" }, "x"))).toBe("switch-browser");
    expect(classify(new InvalidJSONException({ url: "u" }, "x"))).toBe("retry");
    expect(classify(new SessionUnavailableException(null, "x"))).toBe("create-sessions");
    expect(classify(new InvalidParameterException(null, "x"))).toBe("bug-in-caller");
  });

  it("every subclass overrides toString() with the ADR-010 [ClassName]: format", () => {
    const cases = [
      new InvalidParameterException(null, "x"),
      new SessionUnavailableException(null, "x"),
      new CaptchaException({ url: "u" }, "x"),
      new NotFoundException({ url: "u" }, "x"),
      new EmptyResponseException({ url: "u" }, "x"),
      new SoundRemovedException({ url: "u" }, "x"),
      new InvalidJSONException({ url: "u" }, "x"),
      new InvalidResponseException({ url: "u" }, "x"),
    ];
    for (const e of cases) {
      const s = e.toString();
      expect(s).toContain(e.constructor.name);
      expect(s.length).toBeGreaterThan(0);
    }
  });
});

describe("vitest wiring", () => {
  it("runs a trivial assertion", () => {
    expect(1 + 1).toBe(2);
  });

  it("randomChoice returns only members of the input array (or undefined for empty)", () => {
    expect(randomChoice([])).toBeUndefined();
    expect(randomChoice(null)).toBeUndefined();
    expect(randomChoice(undefined)).toBeUndefined();
    const xs = [1, 2, 3];
    for (let i = 0; i < 50; i++) {
      expect(xs).toContain(randomChoice(xs));
    }
  });

  it.todo("placeholder for a real unit test once ADR-002 introduces CI_NETWORK gating");
});

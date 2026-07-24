// Shared test fakes — extracted multiple test files don't each roll their
// own Session/Logger/Page stubs.
import { vi } from "vitest";
import type { TikTokPlaywrightSession } from "../src/types";
import type { Logger } from "../src/logger";

export function fakeLogger(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as Logger;
}

export function fakeSession(
  overrides: Partial<TikTokPlaywrightSession> = {}
): TikTokPlaywrightSession {
  return {
    context: {
      addCookies: vi.fn(),
      cookies: vi.fn().mockResolvedValue([]),
      close: vi.fn(),
      storageState: vi.fn(),
    },
    page: {
      url: vi.fn().mockReturnValue("https://www.tiktok.com/"),
      evaluate: vi.fn(),
      close: vi.fn(),
      waitForFunction: vi.fn(),
      goto: vi.fn(),
      setDefaultNavigationTimeout: vi.fn(),
      mouse: { move: vi.fn() },
      once: vi.fn(),
      content: vi.fn(),
      waitForLoadState: vi.fn(),
      route: vi.fn(),
    },
    isValid: true,
    baseUrl: "https://www.tiktok.com",
    headers: {},
    params: null,
    msToken: null,
    ...overrides,
  } as unknown as TikTokPlaywrightSession;
}

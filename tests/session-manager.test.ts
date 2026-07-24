import { describe, it, expect, vi } from "vitest";
import { SessionManager, type SessionManagerHost } from "../src/session/SessionManager";
import { SessionUnavailableException } from "../src/exceptions";
import type { TikTokPlaywrightSession } from "../src/types";
import { fakeLogger, fakeSession } from "./_fakes";

function makeHost(sessions: TikTokPlaywrightSession[]): SessionManagerHost {
  return {
    getLogger: () => fakeLogger(),
    getSessions: () => sessions,
    isSessionRecoveryEnabled: () => false,
    isAutoCleanupDeadSessions: () => false,
    getSessionCreationLock: () => false,
    setSessionCreationLock: vi.fn(),
  };
}

describe("SessionManager (ADR-009)", () => {
  it("isSessionValid returns true when page.url() does not throw", async () => {
    const session = fakeSession();
    const sm = new SessionManager(makeHost([session]));
    expect(await sm.isSessionValid(session)).toBe(true);
  });

  it("isSessionValid returns false and marks invalid when page.url() throws", async () => {
    const session = fakeSession();
    (session.page.url as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error("page gone");
    });
    const sm = new SessionManager(makeHost([session]));
    expect(await sm.isSessionValid(session)).toBe(false);
    expect(session.isValid).toBe(false);
  });

  it("isSessionValid short-circuits when session.isValid is already false", async () => {
    const session = fakeSession({ isValid: false });
    const sm = new SessionManager(makeHost([session]));
    expect(await sm.isSessionValid(session)).toBe(false);
    expect(session.page.url).not.toHaveBeenCalled();
  });

  it("markSessionInvalid closes page and context, sets isValid=false", async () => {
    const session = fakeSession();
    const sm = new SessionManager(makeHost([session]));
    await sm.markSessionInvalid(session);
    expect(session.isValid).toBe(false);
    expect(session.page.close).toHaveBeenCalled();
    expect(session.context.close).toHaveBeenCalled();
  });

  it("markSessionInvalid removes from pool when autoCleanup is on", async () => {
    const sessions = [fakeSession(), fakeSession()];
    const target = sessions[0]!;
    const host: SessionManagerHost = {
      getLogger: () => fakeLogger(),
      getSessions: () => sessions,
      isSessionRecoveryEnabled: () => false,
      isAutoCleanupDeadSessions: () => true,
      getSessionCreationLock: () => false,
      setSessionCreationLock: vi.fn(),
    };
    const sm = new SessionManager(host);
    await sm.markSessionInvalid(target);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).not.toBe(target);
  });

  it("getValidSessionIndex throws SessionUnavailableException when no sessions exist", async () => {
    const sm = new SessionManager(makeHost([]));
    await expect(sm.getValidSessionIndex()).rejects.toThrow(SessionUnavailableException);
  });

  it("getValidSessionIndex returns the requested index when valid", async () => {
    const session = fakeSession();
    const sm = new SessionManager(makeHost([session]));
    const [i, s] = await sm.getValidSessionIndex({ sessionIndex: 0 });
    expect(i).toBe(0);
    expect(s).toBe(session);
  });

  it("getValidSessionIndex picks a random valid session when no index given", async () => {
    const sessions = [fakeSession(), fakeSession()];
    const sm = new SessionManager(makeHost(sessions));
    const [i] = await sm.getValidSessionIndex();
    expect([0, 1]).toContain(i);
  });

  it("setSessionCookies delegates to context.addCookies", async () => {
    const session = fakeSession();
    const sm = new SessionManager(makeHost([session]));
    const cookies = [{ name: "a", value: "b" }];
    await sm.setSessionCookies(session, cookies);
    expect(session.context.addCookies).toHaveBeenCalledWith(cookies);
  });

  it("getSessionCookies flattens context.cookies() to a name→value map", async () => {
    const session = fakeSession();
    (session.context.cookies as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: "a", value: "1" },
      { name: "b", value: "2" },
    ]);
    const sm = new SessionManager(makeHost([session]));
    expect(await sm.getSessionCookies(session)).toEqual({ a: "1", b: "2" });
  });

  it("saveSessionState throws when index is out of range", async () => {
    const sm = new SessionManager(makeHost([]));
    await expect(sm.saveSessionState("path.json", 0)).rejects.toThrow(
      SessionUnavailableException
    );
  });

  it("saveSessionState calls context.storageState({ path })", async () => {
    const storageState = vi.fn();
    const session = fakeSession();
    session.context = {
      ...session.context,
      storageState,
    } as unknown as TikTokPlaywrightSession["context"];
    const sm = new SessionManager(makeHost([session]));
    await sm.saveSessionState("out.json", 0);
    expect(storageState).toHaveBeenCalledWith({ path: "out.json" });
  });
});

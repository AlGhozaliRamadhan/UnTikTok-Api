import { describe, it, expect, vi } from "vitest";
import { paginate } from "../src/api/_paginate";
import { InvalidResponseException } from "../src/exceptions";
import type { TikTokApi } from "../src/tiktok";

/** Minimal fake schema — paginate() never calls `.parse`/`.safeParse` itself
 *  (that happens inside the real `makeRequest`), so any object satisfies
 *  the generic constraint at the type level for these unit tests. */
const fakeSchema = {} as never;

function fakeParent(makeRequest: (...args: unknown[]) => unknown): TikTokApi {
  return { makeRequest } as unknown as TikTokApi;
}

async function drain<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of gen) out.push(item);
  return out;
}

describe("paginate() (ADR-008)", () => {
  it("normal fetch: walks multiple pages and advances the cursor until hasMore is false", async () => {
    const makeRequest = vi
      .fn()
      .mockResolvedValueOnce({ itemList: ["a", "b"], hasMore: true, cursor: 2 })
      .mockResolvedValueOnce({ itemList: ["c"], hasMore: false, cursor: 3 });

    const items = await drain(
      paginate({
        parent: fakeParent(makeRequest),
        url: "https://example.test/list",
        schema: fakeSchema,
        buildParams: (cursor) => ({ cursor }),
        getItems: (resp) => (resp as { itemList: string[] }).itemList,
        build: (x) => x,
        count: 10,
      })
    );

    expect(items).toEqual(["a", "b", "c"]);
    expect(makeRequest).toHaveBeenCalledTimes(2);
    // Cursor advanced 0 -> 2 across calls (default getCursor reads `.cursor`).
    expect(makeRequest.mock.calls[0]![0].params).toEqual({ cursor: 0 });
    expect(makeRequest.mock.calls[1]![0].params).toEqual({ cursor: 2 });
  });

  it("early hasMore=false: stops after the first page even if count isn't reached", async () => {
    const makeRequest = vi
      .fn()
      .mockResolvedValueOnce({ itemList: ["a"], hasMore: false, cursor: 1 });

    const items = await drain(
      paginate({
        parent: fakeParent(makeRequest),
        url: "https://example.test/list",
        schema: fakeSchema,
        buildParams: (cursor) => ({ cursor }),
        getItems: (resp) => (resp as { itemList: string[] }).itemList,
        build: (x) => x,
        count: 50,
      })
    );

    expect(items).toEqual(["a"]);
    expect(makeRequest).toHaveBeenCalledTimes(1);
  });

  it("null response: throws InvalidResponseException instead of yielding", async () => {
    const makeRequest = vi.fn().mockResolvedValueOnce(null);

    const gen = paginate({
      parent: fakeParent(makeRequest),
      url: "https://example.test/list",
      schema: fakeSchema,
      buildParams: (cursor) => ({ cursor }),
      getItems: (resp) => (resp as { itemList: string[] }).itemList,
      build: (x) => x,
      count: 10,
    });

    await expect(drain(gen)).rejects.toThrow(InvalidResponseException);
  });

  it("count limit: stops mid-page once `count` items have been yielded, without an extra fetch", async () => {
    const makeRequest = vi
      .fn()
      .mockResolvedValueOnce({ itemList: ["a", "b", "c", "d"], hasMore: true, cursor: 4 });

    const items = await drain(
      paginate({
        parent: fakeParent(makeRequest),
        url: "https://example.test/list",
        schema: fakeSchema,
        buildParams: (cursor) => ({ cursor }),
        getItems: (resp) => (resp as { itemList: string[] }).itemList,
        build: (x) => x,
        count: 2,
      })
    );

    expect(items).toEqual(["a", "b"]);
    expect(makeRequest).toHaveBeenCalledTimes(1);
  });

  it("cursor advance: honors a custom getCursor (e.g. minCursor/maxCursor) instead of `.cursor`", async () => {
    const makeRequest = vi
      .fn()
      .mockResolvedValueOnce({ userList: ["u1"], hasMore: true, minCursor: 10, maxCursor: 10 })
      .mockResolvedValueOnce({ userList: ["u2"], hasMore: false, minCursor: 20, maxCursor: 20 });

    const items = await drain(
      paginate({
        parent: fakeParent(makeRequest),
        url: "https://example.test/followers",
        schema: fakeSchema,
        buildParams: (cursor) => ({ minCursor: cursor, maxCursor: cursor }),
        getItems: (resp) => (resp as { userList: string[] }).userList,
        getCursor: (resp) => (resp as { minCursor: number; maxCursor: number }).minCursor || (resp as { maxCursor: number }).maxCursor,
        build: (x) => x,
        count: 10,
      })
    );

    expect(items).toEqual(["u1", "u2"]);
    expect(makeRequest.mock.calls[0]![0].params).toEqual({ minCursor: 0, maxCursor: 0 });
    expect(makeRequest.mock.calls[1]![0].params).toEqual({ minCursor: 10, maxCursor: 10 });
  });

  it("empty page: stops iteration even if hasMore/count would otherwise continue", async () => {
    const makeRequest = vi
      .fn()
      .mockResolvedValueOnce({ itemList: [], hasMore: true, cursor: 0 });

    const items = await drain(
      paginate({
        parent: fakeParent(makeRequest),
        url: "https://example.test/list",
        schema: fakeSchema,
        buildParams: (cursor) => ({ cursor }),
        getItems: (resp) => (resp as { itemList: string[] }).itemList,
        build: (x) => x,
        count: 10,
      })
    );

    expect(items).toEqual([]);
    expect(makeRequest).toHaveBeenCalledTimes(1);
  });

  it("onPage: lets a caller thread extra per-page state into the next buildParams call", async () => {
    let searchId = "";
    const makeRequest = vi
      .fn()
      .mockResolvedValueOnce({ itemList: ["a"], hasMore: true, cursor: 1, rid: "rid-1" })
      .mockResolvedValueOnce({ itemList: ["b"], hasMore: false, cursor: 2, rid: "rid-2" });

    await drain(
      paginate({
        parent: fakeParent(makeRequest),
        url: "https://example.test/search",
        schema: fakeSchema,
        buildParams: (cursor) => (searchId ? { cursor, search_id: searchId } : { cursor }),
        getItems: (resp) => (resp as { itemList: string[] }).itemList,
        onPage: (resp) => {
          searchId = (resp as { rid?: string }).rid ?? "";
        },
        build: (x) => x,
        count: 10,
      })
    );

    expect(makeRequest.mock.calls[0]![0].params).toEqual({ cursor: 0 });
    expect(makeRequest.mock.calls[1]![0].params).toEqual({ cursor: 1, search_id: "rid-1" });
  });
});

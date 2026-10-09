import { describe, it, expect, vi } from "vitest";
import { paginate } from "../src/api/_paginate";
import {
  MAX_CURSOR_STALLS,
  MAX_PAGINATE_COUNT,
  MAX_PAGINATE_PAGES,
} from "../src/constants";
import type { ITikTokApi } from "../src/types";
import { fakeLogger } from "./_fakes";

const fakeSchema = {} as never;

function fakeParent(makeRequest: (...args: unknown[]) => unknown): ITikTokApi {
  return { makeRequest, logger: fakeLogger() } as unknown as ITikTokApi;
}

async function drain<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of gen) out.push(item);
  return out;
}

function runPaginate(parent: ITikTokApi, count: number): AsyncGenerator<string> {
  return paginate({
    parent,
    url: "https://example.test/list",
    schema: fakeSchema,
    buildParams: (cursor) => ({ cursor }),
    getItems: (resp) => (resp as { itemList: string[] }).itemList,
    build: (x) => x,
    count,
  });
}

describe("paginate() cost bounds (ADR-014)", () => {
  it("clamps a huge caller count to MAX_PAGINATE_COUNT items", async () => {
    // 10 items/page, advancing cursor, always hasMore: without the clamp this
    // would issue 100M requests; it must stop at 1000 items / 100 pages.
    let cursor = 0;
    const makeRequest = vi.fn().mockImplementation(() => {
      cursor += 10;
      return Promise.resolve({
        itemList: Array.from({ length: 10 }, (_, i) => `i${cursor + i}`),
        hasMore: true,
        cursor,
      });
    });
    const parent = fakeParent(makeRequest);

    const items = await drain(runPaginate(parent, 1_000_000_000));

    expect(items).toHaveLength(MAX_PAGINATE_COUNT);
    expect(makeRequest.mock.calls.length).toBeLessThanOrEqual(MAX_PAGINATE_PAGES);
    expect(parent.logger.warn).toHaveBeenCalledWith(expect.stringMatching(/clamped/));
  });

  it("caps total pages even when items-per-page is tiny", async () => {
    const makeRequest = vi.fn().mockImplementation(() => {
      const n = makeRequest.mock.calls.length;
      return Promise.resolve({ itemList: [`i${n}`], hasMore: true, cursor: n });
    });
    const parent = fakeParent(makeRequest);

    const items = await drain(runPaginate(parent, 1_000_000_000));

    expect(makeRequest).toHaveBeenCalledTimes(MAX_PAGINATE_PAGES);
    expect(items).toHaveLength(MAX_PAGINATE_PAGES);
  });

  it("breaks on a non-advancing cursor despite hasMore=true", async () => {
    // Adversarial continuation: fresh items, hasMore stuck true, cursor
    // pinned at 0 (the omitted-cursor default). Must stop after the stall
    // budget, not after `count`.
    let n = 0;
    const makeRequest = vi.fn().mockImplementation(() => {
      n += 1;
      return Promise.resolve({
        itemList: [`i${n}`, `x${n}`],
        hasMore: true,
        cursor: 0,
      });
    });
    const parent = fakeParent(makeRequest);

    const items = await drain(runPaginate(parent, 1_000_000_000));

    // 10 consecutive non-advancing pages trip the stall budget.
    expect(makeRequest).toHaveBeenCalledTimes(MAX_CURSOR_STALLS);
    expect(items).toHaveLength(MAX_CURSOR_STALLS * 2);
    expect(parent.logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/non-advancing cursors/)
    );
  });

  it("does not trip the stall guard on a normally advancing feed", async () => {
    const makeRequest = vi
      .fn()
      .mockResolvedValueOnce({ itemList: ["a"], hasMore: true, cursor: 1 })
      .mockResolvedValueOnce({ itemList: ["b"], hasMore: true, cursor: 2 })
      .mockResolvedValueOnce({ itemList: ["c"], hasMore: false, cursor: 3 });
    const parent = fakeParent(makeRequest);

    const items = await drain(runPaginate(parent, 10));

    expect(items).toEqual(["a", "b", "c"]);
    expect(parent.logger.warn).not.toHaveBeenCalled();
  });

  it("a zero/negative count still yields nothing (no behavior change)", async () => {
    const makeRequest = vi.fn();
    const parent = fakeParent(makeRequest);

    expect(await drain(runPaginate(parent, 0))).toEqual([]);
    expect(await drain(runPaginate(parent, -5))).toEqual([]);
    expect(makeRequest).not.toHaveBeenCalled();
  });
});

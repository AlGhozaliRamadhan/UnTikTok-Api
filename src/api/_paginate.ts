import type { z } from "zod";
import type { ITikTokApi } from "../types";
import { InvalidResponseException } from "../exceptions";
import {
  MAX_CURSOR_STALLS,
  MAX_PAGINATE_COUNT,
  MAX_PAGINATE_PAGES,
} from "../constants";

export interface PaginateOptions<S extends z.ZodType, TItem, TOut> {
  parent: ITikTokApi;
  url: string;
  schema: S;
  buildParams: (cursor: number, found: number) => Record<string, unknown>;
  getItems: (resp: z.infer<S>) => TItem[];
  getCursor?: ((resp: z.infer<S>, currentCursor: number) => number) | undefined;
  getHasMore?: ((resp: z.infer<S>) => boolean) | undefined;
  build: (item: TItem) => TOut;
  onPage?: ((resp: z.infer<S>) => void) | undefined;
  count: number;
  cursor?: number;
  headers?: Record<string, string> | undefined;
  sessionIndex?: number | undefined;
}

/**
 * Shared async-generator pagination loop. Fetches pages from `url` until
 * either `count` items have been yielded or the response says there's no
 * more data, advancing the cursor after every page.
 *
 * An empty item page also stops iteration (defends against endpoints that
 * omit `hasMore` on an exhausted feed instead of setting it `false`).
 */
export async function* paginate<S extends z.ZodType, TItem, TOut>(
  opts: PaginateOptions<S, TItem, TOut>
): AsyncGenerator<TOut> {
  const {
    parent,
    url,
    schema,
    buildParams,
    getItems,
    getCursor = (resp) => (resp as { cursor?: number }).cursor ?? 0,
    getHasMore = (resp) => Boolean((resp as { hasMore?: boolean }).hasMore),
    build,
    onPage,
    count,
    headers,
    sessionIndex,
  } = opts;

  let cursor = opts.cursor ?? 0;
  let found = 0;

  // Cost bounds (ADR-014): `count` is caller-controlled and `hasMore`/
  // `cursor` are remote-controlled, so neither alone may drive unbounded
  // signed-fetch spend (Paginate-UnboundedCount-v1). Clamp the caller count,
  // cap total pages, and break when the cursor stops advancing.
  const effectiveCount = Math.min(Math.max(count, 0), MAX_PAGINATE_COUNT);
  if (count > MAX_PAGINATE_COUNT) {
    parent.logger.warn(
      `paginate(${url}): count ${count} exceeds the per-call maximum, clamped to ${MAX_PAGINATE_COUNT}`
    );
  }
  let pages = 0;
  let stalls = 0;

  while (found < effectiveCount) {
    if (pages >= MAX_PAGINATE_PAGES) {
      parent.logger.warn(
        `paginate(${url}): stopping after ${pages} pages (per-call page maximum)`
      );
      return;
    }
    pages++;

    const resp = await parent.makeRequest({
      url,
      params: buildParams(cursor, found),
      headers,
      sessionIndex,
      schema,
    });

    if (resp == null) {
      throw new InvalidResponseException(resp, "TikTok returned an invalid response.");
    }

    onPage?.(resp);

    const items = getItems(resp);
    if (items.length === 0) return;

    for (const item of items) {
      yield build(item);
      found++;
      if (found >= effectiveCount) return;
    }

    if (!getHasMore(resp)) return;
    const nextCursor = getCursor(resp, cursor);
    if (nextCursor === cursor) {
      stalls++;
      if (stalls >= MAX_CURSOR_STALLS) {
        parent.logger.warn(
          `paginate(${url}): stopping after ${stalls} consecutive non-advancing cursors`
        );
        return;
      }
    } else {
      stalls = 0;
      cursor = nextCursor;
    }
  }
}

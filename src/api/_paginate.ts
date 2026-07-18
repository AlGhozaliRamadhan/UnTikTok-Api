// ============================================================
// api/_paginate.ts
// Shared pagination engine — ADR-008.
//
// Every paginated endpoint (user.videos, user.liked, sound.videos, ...) used
// to hand-roll the same ~14-line "fetch a page, yield items, check hasMore,
// advance cursor" loop, 10+ times over. The `hasMore`/`has_more` casing drift
// itself was already fixed at the schema boundary (ADR-007's
// `normalizeHasMore` in schemas.ts, which every list schema runs through) —
// this helper's job is to stop copy-pasting the loop around that normalized
// shape, and to give every paginated method the same
// `(count?, cursor?, kwargs?)` signature.
// ============================================================

import type { z } from "zod";
import type { TikTokApi } from "../tiktok";
import { InvalidResponseException } from "../exceptions";

export interface PaginateOptions<S extends z.ZodType, TItem, TOut> {
  parent: TikTokApi;
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

  while (found < count) {
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
      if (found >= count) return;
    }

    if (!getHasMore(resp)) return;
    cursor = getCursor(resp, cursor);
  }
}

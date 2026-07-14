// ============================================================
// api/trending.ts
// Mirrors TikTokApi/api/trending.py
// ============================================================

import type { TikTokApi } from "../tiktok";
import type { Video } from "./video";
import { trendingFeedResponseSchema } from "../schemas";
import { paginate } from "./_paginate";

export class Trending {
  /** Static reference to the parent TikTokApi instance */
  parent: TikTokApi;

  constructor(parent: TikTokApi) {
    this.parent = parent;
  }


  /**
   * Returns Videos that are trending on TikTok.
   *
   * @example
   * ```ts
   * for await (const video of api.trending.videos()) {
   *   console.log(video.id);
   * }
   * ```
   */
  async *videos(
    count = 30,
    cursor = 0,
    kwargs: { headers?: Record<string, string>; sessionIndex?: number } = {}
  ): AsyncGenerator<Video> {
    yield* paginate({
      parent: this.parent,
      url: "https://www.tiktok.com/api/recommend/item_list/",
      schema: trendingFeedResponseSchema,
      // Trending has no real cursor of its own — TikTok just wants a fresh
      // batch size each call. Size the request to what's still needed.
      buildParams: (_c, found) => ({
        from_page: "fyp",
        count: Math.min(count - found, 30),
      }),
      getItems: (resp) => resp.itemList,
      build: (item) => this.parent.video({ data: item }),
      count,
      cursor,
      headers: kwargs.headers,
      sessionIndex: kwargs.sessionIndex,
    });
  }
}

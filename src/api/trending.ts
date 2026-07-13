// ============================================================
// api/trending.ts
// Mirrors TikTokApi/api/trending.py
// ============================================================

import type { TikTokApi } from "../tiktok";
import type { Video } from "./video";
import { InvalidResponseException } from "../exceptions";
import { trendingFeedResponseSchema } from "../schemas";

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
    kwargs: { headers?: Record<string, string>; sessionIndex?: number } = {}
  ): AsyncGenerator<Video> {
    let found = 0;

    while (found < count) {
      const batchSize = Math.min(count - found, 30);
      const params: Record<string, unknown> = {
        from_page: "fyp",
        count: batchSize,
      };

      const resp = await this.parent.makeRequest({
        url: "https://www.tiktok.com/api/recommend/item_list/",
        params,
        headers: kwargs.headers,
        sessionIndex: kwargs.sessionIndex,
        schema: trendingFeedResponseSchema,
      });

      if (resp == null) {
        throw new InvalidResponseException(resp, "TikTok returned an invalid response.");
      }

      if (resp.itemList.length === 0) return; // If no items returned, stop to avoid infinite loop
      for (const item of resp.itemList) {
        yield this.parent.video({ data: item });
        found++;
      }

      if (!resp.hasMore) return;
    }
  }
}

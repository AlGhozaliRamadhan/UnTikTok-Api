// ============================================================
// api/trending.ts
// Mirrors TikTokApi/api/trending.py
// ============================================================

import type { TikTokApi } from "../tiktok";
import type { Video } from "./video";
import { InvalidResponseException } from "../exceptions";

export class Trending {
  /** Static reference to the parent TikTokApi instance */
  static parent: TikTokApi;

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
  static async *videos(
    count = 30,
    kwargs: { headers?: Record<string, string>; sessionIndex?: number } = {}
  ): AsyncGenerator<Video> {
    let found = 0;

    while (found < count) {
      const params: Record<string, unknown> = {
        from_page: "fyp",
        count,
      };

      const resp = await Trending.parent.makeRequest({
        url: "https://www.tiktok.com/api/recommend/item_list/",
        params,
        headers: kwargs.headers,
        sessionIndex: kwargs.sessionIndex,
      });

      if (resp == null) {
        throw new InvalidResponseException(resp, "TikTok returned an invalid response.");
      }

      const itemList = (resp["itemList"] as Record<string, unknown>[]) ?? [];
      for (const item of itemList) {
        yield Trending.parent.video({ data: item });
        found++;
      }

      if (!resp["hasMore"]) return;
    }
  }
}

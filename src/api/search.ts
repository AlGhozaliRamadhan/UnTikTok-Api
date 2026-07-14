// ============================================================
// api/search.ts
// Mirrors TikTokApi/api/search.py
// ============================================================

import type { TikTokApi } from "../tiktok";
import type { User } from "./user";
import type { Video } from "./video";
import { searchResponseSchema } from "../schemas";
import { paginate } from "./_paginate";

export class Search {
  /** Static reference to the parent TikTokApi instance */
  parent: TikTokApi;

  constructor(parent: TikTokApi) {
    this.parent = parent;
  }


  /**
   * Searches for users.
   *
   * Note: Your ms_token must have been used for a TikTok search already.
   *
   * @example
   * ```ts
   * for await (const user of api.search.users('david teather')) {
   *   console.log(user.username);
   * }
   * ```
   */
  async *users(
    searchTerm: string,
    count = 10,
    cursor = 0,
    kwargs: { headers?: Record<string, string>; sessionIndex?: number } = {}
  ): AsyncGenerator<User> {
    for await (const user of this.searchType(searchTerm, "user", count, cursor, kwargs)) {
      yield user as User;
    }
  }

  /**
   * Searches for a specific type of object.
   *
   * @example
   * ```ts
   * for await (const user of api.search.searchType('david teather', 'user')) {
   *   console.log(user);
   * }
   * ```
   */
  async *searchType(
    searchTerm: string,
    objType: "user" | "item",
    count = 10,
    cursor = 0,
    kwargs: { headers?: Record<string, string>; sessionIndex?: number } = {}
  ): AsyncGenerator<User | Video> {
    // TikTok rotates a `search_id` (from the previous page's `rid`) into
    // subsequent requests. `paginate()`'s `onPage` hook lets us thread that
    // extra bit of per-page state into the next `buildParams` call via this
    // closure variable, without the helper needing to know search is special.
    let searchId = "";

    yield* paginate({
      parent: this.parent,
      url: `https://www.tiktok.com/api/search/${objType}/full/`,
      schema: searchResponseSchema,
      buildParams: (c) => {
        const params: Record<string, unknown> = {
          keyword: searchTerm,
          cursor: c,
          from_page: "search",
          web_search_code: JSON.stringify({
            tiktok: {
              client_params_x: {
                search_engine: {
                  ies_mt_user_live_video_card_use_libra: 1,
                  mt_search_general_user_live_card: 1,
                },
              },
              search_server: {},
            },
          }),
        };
        if (searchId) params["search_id"] = searchId;
        return params;
      },
      getItems: (resp) => (objType === "user" ? resp.user_list : resp.item_list),
      onPage: (resp) => {
        searchId = resp.rid ?? "";
      },
      build: (raw) => {
        if (objType === "user") {
          const userInfo = raw["user_info"] as Record<string, string>;
          return this.parent.user({
            secUid: userInfo["sec_uid"],
            userId: userInfo["user_id"],
            username: userInfo["unique_id"],
          });
        }
        return this.parent.video({ data: raw });
      },
      count,
      cursor,
      headers: kwargs.headers,
      sessionIndex: kwargs.sessionIndex,
    });
  }
}

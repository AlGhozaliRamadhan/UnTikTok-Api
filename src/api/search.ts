// ============================================================
// api/search.ts
// Mirrors TikTokApi/api/search.py
// ============================================================

import type { TikTokApi } from "../tiktok";
import type { User } from "./user";
import type { Video } from "./video";
import { InvalidResponseException } from "../exceptions";

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
    let found = 0;
    let searchId = "";

    while (found < count) {
      const params: Record<string, unknown> = {
        keyword: searchTerm,
        cursor,
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

      if (searchId) {
        params["search_id"] = searchId;
      }

      const resp = await this.parent.makeRequest({
        url: `https://www.tiktok.com/api/search/${objType}/full/`,
        params,
        headers: kwargs.headers,
        sessionIndex: kwargs.sessionIndex,
      });

      if (resp == null) {
        throw new InvalidResponseException(resp, "TikTok returned an invalid response.");
      }

      if (objType === "user") {
        const userList = (resp["user_list"] as Record<string, unknown>[]) ?? [];
        for (const user of userList) {
          const userInfo = user["user_info"] as Record<string, string>;
          yield this.parent.user({
            secUid: userInfo["sec_uid"],
            userId: userInfo["user_id"],
            username: userInfo["unique_id"],
          });
          found++;
        }
      } else if (objType === "item") {
        const itemList = (resp["item_list"] as Record<string, unknown>[]) ?? [];
        for (const item of itemList) {
          yield this.parent.video({ data: item });
          found++;
        }
      }

      if (!resp["has_more"]) return;
      cursor = resp["cursor"] as number;
      searchId = (resp["rid"] as string) ?? "";
    }
  }
}

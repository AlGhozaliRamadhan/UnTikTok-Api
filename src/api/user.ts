// ============================================================
// api/user.ts
// Mirrors TikTokApi/api/user.py
// ============================================================

import type { TikTokApi } from "../tiktok";
import type { Video } from "./video";
import type { Playlist } from "./playlist";
import { InvalidResponseException } from "../exceptions";

export interface UserOptions {
  username?: string | null;
  userId?: string | null;
  secUid?: string | null;
  data?: Record<string, unknown> | null;
}

export class User {
  /** Static reference to the parent TikTokApi instance */
  static parent: TikTokApi;

  /** The ID of the user */
  userId?: string;
  /** The secondary UID of the user */
  secUid?: string;
  /** The username of the user */
  username?: string;
  /** The raw data associated with this user */
  asDict?: Record<string, unknown>;

  constructor({ username, userId, secUid, data }: UserOptions = {}) {
    this._updateIdSecUidUsername(userId, secUid, username);
    if (data) {
      this.asDict = data;
      this._extractFromData();
    }
  }

  /**
   * Returns a dictionary of information associated with this User.
   *
   * @example
   * ```ts
   * const userData = await api.user({ username: 'therock' }).info();
   * ```
   */
  async info(kwargs: {
    msToken?: string;
    headers?: Record<string, string>;
    sessionIndex?: number;
  } = {}): Promise<Record<string, unknown>> {
    const username = this.username;
    if (!username) {
      throw new TypeError(
        "You must provide the username when creating this class to use this method."
      );
    }

    const urlParams: Record<string, unknown> = {
      secUid: this.secUid ?? "",
      uniqueId: username,
      msToken: kwargs.msToken,
    };

    const resp = await User.parent.makeRequest({
      url: "https://www.tiktok.com/api/user/detail/",
      params: urlParams,
      headers: kwargs.headers,
      sessionIndex: kwargs.sessionIndex,
    });

    if (resp == null) {
      throw new InvalidResponseException(resp, "TikTok returned an invalid response.");
    }

    this.asDict = resp;
    this._extractFromData();
    return resp;
  }

  /**
   * Returns a user's playlists.
   *
   * @example
   * ```ts
   * for await (const playlist of api.user({ username: 'therock' }).playlists()) {
   *   console.log(playlist.name);
   * }
   * ```
   */
  async *playlists(
    count = 20,
    cursor = 0,
    kwargs: { headers?: Record<string, string>; sessionIndex?: number } = {}
  ): AsyncGenerator<Playlist> {
    if (!this.secUid) {
      await this.info(kwargs);
    }
    let found = 0;

    while (found < count) {
      const params: Record<string, unknown> = {
        secUid: this.secUid,
        count: Math.min(count, 30),
        cursor,
      };

      const resp = await User.parent.makeRequest({
        url: "https://www.tiktok.com/api/user/playlist",
        params,
        headers: kwargs.headers,
        sessionIndex: kwargs.sessionIndex,
      });

      if (resp == null) {
        throw new InvalidResponseException(resp, "TikTok returned an invalid response.");
      }

      const playList = (resp["playList"] as Record<string, unknown>[]) ?? [];
      for (const pl of playList) {
        yield User.parent.playlist({ data: pl });
        found++;
      }

      if (!resp["hasMore"]) return;
      cursor = resp["cursor"] as number;
    }
  }

  /**
   * Returns a user's videos.
   *
   * @example
   * ```ts
   * for await (const video of api.user({ username: 'davidteathercodes' }).videos()) {
   *   console.log(video.id);
   * }
   * ```
   */
  async *videos(
    count = 30,
    cursor = 0,
    kwargs: { headers?: Record<string, string>; sessionIndex?: number } = {}
  ): AsyncGenerator<Video> {
    if (!this.secUid) {
      await this.info(kwargs);
    }
    let found = 0;

    while (found < count) {
      const params: Record<string, unknown> = {
        secUid: this.secUid,
        count: 30,
        cursor,
      };

      const resp = await User.parent.makeRequest({
        url: "https://www.tiktok.com/api/post/item_list/",
        params,
        headers: kwargs.headers,
        sessionIndex: kwargs.sessionIndex,
      });

      if (resp == null) {
        throw new InvalidResponseException(resp, "TikTok returned an invalid response.");
      }

      const itemList = (resp["itemList"] as Record<string, unknown>[]) ?? [];
      for (const item of itemList) {
        yield User.parent.video({ data: item });
        found++;
      }

      if (!resp["hasMore"]) return;
      cursor = resp["cursor"] as number;
    }
  }

  /**
   * Returns a user's liked posts (if public).
   *
   * @example
   * ```ts
   * for await (const like of api.user({ username: 'davidteathercodes' }).liked()) {
   *   console.log(like.id);
   * }
   * ```
   */
  async *liked(
    count = 30,
    cursor = 0,
    kwargs: { headers?: Record<string, string>; sessionIndex?: number } = {}
  ): AsyncGenerator<Video> {
    if (!this.secUid) {
      await this.info(kwargs);
    }
    let found = 0;

    while (found < count) {
      const params: Record<string, unknown> = {
        secUid: this.secUid,
        count: 30,
        cursor,
      };

      const resp = await User.parent.makeRequest({
        url: "https://www.tiktok.com/api/favorite/item_list",
        params,
        headers: kwargs.headers,
        sessionIndex: kwargs.sessionIndex,
      });

      if (resp == null) {
        throw new InvalidResponseException(resp, "TikTok returned an invalid response.");
      }

      const itemList = (resp["itemList"] as Record<string, unknown>[]) ?? [];
      for (const item of itemList) {
        yield User.parent.video({ data: item });
        found++;
      }

      if (!resp["hasMore"]) return;
      cursor = resp["cursor"] as number;
    }
  }

  private _extractFromData(): void {
    const data = this.asDict ?? {};
    const keys = Object.keys(data);

    if (keys.includes("userInfo")) {
      const userInfo = (data["userInfo"] as Record<string, Record<string, string>>)["user"];
      this._updateIdSecUidUsername(userInfo["id"], userInfo["secUid"], userInfo["uniqueId"]);
    } else {
      this._updateIdSecUidUsername(
        data["id"] as string | undefined,
        data["secUid"] as string | undefined,
        data["uniqueId"] as string | undefined
      );
    }

    if (!this.username || !this.userId || !this.secUid) {
      User.parent.logger.error(
        `Failed to create User with data: ${JSON.stringify(data)}`
      );
    }
  }

  private _updateIdSecUidUsername(
    id?: string | null,
    secUid?: string | null,
    username?: string | null
  ): void {
    if (id != null) this.userId = id;
    if (secUid != null) this.secUid = secUid;
    if (username != null) this.username = username;
  }

  toString(): string {
    return `TikTokApi.user(username='${this.username}', user_id='${this.userId}', sec_uid='${this.secUid}')`;
  }
}

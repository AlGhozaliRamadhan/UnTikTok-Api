// ============================================================
// api/user.ts
// Mirrors TikTokApi/api/user.py
// ============================================================

import type { TikTokApi } from "../tiktok";
import type { Video } from "./video";
import type { Playlist } from "./playlist";
import { InvalidResponseException, InvalidParameterException } from "../exceptions";

export interface UserOptions {
  username?: string | null;
  userId?: string | null;
  secUid?: string | null;
  data?: Record<string, unknown> | null;
}

export class User {
  /** Static reference to the parent TikTokApi instance */
  parent: TikTokApi;

  /** The ID of the user */
  userId?: string;
  /** The secondary UID of the user */
  secUid?: string;
  /** The username of the user */
  username?: string;
  /** The raw data associated with this user */
  asDict?: Record<string, unknown>;

  constructor(parent: TikTokApi, { username, userId, secUid, data }: UserOptions = {}) {
    this.parent = parent;
    this._updateIdSecUidUsername(userId, secUid, username);
    if (data) {
      this.asDict = data;
      this._extractFromData();
    }
  }

  /**
   * Returns whether the user is currently live on TikTok.
   * Based on the presence of a non-zero roomId in the user info data.
   */
  get isLive(): boolean {
    return this.roomId !== null;
  }

  /**
   * Returns the roomId of the user if they are currently live on TikTok.
   * Returns null if they are not live.
   */
  get roomId(): string | null {
    const data = this.asDict ?? {};
    
    // Check inside userInfo.user
    if (data["userInfo"]) {
      const user = (data["userInfo"] as Record<string, unknown>)["user"] as Record<string, unknown> | undefined;
      if (user) {
        if (user["roomId"] && user["roomId"] !== "0" && user["roomId"] !== 0) {
          return String(user["roomId"]);
        }
        if (user["room_id"] && user["room_id"] !== "0" && user["room_id"] !== 0) {
          return String(user["room_id"]);
        }
      }
    }
    
    // Check root level
    if (data["roomId"] && data["roomId"] !== "0" && data["roomId"] !== 0) {
      return String(data["roomId"]);
    }
    if (data["room_id"] && data["room_id"] !== "0" && data["room_id"] !== 0) {
      return String(data["room_id"]);
    }

    // Check if roomData exists (fallback)
    if (data["roomData"] || data["room_data"]) {
      return "unknown_room_id";
    }

    return null;
  }

  /** Gets the user's display name */
  get nickname(): string | null {
    return this._extractUserInfoValue("nickname") as string | null;
  }

  /** Gets the user's bio / signature */
  get signature(): string | null {
    return this._extractUserInfoValue("signature") as string | null;
  }

  /** Gets whether the user is a verified account */
  get verified(): boolean {
    return Boolean(this._extractUserInfoValue("verified"));
  }

  /** Gets whether the user has a private account */
  get isPrivate(): boolean {
    return Boolean(this._extractUserInfoValue("privateAccount"));
  }

  /** Gets the user's follower count */
  get followers(): number {
    return (this._extractUserStatsValue("followerCount") as number) || 0;
  }

  /** Gets the user's following count */
  get following(): number {
    return (this._extractUserStatsValue("followingCount") as number) || 0;
  }

  /** Gets the user's total likes (hearts) */
  get likes(): number {
    return (this._extractUserStatsValue("heartCount") as number) || 0;
  }

  /** Gets the user's total video count */
  get videoCount(): number {
    return (this._extractUserStatsValue("videoCount") as number) || 0;
  }

  /** Gets the user's link in bio */
  get bioLink(): string | null {
    const bioLinkObj = this._extractUserInfoValue("bioLink") as Record<string, unknown> | undefined;
    const link = bioLinkObj?.link;
    return typeof link === "string" ? link : null;
  }

  /** Gets the user's profile picture URL (largest available) */
  get avatar(): string | null {
    return (this._extractUserInfoValue("avatarLarger") as string) || 
           (this._extractUserInfoValue("avatarMedium") as string) || 
           (this._extractUserInfoValue("avatarThumb") as string) || null;
  }

  private _extractUserInfoValue(key: string): unknown {
    const data = this.asDict ?? {};
    if (data["userInfo"]) {
      const user = (data["userInfo"] as Record<string, unknown>)["user"] as Record<string, unknown> | undefined;
      if (user && user[key] !== undefined) return user[key];
    }
    return data[key] ?? null;
  }

  private _extractUserStatsValue(key: string): unknown {
    const data = this.asDict ?? {};
    if (data["userInfo"]) {
      const stats = (data["userInfo"] as Record<string, unknown>)["stats"] as Record<string, unknown> | undefined;
      if (stats && stats[key] !== undefined) return stats[key];
    }
    if (data["stats"]) {
      const stats = data["stats"] as Record<string, unknown>;
      if (stats[key] !== undefined) return stats[key];
    }
    return data[key] ?? null;
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
      throw new InvalidParameterException(
        null,
        "You must provide the username when creating this class to use this method."
      );
    }

    const urlParams: Record<string, unknown> = {
      secUid: this.secUid ?? "",
      uniqueId: username,
      msToken: kwargs.msToken,
    };

    const resp = await this.parent.makeRequest({
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

      const resp = await this.parent.makeRequest({
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
        yield this.parent.playlist({ data: pl });
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

      const resp = await this.parent.makeRequest({
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
        yield this.parent.video({ data: item });
        found++;
      }

      if (!resp["hasMore"]) return;
      cursor = resp["cursor"] as number;
    }
  }

  /**
   * Returns a user's pinned videos.
   *
   * @example
   * ```ts
   * for await (const video of api.user({ username: 'davidteathercodes' }).pinned()) {
   *   console.log(video.id);
   * }
   * ```
   */
  async *pinned(
    count = 3,
    kwargs: { headers?: Record<string, string>; sessionIndex?: number } = {}
  ): AsyncGenerator<Video> {
    // Pinned videos are always sent at the top of the videos feed
    // We fetch a batch of videos and explicitly filter for pinned flags
    let found = 0;
    
    // We only need to check the first few videos since pinned are always at top
    for await (const video of this.videos(10, 0, kwargs)) {
      const data = video.asDict ?? {};
      const isPinned = data["isPinned"] === true || 
                       data["is_pinned"] === true ||
                       data["isTop"] === true ||
                       data["is_top"] === true ||
                       data["isTopItem"] === true ||
                       data["is_top_item"] === true;
                       
      if (isPinned) {
        yield video;
        found++;
        if (found >= count) break;
      }
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

      const resp = await this.parent.makeRequest({
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
        yield this.parent.video({ data: item });
        found++;
      }

      if (!resp["hasMore"]) return;
      cursor = resp["cursor"] as number;
    }
  }

  /**
   * Returns a user's reposted videos (if available).
   * Note: TikTok might restrict visibility based on authentication or region.
   *
   * @example
   * ```ts
   * for await (const repost of api.user({ username: 'davidteathercodes' }).reposts()) {
   *   console.log(repost.id);
   * }
   * ```
   */
  async *reposts(
    count = 30,
    cursor = 0,
    kwargs: { headers?: Record<string, string>; sessionIndex?: number } = {}
  ): AsyncGenerator<Video> {
    if (!this.secUid) {
      await this.info(kwargs);
    }

    // "well now you can stalk your crush repost without knowing" - Al Ghozali Ramadhan
    
    let found = 0;

    while (found < count) {
      const params: Record<string, unknown> = {
        secUid: this.secUid,
        count: 30,
        cursor,
      };

      const resp = await this.parent.makeRequest({
        url: "https://www.tiktok.com/api/repost/item_list/",
        params,
        headers: kwargs.headers,
        sessionIndex: kwargs.sessionIndex,
      });

      if (resp == null) {
        throw new InvalidResponseException(resp, "TikTok returned an invalid response.");
      }

      const itemList = (resp["itemList"] as Record<string, unknown>[]) ?? [];
      for (const item of itemList) {
        yield this.parent.video({ data: item });
        found++;
      }

      if (!resp["hasMore"]) return;
      cursor = resp["cursor"] as number;
    }
  }

  /**
   * Returns a user's favorited/bookmarked videos (Collections).
   * Note: This relies entirely on the user's privacy settings.
   *
   * @example
   * ```ts
   * for await (const fav of api.user({ username: 'davidteathercodes' }).favorited()) {
   *   console.log(fav.id);
   * }
   * ```
   */
  async *favorited(
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

      const resp = await this.parent.makeRequest({
        url: "https://www.tiktok.com/api/user/collect/item_list/",
        params,
        headers: kwargs.headers,
        sessionIndex: kwargs.sessionIndex,
      });

      if (resp == null) {
        throw new InvalidResponseException(resp, "TikTok returned an invalid response.");
      }

      const itemList = (resp["itemList"] as Record<string, unknown>[]) ?? [];
      for (const item of itemList) {
        yield this.parent.video({ data: item });
        found++;
      }

      if (!resp["hasMore"]) return;
      cursor = resp["cursor"] as number;
    }
  }

  /**
   * Returns a user's followers list.
   * Note: This endpoint is heavily guarded and usually requires a logged-in session (cookies).
   * It may also quickly return errors or bot challenges.
   *
   * @example
   * ```ts
   * for await (const follower of api.user({ username: 'davidteathercodes' }).followersList()) {
   *   console.log(follower.username);
   * }
   * ```
   */
  async *followersList(
    count = 30,
    cursor = 0,
    kwargs: { headers?: Record<string, string>; sessionIndex?: number } = {}
  ): AsyncGenerator<User> {
    if (!this.secUid) {
      await this.info(kwargs);
    }
    let found = 0;

    while (found < count) {
      const params: Record<string, unknown> = {
        secUid: this.secUid,
        count: 30,
        minCursor: cursor,
        maxCursor: cursor,
      };

      const resp = await this.parent.makeRequest({
        url: "https://www.tiktok.com/api/user/list/",
        params,
        headers: kwargs.headers,
        sessionIndex: kwargs.sessionIndex,
      });

      if (resp == null) {
        throw new InvalidResponseException(resp, "TikTok returned an invalid response.");
      }

      const userList = (resp["userList"] as Record<string, unknown>[]) ?? [];
      for (const item of userList) {
        yield this.parent.user({ data: item });
        found++;
      }

      if (!resp["hasMore"]) return;
      cursor = resp["minCursor"] as number || resp["maxCursor"] as number;
    }
  }

  /**
   * Returns a user's following list.
   * Note: Like followers, this is heavily guarded and requires authentication.
   *
   * @example
   * ```ts
   * for await (const following of api.user({ username: 'davidteathercodes' }).followingList()) {
   *   console.log(following.username);
   * }
   * ```
   */
  async *followingList(
    count = 30,
    cursor = 0,
    kwargs: { headers?: Record<string, string>; sessionIndex?: number } = {}
  ): AsyncGenerator<User> {
    if (!this.secUid) {
      await this.info(kwargs);
    }
    let found = 0;

    while (found < count) {
      const params: Record<string, unknown> = {
        secUid: this.secUid,
        count: 30,
        minCursor: cursor,
        maxCursor: cursor,
      };

      const resp = await this.parent.makeRequest({
        url: "https://www.tiktok.com/api/user/following/",
        params,
        headers: kwargs.headers,
        sessionIndex: kwargs.sessionIndex,
      });

      if (resp == null) {
        throw new InvalidResponseException(resp, "TikTok returned an invalid response.");
      }

      const userList = (resp["userList"] as Record<string, unknown>[]) ?? [];
      for (const item of userList) {
        yield this.parent.user({ data: item });
        found++;
      }

      if (!resp["hasMore"]) return;
      cursor = resp["minCursor"] as number || resp["maxCursor"] as number;
    }
  }

  private _extractFromData(): void {
    const data = this.asDict ?? {};
    const keys = Object.keys(data);

    if (keys.includes("userInfo")) {
      const userInfo = (data["userInfo"] as Record<string, Record<string, string>>)["user"];
      if (userInfo) {
        this._updateIdSecUidUsername(userInfo["id"], userInfo["secUid"], userInfo["uniqueId"]);
      }
    } else {
      this._updateIdSecUidUsername(
        data["id"] as string | undefined,
        data["secUid"] as string | undefined,
        data["uniqueId"] as string | undefined
      );
    }

    if (!this.username || !this.userId || !this.secUid) {
      this.parent.logger.error(
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

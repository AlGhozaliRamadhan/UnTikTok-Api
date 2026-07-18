// ============================================================
// api/playlist.ts
// Mirrors TikTokApi/api/playlist.py
// ============================================================

import type { TikTokApi } from "../tiktok";
import type { Video } from "./video";
import type { User } from "./user";
import { InvalidResponseException, InvalidParameterException } from "../exceptions";
import { playlistDetailResponseSchema, itemListResponseSchema } from "../schemas";
import { paginate } from "./_paginate";

export interface PlaylistOptions {
  id?: string | null | undefined;
  data?: Record<string, unknown> | null | undefined;
}

export class Playlist {
  /** Static reference to the parent TikTokApi instance */
  parent: TikTokApi;

  /** The ID of the playlist */
  id?: string | undefined;
  /** The name of the playlist */
  name?: string | undefined;
  /** The video count of the playlist */
  videoCount?: number | undefined;
  /** The creator of the playlist */
  creator?: User | undefined;
  /** The cover URL of the playlist */
  coverUrl?: string | undefined;
  /** The raw data associated with this playlist */
  asDict?: Record<string, unknown>;

  constructor(parent: TikTokApi, { id, data }: PlaylistOptions = {}) {
    this.parent = parent;
    if (!id && !data?.["id"]) {
      throw new InvalidParameterException(null, "You must provide id parameter.");
    }
    this.id = id ?? undefined;

    if (data) {
      this.asDict = data;
      this._extractFromData();
    }
  }

  /**
   * Returns information associated with this Playlist.
   *
   * @example
   * ```ts
   * const info = await api.playlist({ id: '7426714779919797038' }).info();
   * ```
   */
  async info(kwargs: {
    msToken?: string;
    headers?: Record<string, string>;
    sessionIndex?: number;
  } = {}): Promise<Record<string, unknown>> {
    const id = this.id;
    if (!id) {
      throw new InvalidParameterException(
        null,
        "You must provide the playlist id when creating this class to use this method."
      );
    }

    const urlParams: Record<string, unknown> = {
      mixId: id,
      msToken: kwargs.msToken,
    };

    const resp = await this.parent.makeRequest({
      url: "https://www.tiktok.com/api/mix/detail/",
      params: urlParams,
      headers: kwargs.headers,
      sessionIndex: kwargs.sessionIndex,
      schema: playlistDetailResponseSchema,
    });

    if (resp == null) {
      throw new InvalidResponseException(resp, "TikTok returned an invalid response.");
    }

    this.asDict = resp.mixInfo as Record<string, unknown>;
    this._extractFromData();
    return resp;
  }

  /**
   * Returns videos in this playlist.
   *
   * @example
   * ```ts
   * for await (const video of api.playlist({ id: '7426714779919797038' }).videos()) {
   *   console.log(video.id);
   * }
   * ```
   */
  async *videos(
    count = 30,
    cursor = 0,
    kwargs: { headers?: Record<string, string>; sessionIndex?: number } = {}
  ): AsyncGenerator<Video> {
    if (!this.id) {
      await this.info(kwargs);
    }

    yield* paginate({
      parent: this.parent,
      url: "https://www.tiktok.com/api/mix/item_list/",
      schema: itemListResponseSchema,
      buildParams: (c) => ({ mixId: this.id, count: Math.min(count, 30), cursor: c }),
      getItems: (resp) => resp.itemList,
      build: (item) => this.parent.video({ data: item }),
      count,
      cursor,
      headers: kwargs.headers,
      sessionIndex: kwargs.sessionIndex,
    });
  }

  private _extractFromData(): void {
    let data = this.asDict ?? {};

    if ("mixInfo" in data) {
      data = data["mixInfo"] as Record<string, unknown>;
    }

    this.id = (data["id"] as string | undefined) ?? (data["mixId"] as string | undefined);
    this.name = (data["name"] as string | undefined) ?? (data["mixName"] as string | undefined);
    this.videoCount = data["videoCount"] as number | undefined;

    const creatorData = data["creator"] as Record<string, unknown> | undefined;
    if (creatorData) {
      this.creator = this.parent.user({ data: creatorData });
    }
    this.coverUrl = data["cover"] as string | undefined;

    if (!this.id || !this.name) {
      this.parent.logger.error(
        `Failed to create Playlist with data: ${JSON.stringify(data)}`
      );
    }
  }

  toString(): string {
    return `TikTokApi.playlist(id='${this.id}')`;
  }
}

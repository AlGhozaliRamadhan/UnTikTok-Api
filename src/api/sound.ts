// ============================================================
// api/sound.ts
// Mirrors TikTokApi/api/sound.py
// ============================================================

import type { TikTokApi } from "../tiktok";
import type { User } from "./user";
import type { Video } from "./video";
import { InvalidResponseException, InvalidParameterException } from "../exceptions";

export interface SoundOptions {
  id?: string | null;
  data?: Record<string, unknown> | null;
}

export class Sound {
  /** Static reference to the parent TikTokApi instance */
  parent: TikTokApi;

  /** TikTok's ID for the sound */
  id?: string;
  /** The title of the song */
  title?: string;
  /** The author of the song */
  author?: User;
  /** Duration in seconds */
  duration?: number;
  /** Whether the song is original */
  original?: boolean;
  /** Play URL */
  playUrl?: string;
  /** Cover URL (large) */
  coverLarge?: string;
  /** The raw data */
  asDict?: Record<string, unknown>;

  constructor(parent: TikTokApi, { id, data }: SoundOptions = {}) {
    this.parent = parent;
    if (data) {
      this.asDict = data;
      this._extractFromData();
    } else if (id == null) {
      throw new InvalidParameterException(null, "You must provide id parameter.");
    } else {
      this.id = id;
    }
  }

  /**
   * Returns all information sent by TikTok related to this sound.
   *
   * @example
   * ```ts
   * const soundInfo = await api.sound({ id: '7016547803243022337' }).info();
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
        "You must provide the id when creating this class to use this method."
      );
    }

    const urlParams: Record<string, unknown> = {
      msToken: kwargs.msToken,
      musicId: id,
    };

    const resp = await this.parent.makeRequest({
      url: "https://www.tiktok.com/api/music/detail/",
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
   * Returns videos created with this sound.
   *
   * @example
   * ```ts
   * for await (const video of api.sound({ id: '7016547803243022337' }).videos()) {
   *   console.log(video.id);
   * }
   * ```
   */
  async *videos(
    count = 30,
    cursor = 0,
    kwargs: { headers?: Record<string, string>; sessionIndex?: number } = {}
  ): AsyncGenerator<Video> {
    const id = this.id;
    if (!id) {
      throw new InvalidParameterException(
        null,
        "You must provide the id when creating this class to use this method."
      );
    }
    let found = 0;

    while (found < count) {
      const params: Record<string, unknown> = {
        musicID: id,
        count: 30,
        cursor,
      };

      const resp = await this.parent.makeRequest({
        url: "https://www.tiktok.com/api/music/item_list/",
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

  private _extractFromData(): void {
    const data = this.asDict ?? {};
    const keys = Object.keys(data);

    if (keys.includes("musicInfo")) {
      const musicInfo = data["musicInfo"] as Record<string, unknown>;
      const author = musicInfo["author"];
      if (typeof author === "object" && author !== null) {
        this.author = this.parent.user({ data: author as Record<string, unknown> });
      } else if (typeof author === "string") {
        this.author = this.parent.user({ username: author });
      }
      const music = musicInfo["music"] as Record<string, unknown> | undefined;
      if (music) {
        this.title = music["title"] as string;
        this.id = music["id"] as string;
        this.original = music["original"] as boolean;
        this.playUrl = music["playUrl"] as string;
        this.coverLarge = music["coverLarge"] as string;
        this.duration = music["duration"] as number;
      }
    }

    if (keys.includes("music")) {
      const music = data["music"] as Record<string, unknown>;
      this.title = music["title"] as string;
      this.id = music["id"] as string;
      this.original = music["original"] as boolean;
      this.playUrl = music["playUrl"] as string;
      this.coverLarge = music["coverLarge"] as string;
      this.duration = music["duration"] as number;
    }

    if (!this.id) {
      this.parent.logger.error(`Failed to create Sound with data: ${JSON.stringify(data)}`);
    }
  }

  toString(): string {
    return `TikTokApi.sound(id='${this.id}')`;
  }
}

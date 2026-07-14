// ============================================================
// api/hashtag.ts
// Mirrors TikTokApi/api/hashtag.py
// ============================================================

import type { TikTokApi } from "../tiktok";
import type { Video } from "./video";
import { InvalidResponseException, InvalidParameterException } from "../exceptions";
import { hashtagDetailResponseSchema, itemListResponseSchema } from "../schemas";
import { paginate } from "./_paginate";

export interface HashtagOptions {
  name?: string | null;
  id?: string | null;
  data?: Record<string, unknown> | null;
}

export class Hashtag {
  /** Static reference to the parent TikTokApi instance */
  parent: TikTokApi;

  /** The ID of the hashtag */
  id?: string;
  /** The name of the hashtag (without #) */
  name?: string;
  /** The raw data associated with this hashtag */
  asDict?: Record<string, unknown>;
  /** Additional split name if available */
  splitName?: string;
  /** Stats if available */
  stats?: Record<string, unknown>;

  constructor(parent: TikTokApi, { name, id, data }: HashtagOptions = {}) {
    this.parent = parent;
    if (name != null) this.name = name;
    if (id != null) this.id = id;

    if (data) {
      this.asDict = data;
      this._extractFromData();
    }
  }

  /**
   * Returns all information sent by TikTok related to this hashtag.
   *
   * @example
   * ```ts
   * const hashtag = api.hashtag({ name: 'funny' });
   * const hashtagData = await hashtag.info();
   * ```
   */
  async info(kwargs: {
    msToken?: string;
    headers?: Record<string, string>;
    sessionIndex?: number;
  } = {}): Promise<Record<string, unknown>> {
    if (!this.name) {
      throw new InvalidParameterException(
        null,
        "You must provide the name when creating this class to use this method."
      );
    }

    const urlParams: Record<string, unknown> = {
      challengeName: this.name,
      msToken: kwargs.msToken,
    };

    const resp = await this.parent.makeRequest({
      url: "https://www.tiktok.com/api/challenge/detail/",
      params: urlParams,
      headers: kwargs.headers,
      sessionIndex: kwargs.sessionIndex,
      schema: hashtagDetailResponseSchema,
    });

    if (resp == null) {
      throw new InvalidResponseException(resp, "TikTok returned an invalid response.");
    }

    this.asDict = resp;
    this._extractFromData();
    return resp;
  }

  /**
   * Returns TikTok videos with this hashtag.
   *
   * @example
   * ```ts
   * for await (const video of api.hashtag({ name: 'funny' }).videos()) {
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
      url: "https://www.tiktok.com/api/challenge/item_list/",
      schema: itemListResponseSchema,
      buildParams: (c) => ({ challengeID: this.id, count: 30, cursor: c }),
      getItems: (resp) => resp.itemList,
      build: (item) => this.parent.video({ data: item }),
      count,
      cursor,
      headers: kwargs.headers,
      sessionIndex: kwargs.sessionIndex,
    });
  }

  private _extractFromData(): void {
    const data = this.asDict ?? {};
    const keys = Object.keys(data);

    if (keys.includes("title")) {
      this.id = data["id"] as string;
      this.name = data["title"] as string;
    }

    if (keys.includes("challengeInfo")) {
      const challengeInfo = data["challengeInfo"] as Record<string, unknown>;
      if (challengeInfo["challenge"]) {
        const challenge = challengeInfo["challenge"] as Record<string, string>;
        this.id = challenge["id"];
        this.name = challenge["title"];
        this.splitName = challenge["splitTitle"];
      }
      if (challengeInfo["stats"]) {
        this.stats = challengeInfo["stats"] as Record<string, unknown>;
      }
    }

    if (!this.id || !this.name) {
      this.parent.logger.error(
        `Failed to create Hashtag with data: ${JSON.stringify(data)}`
      );
    }
  }

  toString(): string {
    return `TikTokApi.hashtag(id='${this.id}', name='${this.name}')`;
  }
}

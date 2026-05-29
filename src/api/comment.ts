// ============================================================
// api/comment.ts
// Mirrors TikTokApi/api/comment.py
// ============================================================

import type { TikTokApi } from "../tiktok";
import type { User } from "./user";
import { InvalidResponseException } from "../exceptions";

export class Comment {
  /** Static reference to the parent TikTokApi instance */
  static parent: TikTokApi;

  /** The id of the comment */
  id!: string;
  /** The author of the comment */
  author!: User;
  /** The text content of the comment */
  text!: string;
  /** The number of likes on the comment */
  likesCount!: number;
  /** The raw data associated with this comment */
  asDict: Record<string, unknown>;

  constructor(data?: Record<string, unknown>) {
    this.asDict = data ?? {};
    if (data) {
      this._extractFromData();
    }
  }

  private _extractFromData(): void {
    const data = this.asDict;
    this.id = data["cid"] as string;
    this.text = data["text"] as string;

    const usr = data["user"] as Record<string, string>;
    this.author = Comment.parent.user({
      userId: usr["uid"],
      username: usr["unique_id"],
      secUid: usr["sec_uid"],
    });
    this.likesCount = data["digg_count"] as number;
  }

  /**
   * Returns reply comments for this comment.
   *
   * @example
   * ```ts
   * for await (const reply of comment.replies()) {
   *   console.log(reply.text);
   * }
   * ```
   */
  async *replies(
    count = 20,
    cursor = 0,
    kwargs: { headers?: Record<string, string>; sessionIndex?: number } = {}
  ): AsyncGenerator<Comment> {
    let found = 0;

    while (found < count) {
      const params: Record<string, unknown> = {
        count: 20,
        cursor,
        item_id: this.author.userId,
        comment_id: this.id,
      };

      const resp = await Comment.parent.makeRequest({
        url: "https://www.tiktok.com/api/comment/list/reply/",
        params,
        headers: kwargs.headers,
        sessionIndex: kwargs.sessionIndex,
      });

      if (resp == null) {
        throw new InvalidResponseException(resp, "TikTok returned an invalid response.");
      }

      const comments = (resp["comments"] as Record<string, unknown>[]) ?? [];
      for (const comment of comments) {
        yield Comment.parent.comment({ data: comment });
        found++;
      }

      if (!resp["has_more"]) return;
      cursor = resp["cursor"] as number;
    }
  }

  toString(): string {
    return `TikTokApi.comment(comment_id='${this.id}', text='${this.text}')`;
  }
}

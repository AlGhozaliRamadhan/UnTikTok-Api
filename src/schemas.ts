// ============================================================
// schemas.ts — Runtime validation boundary for TikTok responses (ADR-007)
// ============================================================
//
// `makeRequest` returns `Record<string, unknown>` today; every consumer
// immediately `as`-casts the response. These zod schemas validate the
// response shape at the boundary and normalize the `hasMore`/`has_more`
// casing drift (ADR-008 will consume the normalized `hasMore`).
//
// Design:
//   - List schemas are STRICT (unknown envelope keys stripped) so consumers
//     get a clean, typed `{ status_code, <listKey>, hasMore, cursor }`.
//   - Detail schemas use `.passthrough()` because resource classes read many
//     dynamic top-level keys in `_extractFromData`; we validate the envelope
//     (`status_code` + the detail key) but preserve the rest.
//   - `hasMore`/`has_more` collapse to a single boolean `hasMore`.
//   - Missing list keys default to `[]` to match the existing `?? []` idiom.
//
// This module defines schemas + types only. Wiring into `makeRequest` is a
// follow-up commit; nothing here changes runtime behaviour.

import { z } from "zod";

// ── Shared pieces ──────────────────────────────────────────────

/** A single TikTok item — validated only as a JSON object. The inner shape is
 *  narrowed by each resource class's `_extractFromData`, not by the boundary. */
export const tiktokItemSchema = z.record(z.string(), z.unknown());

/** `status_code`: 0 (or absent) = OK; non-zero is dispatched by `makeRequest`
 *  (ADR-010). Validated as a number here; string codes like `"captcha"` are
 *  handled before this schema runs. */
export const statusCodeSchema = z.number().optional();

/** Cursor: numeric, defaults to 0 when absent. */
export const cursorSchema = z.number().optional();

/** Pagination flag — TikTok emits both `hasMore` (camel) and `has_more`
 *  (snake) depending on the endpoint. Both are accepted; the transform on
 *  each list schema normalizes to `hasMore`. */
const paginationFlagSchema = z.boolean().optional();

/** Coalesce `hasMore`/`has_more` into a single boolean (false when absent). */
function normalizeHasMore(d: {
  hasMore?: boolean;
  has_more?: boolean;
}): boolean {
  return d.hasMore ?? d.has_more ?? false;
}

// ── 1. ItemListResponse ─────────────────────────────────────────
// Used by: user.videos, user.liked, user.reposts, user.favorited,
// hashtag.videos, sound.videos, playlist.videos, video.relatedVideos.

export const itemListResponseSchema = z
  .object({
    status_code: statusCodeSchema,
    itemList: z.array(tiktokItemSchema).default([]),
    hasMore: paginationFlagSchema,
    has_more: paginationFlagSchema,
    cursor: cursorSchema,
  })
  .transform((d) => ({
    status_code: d.status_code,
    itemList: d.itemList,
    hasMore: normalizeHasMore(d),
    cursor: d.cursor ?? 0,
  }));

export type ItemListResponse = z.infer<typeof itemListResponseSchema>;

// ── 2. UserInfoResponse ─────────────────────────────────────────
// Used by: user.info. `userInfo.user` / `userInfo.stats` are the canonical
// shape; `_extractFromData` also falls back to top-level `id`/`secUid`/
// `uniqueId`, so we keep the envelope permissive via `.passthrough()`.

export const userInfoResponseSchema = z
  .object({
    status_code: statusCodeSchema,
    userInfo: z
      .object({
        user: z.record(z.string(), z.unknown()).optional(),
        stats: z.record(z.string(), z.unknown()).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type UserInfoResponse = z.infer<typeof userInfoResponseSchema>;

// ── 3. HashtagDetailResponse ────────────────────────────────────
// Used by: hashtag.info. `challengeInfo.challenge` carries `id`/`title`/
// `splitTitle`; `challengeInfo.stats` carries view counts.

export const hashtagDetailResponseSchema = z
  .object({
    status_code: statusCodeSchema,
    challengeInfo: z
      .object({
        challenge: z.record(z.string(), z.unknown()).optional(),
        stats: z.record(z.string(), z.unknown()).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type HashtagDetailResponse = z.infer<typeof hashtagDetailResponseSchema>;

// ── 4. SoundDetailResponse ──────────────────────────────────────
// Used by: sound.info. `musicInfo.music` carries `title`/`id`/`playUrl`/...
// `musicInfo.author` may be an object or a username string.

export const soundDetailResponseSchema = z
  .object({
    status_code: statusCodeSchema,
    musicInfo: z
      .object({
        music: z.record(z.string(), z.unknown()).optional(),
        author: z.union([z.record(z.string(), z.unknown()), z.string()]).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type SoundDetailResponse = z.infer<typeof soundDetailResponseSchema>;

// ── 5. PlaylistDetailResponse ──────────────────────────────────
// Used by: playlist.info. The detail key is `mixInfo`.

export const playlistDetailResponseSchema = z
  .object({
    status_code: statusCodeSchema,
    mixInfo: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export type PlaylistDetailResponse = z.infer<typeof playlistDetailResponseSchema>;

// ── 6. SearchResponse ───────────────────────────────────────────
// Used by: search.searchType. Note the snake_case list keys (`user_list` /
// `item_list`) and snake_case pagination — this endpoint is fully snake_case.
// Both list keys are optional (only one is populated per `objType`).

export const searchResponseSchema = z
  .object({
    status_code: statusCodeSchema,
    user_list: z.array(tiktokItemSchema).default([]),
    item_list: z.array(tiktokItemSchema).default([]),
    hasMore: paginationFlagSchema,
    has_more: paginationFlagSchema,
    cursor: cursorSchema,
    rid: z.string().optional(),
  })
  .passthrough()
  .transform((d) => ({
    ...d,
    hasMore: normalizeHasMore(d),
  }));

export type SearchResponse = z.infer<typeof searchResponseSchema>;

// ── 7. CommentListResponse ──────────────────────────────────────
// Used by: comment.replies, video.comments. Snake_case `has_more`.

export const commentListResponseSchema = z
  .object({
    status_code: statusCodeSchema,
    comments: z.array(tiktokItemSchema).default([]),
    hasMore: paginationFlagSchema,
    has_more: paginationFlagSchema,
    cursor: cursorSchema,
  })
  .transform((d) => ({
    status_code: d.status_code,
    comments: d.comments,
    hasMore: normalizeHasMore(d),
    cursor: d.cursor ?? 0,
  }));

export type CommentListResponse = z.infer<typeof commentListResponseSchema>;

// ── 8. TrendingFeedResponse ─────────────────────────────────────
// Used by: trending.videos. Structurally identical to ItemListResponse;
// aliased for endpoint clarity and so a future shape divergence is a one-line
// change rather than a shared-schema surprise.

export const trendingFeedResponseSchema = z
  .object({
    status_code: statusCodeSchema,
    itemList: z.array(tiktokItemSchema).default([]),
    hasMore: paginationFlagSchema,
    has_more: paginationFlagSchema,
    cursor: cursorSchema,
  })
  .transform((d) => ({
    status_code: d.status_code,
    itemList: d.itemList,
    hasMore: normalizeHasMore(d),
    cursor: d.cursor ?? 0,
  }));

export type TrendingFeedResponse = z.infer<typeof trendingFeedResponseSchema>;

// ── Variants consumed by user.ts (not in the ADR's named 8, but real list
//    responses that commit 2 will wire). Kept here so all schemas ship together.

/** user.followersList / user.followingList — `userList` + `minCursor`/`maxCursor`. */
export const userListResponseSchema = z
  .object({
    status_code: statusCodeSchema,
    userList: z.array(tiktokItemSchema).default([]),
    hasMore: paginationFlagSchema,
    has_more: paginationFlagSchema,
    minCursor: cursorSchema,
    maxCursor: cursorSchema,
  })
  .transform((d) => ({
    status_code: d.status_code,
    userList: d.userList,
    hasMore: normalizeHasMore(d),
    minCursor: d.minCursor ?? 0,
    maxCursor: d.maxCursor ?? 0,
  }));

export type UserListResponse = z.infer<typeof userListResponseSchema>;

/** user.playlists — `playList` (camelCase) + `hasMore` + `cursor`. */
export const userPlaylistResponseSchema = z
  .object({
    status_code: statusCodeSchema,
    playList: z.array(tiktokItemSchema).default([]),
    hasMore: paginationFlagSchema,
    has_more: paginationFlagSchema,
    cursor: cursorSchema,
  })
  .transform((d) => ({
    status_code: d.status_code,
    playList: d.playList,
    hasMore: normalizeHasMore(d),
    cursor: d.cursor ?? 0,
  }));

export type UserPlaylistResponse = z.infer<typeof userPlaylistResponseSchema>;

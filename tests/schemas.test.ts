import { describe, it, expect } from "vitest";
import {
  itemListResponseSchema,
  userInfoResponseSchema,
  hashtagDetailResponseSchema,
  soundDetailResponseSchema,
  playlistDetailResponseSchema,
  searchResponseSchema,
  commentListResponseSchema,
  trendingFeedResponseSchema,
  userListResponseSchema,
  userPlaylistResponseSchema,
} from "../src/schemas";

// ============================================================
// ADR-007 boundary schemas — shape validation + hasMore/has_more
// normalization. No live network; fixtures are hand-shaped.
// ============================================================

describe("itemListResponseSchema (ADR-007)", () => {
  it("normalizes camelCase hasMore and keeps itemList/cursor", () => {
    const out = itemListResponseSchema.parse({
      status_code: 0,
      itemList: [{ id: "1" }, { id: "2" }],
      hasMore: true,
      cursor: 30,
    });
    expect(out.itemList).toHaveLength(2);
    expect(out.hasMore).toBe(true);
    expect(out.cursor).toBe(30);
    expect(out.status_code).toBe(0);
  });

  it("normalizes snake_case has_more -> hasMore (ADR-008 casing drift)", () => {
    const out = itemListResponseSchema.parse({
      status_code: 0,
      itemList: [],
      has_more: true,
      cursor: 0,
    });
    expect(out.hasMore).toBe(true);
  });

  it("defaults absent hasMore/has_more to false", () => {
    const out = itemListResponseSchema.parse({ status_code: 0, itemList: [] });
    expect(out.hasMore).toBe(false);
    expect(out.cursor).toBe(0);
  });

  it("defaults absent itemList to [] (matches existing ?? [] idiom)", () => {
    const out = itemListResponseSchema.parse({ status_code: 0 });
    expect(out.itemList).toEqual([]);
  });

  it("rejects a non-array itemList", () => {
    expect(() =>
      itemListResponseSchema.parse({ status_code: 0, itemList: "nope" })
    ).toThrow();
  });

  it("strips unknown envelope keys (strict list envelope)", () => {
    const out = itemListResponseSchema.parse({
      status_code: 0,
      itemList: [],
      hasMore: false,
      cursor: 0,
      extraRandomKey: "should-be-stripped",
    });
    expect((out as Record<string, unknown>)["extraRandomKey"]).toBeUndefined();
  });
});

describe("userInfoResponseSchema (ADR-007)", () => {
  it("parses the canonical userInfo.user / userInfo.stats shape", () => {
    const out = userInfoResponseSchema.parse({
      status_code: 0,
      userInfo: {
        user: { id: "1", secUid: "x", uniqueId: "therock" },
        stats: { followerCount: 999 },
      },
    });
    expect(out.userInfo?.user?.["id"]).toBe("1");
    expect(out.userInfo?.stats?.["followerCount"]).toBe(999);
  });

  it("preserves extra envelope keys (passthrough) for _extractFromData fallbacks", () => {
    const out = userInfoResponseSchema.parse({
      status_code: 0,
      id: "top-level-id",
      secUid: "top-level-sec",
      uniqueId: "top-level-unique",
    }) as Record<string, unknown>;
    expect(out["id"]).toBe("top-level-id");
    expect(out["secUid"]).toBe("top-level-sec");
    expect(out["uniqueId"]).toBe("top-level-unique");
  });

  it("accepts a response with no userInfo (loose detail envelope)", () => {
    const out = userInfoResponseSchema.parse({ status_code: 0 });
    expect(out.userInfo).toBeUndefined();
  });
});

describe("hashtagDetailResponseSchema (ADR-007)", () => {
  it("parses challengeInfo.challenge + stats", () => {
    const out = hashtagDetailResponseSchema.parse({
      status_code: 0,
      challengeInfo: {
        challenge: { id: "1", title: "funny", splitTitle: "fun ny" },
        stats: { viewCount: 10 },
      },
    });
    expect(out.challengeInfo?.challenge?.["title"]).toBe("funny");
    expect(out.challengeInfo?.stats?.["viewCount"]).toBe(10);
  });

  it("preserves top-level title/id fallback keys (passthrough)", () => {
    const out = hashtagDetailResponseSchema.parse({
      status_code: 0,
      title: "funny",
      id: "1",
    }) as Record<string, unknown>;
    expect(out["title"]).toBe("funny");
    expect(out["id"]).toBe("1");
  });
});

describe("soundDetailResponseSchema (ADR-007)", () => {
  it("parses musicInfo.music + author (object form)", () => {
    const out = soundDetailResponseSchema.parse({
      status_code: 0,
      musicInfo: {
        music: { id: "1", title: "song", playUrl: "u" },
        author: { uniqueId: "artist" },
      },
    });
    expect(out.musicInfo?.music?.["title"]).toBe("song");
    expect(out.musicInfo?.author).toEqual({ uniqueId: "artist" });
  });

  it("accepts author as a plain username string", () => {
    const out = soundDetailResponseSchema.parse({
      status_code: 0,
      musicInfo: { music: { id: "1" }, author: "artist-name" },
    });
    expect(out.musicInfo?.author).toBe("artist-name");
  });

  it("preserves top-level music fallback key (passthrough)", () => {
    const out = soundDetailResponseSchema.parse({
      status_code: 0,
      music: { id: "1", title: "song" },
    }) as Record<string, unknown>;
    expect((out["music"] as { title: string }).title).toBe("song");
  });
});

describe("playlistDetailResponseSchema (ADR-007)", () => {
  it("parses mixInfo", () => {
    const out = playlistDetailResponseSchema.parse({
      status_code: 0,
      mixInfo: { id: "1", mixName: "p", videoCount: 5 },
    });
    expect(out.mixInfo?.["mixName"]).toBe("p");
  });

  it("tolerates absent mixInfo (passthrough detail envelope)", () => {
    const out = playlistDetailResponseSchema.parse({ status_code: 0 });
    expect(out.mixInfo).toBeUndefined();
  });
});

describe("searchResponseSchema (ADR-007)", () => {
  it("parses user_list and normalizes has_more -> hasMore", () => {
    const out = searchResponseSchema.parse({
      status_code: 0,
      user_list: [{ user_info: { unique_id: "u", sec_uid: "s", user_id: "1" } }],
      has_more: true,
      cursor: 10,
      rid: "abc",
    });
    expect(out.user_list).toHaveLength(1);
    expect(out.hasMore).toBe(true);
    expect(out.rid).toBe("abc");
  });

  it("parses item_list for item searches", () => {
    const out = searchResponseSchema.parse({
      status_code: 0,
      item_list: [{ id: "v1" }],
      has_more: false,
      cursor: 0,
    });
    expect(out.item_list).toHaveLength(1);
    expect(out.hasMore).toBe(false);
  });

  it("defaults both list keys to []", () => {
    const out = searchResponseSchema.parse({ status_code: 0 });
    expect(out.user_list).toEqual([]);
    expect(out.item_list).toEqual([]);
  });
});

describe("commentListResponseSchema (ADR-007)", () => {
  it("parses comments + snake_case has_more", () => {
    const out = commentListResponseSchema.parse({
      status_code: 0,
      comments: [{ cid: "1", text: "hi" }],
      has_more: true,
      cursor: 20,
    });
    expect(out.comments).toHaveLength(1);
    expect(out.hasMore).toBe(true);
    expect(out.cursor).toBe(20);
  });

  it("defaults absent comments to []", () => {
    const out = commentListResponseSchema.parse({ status_code: 0 });
    expect(out.comments).toEqual([]);
  });
});

describe("trendingFeedResponseSchema (ADR-007)", () => {
  it("parses itemList + hasMore", () => {
    const out = trendingFeedResponseSchema.parse({
      status_code: 0,
      itemList: [{ id: "1" }],
      hasMore: true,
      cursor: 0,
    });
    expect(out.itemList).toHaveLength(1);
    expect(out.hasMore).toBe(true);
  });
});

describe("userListResponseSchema (ADR-007 variant)", () => {
  it("parses userList + minCursor/maxCursor + hasMore", () => {
    const out = userListResponseSchema.parse({
      status_code: 0,
      userList: [{ id: "1" }],
      hasMore: true,
      minCursor: 5,
      maxCursor: 10,
    });
    expect(out.userList).toHaveLength(1);
    expect(out.hasMore).toBe(true);
    expect(out.minCursor).toBe(5);
    expect(out.maxCursor).toBe(10);
  });

  it("defaults absent cursors to 0", () => {
    const out = userListResponseSchema.parse({ status_code: 0, userList: [] });
    expect(out.minCursor).toBe(0);
    expect(out.maxCursor).toBe(0);
  });
});

describe("userPlaylistResponseSchema (ADR-007 variant)", () => {
  it("parses playList + hasMore + cursor", () => {
    const out = userPlaylistResponseSchema.parse({
      status_code: 0,
      playList: [{ id: "1" }],
      hasMore: true,
      cursor: 20,
    });
    expect(out.playList).toHaveLength(1);
    expect(out.hasMore).toBe(true);
    expect(out.cursor).toBe(20);
  });
});

describe("hasMore/has_more precedence (ADR-008 foundation)", () => {
  it("prefers explicit hasMore when both are present", () => {
    const out = itemListResponseSchema.parse({
      status_code: 0,
      itemList: [],
      hasMore: false,
      has_more: true,
    });
    expect(out.hasMore).toBe(false);
  });
});

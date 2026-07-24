// ============================================================
// api/video.ts
// Mirrors TikTokApi/api/video.py — corrected vs Python source
// ============================================================

import axios from "axios";
import type { ITikTokApi, TikTokPlaywrightSession } from "../types";
import type { User } from "./user";
import type { Sound } from "./sound";
import type { Hashtag } from "./hashtag";
import type { Comment } from "./comment";
import {
  InvalidResponseException,
  InvalidParameterException,
  EmptyResponseException,
} from "../exceptions";
import { itemListResponseSchema, commentListResponseSchema } from "../schemas";
import { paginate } from "./_paginate";

export interface VideoOptions {
  id?: string | null | undefined;
  url?: string | null | undefined;
  data?: Record<string, unknown> | null | undefined;
  sessionIndex?: number | undefined;
  proxy?: string | null | undefined;
}

export class Video {
  /** Static reference to the parent TikTokApi instance */
  parent: ITikTokApi;

  /** TikTok's ID of the Video */
  id?: string | undefined;
  /** The URL of the Video */
  url?: string | undefined;
  /** The creation time of the Video */
  createTime?: Date;
  /** TikTok's stats for the Video */
  stats?: Record<string, unknown> | undefined;
  /** The User who created the Video */
  author?: User;
  /** The Sound associated with the Video */
  sound?: Sound;
  /** A list of Hashtags on the Video */
  hashtags?: Hashtag[];
  /** The raw data associated with this Video */
  asDict?: Record<string, unknown>;

  /** Gets the description/caption of the video */
  get description(): string | null {
    return (this.asDict?.["desc"] as string) ?? null;
  }

  /** Gets the play/view count of the video */
  get plays(): number {
    return (this.stats?.["playCount"] as number) || 0;
  }

  /** Gets the digg/like count of the video */
  get likes(): number {
    return (this.stats?.["diggCount"] as number) || 0;
  }

  /** Gets the comment count of the video */
  get commentsCount(): number {
    return (this.stats?.["commentCount"] as number) || 0;
  }

  /** Gets the share count of the video */
  get shares(): number {
    return (this.stats?.["shareCount"] as number) || 0;
  }

  /** Gets the collect/save count of the video */
  get saves(): number {
    return (this.stats?.["collectCount"] as number) || 0;
  }

  /** Gets whether the video is pinned by the creator */
  get isPinned(): boolean {
    const itemControl = this.asDict?.["itemControl"] as Record<string, unknown> | undefined;
    return Boolean(this.asDict?.["isPinnedItem"]) || Boolean(itemControl?.["isPinned"]);
  }

  constructor(parent: ITikTokApi, { id, url, data, sessionIndex, proxy }: VideoOptions = {}) {
    this.parent = parent;
    this.id = id ?? undefined;
    this.url = url ?? undefined;

    if (data) {
      this.asDict = data;
      this._extractFromData();
    } else if (url) {
      // Extract id synchronously when the URL already embeds /video/{id}.
      // Short/redirect URLs must use the async Video.fromUrl() factory instead
      // (which validates a live session via _getValidSessionIndex).
      // sessionIndex/proxy are accepted for API parity with fromUrl but are
      // unused until a network hop is required.
      void sessionIndex;
      void proxy;
      if (url.includes("/video/")) {
        this.id = url.split("/video/")[1]!.split("?")[0];
      }
    }

    if (!this.id && !this.url) {
      if (data) {
        this.parent.logger.warn(`Video data provided is missing 'id': ${JSON.stringify(data)}`);
      } else {
        throw new InvalidParameterException(
          null,
          "You must provide id or url parameter."
        );
      }
    }
  }

  /**
   * Async factory that follows redirects to resolve the video ID from a short URL.
   * Use this instead of `new Video({ url })` when you have a short/redirect URL.
   */
  static async fromUrl(
    parent: ITikTokApi,
    url: string,
    kwargs: { sessionIndex?: number; proxy?: string } = {}
  ): Promise<Video> {
    const [, session] = await parent._getValidSessionIndex({
      sessionIndex: kwargs.sessionIndex,
    });
    // proxy reserved for future HEAD-via-proxy; prefer session headers today
    void kwargs.proxy;

    const response = await axios.head(url, {
      headers: session.headers ?? {},
      maxRedirects: 10,
    });
    const finalUrl: string =
      (response.request as { res?: { responseUrl?: string } })?.res?.responseUrl ?? url;

    if (finalUrl.includes("@") && finalUrl.includes("/video/")) {
      const videoId = finalUrl.split("/video/")[1]!.split("?")[0];
      return new Video(parent, { id: videoId, url });
    }
    throw new InvalidParameterException(
      null,
      "URL format not supported. Example:\nhttps://www.tiktok.com/@therock/video/6829267836783971589"
    );
  }

  /**
   * Returns a dictionary of all data associated with a TikTok Video.
   * Note: This is slow since it requires an HTTP request.
   *
   * Python uses `requests.get`; TS uses `axios.get` (equivalent sync-style).
   *
   * @example
   * ```ts
   * const info = await api.video({ url: 'https://www.tiktok.com/@.../video/...' }).info();
   * ```
   */
  async info(kwargs: {
    headers?: Record<string, string>;
    sessionIndex?: number;
    proxy?: string;
  } = {}): Promise<Record<string, unknown>> {
    const [, session] = await this.parent._getValidSessionIndex({
      sessionIndex: kwargs.sessionIndex,
    });
    // proxy reserved for axios fallback path; unused when browser navigation works
    void kwargs.proxy;

    if (!this.url) {
      throw new InvalidParameterException(
        null,
        "To call video.info() you need to set the video's url."
      );
    }

    const { text, statusCode, setCookieHeader } = await this._fetchPageHtml(session);

    const videoInfo = this._parseVideoPayload(text, statusCode);
    this.asDict = videoInfo;
    this._extractFromData();

    if (setCookieHeader) {
      await this._storeSetCookies(setCookieHeader, session);
    }

    return videoInfo;
  }

  /**
   * Pull the video page's HTML. Prefers browser navigation (preserves the
   * live session's fingerprint); falls back to a direct axios GET if the
   * page won't render the SIGI/REHYDRATION script tags (rare, but observed
   * when TikTok bot-walls the navigation).
   */
  private async _fetchPageHtml(
    session: TikTokPlaywrightSession
  ): Promise<{
    text: string;
    statusCode: number;
    setCookieHeader: string | string[] | undefined;
  }> {
    const url = this.url!;
    try {
      await session.page.goto(url, { waitUntil: "domcontentloaded" });
      let found = false;
      const maxAttempts = 15;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const hasTag = await session.page.evaluate(() => {
          return !!(
            document?.getElementById("__UNIVERSAL_DATA_FOR_REHYDRATION__") ||
            document?.getElementById("SIGI_STATE")
          );
        });
        if (hasTag) {
          found = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      if (!found) {
        throw new EmptyResponseException(
          { url },
          "Script tags (__UNIVERSAL_DATA_FOR_REHYDRATION__ or SIGI_STATE) not found in page DOM after timeout."
        );
      }
      const text = await session.page.content();
      return { text, statusCode: 200, setCookieHeader: undefined };
    } catch (fetchErr) {
      this.parent.logger.warn(
        `Browser navigation failed for video.info(), falling back to axios: ${fetchErr}`
      );
      const response = await axios.get<string>(url, {
        headers: session.headers ?? {},
        responseType: "text",
      });

      if (response.status !== 200) {
        throw new InvalidResponseException(
          response.data,
          "TikTok returned an invalid response.",
          response.status
        );
      }
      return {
        text: response.data,
        statusCode: response.status,
        setCookieHeader: response.headers["set-cookie"],
      };
    }
  }

  /**
   * Pull the JSON video payload out of a rendered page. Tries SIGI_STATE
   * first (older layout), then __UNIVERSAL_DATA_FOR_REHYDRATION__ (newer).
   */
  private _parseVideoPayload(text: string, statusCode: number): Record<string, unknown> {
    const sigiParsed = this._parseSigiState(text, statusCode);
    if (sigiParsed) return sigiParsed;

    const rehydParsed = this._parseRehydrationState(text, statusCode);
    if (rehydParsed) return rehydParsed;

    throw new InvalidResponseException(
      text,
      "TikTok returned an invalid response.",
      statusCode
    );
  }

  private _parseSigiState(
    text: string,
    statusCode: number
  ): Record<string, unknown> | null {
    const sigiTag = '<script id="SIGI_STATE" type="application/json">';
    const sigiStart = text.indexOf(sigiTag);
    if (sigiStart === -1) return null;

    const contentStart = sigiStart + sigiTag.length;
    const contentEnd = text.indexOf("</script>", contentStart);
    if (contentEnd === -1) {
      throw new InvalidResponseException(
        text,
        "TikTok returned an invalid response.",
        statusCode
      );
    }
    const data = JSON.parse(text.slice(contentStart, contentEnd)) as Record<
      string,
      Record<string, unknown>
    >;
    const itemModule = data["ItemModule"];
    if (!itemModule) {
      throw new InvalidResponseException(
        text,
        "TikTok returned an invalid response. 'ItemModule' not found in SIGI_STATE.",
        statusCode
      );
    }
    const videoInfo = itemModule[this.id!] as Record<string, unknown> | undefined;
    if (!videoInfo) {
      throw new InvalidResponseException(
        text,
        `TikTok returned an invalid response. Video ID ${this.id} not found in ItemModule.`,
        statusCode
      );
    }
    return videoInfo;
  }

  private _parseRehydrationState(
    text: string,
    statusCode: number
  ): Record<string, unknown> | null {
    const rehydTag = '<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">';
    const rehydStart = text.indexOf(rehydTag);
    if (rehydStart === -1) return null;

    const contentStart = rehydStart + rehydTag.length;
    const contentEnd = text.indexOf("</script>", contentStart);
    if (contentEnd === -1) {
      throw new InvalidResponseException(
        text,
        "TikTok returned an invalid response.",
        statusCode
      );
    }

    const data = JSON.parse(text.slice(contentStart, contentEnd)) as Record<string, unknown>;
    const defaultScope = (data["__DEFAULT_SCOPE__"] ?? {}) as Record<string, unknown>;
    const videoDetail = (defaultScope["webapp.video-detail"] ?? {}) as Record<string, unknown>;

    if ((videoDetail["statusCode"] ?? 0) !== 0) {
      throw new InvalidResponseException(
        text,
        "TikTok returned an invalid response structure.",
        statusCode
      );
    }

    const videoInfo = (videoDetail["itemInfo"] as Record<string, unknown>)?.["itemStruct"] as
      | Record<string, unknown>
      | undefined;
    if (!videoInfo) {
      throw new InvalidResponseException(
        text,
        "TikTok returned an invalid response structure.",
        statusCode
      );
    }
    return videoInfo;
  }

  /**
   * Convert Set-Cookie headers from the axios fallback into Playwright
   * cookie format and persist them on the live session. Mirrors Python's
   * `requests_cookie_to_playwright_cookie`.
   */
  private async _storeSetCookies(
    setCookieHeader: string | string[],
    session: TikTokPlaywrightSession
  ): Promise<void> {
    const cookies = _parseCookieHeaders(setCookieHeader, this.url!);
    await this.parent.setSessionCookies(session, cookies);
  }

  /**
   * Returns the raw bytes of a TikTok Video.
   *
   * Python uses `requests.get` / `httpx.AsyncClient` for streaming.
   * TS uses `axios` equivalents.
   *
   * @example
   * ```ts
   * const buf = await video.bytes() as Buffer;
   * fs.writeFileSync('video.mp4', buf);
   *
   * // Streaming
   * for await (const chunk of await video.bytes({ stream: true }) as AsyncGenerator<Buffer>) { ... }
   * ```
   */
  async bytes(options: { stream?: boolean } & Record<string, unknown> = {}): Promise<Buffer | AsyncGenerator<Buffer>> {
    const sessionIndex =
      typeof options.sessionIndex === "number" ? options.sessionIndex : undefined;
    const [, session] = await this.parent._getValidSessionIndex({ sessionIndex });
    const videoData = (this.asDict?.["video"] ?? {}) as Record<string, string>;
    const downloadAddr = videoData["downloadAddr"] || videoData["playAddr"];

    if (!downloadAddr) {
      throw new EmptyResponseException(
        { id: this.id, url: this.url },
        "No download address found. Have you called .info() first?"
      );
    }

    // Python sets cookies as a dict directly from get_session_cookies
    const cookies = await this.parent.getSessionCookies(session);
    const cookieString = Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");

    // Python mutates session.headers — we create a shallow copy here
    const headers: Record<string, string> = {
      ...(session.headers ?? {}),
      range: "bytes=0-",
      "accept-encoding": "identity;q=1, *;q=0",
      referer: "https://www.tiktok.com/",
      cookie: cookieString,
    };

    if (options.stream) {
      async function* streamGen(): AsyncGenerator<Buffer> {
        const resp = await axios.get<NodeJS.ReadableStream>(downloadAddr!, {
          headers,
          responseType: "stream",
        });
        if (!resp.data) throw new InvalidResponseException(null, "No stream data received", resp.status ?? undefined);
        for await (const chunk of resp.data) {
          // cast via unknown to avoid TS string↔Uint8Array overlap error
          yield Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as unknown as Uint8Array);
        }
      }
      return streamGen();
    } else {
      // Python: resp = requests.get(downloadAddr, headers=h, cookies=cookies)
      //         return resp.content
      const resp = await axios.get<ArrayBuffer>(downloadAddr, {
        headers,
        responseType: "arraybuffer",
      });
      return Buffer.from(resp.data);
    }
  }

  /**
   * Returns the comments of a TikTok Video.
   *
   * Python key: `has_more` (snake_case) — preserved in TS.
   *
   * @example
   * ```ts
   * for await (const comment of video.comments(20)) { ... }
   * ```
   */
  async *comments(
    count = 20,
    cursor = 0,
    kwargs: { headers?: Record<string, string>; sessionIndex?: number } = {}
  ): AsyncGenerator<Comment> {
    yield* paginate({
      parent: this.parent,
      url: "https://www.tiktok.com/api/comment/list/",
      schema: commentListResponseSchema,
      buildParams: (c) => ({ aweme_id: this.id, count: 20, cursor: c }),
      getItems: (resp) => resp.comments,
      build: (comment) => this.parent.comment({ data: comment }),
      count,
      cursor,
      headers: kwargs.headers,
      sessionIndex: kwargs.sessionIndex,
    });
  }

  /**
   * Returns related videos of a TikTok Video.
   * Note: Python's related_videos does NOT increment `found` after the inner loop — bug or intentional.
   * We preserve that exact behaviour (no double-increment).
   *
   * @example
   * ```ts
   * for await (const rel of video.relatedVideos(30)) { ... }
   * ```
   */
  async *relatedVideos(
    count = 30,
    cursor = 0,
    kwargs: { headers?: Record<string, string>; sessionIndex?: number } = {}
  ): AsyncGenerator<Video> {
    yield* paginate({
      parent: this.parent,
      url: "https://www.tiktok.com/api/related/item_list/",
      schema: itemListResponseSchema,
      buildParams: () => ({ itemID: this.id, count: 16 }),
      getItems: (resp) => resp.itemList,
      // The related-videos feed only ever gets fetched once by the original
      // client regardless of what `hasMore` says — preserve that single-page
      // behaviour explicitly instead of trusting the flag.
      getHasMore: () => false,
      build: (item) => this.parent.video({ data: item }),
      count,
      cursor,
      headers: kwargs.headers,
      sessionIndex: kwargs.sessionIndex,
    });
  }

  private _extractFromData(): void {
    const data = this.asDict!;
    this.id = data["id"] as string;

    const timestamp = data["createTime"];
    if (timestamp != null) {
      try {
        const ts = typeof timestamp === "string" ? parseInt(timestamp, 10) : (timestamp as number);
        this.createTime = new Date(ts * 1000);
      } catch {
        // ignore parse error
      }
    }

    // Python: self.stats = data.get("statsV2") or data.get("stats")
    this.stats = (data["statsV2"] ?? data["stats"]) as Record<string, unknown> | undefined;

    // Python: author = data.get("author"); if isinstance(author, str): ...
    const author = data["author"];
    if (typeof author === "string") {
      this.author = this.parent.user({ username: author });
    } else if (author) {
      this.author = this.parent.user({ data: author as Record<string, unknown> });
    }

    this.sound = this.parent.sound({ data: data });

    const challenges = (data["challenges"] as Record<string, unknown>[]) ?? [];
    this.hashtags = challenges.map((h) => this.parent.hashtag({ data: h }));

    if (!this.id) {
      this.parent.logger.error(
        `Failed to create Video with data: ${JSON.stringify(data)}`
      );
    }
  }

  toString(): string {
    return `TikTokApi.video(id='${this.id}')`;
  }
}

// ---------------------------------------------------------------------------
// Helper: parse Set-Cookie headers into Playwright cookie format
// (mirrors Python's requests_cookie_to_playwright_cookie)
// ---------------------------------------------------------------------------
function _parseCookieHeaders(
  setCookieHeader: string | string[],
  sourceUrl: string
): Record<string, unknown>[] {
  const headers = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  let domain = "";
  try { domain = new URL(sourceUrl).hostname; } catch { /* ignore */ }

  return headers.map((h) => {
    const parts = h.split(";").map((p) => p.trim());
    const [nameVal, ...attrs] = parts;
    const eqIdx = (nameVal ?? "").indexOf("=");
    const name = (nameVal ?? "").slice(0, eqIdx);
    const value = (nameVal ?? "").slice(eqIdx + 1);

    const cookie: Record<string, unknown> = { name, value, domain, path: "/" };
    for (const attr of attrs) {
      const lower = attr.toLowerCase();
      if (lower === "secure") cookie["secure"] = true;
      if (lower.startsWith("path=")) cookie["path"] = attr.slice(5);
      if (lower.startsWith("expires=")) {
        const exp = new Date(attr.slice(8)).getTime() / 1000;
        if (!isNaN(exp)) cookie["expires"] = exp;
      }
    }
    return cookie;
  });
}

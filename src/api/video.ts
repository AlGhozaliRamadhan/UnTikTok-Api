// ============================================================
// api/video.ts
// Mirrors TikTokApi/api/video.py — corrected vs Python source
// ============================================================

import axios from "axios";
import type { TikTokApi } from "../tiktok";
import type { User } from "./user";
import type { Sound } from "./sound";
import type { Hashtag } from "./hashtag";
import type { Comment } from "./comment";
import { InvalidResponseException } from "../exceptions";

export interface VideoOptions {
  id?: string | null;
  url?: string | null;
  data?: Record<string, unknown> | null;
  sessionIndex?: number;
  proxy?: string | null;
}

export class Video {
  /** Static reference to the parent TikTokApi instance */
  parent: TikTokApi;

  /** TikTok's ID of the Video */
  id?: string;
  /** The URL of the Video */
  url?: string;
  /** The creation time of the Video */
  createTime?: Date;
  /** TikTok's stats for the Video */
  stats?: Record<string, unknown>;
  /** The User who created the Video */
  author?: User;
  /** The Sound associated with the Video */
  sound?: Sound;
  /** A list of Hashtags on the Video */
  hashtags?: Hashtag[];
  /** The raw data associated with this Video */
  asDict?: Record<string, unknown>;

  constructor(parent: TikTokApi, { id, url, data, sessionIndex, proxy }: VideoOptions = {}) {
    this.parent = parent;
    this.id = id ?? undefined;
    this.url = url ?? undefined;

    if (data) {
      this.asDict = data;
      this._extractFromData();
    } else if (url) {
      // Python calls extract_video_id_from_url synchronously in __init__ using _get_session.
      // In TypeScript the session is synchronous too — we replicate that via the sync _getSession.
      const [, session] = this.parent._getSession({ sessionIndex });
      const proxyVal = proxy ?? (session.proxy as string | undefined);

      // Resolve synchronously: run a sync HEAD follow-redirect.
      // We extract the id by parsing the URL if it already contains /video/;
      // otherwise we schedule an async resolution and store the raw url.
      // If the url already has the video id embedded we resolve it immediately.
      if (url.includes("/video/")) {
        this.id = url.split("/video/")[1].split("?")[0];
      }
      // If not, the caller must await Video.fromUrl() instead.
    }

    if (!this.id && !this.url) {
      throw new TypeError("You must provide id or url parameter.");
    }
  }

  /**
   * Async factory that follows redirects to resolve the video ID from a short URL.
   * Use this instead of `new Video({ url })` when you have a short/redirect URL.
   */
  static async fromUrl(
    parent: TikTokApi,
    url: string,
    kwargs: { sessionIndex?: number; proxy?: string } = {}
  ): Promise<Video> {
    const [, session] = parent._getSession(kwargs);
    const proxyVal = kwargs.proxy ?? (session.proxy as string | undefined);

    const response = await axios.head(url, {
      headers: session.headers ?? {},
      maxRedirects: 10,
    });
    const finalUrl: string =
      (response.request as { res?: { responseUrl?: string } })?.res?.responseUrl ?? url;

    if (finalUrl.includes("@") && finalUrl.includes("/video/")) {
      const videoId = finalUrl.split("/video/")[1].split("?")[0];
      return new Video(parent, { id: videoId, url });
    }
    throw new TypeError(
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
    const [, session] = this.parent._getSession(kwargs);
    const proxy = kwargs.proxy ?? (session.proxy as string | undefined);

    if (!this.url) {
      throw new TypeError("To call video.info() you need to set the video's url.");
    }

    const response = await axios.get<string>(this.url, {
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

    const text = response.data;
    let videoInfo: Record<string, unknown>;

    // Try SIGI_STATE first (same logic as Python)
    const sigiTag = '<script id="SIGI_STATE" type="application/json">';
    const sigiStart = text.indexOf(sigiTag);
    if (sigiStart !== -1) {
      const contentStart = sigiStart + sigiTag.length;
      const contentEnd = text.indexOf("</script>", contentStart);
      if (contentEnd === -1) {
        throw new InvalidResponseException(text, "TikTok returned an invalid response.", response.status);
      }
      const data = JSON.parse(text.slice(contentStart, contentEnd)) as Record<string, Record<string, unknown>>;
      videoInfo = data["ItemModule"][this.id!] as Record<string, unknown>;
    } else {
      // Try __UNIVERSAL_DATA_FOR_REHYDRATION__
      const rehydTag = '<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">';
      const rehydStart = text.indexOf(rehydTag);
      if (rehydStart === -1) {
        throw new InvalidResponseException(text, "TikTok returned an invalid response.", response.status);
      }
      const contentStart = rehydStart + rehydTag.length;
      const contentEnd = text.indexOf("</script>", contentStart);
      if (contentEnd === -1) {
        throw new InvalidResponseException(text, "TikTok returned an invalid response.", response.status);
      }

      const data = JSON.parse(text.slice(contentStart, contentEnd)) as Record<string, unknown>;
      const defaultScope = (data["__DEFAULT_SCOPE__"] ?? {}) as Record<string, unknown>;
      const videoDetail = (defaultScope["webapp.video-detail"] ?? {}) as Record<string, unknown>;

      if ((videoDetail["statusCode"] ?? 0) !== 0) {
        throw new InvalidResponseException(text, "TikTok returned an invalid response structure.", response.status);
      }

      videoInfo = ((videoDetail["itemInfo"] as Record<string, unknown>)?.["itemStruct"]) as Record<string, unknown>;
      if (!videoInfo) {
        throw new InvalidResponseException(text, "TikTok returned an invalid response structure.", response.status);
      }
    }

    this.asDict = videoInfo;
    this._extractFromData();

    // Convert Set-Cookie headers to Playwright cookie format and store them
    // (mirrors Python's `requests_cookie_to_playwright_cookie`)
    const setCookieHeader = response.headers["set-cookie"];
    if (setCookieHeader) {
      const cookies = _parseCookieHeaders(setCookieHeader, this.url);
      await this.parent.setSessionCookies(session, cookies);
    }

    return videoInfo;
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
    // Python: i, session = self.parent._get_session(**kwargs)
    const [, session] = this.parent._getSession(options as { sessionIndex?: number });
    const videoData = (this.asDict?.["video"] ?? {}) as Record<string, string>;
    const downloadAddr = videoData["downloadAddr"] || videoData["playAddr"];

    if (!downloadAddr) {
      throw new Error("No download address found. Have you called .info() first?");
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
        const resp = await axios.get<NodeJS.ReadableStream>(downloadAddr, {
          headers,
          responseType: "stream",
        });
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
    let found = 0;

    while (found < count) {
      const params: Record<string, unknown> = {
        aweme_id: this.id,
        count: 20,
        cursor,
      };

      const resp = await this.parent.makeRequest({
        url: "https://www.tiktok.com/api/comment/list/",
        params,
        headers: kwargs.headers,
        sessionIndex: kwargs.sessionIndex,
      });

      if (resp == null) {
        throw new InvalidResponseException(resp, "TikTok returned an invalid response.");
      }

      const comments = (resp["comments"] as Record<string, unknown>[]) ?? [];
      for (const comment of comments) {
        yield this.parent.comment({ data: comment });
        found++;
      }

      // Python: if not resp.get("has_more", False): return
      if (!resp["has_more"]) return;
      cursor = resp["cursor"] as number;
    }
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
    let found = 0;

    while (found < count) {
      const params: Record<string, unknown> = {
        itemID: this.id,
        count: 16,
      };

      const resp = await this.parent.makeRequest({
        url: "https://www.tiktok.com/api/related/item_list/",
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
      // Note: Python has no hasMore check here — it just loops once.
      // We match that: break after first page like Python.
      return;
    }
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
    const eqIdx = nameVal.indexOf("=");
    const name = nameVal.slice(0, eqIdx);
    const value = nameVal.slice(eqIdx + 1);

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

# API Reference

Technical overview of the public surface of `untiktok-api`. For narrative guides see the [docs/](./) topic files. For exception taxonomy see [quick_start.md § Error Handling](./quick_start.md#error-handling).

Package entry: `import { TikTokApi, ... } from 'untiktok-api'`.

---

## `new TikTokApi(options?)`

Main entry point. Optional logger config only — sessions are created separately.

```typescript
import { TikTokApi } from 'untiktok-api';

const api = new TikTokApi({
  loggingLevel: 'warn',  // 'debug' | 'info' | 'warn' | 'error'
  loggerName: 'MyApp',   // log prefix when running multiple scrapers
});
```

Resource factories (thin constructors; network I/O happens on methods):

| Method | Returns |
|---|---|
| `api.user(options)` | `User` |
| `api.video(options)` | `Video` |
| `api.sound(options)` | `Sound` |
| `api.hashtag(options)` | `Hashtag` |
| `api.playlist(options)` | `Playlist` |
| `api.comment({ data })` | `Comment` |
| `api.trending` | `Trending` instance |
| `api.search` | `Search` instance |

---

## `api.createSessions(options)`

Boots Playwright browser contexts. **Must** be awaited before any scraping call.

```typescript
await api.createSessions({
  // Concurrent browser contexts / tabs. Default: 5
  numSessions: 5,

  // Hide the browser UI. Set false to watch the session. Default: true
  headless: true,

  // Real msToken cookie values from tiktok.com — strongly recommended
  msTokens: ['...'],

  // Seconds to wait after each session opens so anti-bot cookies settle.
  // Code default is 1; recommend 3+ for cold starts.
  sleepAfter: 3,

  // Browser engine. Default: 'chromium'
  browser: 'chromium',          // 'chromium' | 'firefox' | 'webkit'

  // Page-load timeout in ms. Default: 30000
  timeout: 30000,

  // First URL each session navigates to. Default: 'https://www.tiktok.com'
  startingUrl: 'https://www.tiktok.com',

  // Extra Playwright context options (e.g. storageState for session cache)
  contextOptions: { storageState: 'state.json' },

  // Launch-arg overrides for Chromium/Firefox/WebKit
  overrideBrowserArgs: ['--disable-blink-features=AutomationControlled'],

  // Seed cookies per session (array of cookie maps, one per session index)
  cookies: [{ msToken: '...' }],

  // Resource types to abort in Playwright (bandwidth saver)
  suppressResourceLoadTypes: ['image', 'media', 'font'],

  // Custom Chromium/Firefox binary
  executablePath: '/usr/bin/chromium',

  // Custom page / context factories (advanced launchers)
  pageFactory: async (context) => context.newPage(),
  // browserContextFactory must return a BrowserContext (or Browser cast).
  // browserContextFactory: async (pw) => { return await someCustomContext(pw); },

  // @deprecated Prefer a single proxy via contextOptions / custom factory.
  // Array of proxy strings or { server, username?, password? } objects.
  proxies: ['http://user:pass@host:port'],

  // Auto-recover dead sessions mid-run. Default: true
  enableSessionRecovery: true,

  // Allow createSessions to succeed with fewer than numSessions. Default: false
  allowPartialSessions: false,

  // Minimum sessions required when allowPartialSessions is true
  minSessions: 1,
});
```

All fields are optional. Types live on `CreateSessionsOptions` (exported).

---

## Session lifecycle & utilities

| Method | Description |
|---|---|
| `closeSessions()` | Close all pages/contexts/browser. Prefer `await using` on Node 20.10+ so this runs automatically. |
| `stopPlaywright()` | Close the browser only (legacy helper). |
| `saveSessionState(path, sessionIndex?)` | Write Playwright `storageState` (cookies + storage) to disk. Reload via `contextOptions: { storageState: path }`. There is **no** separate `loadSessionState` method. |
| `getSessionCookies(session)` | Return `Record<name, value>` for a session. |
| `setSessionCookies(session, cookies)` | `context.addCookies(...)`. |
| `getResourceStats()` | Sync snapshot: session counts, `hasBrowser`, cleanup flags. |
| `healthCheck()` | Async probe of each session + stats. |
| `runFetchScript(url, headers, kwargs?)` | `page.evaluate(fetch(...))` through a live session. |
| `generateXBogus(url, kwargs?)` | Evaluate TikTok's `byted_acrawler.frontierSign`. |
| `signUrl(url, kwargs?)` | Append `X-Bogus=` to a URL. |
| `makeRequest(options)` | Low-level signed GET. Prefer resource methods; pass a zod `schema` for validated responses (ADR-007). |
| `getSessionContent(url, kwargs?)` | `page.content()` for a URL. |
| `[Symbol.asyncDispose]()` | Calls `closeSessions()` — powers `await using api = new TikTokApi()`. |

---

## Iterators (async generators)

List endpoints return **async generators**. Use `for await (... of ...)`. Pagination (`cursor` / `hasMore`) is handled inside `paginate()` (ADR-008). Signature pattern for most feeds:

```ts
// @docs-skip — signature sketch, not a runnable example
method(count?: number, cursor?: number, kwargs?: { headers?; sessionIndex? })
```

### Trending
```typescript
for await (const video of api.trending.videos(30)) { /* Video */ }
```

### User feeds
```typescript
const user = api.user({ username: 'therock' });
for await (const video of user.videos(30)) { /* uploads */ }
for await (const video of user.liked(20)) { /* may be empty if private */ }
for await (const video of user.favorited(20)) { /* bookmarks; may be private */ }
for await (const video of user.reposts(20)) { /* reposts tab */ }
for await (const video of user.pinned(10)) { /* pinned uploads */ }
for await (const pl of user.playlists(10)) { /* Playlist */ }
for await (const u of user.followersList(50)) { /* User */ }
for await (const u of user.followingList(50)) { /* User */ }
```

### Hashtag / sound / playlist
```typescript
for await (const video of api.hashtag({ name: 'funny' }).videos(20)) {}
for await (const video of api.sound({ id: '7016547803243022337' }).videos(20)) {}
for await (const video of api.playlist({ id: '7426714779919797038' }).videos(20)) {}
```

### Search
```typescript
for await (const user of api.search.users('david teather', 10)) {}
for await (const video of api.search.searchType('cats', 'item', 10)) {}
```

### Comments
```typescript
const video = api.video({ id: '7041997751718137094' });
for await (const comment of video.comments(20)) {
  for await (const reply of comment.replies(5)) {}
}
```

### Related videos
```typescript
for await (const related of api.video({ id: '...' }).relatedVideos(20)) {}
```

---

## `User`

```typescript
// @docs-skip — options shape sketch, not a runnable example
const user = api.user({
  username?: string,
  userId?: string,
  secUid?: string,
  data?: Record<string, unknown>,
});
```

| Member | Notes |
|---|---|
| `info(kwargs?)` | Fetch profile payload; populates getters below. |
| `nickname`, `signature`, `verified`, `isPrivate` | Profile fields (after `info()`). |
| `followers`, `following`, `likes`, `videoCount` | Typed stats getters (not `user.stats?.followerCount`). |
| `bioLink`, `avatar` | Profile link / avatar URL. |
| `isLive`, `roomId` | Live-stream detection. |
| feeds | `videos`, `liked`, `favorited`, `reposts`, `pinned`, `playlists`, `followersList`, `followingList` (see iterators). |

---

## `Video`

```typescript
// @docs-skip — options shape sketch, not a runnable example
const video = api.video({
  id?: string,
  url?: string,           // preferred for info() / fromUrl
  data?: Record<string, unknown>,
  sessionIndex?: number,
  proxy?: string,
});
```

```typescript
// @docs-skip — this example needs an `api` instance from a previous block.
const video2 = await Video.fromUrl(api, 'https://www.tiktok.com/@user/video/123', { sessionIndex: 0 });
```

| Member | Notes |
|---|---|
| `description` | Caption getter (**not** `video.desc`). |
| `plays`, `likes`, `commentsCount`, `shares`, `saves`, `isPinned` | Typed stats (not `video.stats?.playCount`). |
| `author`, `sound`, `hashtags`, `createTime`, `asDict` | Related objects / raw payload. |
| `info(kwargs?)` | **Requires `url`.** Navigates the video page and parses rehydration state. Id-only instances cannot call `info()`. |
| `bytes({ stream? })` | Download MP4 buffer or stream. Call `info()` first when starting from a URL. CDN may 403 from bare Node — see [download.md](./download.md). |
| `comments(count?, cursor?, kwargs?)` | Async generator of `Comment`. |
| `relatedVideos(count?, cursor?, kwargs?)` | Related-item feed. |
| `Video.fromUrl(parent, url, kwargs?)` | Static helper: resolve share URL → `Video` with id. |

### Video downloads (correct pattern)

```typescript
import * as fs from 'fs';

// info() requires a URL — do not call it on an id-only video
const video = api.video({
  url: 'https://www.tiktok.com/@mrbeast/video/7123456789012345678',
});
await video.info();

const buf = await video.bytes() as Buffer;
fs.writeFileSync('video.mp4', buf);

// Streaming for large files
for await (const chunk of await video.bytes({ stream: true }) as AsyncGenerator<Buffer>) {
  fs.appendFileSync('output.mp4', chunk);
}
```

---

## `Sound`

```typescript
const sound = api.sound({ id: '7016547803243022337' });
await sound.info();
// sound.id, sound.title, sound.author, sound.duration, sound.original, sound.playUrl, sound.coverLarge
for await (const video of sound.videos(30)) {}
```

See [sound.md](./sound.md).

---

## `Hashtag`

```typescript
const tag = api.hashtag({ name: 'funny' }); // do not include '#'
await tag.info();
for await (const video of tag.videos(20)) {}
```

See [hashtag.md](./hashtag.md).

---

## `Playlist`

```typescript
const playlist = api.playlist({ id: '7426714779919797038' });
await playlist.info();
// playlist.name, playlist.videoCount, playlist.creator, playlist.coverUrl
for await (const video of playlist.videos(30)) {}
```

See [playlist.md](./playlist.md).

---

## `Comment`

Obtained from `video.comments()`, not usually constructed by hand.

| Member | Notes |
|---|---|
| `id`, `text`, `author`, `likesCount`, `asDict` | Core fields. |
| `isSticker` | `true` when text contains `[Sticker]`. |
| `stickerText` | Text with `[Sticker]` stripped. |
| `replies(count?, cursor?, kwargs?)` | Async generator of reply `Comment`s. |

See [comment.md](./comment.md).

---

## `Search`

| Method | Notes |
|---|---|
| `users(term, count?, cursor?, kwargs?)` | Wrapper for `searchType(term, 'user', ...)`. |
| `searchType(term, 'user' \| 'item', count?, cursor?, kwargs?)` | Full search; `'item'` returns videos. |

See [search.md](./search.md).

---

## `Trending`

| Method | Notes |
|---|---|
| `videos(count?, kwargs?)` | Global For You feed (`api/recommend/item_list/`). Region is IP/cookie driven — use a geo proxy for other countries. |

See [trending.md](./trending.md).

---

## Exceptions (public)

All extend `TikTokException`:

| Class | When |
|---|---|
| `InvalidParameterException` | Bad caller args (missing username/url/id). |
| `SessionUnavailableException` | No / dead sessions. |
| `EmptyResponseException` | Empty body / bot detection. |
| `InvalidJSONException` | Non-JSON / HTML payload. |
| `InvalidResponseException` | Unexpected shape / failed zod parse. |
| `CaptchaException` | Captcha / challenge response. |
| `NotFoundException` | Missing video/user/etc. |
| `SoundRemovedException` | Music removed. |

---

## Exported types

`TikTokPlaywrightSession`, `CreateSessionsOptions`, `ProxySettings`, `ResourceStats`, `HealthCheckResult`, `StealthConfig` / `StealthConfigOptions`.

---

## Notes

- Prefer typed getters (`video.description`, `video.plays`, `user.followers`) over raw `stats` maps.
- Default `numSessions` is **5**, not 1.
- Session restore = `saveSessionState` + `createSessions({ contextOptions: { storageState } })`. See [session_caching.md](./session_caching.md).

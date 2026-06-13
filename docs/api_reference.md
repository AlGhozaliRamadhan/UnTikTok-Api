# API Reference

This document provides a technical overview of the primary classes, configuration options, and methods available in the `UnTikTok-Api`.

## `new TikTokApi(options?)`

The main entry point for the library. It accepts an optional configuration object.

```typescript
const api = new TikTokApi({
  // Controls how noisy the console output is.
  // Set to 'debug' if you are trying to figure out why requests are failing.
  loggingLevel: 'warn',  // Options: 'debug' | 'info' | 'warn' | 'error'
  
  // Prepended to all logs. Useful if running multiple scrapers concurrently.
  loggerName: 'MyApp',
});
```

---

## `api.createSessions(options)`

Bootstraps the Playwright instances. You **must** await this before calling any scraping endpoints.

```typescript
await api.createSessions({
  // How many concurrent browser tabs to open. Useful for high-volume scraping.
  numSessions: 5,               // default: 1
  
  // Whether to hide the browser UI. Turn to 'false' to visually see what's happening.
  headless: true,               // default: true
  
  // Highly recommended: Pass your actual 'msToken' cookie from TikTok.com here to prevent blocks.
  msTokens: ['...'],            
  
  // Seconds to wait after opening the browser before allowing scraping. 
  // Required to let TikTok's anti-bot scripts execute and assign tracking cookies.
  sleepAfter: 3,                
  
  // The engine to use. Chromium is default, but Webkit sometimes bypasses captchas better.
  browser: 'chromium',          // 'chromium' | 'firefox' | 'webkit'
  
  // How long to wait for page loads before throwing an error.
  timeout: 30000,               // ms
});
```

---

## Iterators (Generators)

All endpoints that fetch lists of videos or users return **Async Generators**. You iterate over them using `for await (... of ...)` rather than standard arrays. This is because the library handles fetching the next page of results seamlessly in the background as you loop.

### `api.trending.videos(count?, kwargs?)`
Fetches the global FYP.
```typescript
for await (const video of api.trending.videos(30)) { ... }
```

### `api.user(options).videos(count?)`
Fetches a specific user's uploads.
```typescript
for await (const video of api.user({ username: 'therock' }).videos(30)) { ... }
```

### `api.user(options).reposts(count?)`
Fetches a specific user's reposted videos in chronological order.
```typescript
for await (const repost of api.user({ username: 'davidteathercodes' }).reposts(30)) { ... }
```

---

## Video Downloads & Metadata

### `api.video(options).bytes(options?)`

Downloads the raw video from the CDN. Call `video.info()` first to ensure the CDN links are populated.

```typescript
const video = api.video({ id: '7123456789012345678' });
await video.info();

// Full download into memory buffer
const buf = await video.bytes() as Buffer;

// Streaming (Useful for massive videos so you don't exhaust RAM)
for await (const chunk of await video.bytes({ stream: true }) as AsyncGenerator<Buffer>) {
  fs.appendFileSync('output.mp4', chunk);
}
```

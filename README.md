# UnTikTok-Api

> An unofficial TikTok API wrapper in TypeScript, originally ported from the [TikTok-Api](https://github.com/davidteather/TikTok-Api) Python library. 
> 
> **Disclaimer:** This project is not affiliated with, endorsed by, or connected to TikTok, ByteDance, or the original author of the Python TikTok-Api. It is an independent, open-source TypeScript port designed for integration into Node.js applications and AI tools.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Playwright](https://img.shields.io/badge/Playwright-1.44+-green?logo=playwright)](https://playwright.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-brightgreen?logo=node.js)](https://nodejs.org/)

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Common Issues](#common-issues)

---

## Features

This API allows you to extract and automate interactions with TikTok data without requiring an official developer API key. It achieves this by using Playwright and stealth scripts to interface directly with TikTok's web endpoints.

**Capabilities include:**
- 📈 **Trending Feeds:** Fetch the most viral and trending videos on the platform.
- 👤 **User Profiles:** Retrieve a user's uploaded videos, liked videos, and profile information.
- 🏷️ **Hashtags:** Fetch videos under specific hashtags.
- 🔍 **Search:** Search for specific users or videos by keyword.
- 💬 **Comments:** Extract comments and replies from specific videos.
- 🎵 **Sounds/Music:** Retrieve videos associated with a specific audio track or sound.
- 📥 **Downloads:** Download raw video bytes (without watermarks) and audio streams directly.

---

## Installation

First, clone the repository and navigate into the project directory:
```bash
git clone https://github.com/AlGhozaliRamadhan/UnTikTok-Api.git
cd UnTikTok-Api
npm install
npx playwright install chromium
```

TypeScript check (no emit):
```bash
npm run typecheck
```

Build to `dist/`:
```bash
npm run build
```

---

## Quick Start

```typescript
import { TikTokApi } from './src';

const msToken = process.env.MS_TOKEN ?? undefined; // from TikTok cookies

async function trendingVideos() {
  const api = new TikTokApi();
  await api.createSessions({
    msTokens: msToken ? [msToken] : undefined,
    numSessions: 1,
    sleepAfter: 3,
    browser: 'chromium',
  });

  for await (const video of api.trending.videos(30)) {
    console.log(video.id, video.createTime);
  }

  await api.closeSessions();
}

trendingVideos();
```

Or using `Symbol.asyncDispose` (Node 18+ with `--experimental-vm-modules`):

```typescript
{
  await using api = new TikTokApi();
  await api.createSessions({ numSessions: 1 });
  // api.closeSessions() is called automatically
}
```

---

## API Reference

### `new TikTokApi(options?)`

```typescript
const api = new TikTokApi({
  loggingLevel: 'warn',  // 'debug' | 'info' | 'warn' | 'error'
  loggerName: 'MyApp',
});
```

### `api.createSessions(options)`

```typescript
await api.createSessions({
  numSessions: 5,               // default: 5
  headless: true,               // default: true
  msTokens: ['...'],            // from TikTok cookies
  sleepAfter: 1,                // seconds to wait for msToken
  startingUrl: 'https://www.tiktok.com',
  browser: 'chromium',          // 'chromium' | 'firefox' | 'webkit'
  timeout: 30000,               // ms
  enableSessionRecovery: true,
});
```

### `api.trending.videos(count?, kwargs?)`
```typescript
for await (const video of api.trending.videos(30)) { ... }
```

### `api.user(options).videos()`
```typescript
for await (const video of api.user({ username: 'therock' }).videos(30)) { ... }
```

### `api.video(options).bytes(options?)`
```typescript
// Full download
const buf = await api.video({ id: '...' }).bytes() as Buffer;

// Streaming
for await (const chunk of await api.video({ id: '...' }).bytes({ stream: true }) as AsyncGenerator<Buffer>) {
  // ...
}
```

---

## Examples

### Trending Videos

```typescript
import { TikTokApi } from './src';

const api = new TikTokApi();
await api.createSessions({ numSessions: 1, sleepAfter: 3 });

for await (const video of api.trending.videos(10)) {
  console.log(`Video: ${video.id}, Author: ${video.author?.username}`);
}

await api.closeSessions();
```

### User Videos

```typescript
for await (const video of api.user({ username: 'therock' }).videos(20)) {
  console.log(video.asDict);
}
```

### Hashtag Videos

```typescript
for await (const video of api.hashtag({ name: 'funny' }).videos(20)) {
  console.log(video.id);
}
```

### Search Users

```typescript
for await (const user of api.search.users('david teather', 5)) {
  console.log(user.username);
}
```

### Download Video

```typescript
import fs from 'fs';

const video = api.video({ url: 'https://www.tiktok.com/@user/video/12345' });
await video.info();
const bytes = await video.bytes() as Buffer;
fs.writeFileSync('video.mp4', bytes);
```

---

## Common Issues

### `EmptyResponseException`
TikTok is detecting you as a bot. Try:
- Using a proxy configuration
- Using a non-headless browser: `headless: false`
- Switching browsers: `browser: 'webkit'`
- Adding a real `msToken` from your TikTok cookies

### `No sessions created`
Ensure you call `createSessions()` before making any API requests.

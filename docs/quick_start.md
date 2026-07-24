# Quick Start Guide

Welcome to the `UnTikTok-Api`! This guide will walk you through the absolute minimum setup required to start pulling data from TikTok. 

Unlike official APIs that give you a clean token to use, this library achieves its goals by programmatically controlling a hidden web browser (Playwright) to intercept data as if a real human were scrolling through TikTok. Because of this, initialization takes an extra step.

## 1. Environment Setup

Ensure you have installed the necessary browser binaries during installation:
```bash
npx playwright install chromium
```

## 2. Basic Initialization

Every script using this library must follow three steps:
1. Initialize the `TikTokApi` class.
2. Call `api.createSessions()` to boot up the hidden browser.
3. Call `api.closeSessions()` when finished to prevent background processes from lingering.

Here is the most basic "Hello World" that fetches 30 trending videos:

```typescript
import { TikTokApi } from '../src';

// If you have a valid msToken from your browser cookies, put it here.
// Otherwise, leave it undefined and the library will attempt to generate one.
const msToken = process.env.ms_token ?? undefined; 

async function startScraping() {
  // 1. Initialize API
  const api = new TikTokApi();
  
  // 2. Create the browser session
  await api.createSessions({
    msTokens: msToken ? [msToken] : undefined,
    numSessions: 1,
    sleepAfter: 3, // Very important: Wait 3 seconds for cookies to settle before firing requests!
    browser: 'chromium',
  });

  console.log("Session created. Fetching trending videos...");

  // Fetch the videos!
  for await (const video of api.trending.videos(30)) {
    console.log(`Title: ${video.description}`);
    console.log(`Author: @${video.author?.username}`);
    console.log(`Views: ${video.plays}`);
    console.log('---');
  }

  // 3. Close the browser
  await api.closeSessions();
  console.log("Done.");
}

startScraping();
```

## 3. The Modern Approach: Automatic Cleanup

If you are on **Node 20.10 or newer**, the `await using` syntax is supported natively for automatic resource cleanup. This is highly recommended because it **automatically** calls `api.closeSessions()` for you, even if your code crashes halfway through!

> **Older Node versions:** Node 22.6+ and 20.10–22.5 support Explicit Resource Management natively (`await using` works out of the box). On even older Node 20 patch versions you can opt in with the `--harmony-explicit-resource-management` flag. (Note: `--experimental-vm-modules` is unrelated to `await using` — that flag is for `node:vm` ESM module tests.)

```typescript
import { TikTokApi } from '../src';

async function modernScrape() {
  // The 'using' keyword ensures the API cleans up after itself automatically
  await using api = new TikTokApi();
  await api.createSessions({ numSessions: 1, sleepAfter: 3 });
  
  const user = api.user({ username: "therock" });
  for await (const video of user.videos(5)) {
    console.log(`Found video: ${video.id}`);
  }
  // No need to call closeSessions()! It happens right here as the function exits.
}
```

## Next Steps

Now that you have your first scraper running, you should learn how to prevent TikTok from blocking you by reading the [Session Caching Guide](./session_caching.md).

## Error Handling

Every error this library raises intentionally extends `TikTokException`, so you can write meaningful `catch` blocks. Import the subclass you want to handle:

```typescript
import { TikTokApi } from '../src';
import {
  CaptchaException,
  NotFoundException,
  EmptyResponseException,
  InvalidParameterException,
  SessionUnavailableException,
} from '../src';
```

There are three categories of failure:

| When | Subclass to throw / catch |
|---|---|
| Caller passed an invalid argument (missing `username`, bad URL, etc.) | `InvalidParameterException` |
| Library state is bad (no sessions exist, all sessions are dead, recovery failed) | `SessionUnavailableException` |
| TikTok response is unusable | `EmptyResponseException` (empty body / bot-detected), `InvalidJSONException` (HTML or malformed payload), `InvalidResponseException` (unexpected status), `CaptchaException` (challenge shown), `NotFoundException` (video/user/etc. doesn't exist), `SoundRemovedException` (music deleted) |

Example retry strategy combining the above:

```typescript
import {
  CaptchaException,
  EmptyResponseException,
  NotFoundException,
  SessionUnavailableException,
  InvalidParameterException,
} from 'untiktok-api';

try {
  for await (const video of api.user({ username: 'mrbeast' }).videos(20)) {
    console.log(video.id);
  }
} catch (e) {
  if (e instanceof CaptchaException || e instanceof EmptyResponseException) {
    // Rotate session / proxy / browser and try again — see Session Caching Guide.
  } else if (e instanceof NotFoundException) {
    // The user doesn't exist; nothing to retry.
  } else if (e instanceof SessionUnavailableException) {
    // Either your createSessions() call failed or all sessions died; start over.
    await api.createSessions({ numSessions: 1 });
  } else if (e instanceof InvalidParameterException) {
    // Bug in your code (e.g. missing username); fix and don't retry.
    console.error(e instanceof Error ? e.message : e);
  }
}
```

Any error that does *not* extend `TikTokException` is an unexpected programmer error or a transport failure — treat as a bug.

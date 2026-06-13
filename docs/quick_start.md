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
const msToken = process.env.MS_TOKEN ?? undefined; 

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
    console.log(`Title: ${video.desc}`);
    console.log(`Author: @${video.author?.username}`);
    console.log(`Views: ${video.stats?.playCount}`);
    console.log('---');
  }

  // 3. Close the browser
  await api.closeSessions();
  console.log("Done.");
}

startScraping();
```

## 3. The Modern Approach: Automatic Cleanup

If you are using Node.js v18+ and have `--experimental-vm-modules` enabled, you can use the modern `await using` syntax. This is highly recommended because it **automatically** calls `api.closeSessions()` for you, even if your code crashes halfway through!

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

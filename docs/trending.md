# Trending Videos Guide

The `api.trending` class allows you to fetch videos directly from TikTok's global "For You" feed.

## How it works

When you call `api.trending.videos()`, the library mimics a user endlessly scrolling their For You page. Behind the scenes, it communicates with the `api/recommend/item_list/` endpoint, continually requesting new batches of videos.

Because the For You feed is heavily algorithm-driven, the videos returned here will vary wildly based on:
1. The location/IP address of the machine running the code.
2. The cookies or `msToken` supplied to the session.

If you don't supply any specific login cookies, you will receive a generalized, unpersonalized feed of globally trending or locally popular videos.

### Changing the Region (Country) 🌍

TikTok's "For You" algorithm determines your region based heavily on your **IP Address** and your session **Cookies**. 

Simply passing a URL parameter like `region=JP` to the web API does **not** work anymore—TikTok ignores it and overrides it with your IP's geographic location.

To see the trending feed (memes, trends) from a specific country, you must pass a proxy server located in that country when fetching the videos:

```typescript
const api = new TikTokApi();
await api.createSessions({ 
  numSessions: 1, 
  // Pass a proxy from the country you want (e.g. Japan)
  proxy: 'http://user:pass@japan-proxy-ip:port' 
});

for await (const video of api.trending.videos()) {
  console.log(`[Japan Trending] ${video.description}`);
}
```

## Example Usage

```typescript
import { TikTokApi } from '../src';

async function trendingVideos() {
  const api = new TikTokApi();
  
  // sleepAfter helps prevent rate limiting on startup
  await api.createSessions({ numSessions: 1, sleepAfter: 3 });

  // Fetch 10 trending videos
  for await (const video of api.trending.videos(10)) {
    console.log(`Video ID: ${video.id}`);
    console.log(`Author: ${video.author?.username}`);
    console.log(`Views: ${video.stats?.playCount}`);
  }

  await api.closeSessions();
}

trendingVideos();
```

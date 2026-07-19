# Video Metadata & Downloads Guide

The `api.video()` class handles specific video interactions, most notably retrieving video metadata (likes, views) and downloading the raw MP4 bytes directly from TikTok's servers.

## Video Metadata & Stats

When you retrieve a `Video` object (whether through a user's feed, search, or by URL), you can instantly access its metrics and metadata!

```typescript
const video = api.video({ url: 'https://www.tiktok.com/@mrbeast/video/12345' });
await video.info(); // Populates data if you only provided a URL

console.log(`Caption: ${video.description}`);
console.log(`Views: ${video.plays}`);
console.log(`Likes: ${video.likes}`);
console.log(`Comments: ${video.commentsCount}`);
console.log(`Shares: ${video.shares}`);
console.log(`Saves/Bookmarks: ${video.saves}`);
console.log(`Pinned by creator: ${video.isPinned}`);
```

## How Downloading Works

When you call `.bytes()`, the library reads the CDN URL from the video metadata (after `video.info()` or after receiving a video from a feed) and fetches the raw MP4 payload (`v16-webapp-prime.tiktok.com`, etc.).

**Watermark free (usually):**
The browser-player payload is typically free of the bouncing share watermark (that watermark is applied on mobile share flows, not always baked into the master CDN file).

**CDN may 403 from Node:**
TikTok CDNs heavily fingerprint TLS / client identity. A plain Node/`axios` download can return **403** even when the same URL works inside Playwright. Prefer:

1. Call `video.info()` (or obtain the video via a session-backed feed) so cookies and CDN links are current.
2. Retry through a residential proxy if you still see 403s.
3. Treat “no watermark + always succeeds from bare Node” as **best-effort**, not a guarantee.

## Example Usage

```typescript
import { TikTokApi } from '../src';
import * as fs from 'fs';

async function downloadVideo() {
  const api = new TikTokApi();
  await api.createSessions({ numSessions: 1 });

  // Initialize the video instance
  const video = api.video({ url: 'https://www.tiktok.com/@user/video/12345' });
  
  // It's highly recommended to fetch metadata first to populate the CDN links
  await video.info(); 
  
  // Await the raw buffer
  const bytes = await video.bytes() as Buffer;
  
  // Write the buffer out to a file
  fs.writeFileSync('video.mp4', bytes);
  console.log('Video downloaded successfully without a watermark!');

  await api.closeSessions();
}

downloadVideo();
```

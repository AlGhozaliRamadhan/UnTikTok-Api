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

When you call `.bytes()`, the library bypasses the standard TikTok video player and directly accesses the raw CDN URL (`v16-webapp-prime.tiktok.com` etc). 

**Watermark Free:**
Because the library fetches the raw video payload delivered to the browser player, the resulting download is usually completely free of the bouncing TikTok watermark (which is applied via mobile sharing, not strictly baked into the master CDN file).

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

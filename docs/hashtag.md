# Hashtag Videos Guide

The `api.hashtag()` class lets you explore videos that have been tagged with a specific keyword. 

## How it works

When querying a hashtag, the library interacts with TikTok's search/challenge endpoints (`api/challenge/item_list/`). It retrieves videos identically to how a user clicking on a hashtag on the web would experience it.

These videos are generally returned in order of popularity and engagement related to that specific tag, rather than strict chronological order.

## Example Usage

```typescript
import { TikTokApi } from '../src';

async function hashtagVideos() {
  const api = new TikTokApi();
  await api.createSessions({ numSessions: 1 });

  // Do not include the '#' symbol, just the word itself
  for await (const video of api.hashtag({ name: 'funny' }).videos(20)) {
    console.log(`Video ID: ${video.id}`);
    console.log(`Description: ${video.desc}`);
  }

  await api.closeSessions();
}

hashtagVideos();
```

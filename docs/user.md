# User Data Guide

The `api.user()` class is your primary entry point for fetching data related to a specific TikTok creator. By passing in a username, you can interact with their profile to retrieve their uploads, liked videos, and reposts.

## Setup
Before calling any methods, you must initialize the API and create a session. This spins up the underlying headless browser.

```typescript
import { TikTokApi } from '../src';

const api = new TikTokApi();
await api.createSessions({ numSessions: 1 });
```

## User Videos

The `.videos(count)` method allows you to fetch a user's uploaded videos in reverse chronological order. It acts as an asynchronous generator.

**How it works:**
The library simulates a user visiting the profile and intercepts the `api/post/item_list/` network request. It signs the request with a fresh `X-Bogus` token to prevent bot detection.

```typescript
// Fetch the 20 most recent videos from @therock
for await (const video of api.user({ username: 'therock' }).videos(20)) {
  console.log(`Video ID: ${video.id}`);
  console.log(video.asDict); // Raw JSON payload returned from TikTok
}
```

## User Liked Videos

The `.liked(count)` method retrieves the videos that the specified user has liked. 

**Important Note on Privacy:**
TikTok allows users to make their liked videos private. If the target user has their likes set to private, this method will simply return an empty list. It cannot bypass TikTok's privacy settings.

```typescript
for await (const video of api.user({ username: 'therock' }).liked(20)) {
  console.log(`Liked Video ID: ${video.id}`);
}
```

## User Reposts 🆕

The `.reposts(count)` method allows you to retrieve the videos a user has reposted to their feed. 

**How it works:**
Recently, TikTok introduced a "Reposts" tab on the web version of user profiles. This method interacts with the `api/repost/item_list/` endpoint to fetch those exact videos.

**A note on timestamps:**
Unlike the mobile app which tells you exactly when a user reposted a video (e.g., "reposted 2 minutes ago"), the web endpoint only returns the *original video's* creation date (`createTime`). The library yields the videos in the correct order (newest repost to oldest), but cannot provide the exact time the repost button was clicked.

```typescript
for await (const video of api.user({ username: 'oja756' }).reposts(20)) {
  console.log(`Reposted Video ID: ${video.id}`);
  console.log(`Original Author: ${video.author?.username}`);
}
```

## Cleanup
Always ensure you close sessions when finished to prevent memory leaks and zombie browser processes:
```typescript
await api.closeSessions();
```

# User Data Guide

The `api.user()` class is your primary entry point for fetching data related to a specific TikTok creator. By passing in a username, you can interact with their profile to retrieve their uploads, liked videos, and reposts.

## Setup
Before calling any methods, you must initialize the API and create a session. This spins up the underlying headless browser.

```typescript
import { TikTokApi } from '../src';

const api = new TikTokApi();
await api.createSessions({ numSessions: 1 });
```

## User Profile Info 🆕

You can fetch rich metadata about a user's profile, including their stats, bio, and verification status:

```typescript
const user = api.user({ username: 'mrbeast' });
await user.info(); // Populates the data

console.log(`Display Name: ${user.nickname}`);
console.log(`Bio: ${user.signature}`);
console.log(`Link in Bio: ${user.bioLink}`);
console.log(`Verified: ${user.verified}`);
console.log(`Followers: ${user.followers}`);
console.log(`Total Likes: ${user.likes}`);
console.log(`Profile Picture: ${user.avatar}`);
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

## User Favorited Videos (Collections) 🆕

The `.favorited(count)` method retrieves the videos a user has bookmarked or saved to their collections (the bookmark icon).

**Important Note on Privacy:**
Just like liked videos, this depends entirely on the user's privacy settings. If their favorites are private, it will return an empty list.

```typescript
for await (const video of api.user({ username: 'therock' }).favorited(20)) {
  console.log(`Favorited Video ID: ${video.id}`);
}
```

## User Reposts

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

## User Pinned Videos 🆕

The `.pinned(count)` method explicitly filters the user's feed and returns only the videos they have pinned to the top of their profile. 

**How it works:**
When you view a user's profile on TikTok, any pinned videos are sent at the very beginning of the `api/post/item_list/` feed, regardless of when they were actually posted. This helper explicitly looks for boolean flags inside the raw video data (e.g. `isPinned`, `is_top`) and isolates just the showcased content.

```typescript
for await (const video of api.user({ username: 'davidteathercodes' }).pinned()) {
  console.log(`Pinned Video ID: ${video.id}`);
}
```

## User Live Status 🆕

You can easily check if a user is currently broadcasting a TikTok Live by checking the `.isLive` getter on the user object. If they are live, the `.roomId` getter will return the ID of the stream.

```typescript
const user = api.user({ username: 'guinevere.gnv' });
await user.info(); // Populates the data

if (user.isLive) {
  console.log(`They are live! Room ID: ${user.roomId}`);
} else {
  console.log(`They are currently offline.`);
}
```

## Followers & Following Lists 🆕

The `.followersList(count)` and `.followingList(count)` methods let you retrieve the users that a creator is following or who follow them.

**Important Catch:**
TikTok heavily guards these endpoints to prevent scraping of the social graph. These requests usually fail, return an empty list, or trigger bot verification challenges unless you are providing valid, logged-in session cookies inside the TikTokApi constructor. Even then, they might limit the number of results.

```typescript
for await (const follower of api.user({ username: 'davidteathercodes' }).followersList(30)) {
  console.log(`Follower: ${follower.username}`);
}
```

## Cleanup
Always ensure you close sessions when finished to prevent memory leaks and zombie browser processes:
```typescript
await api.closeSessions();
```

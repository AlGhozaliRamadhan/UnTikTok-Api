# Search Guide

The `api.search` module taps into TikTok's internal web search. It supports searching for **user profiles** and **videos** (items).

## How it works

- **Users** — `api/search/user/full/`
- **Videos** — `api/search/item/full/` via `searchType(term, 'item')`

TikTok's ranking decides order. The library paginates with the same `cursor` + `search_id` rotation the web client uses.

**Rate Limiting Warning:**
Search is one of the most heavily rate-limited TikTok surfaces. Rapid multi-page scrapes often yield `EmptyResponseException` (and eventually `CaptchaException`). Keep counts small and sleep between aggressive runs.

**msToken note:** Your `ms_token` should already have been used for a real TikTok search once, or the endpoint may return empty pages.

## Search Users

```typescript
import { TikTokApi } from '../src';

async function searchUsers() {
  const api = new TikTokApi();
  await api.createSessions({ numSessions: 1, sleepAfter: 3 });

  // Search for the phrase 'david teather' and return 5 results
  for await (const user of api.search.users('david teather', 5)) {
    console.log(`Username: ${user.username}`);
    console.log(`Nickname: ${user.nickname}`);
    // Prefer the typed getter after user.info() if you need stats:
    // await user.info();
    // console.log(`Follower Count: ${user.followers}`);
  }

  await api.closeSessions();
}

searchUsers();
```

`search.users(term, count?, cursor?, kwargs?)` is a thin wrapper around `searchType(term, 'user', ...)`.

## Search Videos

```typescript
import { TikTokApi } from '../src';

async function searchVideos() {
  const api = new TikTokApi();
  await api.createSessions({ numSessions: 1, sleepAfter: 3 });

  for await (const video of api.search.searchType('cats', 'item', 10)) {
    console.log(`Video ID: ${video.id}`);
    console.log(`Caption: ${video.description}`);
    console.log(`Views: ${video.plays}`);
  }

  await api.closeSessions();
}

searchVideos();
```

`objType` is `'user' | 'item'`. There is no dedicated `search.videos()` helper — use `searchType(..., 'item')`.

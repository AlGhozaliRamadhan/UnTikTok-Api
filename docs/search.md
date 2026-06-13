# Search Guide

The `api.search` module allows you to tap into TikTok's internal search engine. Currently, it supports searching for user profiles.

## How it works

When you query for a user, the library interacts with the web search endpoints (`api/search/user/full/`) to return users that match the keyword. TikTok's algorithm dictates the relevance and order of these results.

**Rate Limiting Warning:**
The search endpoint is notoriously one of the most heavily rate-limited endpoints on TikTok. Attempting to rapidly scrape hundreds of search pages will almost certainly trigger an `EmptyResponseException`. Use small counts and sleep between aggressive requests.

## Example Usage

```typescript
import { TikTokApi } from '../src';

async function searchUsers() {
  const api = new TikTokApi();
  await api.createSessions({ numSessions: 1 });

  // Search for the phrase 'david teather' and return 5 results
  for await (const user of api.search.users('david teather', 5)) {
    console.log(`Username: ${user.username}`);
    console.log(`Nickname: ${user.nickname}`);
    console.log(`Follower Count: ${user.stats?.followerCount}`);
  }

  await api.closeSessions();
}

searchUsers();
```

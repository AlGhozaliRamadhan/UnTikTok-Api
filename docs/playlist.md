# Playlists Guide

The `api.playlist()` class fetches mix/playlist metadata and the videos inside it. You can also enumerate a user's playlists via `user.playlists()`.

## How it works

- `playlist.info()` → `api/mix/detail/` with `mixId`
- `playlist.videos(count)` → mix item list (paginated)
- `user.playlists(count)` → playlists owned by a profile

## Example Usage

```typescript
import { TikTokApi } from '../src';

async function playlistExample() {
  const api = new TikTokApi();
  await api.createSessions({ numSessions: 1, sleepAfter: 3 });

  const playlist = api.playlist({ id: '7426714779919797038' });
  await playlist.info();

  console.log(`Name: ${playlist.name}`);
  console.log(`Videos: ${playlist.videoCount}`);
  console.log(`Creator: ${playlist.creator?.username}`);

  for await (const video of playlist.videos(20)) {
    console.log(`Video ${video.id}: ${video.description}`);
  }

  // Enumerate playlists for a user
  const user = api.user({ username: 'davidteathercodes' });
  for await (const pl of user.playlists(5)) {
    console.log(`Playlist: ${pl.name} (${pl.videoCount})`);
  }

  await api.closeSessions();
}

playlistExample();
```

## Members

| Member | Description |
|---|---|
| `id` | Mix / playlist id. |
| `name` | Display name. |
| `videoCount` | Declared item count. |
| `creator` | Owning `User` when present. |
| `coverUrl` | Cover image URL. |
| `asDict` | Raw payload. |
| `info(kwargs?)` | Fetch / refresh metadata. |
| `videos(count?, cursor?, kwargs?)` | Videos in the playlist. |

## Notes

- Construct with `{ id }` or with `data` that already contains an `id`.
- Playlist endpoints inherit the same bot-detection pressure as other list APIs — prefer cached sessions.
# Sounds / Music Guide

The `api.sound()` class fetches metadata for a TikTok audio track and the videos that use it.

## How it works

- `sound.info()` → `api/music/detail/` with `musicId`
- `sound.videos(count)` → `api/music/item_list/` (paginated)

You need the sound's numeric `id` (visible in TikTok music URLs / video payloads as `music.id`).

## Example Usage

```typescript
import { TikTokApi } from '../src';

async function soundExample() {
  const api = new TikTokApi();
  await api.createSessions({ numSessions: 1, sleepAfter: 3 });

  const sound = api.sound({ id: '7016547803243022337' });
  await sound.info();

  console.log(`Title: ${sound.title}`);
  console.log(`Duration: ${sound.duration}s`);
  console.log(`Original: ${sound.original}`);
  console.log(`Author: ${sound.author?.username ?? sound.author?.nickname}`);
  console.log(`Play URL: ${sound.playUrl}`);

  for await (const video of sound.videos(20)) {
    console.log(`Video ${video.id}: ${video.description}`);
  }

  await api.closeSessions();
}

soundExample();
```

## Members

| Member | Description |
|---|---|
| `id` | Music id. |
| `title` | Track title. |
| `author` | `User` when TikTok returns an author object/string. |
| `duration` | Seconds. |
| `original` | Whether the sound is original audio. |
| `playUrl` / `coverLarge` | CDN URLs when present. |
| `asDict` | Raw payload. |
| `info(kwargs?)` | Fetch / refresh metadata. |
| `videos(count?, cursor?, kwargs?)` | Videos using this sound. |

## Notes

- If TikTok reports a track as removed, `makeRequest` may throw `SoundRemovedException` (ADR-010). Catch it if you scrape music at scale.
- Sound feeds are popular scraping targets — cache sessions and throttle.
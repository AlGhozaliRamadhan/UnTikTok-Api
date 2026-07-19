# Comments Guide

The `Comment` class is returned by `video.comments()` and `comment.replies()`. It exposes the comment text, author, like count, sticker helpers, and a replies generator.

## How it works

`video.comments()` hits TikTok's `api/comment/list/` endpoint (paginated). Each item becomes a `Comment`. Nested replies use `api/comment/list/reply/` with the parent `comment_id`.

Comments are not usually constructed by hand — use `api.video(...).comments(...)`.

## Example Usage

```typescript
import { TikTokApi } from '../src';

async function commentExample() {
  const api = new TikTokApi();
  await api.createSessions({ numSessions: 1, sleepAfter: 3 });

  // Comments only need a video id (no URL required)
  const video = api.video({ id: '7041997751718137094' });

  for await (const comment of video.comments(20)) {
    console.log(`Comment: ${comment.text}`);
    console.log(`Likes: ${comment.likesCount}`);
    console.log(`Author: @${comment.author.username}`);
    console.log(`Sticker?: ${comment.isSticker}`);
    if (comment.isSticker) {
      console.log(`Text without sticker marker: ${comment.stickerText}`);
    }

    // Nested replies (optional)
    for await (const reply of comment.replies(5)) {
      console.log(`  Reply: ${reply.text}`);
    }
  }

  await api.closeSessions();
}

commentExample();
```

## Members

| Member | Description |
|---|---|
| `id` | Comment id (`cid`). |
| `text` | Raw comment body (may include `[Sticker]`). |
| `author` | `User` for the commenter. |
| `likesCount` | Digg count. |
| `asDict` | Raw TikTok payload. |
| `isSticker` | `true` when `text` contains `[Sticker]`. |
| `stickerText` | `text` with `[Sticker]` placeholders stripped. |
| `replies(count?, cursor?, kwargs?)` | Async generator of reply `Comment`s. |

## Notes

- The sticker *image* URL is not available from this endpoint — only the `[Sticker]` placeholder in text.
- Comment endpoints are rate-limited; keep counts modest and reuse a warmed session (see [session_caching.md](./session_caching.md)).

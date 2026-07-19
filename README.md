# UnTikTok-Api

> An unofficial TikTok API wrapper in TypeScript, originally ported from the [TikTok-Api](https://github.com/davidteather/TikTok-Api) Python library. 
> 
> **Disclaimer:** This project is not affiliated with, endorsed by, or connected to TikTok, ByteDance, or the original author of the Python TikTok-Api. It is an independent, open-source TypeScript port designed for integration into Node.js applications and AI tools.

[![NPM Version](https://img.shields.io/npm/v/untiktok-api?color=red)](https://www.npmjs.com/package/untiktok-api)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Playwright](https://img.shields.io/badge/Playwright-1.61-green?logo=playwright)](https://playwright.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20.10+-brightgreen?logo=node.js)](https://nodejs.org/)

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Common Issues](#common-issues)

---

## Features

This API allows you to extract and automate interactions with TikTok data without requiring an official developer API key. It achieves this by using Playwright and stealth scripts to interface directly with TikTok's web endpoints.

**Capabilities include:**
- **Trending Feeds:** Fetch the most viral and trending videos on the platform.
- **User Profiles:** Retrieve a user's uploaded videos, liked videos, favorited videos, reposted videos, pinned videos, followers/following lists, profile information, and live stream status.
- **Hashtags:** Fetch videos under specific hashtags.
- **Search:** Search for specific users or videos by keyword.
- **Comments:** Extract comments and replies from specific videos, including support for TikTok Stickers.
- **Sounds/Music:** Retrieve videos associated with a specific audio track or sound.
- **Downloads:** Download raw video bytes (without watermarks) and audio streams directly.

---

## Installation

Install the package directly from NPM:
```bash
npm install untiktok-api
```

Since this wrapper relies on Playwright to interface with TikTok, you must also install the required Playwright browsers (specifically Chromium):
```bash
npx playwright install chromium
```

### Building from Source

If you want to contribute, modify, or build the project locally:
```bash
git clone https://github.com/AlGhozaliRamadhan/UnTikTok-Api.git
cd UnTikTok-Api
npm install
npm run build
```

---

## Quick Start
Looking to get started immediately? Check out the [Quick Start Guide](./docs/quick_start.md).

---

## API Reference
For a full list of classes, methods, and constructor options, check out the [API Reference](./docs/api_reference.md).

---

## Examples & Guides

For detailed examples and tutorials on how to use specific features, check out the dedicated guides in the `docs/` folder:

- [Trending Videos](./docs/trending.md)
- [User Data (Videos, Likes, Reposts)](./docs/user.md)
- [Hashtag Videos](./docs/hashtag.md)
- [Search (Users & Videos)](./docs/search.md)
- [Comments & Replies](./docs/comment.md)
- [Sounds / Music](./docs/sound.md)
- [Playlists](./docs/playlist.md)
- [Download Videos](./docs/download.md)
- [Session Caching (Bot evasion)](./docs/session_caching.md)
- [API Reference](./docs/api_reference.md)

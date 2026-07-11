// ============================================================
// index.ts — Public API surface
// ============================================================

export { TikTokApi } from "./tiktok";
export { User } from "./api/user";
export { Video } from "./api/video";
export { Sound } from "./api/sound";
export { Hashtag } from "./api/hashtag";
export { Comment } from "./api/comment";
export { Trending } from "./api/trending";
export { Search } from "./api/search";
export { Playlist } from "./api/playlist";

export {
  TikTokException,
  InvalidParameterException,
  SessionUnavailableException,
  CaptchaException,
  NotFoundException,
  EmptyResponseException,
  SoundRemovedException,
  InvalidJSONException,
  InvalidResponseException,
} from "./exceptions";

export type {
  TikTokPlaywrightSession,
  CreateSessionsOptions,
  ProxySettings,
  ResourceStats,
  HealthCheckResult,
} from "./types";

export { stealthAsync, StealthConfig } from "./stealth";
export type { StealthConfigOptions } from "./stealth";

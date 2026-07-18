# ADR-007: Add runtime validation at the `makeRequest` boundary

- **Status:** Accepted
- **Date:** 2026-07-03
- **Phase:** 2 (High / type safety)
- **Maps to audit:** `CODEBASE_AUDIT.md` → Executive Summary #5; TypeScript & types findings (125 `as` casts, shallow `unknown`, `noUncheckedIndexedAccess` absent, `no-explicit-any` disabled)

## Context

`makeRequest` (`src/tiktok.ts:657,729`) returns `Record<string, unknown>`, but every consumer immediately `as`-casts the response to concrete interfaces:

- `user.ts:239,288,373,426,476,528,579` — `resp["itemList"] as Record<string,unknown>[]`.
- `video.ts:366,412` — `resp["itemList"] as Record<string,unknown>[]`.
- `sound.ts:131`; `hashtag.ts:121`; `playlist.ts:125`; `search.ts:97,108`; `comment.ts:98,105`.
- `user.ts:595` — `data["userInfo"] as Record<string, Record<string,string>>` (typed `string` but can be `undefined`).
- `tiktok.ts:729` — `JSON.parse(result) as Record<string, unknown>` with no shape check.

The audit counts **~125 `as` casts on unvalidated external JSON**, and 9 genuine `any` usages clustered in `user.ts` (5 × `Record<string, any>`) plus a `globalThis as any` at `video.ts:173`. `unknown` is the declared type but is only skin-deep — there is no runtime narrowing before the cast, so a single TikTok shape change silently produces `undefined` arrays and `NaN` cursors.

The TS configuration compounds this: `noUncheckedIndexedAccess` is off (so `resp["key"]` is typed `T`, not `T | undefined`), and ESLint's `@typescript-eslint/no-explicit-any` is disabled (`eslint.config.mjs:9`).

## Decision

Introduce a **single runtime validation boundary** at `makeRequest`, then strengthen the type system around it.

### Validation library
- Adopt **`zod`** (or `valibot` — see alternatives) as a dev/runtime dependency.
- Define schemas for every TikTok response shape the library consumes: `ItemListResponse`, `UserInfoResponse`, `HashtagDetailResponse`, `SoundDetailResponse`, `PlaylistDetailResponse`, `SearchResponse`, `CommentListResponse`, `TrendingFeedResponse`.
- Each schema validates `status_code`, `has_more`/*`hasMore`*, `cursor`, and the list key (`itemList`/`aweme_list`/etc.) before the consumer sees them.
- `makeRequest` returns `z.infer<typeof SchemaX>` instead of `Record<string, unknown>` — the `as` casts at ~125 sites collapse into typed access.

### Shared `hasMore()` accessor (overlaps ADR-008)
- The schema layer normalizes the `has_more`/`hasMore` casing drift at the boundary, so ADR-008's `hasMore()` accessor becomes a thin pass-through.

### tsconfig strictness unlocks (deferred until the boundary is in)
- Enable `noUncheckedIndexedAccess: true` (forces defensive `?.`/`??` on every `resp["key"]`).
- Enable `exactOptionalPropertyTypes: true` (fixes the `cookies?: ... | null` + `cookies = cookies ?? {}` conflation at `tiktok.ts:432`).
- Enable `noImplicitOverride: true` + annotate `override` on the 6 `toString()` overrides in `exceptions.ts`.
- `verbatimModuleSyntax` + `isolatedModules` are added under ADR-006.

### ESLint re-enable
- Flip `@typescript-eslint/no-explicit-any` from `"off"` to `"warn"` (or `"error"`) at `eslint.config.mjs:9`.
- Leave `"off"` as an `overrides` block for `examples/` and `tests/` (which legitimately use `any` for ad-hoc stubbing).

### Cleanup
- Remove the dead `// eslint-disable-next-line preserve-caught-error` at `tiktok.ts:596` (the rule doesn't exist).
- Replace the `globalThis as any` cast at `video.ts:173` with typed access (ADR-006 adds the `DOM` lib so `document` is available without a cast).

## Tasks (from the audit)

- [x] Install `zod` (or `valibot`). — `zod ^4.4.3` already in `package.json#dependencies`.
- [x] Define schemas for the 8 response shapes above; write unit tests for each (ADR-001 enables this). — `src/schemas.ts` + `tests/schemas.test.ts` (26 tests). Covers the 8 named shapes plus two `user.ts` variants (`UserListResponse`, `UserPlaylistResponse`). No runtime change yet — schemas + types only.
- [x] Refactor `makeRequest` to parse-then-infer; remove the ~125 `as` casts in `api/*`. — `makeRequest` now runs `schema.safeParse(data)` and returns `parsed.data` (throwing `InvalidResponseException` on mismatch); every `api/*.ts` consumer passes a `schema` and reads `resp.itemList`/`resp.hasMore`/etc. directly with no `resp[...] as` casts left anywhere in `src/api/`. Verified via manual read of all 8 files + `tiktok.ts`. The remaining ~42 `as` casts in `src/` (down from ~125) are internal `_extractFromData` field-extraction casts on already-validated data (e.g. `data["id"] as string`), not response-boundary casts — out of this ADR's scope.
- [x] Replace the 5 `Record<string, any>` in `user.ts:57,126,140,149,153` with `Record<string, unknown>` + narrowed accessors. — already landed; `grep "Record<string, any>" src/api/user.ts` is empty.
- [x] Enable `noImplicitOverride` in `tsconfig.json`. — already `true`; all 9 `toString()` overrides in `exceptions.ts` carry the `override` keyword.
- [x] Enable `exactOptionalPropertyTypes` in `tsconfig.json`. (`noUncheckedIndexedAccess` is already `true`.) — enabled; integration tests updated to pass `null` instead of `undefined` for optional `msTokens`.
- [x] Add `override` to the 6 `toString()` methods in `exceptions.ts`. — already landed.
- [x] Re-enable `@typescript-eslint/no-explicit-any` as `"warn"` (override-off for examples/tests). — already landed at `eslint.config.mjs:9` (override-off `:17`).
- [x] Remove the dead `preserve-caught-error` eslint-disable. — already gone; `grep` in `src/tiktok.ts` is empty.
- [x] Drop the `globalThis as any` cast in `video.ts:173`. — already gone; `grep` in `src/api/video.ts` is empty.

## Consequences

- **Positive:** A single TikTok shape change now fails loudly at the boundary instead of producing silent `undefined`/`NaN` downstream.
- **Positive:** Type system enforces reality rather than lying via `as`; the `unknown` declarations become genuinely protective.
- **Positive:** The strict tsconfig flags (`noUncheckedIndexedAccess` etc.) become safe to enable because the boundary already returns validated shapes.
- **Negative:** Adds `zod` as a runtime dep (≈8KB gzipped; the smallest of the validation libs). Acceptable for a library whose entire value proposition is "talk to an adversarial external API."
- **Negative:** If TikTok changes a shape, the library throws `ZodError` instead of silently breaking — desired behavior, but requires version-pinning schemas and a clear error story (subclass `TikTokException` — see ADR-010).
- **Negative:** ~30-40 hours of careful work to define and test all 8 schemas. Highest-effort item in Phase 2.

## Alternatives considered

- **`valibot`:** smaller bundle (~0.5KB per API), tree-shakeable, similar API. Adopt if package size matters for browser usage of this lib; otherwise `zod`'s larger ecosystem and tooling (zod-to-ts, openapi-zod) win. Defer to implementer's discretion; both schema APIs are similar enough that the schemas themselves are portable.
- **Hand-written `unknown`-narrowing guards (typeof/Array.isArray) per consumer:** no new dependency, but scatter validation across every api/* file and re-introduce the exact duplication ADR-008 fixes. Rejected.
- **`ajv` + JSON Schema:** schema-as-data is attractive for an external API, but JSON Schema's authoring DX is worse than zod's TS-native schemas, and we lose `z.infer` (the schemas *are* the types). Rejected.
- **Skip runtime validation, just enable `noUncheckedIndexedAccess`:** trades the type-safety win for an even larger diff of defensive `?.` everywhere with no actual runtime protection. Rejected.

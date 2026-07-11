# AGENTS.md

Compact guide for agents working in `UnTikTok-Api`. Read alongside `README.md` and `docs/decisions/*.md` (each ADR captures an architectural decision with rationale worth respecting).

---

## Before you implement anything

### 1. Check the ADRs first (mandatory)

Every change must start with a 60-second ADR scan. `docs/decisions/adr-*.md` are architecture decision records — each one captures *intent, status, and what has/hasn't been done yet*. Skipping this step is how agents re-litigate settled decisions or duplicate work.

Concrete pre-flight before writing code:

1. List `docs/decisions/adr-*.md` and skim the **`## Status`** field (`Accepted` vs `Proposed` vs superseded).
2. Identify which ADR(s) own the area you're touching (use the "Maps to audit" line and the table below).
3. Read the **`## Context`** + **`## Decision`** + **`## Tasks`** sections of those ADRs:
   - **`Accepted`**: the decision is in force. Don't re-argue it; respect the constraints. The `Tasks` checklist tells you what's already in place — don't undo it.
   - **`Proposed`** with `[ ]` tasks: the work is **not done yet**. If your change implements one of those tasks, fine — but update the ADR's task list (`- [x]`) in the same commit and call it out in your PR/response.
   - **`Proposed`** but you find the existing code already follows the decision: leave the ADR alone; mention in the response that the work appears partially or fully landed and ask the maintainer whether to mark it `Accepted`.
4. If your change **contradicts** an Accepted ADR, stop and surface the conflict to the user — do not silently override it.

**ADR ownership cheat sheet** (which ADR owns which area):

| Touching… | Read first |
|---|---|
| `tsconfig*.json`, `package.json#exports`, build scripts | ADR-006 |
| `Dockerfile`, `playwright` version, `scripts/check-playwright-version.mjs` | ADR-004 |
| Node version, `.nvmrc`, CI matrix, `engines` | ADR-003 |
| Vitest setup, `tests/`, any `*test.ts*` file | ADR-001, ADR-002 |
| `src/tiktok.ts` request dispatch, `makeRequest`, response validation | ADR-007 (Proposed), ADR-009 (Proposed) |
| `src/tiktok.ts` session lifecycle, the god-class itself | ADR-009 (Proposed) |
| `src/api/*` pagination loops, `hasMore`/`has_more` casing | ADR-008 (Proposed) |
| `src/exceptions.ts`, throw sites, exception taxonomy | ADR-010 |
| `npm run dev`, ts-node vs tsx | ADR-011 |
| `docs/*.md`, README badges, `video.desc`, `video.plays`, `user.followers` | ADR-012 (Proposed) |
| `.gitignore`, `.dockerignore`, `.env.example`, `ms_token` casing | ADR-005 |
| Session caching, `saveSessionState`/`loadSessionState` | `docs/session_caching.md` |

### 2. Git push policy (do not surprise the user)

Agents in this repo **do not push to GitHub** unless the user explicitly asks for it. This is non-negotiable.

- **Default**: stay local. Make edits, run checks, leave the working tree dirty so the user can review. Never run `git push`, `git push origin`, `gh pr create`, `gh release create`, or any equivalent on your own initiative.
- **Committing locally is also gated**: do **not** run `git commit` without an explicit user request. When the user *does* ask you to commit, follow repo conventions:
  - Inspect `git status`, `git diff`, and `git log --oneline -10` first to understand current state and commit style.
  - Stage only files you intentionally changed.
  - Never amend a commit, never force-push, never disable hooks, never run `git commit --amend` on a shared branch.
  - Do not introduce Co-authored-by trailers, sign-off lines, or emoji subjects unless the user asks.
  - Use a concise subject (`<scope>: <imperative>`, e.g. `api: extract paginate() helper`, `build: align playwright version`).
- **Releases and npm publishing**: out of scope for agents. See the *Publishing* section below — the user drives release tags; `publish.yml` does the rest.
- **Credentials and secrets**: never paste `MS_TOKEN`, `ms_token`, cookies, or any session JSON into a commit, issue, PR, or chat message. Even locals are fair game to leak via prompts. If you suspect a secret was about to be committed, stop and warn the user.

If you are unsure whether a git action is "surprising the user", it is. Ask first.

### 3. Errors that are not your job — record them, do not silently fix them

While working in this repo you will routinely encounter bugs, smells, or inconsistencies that fall *outside* the scope of the task you were actually given — a stray `throw new Error` that belongs in `InvalidParameterException` (ADR-010), a paging loop still using the old `has_more` casing (ADR-008), a doc claim that doesn't match the runtime (ADR-012), a TODO in code, an undocumented magic number, a flaky test, a missing `.tsbuildinfo` in `.dockerignore` (ADR-005), etc.

**Rule:** record it; don't fix it without permission.

Concretely:

- **Do not** silently patch it in the same commit/turn as your primary work. That mixes two unrelated changes, makes review harder, and lets the user lose track of what they asked for.
- **Do not** ignore it either. Drift compounds — an undocumented bug found twice becomes three, then a regression.
- **Do** add it to the file that owns the area — usually the relevant ADR's `## Tasks` checklist, flagged appropriately:
  - If the bug is exactly one of the unchecked tasks in a `Proposed` ADR's `## Tasks` section, **just check it off there** — it was already on the plan. That's not a separate fix, that's the ADR catching up to reality.
  - If the bug is *adjacent* but not on the plan, add a new bullet under that ADR's `## Tasks` (or `## Consequences / follow-ups` if your repo convention prefers) with `- [ ]` and a one-line description: `- [ ] video.ts:289 — "No download address found" throws raw Error; route through EmptyResponseException per ADR-010.` (`src/path:line`, short problem, link to the parent ADR for context.)
  - If no ADR owns the area at all (real bug, no decision record), open a new **`docs/decisions/adr-NNN-<slug>.md`** with status `Proposed` using the same skeleton as the existing ones (`Status`, `Date`, `Phase`, `Maps to audit`, `## Context`, `## Decision`, `## Tasks`, `## Consequences`, `## Alternatives considered`). Don't ship a stray fix without recording why.
- **Do** mention the find in your final response to the user, with the `file:line` reference and which ADR (or new ADR) now tracks it. Don't ask for permission to make the fix in that same message — let the user decide on the next turn.
- **Exception:** if a step is required to make the build green *right now* (e.g. ADR-011 says `npm run dev` uses `tsx`, you find a stray `ts-node` invocation breaking the build), you may fix the blocker, but still record the underlying smell in the relevant ADR if it isn't already. Blockers are not free passes.

The goal: every bug you notice becomes a tracked item, no later agent has to re-discover it, and the user always knows what was in/out of the original ask.

---

## Stack

- TypeScript library (`module: nodenext`, `target: ES2022`, dual CJS+ESM emit). See ADR-006.
- Single npm package. No monorepo.
- Runtime: Node `>=20.10` (`engines` + `.nvmrc`). CI matrix: `20.x`, `22.x`.
- Playwright `1.61.0` (pinned to match the `mcr.microsoft.com/playwright:v1.61.0-jammy` base image — see ADR-004).
- Test runner: Vitest 4.x.

## Directory layout

| Path | Purpose |
|---|---|
| `src/index.ts` | Public re-exports only |
| `src/tiktok.ts` | `TikTokApi` god-class — session lifecycle, request dispatch, X-Bogus signing (planned split in ADR-009, not yet implemented) |
| `src/api/*.ts` | Resource classes: `user`, `video`, `sound`, `hashtag`, `comment`, `trending`, `search`, `playlist` |
| `src/stealth/` | `stealthAsync` + `StealthConfig`; JS snippets in `src/stealth/js/` |
| `src/exceptions.ts` | `TikTokException` taxonomy — exported from `src/index.ts` |
| `tests/smoke.test.ts` | Auto-runs in CI (vitest wired) |
| `tests/*.integration.test.ts` | Gated by `CI_NETWORK=true` — hit real TikTok endpoints |
| `scripts/` | `check-playwright-version.mjs`, `rewrite-esm-extensions.mjs`, `write-esm-package.mjs` |
| `docs/decisions/adr-*.md` | Architecture decisions (ADR-001 through ADR-012) — primary design intent |
| `.codex/AGENTS.md` | Codex-specific supplements; subagent configs in `.codex/agents/` |

## Commands

```bash
npm install
npm run lint            # eslint src/
npm run typecheck       # tsc --noEmit
npm run build           # CJS pass + ESM pass + 2 post-process scripts (see below)
npm test                # vitest --watch by default; only picks up smoke.test.ts unless CI_NETWORK
npm run test:run        # vitest run (CI mode, non-watch)
npm run clean           # rimraf dist
npm run dev             # tsx watch src/index.ts (ADR-011)
npm run check:playwright-version   # CI step — guards Dockerfile base image vs npm driver drift
```

Single-test invocation: `npx vitest run tests/smoke.test.ts` (the only always-on suite) or `CI_NETWORK=true npx vitest run tests/trending.integration.test.ts`.

CI sequencing (see `.github/workflows/ci.yml`): `npm ci` → `check:playwright-version` → `lint` → `typecheck` → `build` → `test:run`. Mirror this order locally before opening a PR.

## Build quirks (ADR-006)

`npm run build` does **not** just run `tsc`. It is a five-step pipeline:

1. `tsc -p tsconfig.build.json` → `dist/` (CJS)
2. `tsc -p tsconfig.esm.json` → `dist/esm/` (ESM, extensionless imports)
3. `node scripts/rewrite-esm-extensions.mjs` — post-process the ESM output to add `.js`/`.index.js` to relative imports (Node strict ESM requires explicit extensions)
4. `node scripts/write-esm-package.mjs` — writes `dist/esm/package.json` with `{"type":"module"}`
5. The root `package.json` then exposes both via the `exports` map

Never import from `dist/` in source; never edit anything under `dist/` directly. Regenerate with `npm run clean && npm run build`.

If you change the tsconfig, also re-run all three compiled entry files to verify both CJS and ESM build outputs succeed.

## Gotchas worth knowing

- **Env var casing**: the library reads `process.env.ms_token` (lowercase). Tests and `src/` all use lowercase. CI passes the secret as `MS_TOKEN` (uppercase), but `tests/*.integration.test.ts` read `process.env.ms_token`, so the CI secret is currently **not** reaching the integration tests — confirmed broken. If you fix it, also update `.env.example` to match (ADR-005). Do not "fix" the source to read `MS_TOKEN`; the lowercase name is canonized by ADR-005.
- **Playwright version drift**: `Dockerfile` line 4 pins `mcr.microsoft.com/playwright:v1.61.0-jammy`. The npm driver is also pinned at `1.61.0` in `package.json`. `scripts/check-playwright-version.mjs` enforces this in CI and on every `npm run build` workflow — bumping one without the other will fail the build.
- **God-class `tiktok.ts`**: ~885 lines, ~25 responsibilities (session lifecycle, signing, dispatch, storage, health). ADR-009 proposes a 5-module split but is **Proposed**, not implemented. Touch this file with care; small changes still ripple.
- **Deprecated `_getSession`**: `src/tiktok.ts:268` is marked deprecated but still used by `src/api/video.ts:90,156,285` and `Video.fromUrl`. Prefer the async `_getValidSessionIndex` when adding new call sites.
- **`hasMore` vs `has_more` casing** is intentionally inconsistent across modules — `user/hashtag/sound/playlist/trending` use `hasMore`, `video/comment/search` use `has_more`. Both are real, both can break pagination if mixed up. (ADR-008 proposes a helper but is Proposed.)
- **`video.desc` is a doc bug**: the real getter is `video.description`; `video.stats?.playCount` → use typed `video.plays`; `user.stats?.followerCount` → `user.followers` (or `follows`, see ADR-012 §"Negative"). Fix only via the ADR-012 doc-update plan — do not introduce a `desc` alias in source.
- **Casing**: file names are camelCase (`userProfile.ts`-style — see `.agents/skills/UnTikTok-Api/SKILL.md`). Use named exports. Use relative imports for project-internal modules.
- **ESLint** disables `@typescript-eslint/no-explicit-any` in `tests/` and `examples/` (see `eslint.config.mjs`). The rule is `warn` (not error) in `src/`.
- **`createSessions().sleepAfter`**: don't skip it. It's `3` by default and exists to let cookies settle before requests fire.

## Testing

- `npm test` (watch mode) only runs `tests/smoke.test.ts`. The 11 `*.integration.test.ts` files all use `describe.skipIf(!process.env.CI_NETWORK)` and are silent otherwise.
- Integration tests boot Playwright + Chromium and hit live TikTok. They are **flaky by design** (anti-bot triggers, rate limits) which is why CI only runs them on the night cron (`0 4 * * *`), see ADR-002 / `ci.yml`. Do not run them in PR-blocking fashion locally without expecting intermittent failures.
- `vitest.config.ts` explicitly excludes legacy `tests/test_*.ts` (deleted in ADR-002, only historical context).
- Required env for integration: `ms_token` (lowercase), optional `headless`, optional `TIKTOK_BROWSER`.
- Integration test for video needs a real URL: set `TEST_VIDEO_URL` (MrBeast URL is the fallback).

## Publishing

**Do not run `npm publish` locally. Do not create GitHub Releases.** Either action is treated like a push — user-driven only. Releases ship via GitHub Releases — creating a `v<version>` release triggers `.github/workflows/publish.yml`, which builds with provenance and publishes. The repo's `prepublishOnly` script only runs `clean + build`; the actual `npm publish` happens in CI.

Version bump lives in `package.json`; the GitHub Release tag must match it exactly. `publish.yml` needs Node `22.x`.

If the user asks "is this ready to release?", read `package.json#version`, compare to the latest tag (`git tag --list 'v*' --sort=-v:refname | head -1`), and report — do **not** run `gh release create`, `npm publish`, or bump `version` without explicit confirmation.

## Security

- `.gitignore` covers `*cookies*.json`, `*session*.json`, `storageState*.json`, `.env*` (with `!.env.example` negation), `examples/.cache/` (ADR-005). Do not commit any of these.
- `.dockerignore` excludes tests/, docs/, secrets, and build artifacts (ADR-005). Verify before adding new top-level files.

## Pointers

- Adding a resource class (fetch endpoint)? Follow the pattern in `src/api/hashtag.ts` (smallest analogue). Cross-check the topic guides in `docs/`.
- Touching `makeRequest`? Read ADR-007 (runtime validation at the request boundary) — current state uses `Record<string, unknown>` and casts; the ADR proposes a Zod boundary that is Proposed.
- Touching imports/exports? Read ADR-006 (`nodenext` + dual-emit) and the build script above before changing anything that crosses `src/index.ts`.
- Touching session state? Read `docs/session_caching.md`.

## When unsure

Default order of operations:

0. **Re-read §1 above.** Skim relevant ADRs (`Status` + `Tasks`), confirm your change doesn't contradict an `Accepted` one.
1. Run `npm run lint && npm run typecheck` (fastest feedback).
2. Then `npm run test:run` (only `smoke.test.ts` runs without `CI_NETWORK`).
3. Then `npm run build` — only if you changed public surface, exports map, or stealth/scripts.
4. Surface any push, commit, release, or publish intent to the user. Do **not** run git push, gh release, or `npm publish` unilaterally.
5. Ask the user only on workflow/branch/release conventions not documented here.

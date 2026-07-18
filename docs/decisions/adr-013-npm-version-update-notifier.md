# ADR-013: npm version update-notifier (runtime warning + dev/CI guard)

- **Status:** Accepted
- **Date:** 2026-07-14
- **Phase:** 2 (DX / hygiene)
- **Maps to audit:** new — requested feature, no prior decision recorded.

## Context

The library is published to npm as `untiktok-api` at `package.json:2-3`. There is currently no mechanism to tell a consumer (or a maintainer) that the version they are running is no longer the latest. Symptoms in practice:

- **Consumers** run old releases for months without realising TikTok signature/endpoint drift has been fixed on `main`.
- **Maintainers** can drift the local `package.json#version` ahead of or behind `npm` without GitHub PR review catching it (the publish step is `npm publish` via `.github/workflows/publish.yml`, gated only by a manual `gh release create`).
- **`CODEBASE_AUDIT.md`-adjacent smell.** ADR-005 already centralises env-var convention; ADR-007 already establishes a "validation at the boundary" pattern. The analogous "check at the boundary" for the publish pipeline is missing.

The user request was for both **runtime** (warn a developer when they `import` the package and it's behind) and **dev/CI** (a script/jobs that fail or inform when local is behind npm).

## Decision

Add three small, opt-out-able version-check surfaces:

1. **Runtime (`src/version-check.ts` + `src/index.ts`)** — on `import { TikTokApi } from "untiktok-api"`, fire-and-forget a single `fetch` to `https://registry.npmjs.org/untiktok-api/latest`. If the local version is `<` the registry's latest, `console.warn` a one-line message with the nopkg link. Never throws, never blocks import, times out at 4s.

2. **Dev script (`scripts/check-npm-version.mjs`)** — `npm run check:npm-version` runs the same comparison as the runtime check, prints a human summary, accepts `--strict` (exit 1) and `--json` for tooling.

3. **CI step (`.github/workflows/ci.yml`)** — runs the script in *informational* mode (`continue-on-error: true`, `CI: ''` to bypass the auto-disable-for-CI escape hatch). Strict mode is intentionally **not** wired into CI: a maintainer who bumps `package.json` ahead of npm must be able to keep the green build until release time.

### Opt-outs (canonical)

The runtime check is suppressed if **any** of these is set:

| Env var | Origin |
|---|---|
| `UNTIKTOK_SKIP_VERSION_CHECK=1` | package-specific canonical |
| `NO_UPDATE_NOTIFIER=1` | `update-notifier` convention |
| `CI=true` | generic CI escape hatch (library users only) |

CI overrides `CI: ''` on its step so the maintainer-side check still runs. Documented in `.env.example` per ADR-005.

### Semver comparison

Hand-rolled integer-segment comparison in `compareVersions(a, b)` keeps the helper dependency-free. Pre-release tags sort below their stable release (`1.0.0 > 1.0.0-rc.1`). Sufficient for `dist-tags.latest` semantics; the npm `latest` tag tracks stable releases.

### Version resolution

`getCurrentVersion()` reads `package.json` at runtime via `createRequire(import.meta.url)` — works under both CJS (`dist/index.js`) and ESM (`dist/esm/index.js`) without bundler-time substitution. Falls back to `"0.0.0"` if resolution fails (test/edge cases), so the helper never crashes import.

### Why not `update-notifier`?

`update-notifier` is a popular drop-in, but it (a) writes a cache file to `~/.cache/update-notifier/...` (additional filesystem footprint), (b) injects an extra dependency on every install, (c) bypasses the env-var convention already established by ADR-005 in a non-obvious way. The 80-line module above covers the same surface with zero new dependencies.

## Tasks

- [x] `src/version-check.ts` — `fetchLatestNpmVersion`, `compareVersions`, `checkForUpdate`, `warnIfOutdated`, `isVersionCheckDisabled`, `getCurrentVersion`.
- [x] `src/index.ts` — fire-and-forget `checkForUpdate(getCurrentVersion()).then(warnIfOutdated)`.
- [x] `scripts/check-npm-version.mjs` — CLI/CI script with `--strict` and `--json` modes.
- [x] `package.json` — wire `"check:npm-version": "node scripts/check-npm-version.mjs"`.
- [x] `.github/workflows/ci.yml` — informational step with `continue-on-error: true` and `CI: ''`.
- [x] `tests/version-check.test.ts` — unit tests covering compareVersions, env-var opt-outs, fetch happy/error/abort paths, disabled flag, `warnIfOutdated` console output.
- [x] `.env.example` — document the three opt-out envs (ADR-005).

## Consequences

- **Positive:** Consumers find out they're stale without having to read release notes manually.
- **Positive:** Maintainers see npm drift on every PR without leaving IDE/GitHub.
- **Positive:** Zero new runtime dependencies; ~150 LOC of net code + a single script.
- **Positive:** Honours update-notifier semantics (`NO_UPDATE_NOTIFIER`, `CI`) so it composes with existing tooling.
- **Negative:** Adds a one-shot network call on `import`. Mitigated by 4s timeout, env-var opt-outs, and `fetch` against a single tiny endpoint.
- **Negative:** Consoles that pipe stdout/stderr (CI logs, library users running with `console` silenced) will get one extra line. Acceptable; matches `update-notifier` behaviour.

## Alternatives considered

- **`update-notifier` package**: heavier, cache file, new dep. Rejected.
- **`npm view` from the CLI**: spawns a subprocess per check, not callable from runtime. Rejected for runtime; kept out of CI path too.
- **GitHub Releases API instead of npm registry**: the registry's `latest` tag is the user-facing truth (matches what `npm install` would resolve), Releases is just metadata. Rejected as the primary signal; can be added later as a *secondary* signal if desired.
- **Strict CI failure on outdated**: blocks legitimate "bump version ahead of release" workflows where the maintainer wants the next version staged locally before publishing. Rejected; informational mode only.
- **Background poller (interval-based) rather than on-import**: higher complexity, breaks tree-shaking, has to deal with dispose lifecycle. Rejected.

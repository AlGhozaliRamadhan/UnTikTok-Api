```markdown
# UnTikTok-Api Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches you the core development patterns and conventions used in the UnTikTok-Api TypeScript codebase. You'll learn about file naming, import/export styles, commit message conventions, and how to write and organize tests. This guide will help you contribute code that fits seamlessly with the existing project structure.

## Coding Conventions

### File Naming
- Use **camelCase** for all file names.
  - Example: `userProfile.ts`, `videoFetcher.ts`

### Import Style
- Use **relative imports** for referencing modules within the project.
  - Example:
    ```typescript
    import { fetchUser } from './userProfile';
    ```

### Export Style
- Use **named exports** for all modules.
  - Example:
    ```typescript
    // In userProfile.ts
    export function fetchUser(id: string) { ... }

    // In another file
    import { fetchUser } from './userProfile';
    ```

### Commit Messages
- Mixed commit types, with some using the `build` prefix.
- Keep commit messages concise (average ~49 characters).
  - Example: `build: update dependencies for security patch`

## Workflows

### Adding a New Feature
**Trigger:** When implementing a new API endpoint or functionality  
**Command:** `/add-feature`

1. Create a new TypeScript file using camelCase naming.
2. Use relative imports to include any dependencies.
3. Export your functions or constants using named exports.
4. Write corresponding test files following the `*.test.*` pattern.
5. Commit your changes with a clear, concise message.

### Running Tests
**Trigger:** When verifying code correctness  
**Command:** `/run-tests`

1. Identify test files (pattern: `*.test.*`).
2. Use the project's preferred test runner (framework unknown; check project docs or `package.json`).
3. Run all tests and ensure they pass before submitting code.

### Building the Project
**Trigger:** Before deploying or sharing code  
**Command:** `/build`

1. Run the build command (likely via npm/yarn, e.g., `npm run build`).
2. Ensure output is free of errors and warnings.

### Check NPM Sync
**Trigger:** When verifying if the GitHub repository and NPM package are aligned  
**Command:** `/check-npm`

1. Read `package.json` to check the current version of the project.
2. Fetch the latest version published to the NPM registry (e.g., using `npm view untiktok-api version`).
3. Compare the two versions. If they match, confidently output "its done". If they do not match, advise the user that the NPM package is not yet aligned with the GitHub repository.

### Releasing to NPM
**Trigger:** When the user wants to publish a new version to NPM  
**Command:** `/release`

> **Important:** Publishing to NPM is NEVER done by running `npm publish` locally. This project uses a GitHub Actions workflow (`.github/workflows/publish.yml`) that publishes to NPM automatically when a GitHub Release is published. Locally running `npm publish` must be avoided.

1. Read `package.json` to verify the current `version` matches what the user wants to release.
2. If there is an ongoing release flow that already updated `package.json`, verify that the working tree has been committed and pushed to `main`. If not, commit and push the changes first.
3. Create a GitHub Release tagged with the version from `package.json` using:
   ```bash
   gh release create v<version> --title "<version>" --notes "Release <version>"
   ```
   - Example: for `package.json` version `1.0.7`, run `gh release create v1.0.7 --title "1.0.7" --notes "Release 1.0.7"`.
4. That release event triggers `.github/workflows/publish.yml`, which builds the project and publishes the package to NPM with provenance.
5. Do NOT run `npm login`, `npm whoami`, or `npm publish` locally. If the user asks for a direct local publish, remind them that this project is configured to ship via GitHub Releases and offer to create the release instead.

## Testing Patterns

- Test files follow the `*.test.*` naming convention (e.g., `userProfile.test.ts`).
- The testing framework is not specified; check for configuration in project files.
- Place tests alongside or near the modules they test for easy maintenance.

## Commands
| Command       | Purpose                                      |
|---------------|----------------------------------------------|
| /add-feature  | Scaffold and implement a new feature/module  |
| /run-tests    | Execute all test suites                      |
| /build        | Build the project for deployment             |
| /check-npm    | Check if GitHub repo and NPM package are synced |
| /release      | Publish a new version to NPM via GitHub Release |
```

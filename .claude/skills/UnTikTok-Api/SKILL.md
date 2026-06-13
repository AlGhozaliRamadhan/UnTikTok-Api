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
```

#!/usr/bin/env node
// ============================================================
// typecheck-docs.mjs — extract fenced TS/JS code blocks from docs/*.md
// and run them through `tsc --noEmit` (ADR-012 follow-up).
//
// Skip: first non-empty line is `// @docs-skip` (signatures / pseudo-code).
// ============================================================

import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const docsDir = join(repoRoot, "docs");
const srcIndex = join(repoRoot, "src", "index.ts");

const FENCE_RE = /^```(?:ts|typescript|js|javascript)\s*$/;

function* extractBlocks(filePath) {
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  let inBlock = false;
  let blockStart = 0;
  let buf = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inBlock && FENCE_RE.test(line)) {
      inBlock = true;
      blockStart = i + 1;
      buf = [];
      continue;
    }
    if (inBlock && line === "```") {
      yield { file: filePath, line: blockStart, code: buf.join("\n") };
      inBlock = false;
      buf = [];
      continue;
    }
    if (inBlock) buf.push(line);
  }
}

function isSkipped(code) {
  const firstNonEmpty = code.split(/\r?\n/).find((l) => l.trim().length > 0);
  return firstNonEmpty?.trim().startsWith("// @docs-skip") ?? false;
}

/** Rewrite package imports to a relative path from the temp file to src/index.ts. */
function rewriteImports(code, outPath) {
  // TypeScript nodenext resolves extensionless relative imports; strip `.ts`
  // so we don't need allowImportingTsExtensions.
  const relToSrc = relative(dirname(outPath), srcIndex)
    .replaceAll("\\", "/")
    .replace(/\.ts$/, "")
    .replace(/^(?![./])/, "./");

  return code
    .replaceAll(/from\s+["']\.\.\/src(?:\/index)?["']/g, `from "${relToSrc}"`)
    .replaceAll(/from\s+["']\.\/src(?:\/index)?["']/g, `from "${relToSrc}"`)
    .replaceAll(/from\s+["']untiktok-api["']/g, `from "${relToSrc}"`)
    .replaceAll(/import\s+["']\.\.\/src(?:\/index)?["']/g, `import "${relToSrc}"`)
    .replaceAll(/import\s+["']untiktok-api["']/g, `import "${relToSrc}"`);
}

/**
 * Split multi-line import/export-from statements out of the body so they
 * stay at module top-level, while the rest can use top-level await inside
 * an async IIFE.
 */
function hoistImports(code) {
  const lines = code.split(/\r?\n/);
  const imports = [];
  const body = [];
  let collecting = null; // 'import' | null
  let buf = [];

  const flushImport = () => {
    if (buf.length) imports.push(buf.join("\n"));
    buf = [];
    collecting = null;
  };

  for (const line of lines) {
    if (collecting) {
      buf.push(line);
      // End of a multi-line import: line contains `from "..."` or ends with `;`
      if (/from\s+["']/.test(line) || /;\s*$/.test(line)) {
        flushImport();
      }
      continue;
    }

    if (/^\s*import\s/.test(line)) {
      // Single-line import (has `from` or side-effect form) vs multi-line start.
      if (/from\s+["']/.test(line) || /;\s*$/.test(line) || /import\s+["']/.test(line)) {
        imports.push(line);
      } else {
        collecting = "import";
        buf = [line];
      }
      continue;
    }

    body.push(line);
  }
  // Unclosed multi-line import — treat remaining as body to surface a real error.
  if (buf.length) body.push(...buf);

  return { imports, body };
}

function buildContents(code, outPath) {
  const rewritten = rewriteImports(code, outPath);
  const { imports, body } = hoistImports(rewritten);

  const usesApi = /\bapi\./.test(rewritten);
  const declaresApi = /\b(const|let|var|async function|function)\s+api\b/.test(rewritten);
  const usesNewTikTokApi = /\bnew\s+TikTokApi\b/.test(rewritten);
  const hasTikTokApiImport = imports.some((l) => /\bTikTokApi\b/.test(l));

  const relToSrc = relative(dirname(outPath), srcIndex)
    .replaceAll("\\", "/")
    .replace(/\.ts$/, "")
    .replace(/^(?![./])/, "./");

  // Auto-import exception / class names referenced but not imported — keeps
  // fragment examples (quick_start error handling, Video.fromUrl, etc.) honest
  // without forcing every narrative block to re-declare the full import list.
  const AUTO_SYMBOLS = [
    "TikTokApi",
    "Video",
    "User",
    "Sound",
    "Hashtag",
    "Playlist",
    "Comment",
    "CaptchaException",
    "NotFoundException",
    "EmptyResponseException",
    "InvalidParameterException",
    "SessionUnavailableException",
    "InvalidJSONException",
    "InvalidResponseException",
    "SoundRemovedException",
    "TikTokException",
  ];
  const missing = AUTO_SYMBOLS.filter((sym) => {
    if (!new RegExp(`\\b${sym}\\b`).test(rewritten)) return false;
    return !imports.some((l) => new RegExp(`\\b${sym}\\b`).test(l));
  });
  // TikTokApi only auto-imports when used as a value constructor, not just a type.
  if (!usesNewTikTokApi && !hasTikTokApiImport) {
    const idx = missing.indexOf("TikTokApi");
    if (idx !== -1) missing.splice(idx, 1);
  }

  const header = [
    "// auto-generated by scripts/typecheck-docs.mjs — do not edit",
    ...imports,
  ];
  if (missing.length > 0) {
    header.push(`import { ${missing.join(", ")} } from "${relToSrc}";`);
  }

  if (usesApi && !declaresApi) {
    header.push(`import type { TikTokApi as _TikTokApi } from "${relToSrc}";`);
    header.push("declare const api: _TikTokApi;");
  }

  // Only wrap if the body has non-whitespace content (import-only blocks
  // should not get an empty async IIFE — they typecheck as-is).
  const bodyText = body.join("\n");
  if (!bodyText.trim()) {
    return header.join("\n") + "\n";
  }

  return header.join("\n") + "\nvoid (async () => {\n" + bodyText + "\n})();\n";
}

function main() {
  const docs = readdirSync(docsDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(docsDir, f));

  const tmp = mkdtempSync(join(tmpdir(), "untiktok-docs-"));
  const extracted = [];
  try {
    for (const file of docs) {
      let blockIdx = 0;
      for (const block of extractBlocks(file)) {
        blockIdx++;
        if (isSkipped(block.code)) continue;
        const rel = file.slice(repoRoot.length + 1).replaceAll("\\", "/");
        const name = `${rel.replaceAll(/[^\w.-]/g, "_")}.${blockIdx}.ts`;
        const outPath = join(tmp, name);
        writeFileSync(outPath, buildContents(block.code, outPath), "utf8");
        extracted.push({ path: outPath, file: rel, line: block.line });
      }
    }

    if (extracted.length === 0) {
      console.log("[typecheck-docs] no fenced TS/JS blocks found in docs/*.md");
      return;
    }

    const tsconfigPath = join(tmp, "tsconfig.json");
    writeFileSync(
      tsconfigPath,
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "nodenext",
            moduleResolution: "nodenext",
            lib: ["ES2022", "DOM"],
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            noEmit: true,
            types: ["node"],
            typeRoots: [join(repoRoot, "node_modules", "@types")],
          },
          include: ["**/*.ts"],
        },
        null,
        2
      ),
      "utf8"
    );

    console.log(`[typecheck-docs] extracted ${extracted.length} block(s); running tsc --noEmit`);
    try {
      execFileSync(
        process.execPath,
        [join(repoRoot, "node_modules", "typescript", "bin", "tsc"), "-p", tsconfigPath],
        { stdio: "inherit", cwd: tmp }
      );
      console.log("[typecheck-docs] OK");
    } catch (err) {
      console.error(
        `\n[typecheck-docs] FAILED — one or more docs code blocks do not typecheck.`
      );
      console.error(`[typecheck-docs] Blocks live in ${tmp} (kept for inspection).`);
      process.exitCode = err.status ?? 1;
      return;
    }

    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  } catch (e) {
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    throw e;
  }
}

main();

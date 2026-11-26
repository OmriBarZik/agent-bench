import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DiffPageInput, PageAssets, PageFile } from "./diff-page.types";

/** diff2html 3.x from the jsDelivr CDN, so the page needs no install and no dependency in this repo. */
const DIFF2HTML = "https://cdn.jsdelivr.net/npm/diff2html@3";
const HIGHLIGHT = "https://cdn.jsdelivr.net/npm/highlight.js@11/styles";

/**
 * A GitHub-style page for one run's patch: a file tree on the side (filter, folders, viewed marks),
 * split or unified diffs with syntax highlighting, and light or dark to match the system.
 * The patch and the page's CSS and script are inlined, so the file stands alone.
 */
export function diffPageHtml({ input, assets = readAssets() }: { input: DiffPageInput; assets?: PageAssets }): string {
  const files: PageFile[] = input.files.map((file) => ({
    path: file.path,
    status: file.status,
    previousPath: file.previousPath,
    added: file.added,
    removed: file.removed,
  }));
  const data = { title: input.title, storageKey: input.storageKey, patch: input.patch, files };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(input.title)}</title>
<link rel="stylesheet" href="${HIGHLIGHT}/github.min.css" media="(prefers-color-scheme: light)">
<link rel="stylesheet" href="${HIGHLIGHT}/github-dark.min.css" media="(prefers-color-scheme: dark)">
<link rel="stylesheet" href="${DIFF2HTML}/bundles/css/diff2html.min.css">
<script src="${DIFF2HTML}/bundles/js/diff2html-ui.min.js"></script>
<style>
${assets.css}
</style>
</head>
<body>
<header class="bar">
  <button class="icon" id="toggle-tree" title="Show or hide the file tree">☰</button>
  <div class="heading">
    <h1>${escapeHtml(input.title)}</h1>
    <span class="range">${escapeHtml(input.subtitle)}</span>
  </div>
  <span class="stats" id="stats"></span>
  <span class="spacer"></span>
  <span class="progress" id="progress"></span>
  <div class="segmented">
    <button data-format="side-by-side">Split</button>
    <button data-format="line-by-line">Unified</button>
  </div>
</header>
<div class="layout">
  <nav class="tree" id="tree-pane">
    <input id="filter" type="search" placeholder="Filter changed files" autocomplete="off">
    <div id="tree"></div>
  </nav>
  <main id="diff"></main>
</div>
<script>
const PAGE = ${embedJson(data)};
${assets.script}
</script>
</body>
</html>
`;
}

/** The page's CSS and script, kept next to this file so they can be edited as CSS and JavaScript. */
export function readAssets(): PageAssets {
  return {
    css: readFileSync(join(import.meta.dir, "page.css"), "utf8"),
    script: readFileSync(join(import.meta.dir, "page.js"), "utf8"),
  };
}

/** JSON inside a script tag: `<` is escaped so a `</script>` in the patch cannot end the tag. */
function embedJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

import type { DiffPageInput } from "./diff-page.types";

/** diff2html 3.x from the jsDelivr CDN, so the page needs no install and no dependency in this repo. */
const DIFF2HTML = "https://cdn.jsdelivr.net/npm/diff2html@3";
const HIGHLIGHT_STYLE = "https://cdn.jsdelivr.net/npm/highlight.js@11/styles/github.min.css";

/**
 * A GitHub-style page for one run's patch: a collapsible file list, side-by-side or unified view,
 * syntax highlighting, and a viewed checkbox per file. The patch is embedded, so the file works offline once cached.
 */
export function diffPageHtml({ title, subtitle, patch }: DiffPageInput): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="${HIGHLIGHT_STYLE}">
<link rel="stylesheet" href="${DIFF2HTML}/bundles/css/diff2html.min.css">
<script src="${DIFF2HTML}/bundles/js/diff2html-ui.min.js"></script>
<style>
  body { margin: 0; font: 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  header { position: sticky; top: 0; z-index: 10; display: flex; gap: 16px; align-items: center;
    padding: 10px 16px; background: #f6f8fa; border-bottom: 1px solid #d0d7de; }
  header h1 { font-size: 16px; margin: 0; }
  header .range { color: #57606a; font-family: ui-monospace, monospace; }
  header .spacer { flex: 1; }
  header button { padding: 4px 10px; border: 1px solid #d0d7de; border-radius: 6px; background: #fff; cursor: pointer; }
  header button[aria-pressed="true"] { background: #0969da; color: #fff; border-color: #0969da; }
  main { padding: 16px; }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(title)}</h1>
  <span class="range">${escapeHtml(subtitle)}</span>
  <span class="spacer"></span>
  <button data-format="side-by-side" aria-pressed="true">Split</button>
  <button data-format="line-by-line" aria-pressed="false">Unified</button>
</header>
<main id="diff"></main>
<script>
  const patch = ${embedJson(patch)};
  const target = document.getElementById("diff");
  const draw = (outputFormat) => {
    const ui = new Diff2HtmlUI(target, patch, {
      outputFormat,
      drawFileList: true,
      fileListToggle: true,
      fileListStartVisible: true,
      fileContentToggle: true,
      matching: "lines",
      synchronisedScroll: true,
      highlight: true,
      stickyFileHeaders: true,
    });
    ui.draw();
    ui.highlightCode();
    for (const button of document.querySelectorAll("header button")) {
      button.setAttribute("aria-pressed", String(button.dataset.format === outputFormat));
    }
  };
  for (const button of document.querySelectorAll("header button")) {
    button.addEventListener("click", () => draw(button.dataset.format));
  }
  if (patch.trim() === "") {
    target.textContent = "No file changes between these commits.";
  } else {
    draw("side-by-side");
  }
</script>
</body>
</html>
`;
}

/** JSON inside a script tag: `<` is escaped so a `</script>` in the patch cannot end the tag. */
function embedJson(value: string): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

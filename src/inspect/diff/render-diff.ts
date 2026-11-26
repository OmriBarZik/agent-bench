import { colorLine, fit } from "../render/terminal-text";
import type { LineKind } from "../render/terminal-text.types";
import { DIFF_CHROME_ROWS, followSelection } from "./diff-viewer";
import type { DiffViewer, FileDiff } from "./run-diff.types";

/** The run diff over the Runs list: the changed files with their line counts, or one file's colored patch. */
export function renderDiff({ viewer, rows, columns }: { viewer: DiffViewer; rows: number; columns: number }): string {
  const width = Math.max(columns, 1);
  const bodyRows = Math.max(0, rows - DIFF_CHROME_ROWS);
  const painted =
    viewer.mode === "files" ? filesScreen({ viewer, bodyRows, width }) : patchScreen({ viewer, bodyRows, width });

  return painted.slice(0, rows).join("\r\n");
}

function filesScreen({ viewer, bodyRows, width }: { viewer: DiffViewer; bodyRows: number; width: number }): string[] {
  const added = viewer.files.reduce((sum, file) => sum + file.added, 0);
  const removed = viewer.files.reduce((sum, file) => sum + file.removed, 0);
  const count = viewer.files.length === 1 ? "1 file" : `${viewer.files.length} files`;
  const scroll = followSelection({ selected: viewer.selected, scroll: viewer.listScroll, page: Math.max(1, bodyRows) });
  const countWidth = Math.max(...viewer.files.map((file) => countLabel(file).length), 0);
  const body = viewer.files.slice(scroll, scroll + bodyRows).map((file, index) => {
    const text = `${file.status} ${countLabel(file).padStart(countWidth)}  ${pathLabel(file)}`;
    const kind: LineKind = scroll + index === viewer.selected ? "selected" : "plain";

    return colorLine({ text: fit({ text, width }), kind });
  });

  if (viewer.files.length === 0) {
    body.push(colorLine({ text: fit({ text: "No file changes between these commits.", width }), kind: "dim" }));
  }

  return framed({
    title: `Diff · ${viewer.label} · ${count} · +${added} -${removed}`,
    subtitle: `${viewer.range} · read from git, nothing checked out`,
    body,
    bodyRows,
    footer: "↑↓ pgup/pgdn move · enter opens the file's patch · esc back to runs",
    width,
  });
}

function patchScreen({ viewer, bodyRows, width }: { viewer: DiffViewer; bodyRows: number; width: number }): string[] {
  const file = viewer.files[viewer.selected];
  const lines = file?.lines ?? [];
  const top = Math.min(viewer.patchScroll, Math.max(0, lines.length - bodyRows));
  const body = lines
    .slice(top, top + bodyRows)
    .map((line) => colorLine({ text: fit({ text: line, width }), kind: patchKind(line) }));
  const last = Math.min(top + bodyRows, lines.length);

  return framed({
    title: `Diff · ${viewer.label} · file ${viewer.selected + 1}/${viewer.files.length} · ${file ? pathLabel(file) : ""}`,
    subtitle: file ? `${file.status} ${countLabel(file)} · ${viewer.range}` : viewer.range,
    body,
    bodyRows,
    footer: `lines ${lines.length === 0 ? 0 : top + 1}–${last} of ${lines.length} · ↑↓ pgup/pgdn scroll · n/p next/previous file · esc file list`,
    width,
  });
}

function framed({
  title,
  subtitle,
  body,
  bodyRows,
  footer,
  width,
}: {
  title: string;
  subtitle: string;
  body: string[];
  bodyRows: number;
  footer: string;
  width: number;
}): string[] {
  const painted = [
    colorLine({ text: fit({ text: title, width }), kind: "title" }),
    colorLine({ text: fit({ text: subtitle, width }), kind: "dim" }),
    ...body,
  ];

  while (painted.length < bodyRows + 2) {
    painted.push(colorLine({ text: "", kind: "plain" }));
  }

  painted.push(colorLine({ text: fit({ text: footer, width }), kind: "hint" }));

  return painted;
}

function patchKind(line: string): LineKind {
  if (line.startsWith("diff --git") || line.startsWith("+++ ") || line.startsWith("--- ")) {
    return "title";
  }

  if (line.startsWith("@@")) {
    return "hunk";
  }

  if (line.startsWith("+")) {
    return "added";
  }

  if (line.startsWith("-")) {
    return "removed";
  }

  if (line.startsWith(" ") || line === "") {
    return "plain";
  }

  return "dim";
}

function countLabel(file: FileDiff): string {
  return `+${file.added} -${file.removed}`;
}

function pathLabel(file: FileDiff): string {
  if (file.previousPath) {
    return `${file.previousPath} -> ${file.path}`;
  }

  return file.path;
}

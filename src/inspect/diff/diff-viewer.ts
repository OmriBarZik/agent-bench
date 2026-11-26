import type { RunChoice } from "../list/select-state.types";
import type { DiffRange, DiffViewer, FileDiff } from "./run-diff.types";

/** Rows the viewer keeps for its title, range and footer lines. */
export const DIFF_CHROME_ROWS = 3;

/** A viewer on the file list of `choice`'s diff. */
export function openDiffViewer({
  choice,
  range,
  files,
}: {
  choice: RunChoice;
  range: DiffRange;
  files: FileDiff[];
}): DiffViewer {
  return {
    runId: choice.runId,
    label: `${choice.taskId} × ${choice.configId}`,
    range: `${range.baseSha.slice(0, 12)}..${range.tipSha.slice(0, 12)}`,
    files,
    mode: "files",
    selected: 0,
    listScroll: 0,
    patchScroll: 0,
  };
}

/** Esc: a patch goes back to the file list, and the file list closes. */
export function diffViewerBack(viewer: DiffViewer): DiffViewer | null {
  if (viewer.mode === "patch") {
    return { ...viewer, mode: "files" };
  }

  return null;
}

/**
 * The file list moves with the arrows, page keys, home and end, and enter opens the highlighted patch.
 * A patch scrolls with the same keys; n and p open the next and previous file.
 */
export function applyDiffKey({ viewer, key, rows }: { viewer: DiffViewer; key: string; rows: number }): DiffViewer {
  const page = Math.max(1, rows - DIFF_CHROME_ROWS);

  if (viewer.mode === "files") {
    return applyFilesKey({ viewer, key, page });
  }

  return applyPatchKey({ viewer, key, page });
}

function applyFilesKey({ viewer, key, page }: { viewer: DiffViewer; key: string; page: number }): DiffViewer {
  if ((key === "\r" || key === "\n") && viewer.files.length > 0) {
    return { ...viewer, mode: "patch", patchScroll: 0 };
  }

  const delta = moveDelta({ key, page, total: viewer.files.length });

  if (delta === 0) {
    return viewer;
  }

  const selected = clamp({ value: viewer.selected + delta, max: viewer.files.length - 1 });

  return { ...viewer, selected, listScroll: followSelection({ selected, scroll: viewer.listScroll, page }) };
}

function applyPatchKey({ viewer, key, page }: { viewer: DiffViewer; key: string; page: number }): DiffViewer {
  if (key === "n" || key === "p") {
    const selected = clamp({ value: viewer.selected + (key === "n" ? 1 : -1), max: viewer.files.length - 1 });
    const listScroll = followSelection({ selected, scroll: viewer.listScroll, page });

    return { ...viewer, selected, listScroll, patchScroll: 0 };
  }

  const lineCount = viewer.files[viewer.selected]?.lines.length ?? 0;
  const delta = moveDelta({ key, page, total: lineCount });

  return { ...viewer, patchScroll: clamp({ value: viewer.patchScroll + delta, max: lineCount - page }) };
}

/** How far a key moves the highlight or the window, or 0 for a key that does not move it. */
function moveDelta({ key, page, total }: { key: string; page: number; total: number }): number {
  if (key === "\x1b[A" || key === "\x1bOA") {
    return -1;
  }

  if (key === "\x1b[B" || key === "\x1bOB") {
    return 1;
  }

  if (key === "\x1b[5~") {
    return -page;
  }

  if (key === "\x1b[6~" || key === " ") {
    return page;
  }

  if (key === "\x1b[H" || key === "\x1b[1~" || key === "\x1bOH") {
    return -total;
  }

  if (key === "\x1b[F" || key === "\x1b[4~" || key === "\x1bOF") {
    return total;
  }

  return 0;
}

/** Scrolls the list just enough to keep `selected` on screen. */
export function followSelection({
  selected,
  scroll,
  page,
}: {
  selected: number;
  scroll: number;
  page: number;
}): number {
  if (selected < scroll) {
    return selected;
  }

  if (selected >= scroll + page) {
    return selected - page + 1;
  }

  return scroll;
}

function clamp({ value, max }: { value: number; max: number }): number {
  return Math.max(0, Math.min(value, Math.max(0, max)));
}

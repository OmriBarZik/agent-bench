import { changedFileLine } from "./format-run";
import type { RunChoice } from "./select-state.types";
import { colorLine, fit } from "./terminal-text";
import type { LineKind } from "./terminal-text.types";

/** The pane under the list: the selected run, from the database, and the paths it changed. */
export function detailLines({
  choice,
  notice,
  height,
  columns,
}: {
  choice: RunChoice | undefined;
  notice: string;
  height: number;
  columns: number;
}): string[] {
  const plain: string[] = [];

  if (notice !== "") {
    plain.push(notice);
  }

  if (!choice) {
    plain.push("No runs match the filter.");

    return colorDetails({ plain, notice, height, columns });
  }

  plain.push(titleLine(choice));
  plain.push(metaLine(choice));
  plain.push(choice.branch);
  plain.push(choice.commitSha ? choice.commitSha.slice(0, 12) : "no changes committed");
  plain.push(choice.transcriptPath ? "transcript ready" : "no transcript");

  if (choice.current) {
    plain.push("currently checked out");
  }

  if (!choice.present) {
    plain.push("branch is not in this Chromium checkout");
  }

  appendFiles({ plain, choice, height });

  return colorDetails({ plain, notice, height, columns });
}

function appendFiles({ plain, choice, height }: { plain: string[]; choice: RunChoice; height: number }) {
  const fileRoom = height - plain.length;

  if (fileRoom <= 0) {
    return;
  }

  if (choice.changedFiles.length === 0 && choice.present) {
    plain.push("no file changes");

    return;
  }

  if (choice.changedFiles.length === 0) {
    return;
  }

  const overflow = choice.changedFiles.length > fileRoom;
  const shown = overflow ? Math.max(fileRoom - 1, 0) : choice.changedFiles.length;

  for (const file of choice.changedFiles.slice(0, shown)) {
    plain.push(changedFileLine(file));
  }

  if (overflow) {
    plain.push(`${choice.changedFiles.length - shown} more files`);
  }
}

function colorDetails({
  plain,
  notice,
  height,
  columns,
}: {
  plain: string[];
  notice: string;
  height: number;
  columns: number;
}): string[] {
  return plain.slice(0, height).map((line, index) => {
    const kind: LineKind = notice !== "" && index === 0 ? "notice" : "plain";

    return colorLine({ text: fit({ text: line, width: columns }), kind });
  });
}

function titleLine(choice: RunChoice): string {
  const name = `${choice.taskId} × ${choice.configId}`;

  if (!choice.title) {
    return name;
  }

  return `${name} · ${choice.title}`;
}

function metaLine(choice: RunChoice): string {
  const model = choice.model === "" ? "default model" : choice.model;

  return `${model} · ${choice.status} · repeat ${choice.repeat}`;
}

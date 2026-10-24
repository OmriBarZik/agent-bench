import { changedFileLine, scoreLabel } from "./format-run";
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

  if (choice.judgeNote) {
    plain.push(choice.judgeNote.replace(/\s+/g, " ").trim());
  }

  const usage = judgeUsageLine(choice);

  if (usage) {
    plain.push(usage);
  }

  plain.push(choice.branch);
  plain.push(choice.commitSha ? choice.commitSha.slice(0, 12) : "no changes committed");
  plain.push(transcriptStatus(choice));

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

function transcriptStatus(choice: RunChoice): string {
  const run = choice.transcriptPath ? "run transcript" : "no run transcript";
  const judge = choice.judgeTranscriptPath ? "judge transcript" : "no judge transcript";

  return `${run} · ${judge}`;
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

  return `${model} · ${choice.status} · repeat ${choice.repeat} · ${scoreText(choice)}`;
}

function scoreText(choice: RunChoice): string {
  const label = scoreLabel(choice.score).trim();

  if (choice.success == null) {
    return `score ${label}`;
  }

  if (choice.success) {
    return `score ${label} · success`;
  }

  if (choice.successThreshold == null) {
    return `score ${label} · below threshold`;
  }

  return `score ${label} · below ${choice.successThreshold}`;
}

function judgeUsageLine(choice: RunChoice): string | null {
  const parts: string[] = [];

  if (choice.judgeModel) {
    parts.push(choice.judgeModel);
  }

  if (choice.judgeDurationMs != null) {
    parts.push(`${Math.round(choice.judgeDurationMs / 1000)}s`);
  }

  if (choice.judgeCostUsd != null) {
    parts.push(`$${choice.judgeCostUsd.toFixed(3)}`);
  }

  if (choice.judgeTurns != null) {
    parts.push(choice.judgeTurns === 1 ? "1 turn" : `${choice.judgeTurns} turns`);
  }

  if (parts.length === 0) {
    return null;
  }

  return `judge ${parts.join(" · ")}`;
}

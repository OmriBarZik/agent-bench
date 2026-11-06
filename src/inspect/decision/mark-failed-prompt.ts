import { colorLine, fit } from "../render/terminal-text";
import type {
  MarkFailedAnswer,
  MarkFailedKeyResult,
  MarkFailedPrompt,
  MarkFailedRun,
} from "./mark-failed-prompt.types";

const CHOICES = ["No, keep the decision", "Yes, mark it failed"] as const;

/** Opens the question for these runs, highlighting No. Empty when nothing failed. */
export function openMarkFailedPrompt(runIds: string[]): MarkFailedPrompt | null {
  if (runIds.length === 0) {
    return null;
  }

  return { runIds, selected: 0 };
}

/**
 * y marks the run failed and n keeps the decision. 1–2 or enter choose the highlight.
 * A queue advances to the next failed run. Any other key leaves the question open.
 */
export function applyMarkFailedKey({ prompt, key }: { prompt: MarkFailedPrompt; key: string }): MarkFailedKeyResult {
  if (key === "y" || key === "Y" || key === "2") {
    return advance({ prompt, markFailed: true });
  }

  if (key === "n" || key === "N" || key === "1") {
    return advance({ prompt, markFailed: false });
  }

  if (key === "\r" || key === "\n") {
    return advance({ prompt, markFailed: prompt.selected === 1 });
  }

  if (isUp(key) || isDown(key)) {
    const delta = isUp(key) ? -1 : 1;
    const selected = Math.min(CHOICES.length - 1, Math.max(0, prompt.selected + delta));

    return { kind: "stay", prompt: { runIds: prompt.runIds, selected } };
  }

  return { kind: "stay", prompt };
}

/** The question pane: the run that failed to build, then no and yes. */
export function markFailedPromptLines({
  prompt,
  choices,
  height,
  columns,
}: {
  prompt: MarkFailedPrompt;
  choices: MarkFailedRun[];
  height: number;
  columns: number;
}): string[] {
  const runId = prompt.runIds[0] ?? "";
  const choice = choices.find((item) => item.runId === runId);
  const name = choice ? `${choice.taskId} × ${choice.configId}` : runId;
  const waiting = prompt.runIds.length > 1 ? `  (${prompt.runIds.length} failed)` : "";
  const title = `Build failed. Mark ${name} as failed?${waiting}`;
  const rows = CHOICES.map((label, index) => `${index + 1}  ${label}`);
  const footer = "y marks it failed, n keeps it, esc dismisses";
  const lines = [title, ...rows, footer].slice(0, height);

  return lines.map((line, index) => {
    const choiceIndex = index - 1;
    const kind = choiceIndex === prompt.selected ? "selected" : "plain";

    return colorLine({ text: fit({ text: `  ${line}`, width: columns }), kind });
  });
}

function advance({ prompt, markFailed }: { prompt: MarkFailedPrompt; markFailed: boolean }): MarkFailedAnswer {
  const runId = prompt.runIds[0] ?? "";
  const rest = prompt.runIds.slice(1);

  return {
    kind: "answer",
    runId,
    markFailed,
    prompt: rest.length === 0 ? null : { runIds: rest, selected: 0 },
  };
}

function isUp(key: string): boolean {
  return key === "\x1b[A" || key === "\x1bOA";
}

function isDown(key: string): boolean {
  return key === "\x1b[B" || key === "\x1bOB";
}

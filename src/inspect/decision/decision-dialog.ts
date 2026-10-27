import { JUDGE_DECISIONS } from "../../db/judge-decision";
import type { JudgeDecision } from "../../db/judge-decision.types";
import { colorLine, fit } from "../render/terminal-text";
import type { DecisionDialog, DecisionKeyResult } from "./decision-dialog.types";

/** Opens the dialog on this run, highlighting its current decision. */
export function openDecisionDialog({
  runId,
  decision,
}: {
  runId: string;
  decision: JudgeDecision | null;
}): DecisionDialog {
  const index = decision == null ? 0 : JUDGE_DECISIONS.indexOf(decision);

  return { runId, selected: index === -1 ? 0 : index };
}

/**
 * Arrow keys move the highlight. 1–4 or enter chooses that judge decision.
 * Any other key leaves the dialog open.
 */
export function applyDecisionKey({ dialog, key }: { dialog: DecisionDialog; key: string }): DecisionKeyResult {
  const numbered = decisionAt(key);

  if (numbered) {
    return { kind: "choose", decision: numbered };
  }

  if (key === "\r" || key === "\n") {
    return { kind: "choose", decision: JUDGE_DECISIONS[dialog.selected] ?? "failed" };
  }

  if (isUp(key)) {
    return { kind: "stay", dialog: moveSelection({ dialog, delta: -1 }) };
  }

  if (isDown(key)) {
    return { kind: "stay", dialog: moveSelection({ dialog, delta: 1 }) };
  }

  return { kind: "stay", dialog };
}

/** The dialog pane: one row per judge decision, with the highlight marked. */
export function decisionDialogLines({
  dialog,
  height,
  columns,
}: {
  dialog: DecisionDialog;
  height: number;
  columns: number;
}): string[] {
  const choices = JUDGE_DECISIONS.map((decision, index) => `${index + 1}  ${decision}`);
  const footer = "1-4 or enter sets it, esc cancels";
  const lines = [...choices, footer].slice(0, height);

  return lines.map((line, index) => {
    const kind = index === dialog.selected ? "selected" : "plain";

    return colorLine({ text: fit({ text: `  ${line}`, width: columns }), kind });
  });
}

function decisionAt(key: string): JudgeDecision | null {
  const index = Number(key) - 1;
  const decision = JUDGE_DECISIONS[index];

  if (!decision || key.length !== 1) {
    return null;
  }

  return decision;
}

function moveSelection({ dialog, delta }: { dialog: DecisionDialog; delta: number }): DecisionDialog {
  const last = JUDGE_DECISIONS.length - 1;
  const selected = Math.min(last, Math.max(0, dialog.selected + delta));

  return { runId: dialog.runId, selected };
}

function isUp(key: string): boolean {
  return key === "\x1b[A" || key === "\x1bOA";
}

function isDown(key: string): boolean {
  return key === "\x1b[B" || key === "\x1bOB";
}

import type { ToolTrouble } from "../../../db/db.types";

const MAX_CALLS = 40;
const COMMAND_MAX_CHARS = 200;
const RESPONSE_MAX_CHARS = 300;

/**
 * The agent's blocked and failed tool calls as judge prompt lines. Keeps the last calls when there are many,
 * since a stuck agent shows it at the end.
 */
export function toolTroubleText(troubles: ToolTrouble[]): string {
  if (troubles.length === 0) {
    return "(none recorded)";
  }

  const blocked = troubles.filter((trouble) => !trouble.ran).length;
  const failed = troubles.length - blocked;
  const shown = troubles.slice(-MAX_CALLS);
  const header =
    shown.length < troubles.length
      ? `${blocked} never ran, ${failed} failed; the last ${shown.length} are listed.`
      : `${blocked} never ran, ${failed} failed.`;

  return [header, ...shown.map(troubleLine)].join("\n");
}

function troubleLine(trouble: ToolTrouble): string {
  const what = trouble.command
    ? `${trouble.tool}: ${clip({ text: trouble.command, max: COMMAND_MAX_CHARS })}`
    : trouble.tool;

  if (!trouble.ran) {
    return `- never ran (denied, or the session ended): ${what}`;
  }

  const response = trouble.responsePreview
    ? ` -> ${clip({ text: trouble.responsePreview, max: RESPONSE_MAX_CHARS })}`
    : "";

  return `- failed: ${what}${response}`;
}

function clip({ text, max }: { text: string; max: number }): string {
  const oneLine = text.replace(/\s+/g, " ").trim();

  if (oneLine.length <= max) {
    return oneLine;
  }

  return `${oneLine.slice(0, max)}…`;
}

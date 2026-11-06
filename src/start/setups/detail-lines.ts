import { fitEnd } from "../../inspect/render/terminal-text";
import type { ConfigSetup, SetupLine, SetupStatus } from "./load-setups.types";

const STATUS_WORDS: Record<SetupStatus, string> = {
  ready: "ready",
  missing: "missing",
  undeclared: "no file",
  invalid: "invalid",
};

/** The word the list and the detail use for a config's setup status. */
export function statusWord(status: SetupStatus): string {
  return STATUS_WORDS[status];
}

/** `not run`, `1 run`, or `12 runs`. */
export function runsText(runs: number): string {
  if (runs === 0) {
    return "not run";
  }

  if (runs === 1) {
    return "1 run";
  }

  return `${runs} runs`;
}

/** The detail under the list for the highlighted config, padded to `height` lines. */
export function detailLines({
  config,
  height,
  columns,
}: {
  config: ConfigSetup | undefined;
  height: number;
  columns: number;
}): SetupLine[] {
  if (!config) {
    return pad([{ text: "no configs", kind: "dim" }], height);
  }

  if (height <= 0) {
    return [];
  }

  const lines: SetupLine[] = [
    { text: `${config.configId}  ${statusWord(config.status)} · ${runsText(config.runs)}`, kind: "title" },
  ];

  if (config.description) {
    lines.push({ text: config.description, kind: "dim" });
  }

  if (config.status === "undeclared") {
    lines.push({ text: `add ${config.detail ?? "setup.json"}`, kind: "notice" });
  } else if (config.status === "invalid") {
    lines.push({ text: config.detail ?? "setup.json is invalid", kind: "notice" });
  } else if (config.checks.length === 0) {
    lines.push({ text: "nothing to install", kind: "dim" });
  } else {
    for (const check of config.checks) {
      lines.push({ text: `${check.ok ? "ok     " : "missing"}  ${check.label}`, kind: check.ok ? "dim" : "notice" });
      lines.push({ text: `         ${fitEnd({ text: check.target, width: Math.max(columns - 9, 1) })}`, kind: "dim" });

      if (!check.ok && check.fix) {
        lines.push({ text: `         ${check.fix}`, kind: "plain" });
      }
    }
  }

  return pad(trim({ lines, height }), height);
}

function trim({ lines, height }: { lines: SetupLine[]; height: number }): SetupLine[] {
  if (lines.length <= height) {
    return lines;
  }

  return [...lines.slice(0, height - 1), { text: `… ${lines.length - (height - 1)} more`, kind: "dim" }];
}

function pad(lines: SetupLine[], height: number): SetupLine[] {
  const padded = [...lines];

  while (padded.length < height) {
    padded.push({ text: "", kind: "plain" });
  }

  return padded;
}

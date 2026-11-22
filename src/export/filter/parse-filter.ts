import type { ExportFilter, FilterArgs, VersionFilter } from "./export-filter.types";

const DECISIONS = new Set(["failed", "partially-failed", "partially-pass", "pass", "unjudged"]);

/** The filter flags with the dashboard's defaults: every task, config, decision, and run, and the latest prompts. */
export function parseFilter(args: FilterArgs): ExportFilter {
  const decisions = parseList(args.decision);
  const unknown = decisions?.filter((decision) => !DECISIONS.has(decision)) ?? [];

  if (unknown.length > 0) {
    throw new Error(`unknown --decision ${unknown.join(", ")}; use ${[...DECISIONS].join(", ")}`);
  }

  return {
    tasks: parseList(args.task),
    configs: parseList(args.config),
    compareAgainst: args.compare ?? "baseline",
    prompt: parseVersions(args.prompt),
    judgePrompt: parseVersions(args["judge-prompt"]),
    decisions,
    runs: parseList(args.run),
  };
}

/** Comma-separated values; empty or `all` means no filter. */
function parseList(text: string | undefined): string[] | null {
  const values = (text ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return values.length === 0 || values.includes("all") ? null : values;
}

function parseVersions(text: string | undefined): VersionFilter {
  const values = (text ?? "latest")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    latest: values.includes("latest"),
    all: values.includes("all"),
    versions: values.filter((value) => value !== "latest" && value !== "all"),
  };
}

import { BRANCH_DENIAL, PRIVATE_PATH_DENIAL } from "../../src/baseline-policy";
import { namesOtherRun } from "../bash/other-branches";
import { isPrivatePath } from "./private-paths";

// Tools whose other fields are file contents, not paths: only their path field is checked.
const PATH_FIELDS: Record<string, string[]> = {
  Edit: ["file_path"],
  MultiEdit: ["file_path"],
  Write: ["file_path"],
  NotebookEdit: ["notebook_path"],
};
// The benchmark's own build tools are given paths by the runner, not by the agent.
const TRUSTED_TOOL_PREFIX = "mcp__chrome-validate__";

/**
 * Why a non-Bash tool call is denied, or null. Every string the agent passed (a Read path, a Glob pattern,
 * an MCP query or script) is checked for another run's branch or ref, the benchmark repo, and ~/.claude.
 */
export function toolInputDenial({
  toolName,
  toolInput,
  cwd,
}: {
  toolName: string;
  toolInput: unknown;
  cwd: string;
}): string | null {
  if (toolName === "Bash" || toolName.startsWith(TRUSTED_TOOL_PREFIX)) {
    return null;
  }

  const words = inputStrings({ toolName, toolInput });

  if (words.some((word) => isPrivatePath({ word, cwd }))) {
    return PRIVATE_PATH_DENIAL;
  }

  if (words.some(namesOtherRun)) {
    return BRANCH_DENIAL;
  }

  return null;
}

function inputStrings({ toolName, toolInput }: { toolName: string; toolInput: unknown }): string[] {
  const fields = PATH_FIELDS[toolName];

  if (!fields) {
    return allStrings(toolInput);
  }

  if (toolInput == null || typeof toolInput !== "object") {
    return [];
  }

  const record = toolInput as Record<string, unknown>;

  return fields.flatMap((field) => allStrings(record[field]));
}

function allStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(allStrings);
  }

  if (value != null && typeof value === "object") {
    return Object.values(value).flatMap(allStrings);
  }

  return [];
}

import type { ToolKind } from "../../db/db.types";
import { bashPrograms } from "../../../hooks/bash/bash-programs";
import { VALIDATE_TOOL_PREFIX } from "../phases/validate-waits";
import type { CallTool, MessageKind, RoundCall, RoundMessage } from "./split-rounds.types";

const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
const SEARCH_PROGRAMS = new Set([
  "grep",
  "egrep",
  "fgrep",
  "rg",
  "ugrep",
  "ug",
  "agrep",
  "tre-agrep",
  "sift",
  "ast-grep",
  "sg",
  "zoekt",
  "csearch",
  "cgrep",
]);
const READ_PROGRAMS = new Set(["cat", "head", "tail", "sed", "awk", "less", "wc", "nl"]);
const LIST_PROGRAMS = new Set(["ls", "find", "fd", "tree"]);
/** MCP servers and tools that answer questions about the code: language servers and code indexes. */
const NAVIGATE_PREFIXES = ["LSP", "mcp__serena__", "mcp__codebase-memory-mcp__"];

/**
 * Whether a message edits a file, builds or checks Chrome, or does anything else. Editing wins: agents often send
 * their last edits and start_build in one response, and that response is still implementation.
 */
export function messageKind(message: RoundMessage): MessageKind {
  if (message.calls.some((call) => EDIT_TOOLS.has(call.name))) {
    return "edit";
  }

  if (message.calls.some((call) => call.name.startsWith(VALIDATE_TOOL_PREFIX))) {
    return "validate";
  }

  return "explore";
}

/** The tools one call ran: each program of a Bash script, or the tool's own name. */
export function callTools(call: RoundCall): CallTool[] {
  if (call.name === "Bash") {
    return bashPrograms(call.input.command ?? "").map((program) => ({ tool: program, kind: programKind(program) }));
  }

  return [{ tool: call.name, kind: toolKind(call.name) }];
}

/** The file an Edit or Write call changed, or null for any other call. */
export function editedPath(call: RoundCall): string | null {
  if (!EDIT_TOOLS.has(call.name)) {
    return null;
  }

  return call.input.file_path ?? call.input.notebook_path ?? null;
}

function programKind(program: string): ToolKind {
  if (SEARCH_PROGRAMS.has(program)) {
    return "search";
  }

  if (READ_PROGRAMS.has(program)) {
    return "read";
  }

  if (LIST_PROGRAMS.has(program)) {
    return "list";
  }

  return "other";
}

function toolKind(name: string): ToolKind {
  if (name === "Grep" || name === "Glob") {
    return name === "Grep" ? "search" : "list";
  }

  if (name === "Read") {
    return "read";
  }

  if (EDIT_TOOLS.has(name)) {
    return "edit";
  }

  if (name.startsWith(VALIDATE_TOOL_PREFIX)) {
    return "validate";
  }

  if (NAVIGATE_PREFIXES.some((prefix) => name.startsWith(prefix))) {
    return "navigate";
  }

  return "other";
}

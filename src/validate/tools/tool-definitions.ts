import type { ToolDefinition } from "../mcp/protocol.types";

/** The longest a single wait_build call blocks. Kept under the runner's MCP_TOOL_TIMEOUT. */
export const MAX_WAIT_MINUTES = 50;

/** The chrome-validate tools as tools/list describes them. Part of every config_hash. */
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "start_build",
    description:
      "Snapshot the current Chromium working tree (including new files and submodule edits) and start building " +
      "the `chrome` target from it on the build Mac. Returns at once with a build number. Then call wait_build. " +
      "Only one build runs at a time. If the tree is unchanged since the last successful build, nothing is rebuilt.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "wait_build",
    description:
      "Block until a build finishes, then report it: on success, which build and snapshot the local Chromium now " +
      "is; on failure, only the compiler errors. You do nothing while it waits. Builds take minutes.",
    inputSchema: {
      type: "object",
      properties: {
        build: { type: "integer", description: "Build number from start_build. Defaults to the newest build." },
        max_wait_minutes: {
          type: "number",
          description: `Give up waiting after this long (default and max ${MAX_WAIT_MINUTES}). The build keeps running.`,
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "run_chrome",
    description:
      "Start the newest successfully built Chromium headless with a fresh profile, open a URL, run actions in " +
      "order, and return eval results, console output, page exceptions and screenshots. Says which build it ran " +
      "and warns when the working tree has changed since that build.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Page to open, e.g. chrome://dino or devtools://devtools/bundled/devtools_app.html",
        },
        flags: {
          type: "array",
          items: { type: "string" },
          description: "Extra Chromium switches, e.g. --enable-features=MyFeature",
        },
        actions: {
          type: "array",
          description:
            'Steps after the page loads, in order: {"key":"Space","hold_ms":50} presses a key (letters, digits, Space, ' +
            'Arrow*, Enter, Escape, Tab, Backspace); {"wait_ms":500}; {"eval":"js"} runs an expression, or ' +
            'statements that return a value, awaiting promises; {"screenshot":true} (max 8).',
          items: { type: "object" },
        },
        width: { type: "integer", description: "Viewport width (default 800)" },
        height: { type: "integer", description: "Viewport height (default 600)" },
      },
      required: ["url"],
      additionalProperties: false,
    },
  },
];

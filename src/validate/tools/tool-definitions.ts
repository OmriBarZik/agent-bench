import type { ToolDefinition } from "../mcp/protocol.types";

/** The chrome-validate tools as tools/list describes them. Part of every config_hash. */
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "start_build",
    description:
      "Snapshot the current Chromium working tree (including new files and submodule edits) and start building " +
      "this task's validate target on the build Mac. The target depends on the task: full `chrome`, the offline " +
      "dino TypeScript (`components/neterror/resources:build_ts`), or the DevTools frontend " +
      "(`devtools_frontend_resources`). Returns at once with a build number. Then call wait_build. " +
      "Only one build runs at a time. If the tree is unchanged since the last successful build, nothing is rebuilt.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "wait_build",
    description:
      "Pause until a build finishes, then report it. You are stopped while it waits: that time is not part of " +
      "your session, and you are resumed when the build finishes. The build has its own time limit. On success, " +
      "the result says which build and snapshot are ready, and how to check them with run_chrome. On failure, " +
      "you get only the compiler errors.",
    inputSchema: {
      type: "object",
      properties: {
        build: { type: "integer", description: "Build number from start_build. Defaults to the newest build." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "run_chrome",
    description:
      "Start Chromium headless with a fresh profile, open a URL, run actions in order, and return eval results, " +
      "console output, page exceptions and screenshots. Uses the newest successful build. For a full chrome " +
      'task that is the rebuilt Chromium.app. For a dino task, url "dino" (or chrome://dino) opens a harness ' +
      "that loads your rebuilt game with the real sprites and sounds. For a DevTools task, stock Chromium is " +
      "launched with --custom-devtools-frontend pointed at the rebuilt front_end. Warns when the working tree " +
      "has changed since that build.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description:
            'Page to open, e.g. chrome://dino, "dino" (dino harness), or ' +
            "devtools://devtools/bundled/devtools_app.html",
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

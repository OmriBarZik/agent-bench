import type { ChromeAction, PagePoint } from "../chrome/chrome-check.types";
import type { ToolArguments } from "../mcp/protocol.types";
import type { ChromeInput, WaitInput } from "./tools.types";

/** wait_build arguments with defaults applied. The wait lasts until the build finishes. */
export function waitInput(args: ToolArguments): WaitInput {
  return {
    build: typeof args.build === "number" ? args.build : null,
  };
}

/** run_chrome arguments, checked. Throws a message the agent can act on. */
export function chromeInput(args: ToolArguments): ChromeInput {
  if (typeof args.url !== "string" || args.url === "") {
    throw new Error("run_chrome needs a url");
  }

  const flags = Array.isArray(args.flags) ? args.flags.map(String) : [];
  const actions = Array.isArray(args.actions) ? args.actions.map((action) => chromeAction(action)) : [];

  return {
    url: args.url,
    flags,
    actions,
    width: typeof args.width === "number" ? args.width : 800,
    height: typeof args.height === "number" ? args.height : 600,
  };
}

function chromeAction(raw: unknown): ChromeAction {
  const action = (raw ?? {}) as Record<string, unknown>;

  if (typeof action.key === "string") {
    return { key: action.key, hold_ms: typeof action.hold_ms === "number" ? action.hold_ms : undefined };
  }

  if (action.click != null) {
    return { click: pagePoint(action.click) };
  }

  if (typeof action.wait_ms === "number") {
    return { wait_ms: action.wait_ms };
  }

  if (typeof action.eval === "string") {
    return { eval: action.eval };
  }

  if (action.state === true) {
    return { state: true };
  }

  if (action.screenshot === true) {
    return { screenshot: true };
  }

  throw new Error(`unknown action ${JSON.stringify(raw)}; use key, click, wait_ms, eval, state, or screenshot`);
}

function pagePoint(raw: unknown): PagePoint {
  const point = (raw ?? {}) as Record<string, unknown>;

  if (typeof point.x !== "number" || typeof point.y !== "number") {
    throw new Error(`click needs {"x": number, "y": number}; got ${JSON.stringify(raw)}`);
  }

  return { x: point.x, y: point.y };
}

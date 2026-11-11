#!/usr/bin/env bun
import { forEachChild, parse, type SyntaxNode } from "unbash";
import {
  BRANCH_DENIAL,
  BUILD_DENIAL,
  DIRECTORY_DENIAL,
  FILE_DENIAL,
  PRIVATE_PATH_DENIAL,
  buildDenial,
} from "../src/baseline-policy";
import { namesOtherRun } from "./bash/other-branches";
import type { GuardDeny, GuardPayload } from "./baseline-guard.types";
import { commandDenial } from "./command-policy";
import { nestedScripts } from "./nested-scripts";
import { mentionsPrivateText } from "./paths/private-paths";
import { toolInputDenial } from "./paths/tool-input-denial";

/**
 * Why this Bash command is denied, or null when the baseline allows it.
 * Relative paths stay allowed: the working directory does not change, so they resolve from the checkout root.
 */
export function baselineDenial(command: string): string | null {
  try {
    return denialIn({ source: command, depth: 0 });
  } catch {
    // A parser crash must not block the tool. The settings deny rules still reject cd, pushd, and popd.
    return null;
  }
}

function denialIn({ source, depth }: { source: string; depth: number }): string | null {
  if (depth > 20 || source.trim() === "") {
    return null;
  }

  // Checked on the raw text too, so a variable (`D=…; cat $D/x`) cannot carry the name past the word checks.
  if (mentionsPrivateText(source)) {
    return PRIVATE_PATH_DENIAL;
  }

  if (namesOtherRun(source)) {
    return BRANCH_DENIAL;
  }

  const script = parse(source);
  let directory = false;
  let fileWrite = false;
  let otherBranch = false;
  let localBuild = false;
  let privatePath = false;
  const nested: string[] = [];
  walk(script, (node) => {
    if (node.type !== "Command") {
      return;
    }

    const reason = commandDenial(node);

    if (reason === DIRECTORY_DENIAL) {
      directory = true;
    }

    if (reason === FILE_DENIAL) {
      fileWrite = true;
    }

    if (reason === BRANCH_DENIAL) {
      otherBranch = true;
    }

    if (reason === BUILD_DENIAL) {
      localBuild = true;
    }

    if (reason === PRIVATE_PATH_DENIAL) {
      privatePath = true;
    }

    nested.push(...nestedScripts({ command: node, source }));
  });

  if (directory) {
    return DIRECTORY_DENIAL;
  }

  if (fileWrite) {
    return FILE_DENIAL;
  }

  if (otherBranch) {
    return BRANCH_DENIAL;
  }

  if (privatePath) {
    return PRIVATE_PATH_DENIAL;
  }

  if (localBuild) {
    return buildDenial();
  }

  for (const scriptText of nested) {
    if (scriptText.trim() === "" || scriptText === source) {
      continue;
    }

    const reason = denialIn({ source: scriptText, depth: depth + 1 });

    if (reason) {
      return reason;
    }
  }

  return null;
}

function walk(node: SyntaxNode, visit: (node: SyntaxNode) => void) {
  visit(node);
  forEachChild(node, (child) => {
    walk(child, visit);
  });
}

/**
 * PreToolUse hook for every benchmark config. Prints a deny decision for cd, shell file edits, other runs' branches, local
 * Chromium builds, and, for every tool, paths into the benchmark repo or ~/.claude.
 * Exit 0 always: the decision is the JSON on stdout, and a crash must not fail the tool on its own.
 */
async function main() {
  const payload = parsePayload(await Bun.stdin.text());

  if (!payload?.tool_name) {
    return;
  }

  const reason = toolDenial(payload);

  if (!reason) {
    return;
  }

  const decision: GuardDeny = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  };
  process.stdout.write(JSON.stringify(decision));
}

function toolDenial(payload: GuardPayload): string | null {
  if (payload.tool_name !== "Bash") {
    return toolInputDenial({
      toolName: payload.tool_name ?? "",
      toolInput: payload.tool_input,
      cwd: payload.cwd ?? process.cwd(),
    });
  }

  const command = payload.tool_input?.command;

  if (typeof command !== "string" || command === "") {
    return null;
  }

  return baselineDenial(command);
}

function parsePayload(raw: string): GuardPayload | null {
  try {
    const payload: unknown = JSON.parse(raw);

    if (payload == null || typeof payload !== "object") {
      return null;
    }

    return payload as GuardPayload;
  } catch {
    // Unreadable input must not block the tool. Empty stdout and exit 0 are "no decision".
    return null;
  }
}

if (import.meta.main) {
  main()
    .catch((error) => console.error(`[baseline-guard] ${error}`))
    .finally(() => process.exit(0));
}

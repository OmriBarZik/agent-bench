#!/usr/bin/env bun
import { forEachChild, parse, type SyntaxNode } from "unbash";
import { DIRECTORY_DENIAL, FILE_DENIAL } from "../src/baseline-policy";
import type { GuardDeny, GuardPayload } from "./baseline-guard.types";
import { commandDenial } from "./command-policy";
import { nestedScripts } from "./nested-scripts";

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

  const script = parse(source);
  let directory = false;
  let fileWrite = false;
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

    nested.push(...nestedScripts({ command: node, source }));
  });

  if (directory) {
    return DIRECTORY_DENIAL;
  }

  if (fileWrite) {
    return FILE_DENIAL;
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
 * PreToolUse hook for every benchmark config. Prints a deny decision for cd and for shell file edits.
 * Exit 0 always: the decision is the JSON on stdout, and a crash must not fail the tool on its own.
 */
async function main() {
  const payload = parsePayload(await Bun.stdin.text());

  if (!payload || payload.tool_name !== "Bash") {
    return;
  }

  const command = payload.tool_input?.command;

  if (typeof command !== "string" || command === "") {
    return;
  }

  const reason = baselineDenial(command);

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

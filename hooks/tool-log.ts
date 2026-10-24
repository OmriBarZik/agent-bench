#!/usr/bin/env bun
import { appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { logToolCall, openDb } from "../src/db/db";
import type { ToolCall } from "../src/db/db.types";

const WRAPPERS = new Set(["sudo", "time", "nohup", "xargs", "env", "command", "exec"]);

/** "FOO=1 rg x | head && ./out/mytool y" -> ["rg", "head", "mytool"] */
export function bashPrograms(command: string): string[] {
  const programs: string[] = [];
  for (const segment of command.split(/\|\||&&|\||;|\n/)) {
    let words = segment.trim().split(/\s+/).filter(Boolean);
    words = words.filter((word) => !/^\w+=/.test(word)); // drop env assignments
    while (words.length && WRAPPERS.has(words[0])) words = words.slice(1);
    const first = words[0]?.replace(/^["'(]+|["')]+$/g, "");
    if (first) {
      programs.push(basename(first));
    }
  }

  return programs;
}

function looksLikeError(response: any): boolean | null {
  if (response == null) {
    return null;
  }

  if (typeof response !== "object") {
    return /error/i.test(String(response)) ? true : null;
  }

  if (response.is_error === true || response.isError === true || response.interrupted === true) {
    return true;
  }

  if (typeof response.exit_code === "number") {
    return response.exit_code !== 0;
  }

  if (typeof response.exitCode === "number") {
    return response.exitCode !== 0;
  }

  if (response.error) {
    return true;
  }

  return false;
}

/**
 * Claude Code PreToolUse / PostToolUse hook -> writes every tool call into the results DB.
 *
 * Registered in hooks/settings.example.json (passed to `claude --settings`) as:
 *   bun "$CLAUDE_PROJECT_DIR"/../agent-bench/hooks/tool-log.ts pre
 *   bun "$CLAUDE_PROJECT_DIR"/../agent-bench/hooks/tool-log.ts post
 *
 * Only logs when BENCH_RUN_ID is set (the runner sets it), so your normal
 * Claude Code sessions are not recorded. It never blocks a tool: it always exits 0.
 * If the DB is unreachable, the row goes to ~/.claude/bench-hook-fallback.jsonl instead.
 */
async function main() {
  const phase = (Bun.argv[2] ?? "pre") as "pre" | "post";
  const runId = process.env.BENCH_RUN_ID;
  const raw = await Bun.stdin.text();
  if (!runId) {
    return; // not a benchmark run
  }

  if (process.env.BENCH_HOOK_DUMP) {
    // Debug: see exactly what your Claude Code version sends.
    appendFileSync(process.env.BENCH_HOOK_DUMP, raw.trim() + "\n");
  }

  const payload = JSON.parse(raw);
  const input = payload.tool_input ?? {};
  const command: string | null = input.command ?? null;
  const base: Omit<ToolCall, "program"> = {
    runId,
    phase,
    sessionId: payload.session_id,
    toolUseId: payload.tool_use_id,
    tool: payload.tool_name,
    command,
  };

  const rows: ToolCall[] = [];
  if (phase === "pre") {
    // One row per program for Bash, so `rg | mytool` counts both.
    const programs =
      payload.tool_name === "Bash" && command
        ? bashPrograms(command)
        : payload.tool_name === "Skill"
          ? [input.skill ?? input.name ?? null]
          : [null];
    for (const program of programs.length ? programs : [null]) rows.push({ ...base, program });
  } else {
    const response = payload.tool_response;
    rows.push({
      ...base,
      program: null,
      isError: looksLikeError(response),
      responsePreview: response == null ? null : JSON.stringify(response).slice(0, 500),
    });
  }

  try {
    const db = openDb();
    for (const call of rows) logToolCall({ db, call });
    db.close();
  } catch (err) {
    const fallback = join(homedir(), ".claude", "bench-hook-fallback.jsonl");
    for (const row of rows)
      appendFileSync(fallback, JSON.stringify({ ...row, ts: Date.now(), dbError: String(err) }) + "\n");
  }
}

if (import.meta.main) {
  main()
    .catch((err) => console.error(`[tool-log] ${err}`))
    .finally(() => process.exit(0)); // never block the tool
}

#!/usr/bin/env bun
import process from "node:process";
import { parseArgs } from "node:util";
import { DB_PATH } from "../db/db";
import { CHROMIUM_SRC } from "../paths";
import { checkoutBranch, hasUncommittedChanges } from "../runner/chromium/chromium";
import { changedFileLine } from "./format-run";
import { loadChoices } from "./load-choices";
import { selectRun } from "./select-run";
import type { RunChoice } from "./select-state.types";

const { values: args, positionals } = parseArgs({
  options: {
    force: { type: "boolean", default: false },
  },
  allowPositionals: true,
  strict: true,
});

/**
 * Pick a run from the results database.
 *
 *   bun run start:inspect
 *   bun run start:inspect <branch>
 *   bun run start:inspect --force
 *
 * The list is the runs table: task, config, status, model, and changed files.
 * Enter runs `uvx claude-code-transcripts` on that run's transcript.jsonl and opens it
 * in the browser. Right arrow does the same for the judge session (judge-transcript.jsonl).
 * Ctrl-x twice removes the highlighted run from the database. The branch and artifact files stay.
 * Tab checks the branch out in CHROMIUM_SRC so you can build it.
 * Esc cancels. Passing a branch skips the list and checks it out.
 * Refuses to switch branches when the tree has uncommitted tracked changes, unless
 * --force, which discards them with `git switch --force`.
 */
async function main() {
  if (positionals.length > 1) {
    throw new Error("pass at most one branch name");
  }

  const choices = await loadChoices();

  if (choices.length === 0) {
    throw new Error(`no runs in ${DB_PATH} yet`);
  }

  const requested = positionals[0];
  const chosen = requested ? requireChoice({ choices, name: requested }) : await pickFromTerminal(choices);

  if (!chosen) {
    return;
  }

  if (!chosen.present) {
    throw new Error(`branch ${chosen.branch} does not exist in ${CHROMIUM_SRC}`);
  }

  if (!args.force && (await hasUncommittedChanges())) {
    throw new Error(`${CHROMIUM_SRC} has uncommitted changes; commit/stash them or pass --force`);
  }

  await checkoutBranch({ branch: chosen.branch, force: args.force });
  printCheckedOut(chosen);
}

function requireChoice({ choices, name }: { choices: RunChoice[]; name: string }): RunChoice {
  const chosen = choices.find((choice) => choice.branch === name || choice.runId === name);

  if (!chosen) {
    throw new Error(`no run with branch ${name} in the database`);
  }

  return chosen;
}

async function pickFromTerminal(choices: RunChoice[]): Promise<RunChoice | null> {
  if (!process.stdin.isTTY) {
    throw new Error("pass a branch name, or run in a terminal to pick a run");
  }

  return selectRun({ choices, chromiumSrc: CHROMIUM_SRC });
}

function printCheckedOut(choice: RunChoice) {
  const count = choice.changedFiles.length;
  const files = count === 1 ? "1 file" : `${count} files`;
  console.log(`Checked out ${choice.branch}`);
  console.log(`${CHROMIUM_SRC}`);
  console.log(`${choice.taskId} × ${choice.configId} · ${choice.status} · ${files}`);

  for (const file of choice.changedFiles.slice(0, 20)) {
    console.log(`  ${changedFileLine(file)}`);
  }

  if (count > 20) {
    console.log(`  ${count - 20} more`);
  }
}

if (import.meta.main) {
  await main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}

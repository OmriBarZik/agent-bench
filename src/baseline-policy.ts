const BASELINE_RULES = [
  "The shell stays at the checkout root for the whole session.",
  "Do not use cd, pushd, or popd. Use an absolute path, or git -C <absolute-path> for git.",
  "Create and modify file contents only with the Edit and Write tools.",
  "Do not update a file from the shell: no redirection into a file, tee, in-place sed/perl/ruby, patch, or an interpreter one-liner or here-document that writes a file.",
];

const LOCAL_BUILD_RULE = "Do not run gn, ninja, autoninja, or siso on this machine.";

const AUTO_REVIEW_RULE =
  "Do not run gn, ninja, autoninja, or siso on this machine. You must build your change and check it in Chromium with the chrome-validate MCP tools (mcp__chrome-validate__start_build, mcp__chrome-validate__wait_build, and mcp__chrome-validate__run_chrome) as the validate-build skill describes. If they are not in your tool list yet, load them with tool search before you finish. Do not finish while the change is unbuilt.";

/**
 * Instructions added to every agent session when auto review is on.
 * This is the benchmark baseline, not a config in benchmark-setup.json.
 */
export const BASELINE_PROMPT = [...BASELINE_RULES, AUTO_REVIEW_RULE].join(" ");

/** Baseline instructions for one session. Auto review adds how to build and check the change. */
export function baselinePrompt({ autoReview }: { autoReview: boolean }): string {
  return [...BASELINE_RULES, autoReview ? AUTO_REVIEW_RULE : LOCAL_BUILD_RULE].join(" ");
}

/** Shown to the agent when a Bash command would change the working directory. */
export const DIRECTORY_DENIAL =
  "cd, pushd, and popd are denied. The working directory stays at the checkout root. Use an absolute path, or git -C <absolute-path>.";

/**
 * Shown to the agent when a Bash command would reach another branch or the reflog.
 * BASELINE_PROMPT stays silent on this so agents are not told other runs exist.
 */
export const BRANCH_DENIAL =
  "Other branches, refs, and the reflog are denied. Work from the working tree and the history reachable from HEAD.";

/** Shown to the agent when a Bash command would create or modify a file. */
export const FILE_DENIAL =
  "Updating a file from the shell is denied. Use the Edit or Write tool, not redirection, tee, an in-place editor, patch, or a script that writes the file.";

/** Shown to the agent when a Bash command would build Chromium on this machine and chrome-validate is attached. */
export const BUILD_DENIAL =
  "gn, ninja, autoninja, and siso are denied on this machine. Use the chrome-validate tools to build your change and check it in Chromium.";

/** Shown when a local build is denied and this session was started with --no-auto-review. */
export const BUILD_DENIAL_WITHOUT_REVIEW = "gn, ninja, autoninja, and siso are denied on this machine.";

/**
 * The local-build denial for this hook process.
 * The runner sets BENCH_AUTO_REVIEW=0 when the session has no chrome-validate tools. Unset means they are attached.
 */
export function buildDenial(): string {
  if (process.env.BENCH_AUTO_REVIEW === "0") {
    return BUILD_DENIAL_WITHOUT_REVIEW;
  }

  return BUILD_DENIAL;
}

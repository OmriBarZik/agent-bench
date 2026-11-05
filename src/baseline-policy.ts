/**
 * Instructions added to every agent session.
 * This is the benchmark baseline, not a config in benchmark-setup.json.
 */
export const BASELINE_PROMPT = [
  "The shell stays at the checkout root for the whole session.",
  "Do not use cd, pushd, or popd. Use an absolute path, or git -C <absolute-path> for git.",
  "Create and modify file contents only with the Edit and Write tools.",
  "Do not update a file from the shell: no redirection into a file, tee, in-place sed/perl/ruby, patch, or an interpreter one-liner or here-document that writes a file.",
  "Do not run gn, ninja, autoninja, or siso on this machine. To build your change and check it in Chromium, use the chrome-validate tools as the validate-build skill describes.",
].join(" ");

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

/** Shown to the agent when a Bash command would build Chromium on this machine. */
export const BUILD_DENIAL =
  "gn, ninja, autoninja, and siso are denied on this machine. Use the chrome-validate tools to build your change and check it in Chromium.";

/**
 * Instructions added to every agent session.
 * This is the benchmark baseline, not a config in benchmark-setup.json.
 */
export const BASELINE_PROMPT = [
  "The shell stays at the checkout root for the whole session.",
  "Do not use cd, pushd, or popd. Use an absolute path, or git -C <absolute-path> for git.",
  "Create and modify file contents only with the Edit and Write tools.",
  "Do not update a file from the shell: no redirection into a file, tee, in-place sed/perl/ruby, patch, or an interpreter one-liner or here-document that writes a file.",
].join(" ");

/** Shown to the agent when a Bash command would change the working directory. */
export const DIRECTORY_DENIAL =
  "cd, pushd, and popd are denied. The working directory stays at the checkout root. Use an absolute path, or git -C <absolute-path>.";

/** Shown to the agent when a Bash command would create or modify a file. */
export const FILE_DENIAL =
  "Updating a file from the shell is denied. Use the Edit or Write tool, not redirection, tee, an in-place editor, patch, or a script that writes the file.";

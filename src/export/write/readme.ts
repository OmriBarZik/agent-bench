/** The guide at the top of the export: what the benchmark tests and how to read each file and field. */
export function readmeMarkdown({
  generatedAt,
  taskCount,
  configCount,
  runCount,
  filterLines,
}: {
  generatedAt: string;
  taskCount: number;
  configCount: number;
  runCount: number;
  filterLines: string[];
}): string {
  return `# agent-bench results export

Generated ${generatedAt}: ${taskCount} tasks, ${configCount} configs, ${runCount} runs.

## Filters

The same filters as the dashboard. Only runs that match all of them are in this export. "Prompt: latest" keeps runs
that used each task's current prompt; older prompt versions are left out.

${filterLines.map((line) => `- ${line}`).join("\n")}

## What is being tested

agent-bench measures how well Claude Code (an AI coding agent) does real coding tasks in a Chromium source checkout
under different **tool setups**, called **configs**. The question it answers: *which tools (code search, language
servers, MCP servers, etc.) help the agent finish the task more often, faster, or cheaper?*

- A **task** is a coding job in Chromium (for example, change the offline dino game). Each task has the prompt the
  agent got, a judge rubric, and a fixed Chromium commit (\`chromiumSha\`) every run starts from.
- A **config** is a tool setup: the model, allowed tools, MCP servers, plugins, and an extra tool prompt telling the
  agent to use those tools. \`baseline\` is plain Claude Code with no extra tools; compare every other config to it.
- A **run** is one task × config × repeat: Chromium is reset to the task commit, one headless \`claude -p\` session
  does the task, and the runner commits what it changed onto a branch named after the run id.
- Every config shares the same baseline rules: no \`cd\`, no editing files through the shell, no local Chromium
  builds. With auto review on, the agent gets chrome-validate tools (\`start_build\`, \`wait_build\`, \`run_chrome\`)
  that build its change on a build Mac and let it check the result in a real Chromium.
- After the agent finishes, a separate read-only **judge** session reads the diff, the build results, and
  deterministic **bench checks**, and picks a decision: \`pass\`, \`partially-pass\`, \`partially-failed\`, or
  \`failed\`. **Success** means \`pass\` or \`partially-pass\`. The judge also reports whether a missing, denied, or
  failing tool **blocked** the agent.

## Files

| File | What it holds |
| --- | --- |
| \`README.md\` | This guide |
| \`summary.md\` / \`summary.json\` | One row per task × config: run count, success rate, decision counts, blocked runs, average cost, tokens, minutes (total, before testing, testing), turns, builds (done and crashed runs only), and \`comparison\` against the Compare against config on the same task: Δ success rate and cost, tokens, and time ratios (this ÷ that) |
| \`tasks.json\` | Every task: title, difficulty, validate mode, scoring checks, the full agent prompt and judge rubric |
| \`configs.json\` | Every config: description, model, allowed tools, MCP config, permissions, and the tool prompt text |
| \`runs.jsonl\` | One JSON object per line, one per run (fields below) |
| \`bench-export.md\` | One file to paste into an AI chat: this guide, the summary, tasks, configs, and a compact line per run (metrics, decision, judge reason, blockers, bench checks, build statuses, top tools, start of the agent's summary). Use \`runs.jsonl\` for commands, compiler errors, and full messages |

## Run fields (runs.jsonl)

- \`runId\`, \`taskId\`, \`configId\`, \`repeat\`: which task × config × repeat this is.
- \`promptVersion\`, \`judgePromptVersion\`: first 8 hex chars of the prompt's sha256. Runs with different versions
  got different prompts, so compare like with like.
- \`timeline\` (ISO-8601 UTC): \`startedAt\` (agent session started), \`testingStartedAt\` (the agent's first
  chrome-validate call, \`start_build\` / \`wait_build\` / \`run_chrome\`; null when it never built or tested),
  \`firstBuildStartedAt\`, \`lastBuildFinishedAt\`, \`finishedAt\` (the agent session stopped), \`judgeFinishedAt\`, and
  \`minutesBeforeTesting\` / \`minutesTesting\` (start → testing, testing → stop). Also in the compact runs of
  \`bench-export.md\`.
- \`agent\`: the agent session. \`status\` is \`done\`, \`crashed\` (error or timeout), \`cancelled\`, or \`running\`.
  \`durationMs\`, \`numTurns\`, \`costUsd\` (USD), tokens (\`totalTokens\` = fresh input + cache write + cache read +
  output), \`permissionDenials\`, and \`finalMessage\` (the agent's own closing summary; it may overclaim, trust the
  judge).
- \`judge\`: \`decision\`, \`success\`, \`reason\` (the judge's explanation; the best place to learn what went right or
  wrong), \`blocked\` and \`blockers\` (\`[{ kind, tool, detail }]\`, kind is \`missing-tool\`, \`denied\`, or
  \`exec-failed\`), plus the judge's own cost and duration.
- \`benchChecks\`: deterministic checks the runner ran on the final tree, \`[{ name, status, detail }]\`, status
  \`pass\` / \`fail\` / \`not-run\`. Null for tasks or runs without them.
- \`changedFiles\`: \`[{ status, path, previousPath? }]\` vs the task commit. \`commitSha\` is null when nothing changed.
- \`phases\`: \`discovery\` (finding the code and writing the change) and \`validation\` (from the first
  chrome-validate call to the end, fix loops included), each with turns, time, tokens, and cost.
- \`builds\`: each Chromium build the agent asked for, in order: \`status\` (\`ok\`, \`failed\`, \`cancelled\`,
  \`abandoned\`), \`failedStep\`, \`startedAt\`, \`finishedAt\`, \`durationMs\`, and the first part of the compiler \`error\`.
- \`toolUsage\`: calls per tool (and per program for Bash, e.g. \`git\`, \`grep\`). \`notRan\` were denied or blocked,
  \`failed\` ran and returned an error. MCP tools are named \`mcp__<server>__<tool>\`.
- \`toolTrouble\`: up to 40 of the denied or failed calls, with the command cut to 400 characters.

## How to analyse it

- Compare configs **within one task**; tasks differ a lot in difficulty (\`simple\`, \`medium\`, \`complex\`).
- Weigh success rate first, then cost, tokens, and time. With few repeats per cell, treat small differences as noise.
- Read \`judge.reason\` and \`judge.blockers\` to see *why* a config did better or worse, and \`toolUsage\` to check the
  agent actually used the config's tools (the tool prompt in \`configs.json\` says which ones it should use).
`;
}

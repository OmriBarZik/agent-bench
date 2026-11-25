import { describe, expect, test } from "bun:test";
import { BENCH_DIR } from "../../paths";
import { setupHash } from "./setup-hash";

function command({ prompt, runId, allowed }: { prompt: string; runId: string; allowed: string }): string[] {
  const mcpConfig = JSON.stringify({
    mcpServers: {
      "chrome-validate": {
        command: "bun",
        args: [`${BENCH_DIR}/src/validate/main.ts`],
        env: { BENCH_RUN_ID: runId, BENCH_TASK_SHA: "abc", BENCH_VALIDATE_MODE: "dino", BENCH_BUILD_TIMEOUT_MS: "1" },
      },
    },
  });

  return ["claude", "-p", prompt, "--session-id", runId, "--mcp-config", mcpConfig, "--allowedTools", allowed];
}

describe("setupHash", () => {
  test("ignores the prompt, session and per-run chrome-validate env", () => {
    const first = setupHash(command({ prompt: "a", runId: "run-1", allowed: "Bash(rg *)" }));
    const second = setupHash(command({ prompt: "b", runId: "run-2", allowed: "Bash(rg *)" }));

    expect(first).toBe(second);
  });

  test("changes with the tools the agent is given", () => {
    const ripgrep = setupHash(command({ prompt: "a", runId: "run-1", allowed: "Bash(rg *)" }));
    const ugrep = setupHash(command({ prompt: "a", runId: "run-1", allowed: "Bash(ugrep *)" }));

    expect(ripgrep).not.toBe(ugrep);
  });
});

import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AGENT_PAUSED_LINE, AGENT_RESUMED_LINE } from "../../runner/claude/session/agent-pause";
import { holdAgent } from "./hold-agent";

test("holding the agent writes the pause into the build log and clears it on release", () => {
  const directory = mkdtempSync(join(tmpdir(), "hold-agent-"));
  const logPath = join(directory, "build-1.log");
  const pausePath = join(directory, "agent-paused");
  writeFileSync(logPath, "build 1\n");

  try {
    const release = holdAgent({ runId: "run", logPath, pausePath });

    expect(readFileSync(pausePath, "utf8")).toBe("paused\n");
    expect(readFileSync(logPath, "utf8")).toContain(AGENT_PAUSED_LINE);

    release();
    release();

    expect(readFileSync(logPath, "utf8")).toContain(AGENT_RESUMED_LINE);
    expect(() => readFileSync(pausePath, "utf8")).toThrow();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a manual session has no agent to pause", () => {
  const directory = mkdtempSync(join(tmpdir(), "hold-agent-"));
  const logPath = join(directory, "build-1.log");
  writeFileSync(logPath, "build 1\n");

  try {
    holdAgent({ runId: null, logPath })();

    expect(readFileSync(logPath, "utf8")).toBe("build 1\n");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

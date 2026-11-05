import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BENCH_DIR, VALIDATE_SERVER } from "../../paths";

test("the server answers initialize and tools/list, and reports builds unavailable without a build Mac", async () => {
  const scratch = mkdtempSync(join(tmpdir(), "chrome-validate-"));

  try {
    const server = Bun.spawn(["bun", VALIDATE_SERVER], {
      cwd: BENCH_DIR,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "ignore",
      // No remote.yaml in a scratch config, no run: nothing is built or stored.
      env: {
        ...process.env,
        BENCH_RUN_ID: "",
        BENCH_TASK_SHA: "0".repeat(40),
        CHROMIUM_SRC: BENCH_DIR,
        BENCH_REMOTE_BUILD_FILE: join(scratch, "remote.yaml"),
      },
    });
    const requests = [
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
      { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "start_build", arguments: {} } },
    ];
    server.stdin.write(requests.map((request) => `${JSON.stringify(request)}\n`).join(""));
    await server.stdin.end();
    const lines = (await new Response(server.stdout).text()).trim().split("\n");
    const replies = new Map(lines.map((line) => JSON.parse(line)).map((reply) => [reply.id, reply]));

    expect(replies.get(1).result.serverInfo.name).toBe("chrome-validate");
    expect(replies.get(2).result.tools.map((tool: { name: string }) => tool.name)).toEqual([
      "start_build",
      "wait_build",
      "run_chrome",
    ]);
    expect(replies.get(3).result.isError).toBe(true);
    expect(replies.get(3).result.content[0].text).toContain("build Mac is not set up");
    expect(replies.size).toBe(3);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

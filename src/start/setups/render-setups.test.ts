import { expect, test } from "bun:test";
import type { SetupReport } from "./load-setups.types";
import { renderSetups } from "./render-setups";

const report: SetupReport = {
  shared: [
    { label: "bun", ok: true },
    { label: "claude", ok: false },
    { label: "checkout", ok: true },
  ],
  configs: [
    { configId: "baseline", description: "plain", status: "ready", runs: 3, checks: [] },
    {
      configId: "clangd",
      description: "C and C++ diagnostics",
      status: "missing",
      runs: 0,
      checks: [
        {
          label: "compile_commands.json",
          ok: false,
          target: "/src/compile_commands.json",
          fix: "bun run setup:clangd",
        },
      ],
    },
  ],
};

test("the setups list shows the check, the fix, and whether the config has been run", () => {
  const frame = renderSetups({ report, selected: 1, scroll: 0, rows: 24, columns: 100 });

  expect(frame.body).toContain("clangd");
  expect(frame.body).toContain("missing");
  expect(frame.body).toContain("not run");
  expect(frame.body).toContain("3 runs");
  expect(frame.body).toContain("bun run setup:clangd");
  expect(frame.body).toContain("claude missing");
  expect(frame.body).toContain("1 never run");
});

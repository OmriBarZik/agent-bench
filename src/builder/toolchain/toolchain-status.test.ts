import { expect, test } from "bun:test";
import { recordToolchainScript, toolchainGuardScript, TOOLCHAIN_STAMP } from "./toolchain-script";
import { parseToolchainStatus, toolchainSummary } from "./toolchain-status";

const CURRENT = "--current\nxcode=Xcode 27.2 Build version 27B52\nsdk=27.2 27C40\nclang=llvmorg-24-init-1\n";

test("the same recorded toolchain is unchanged", () => {
  const status = parseToolchainStatus(`${CURRENT}--built\n${CURRENT.replace("--current\n", "")}`);

  expect(status).toEqual({ state: "same", changes: [] });
  expect(toolchainSummary(status)).toEqual({ ok: true, word: "toolchain unchanged" });
});

test("an Xcode update is reported with the old and new value", () => {
  const built = "xcode=Xcode 27.0 Build version 27A10\nsdk=27.0 27A20\nclang=llvmorg-24-init-1\n";
  const status = parseToolchainStatus(`${CURRENT}--built\n${built}`);

  expect(status.state).toBe("changed");
  expect(status.changes.map((change) => change.part)).toEqual(["xcode", "sdk"]);

  const summary = toolchainSummary(status);

  expect(summary.ok).toBe(false);
  expect(summary.word).toContain("xcode Xcode 27.0 Build version 27A10 → Xcode 27.2 Build version 27B52");
});

test("no recorded toolchain is never-built, and output without markers is unreachable", () => {
  expect(parseToolchainStatus(`${CURRENT}--built\n`).state).toBe("never-built");
  expect(parseToolchainStatus("Last login: today\n").state).toBe("unreachable");
  expect(toolchainSummary({ state: "unreachable", changes: [] })).toEqual({ ok: true, word: "unreachable" });
});

test("only a chrome build records the toolchain", () => {
  expect(recordToolchainScript("chrome")).toContain(`> ${TOOLCHAIN_STAMP}`);
  expect(recordToolchainScript("components/neterror/resources:build_ts")).toBe("");
  expect(toolchainGuardScript()).toContain("toolchain_now=$(toolchain_fingerprint)");
});

import { expect, test } from "bun:test";
import { JUDGE_DECISIONS } from "../../db/judge-decision";
import { applyDecisionKey, decisionDialogLines, openDecisionDialog } from "./decision-dialog";

test("the dialog opens on the run's current decision", () => {
  const current = openDecisionDialog({ runId: "dino__haiku__r0", decision: "partially-pass" });
  const unset = openDecisionDialog({ runId: "dino__haiku__r0", decision: null });

  expect(current).toEqual({ runId: "dino__haiku__r0", selected: 2 });
  expect(unset.selected).toBe(0);
  expect(JUDGE_DECISIONS[current.selected]).toBe("partially-pass");
});

test("arrows move within the four decisions and enter chooses the highlight", () => {
  const opened = openDecisionDialog({ runId: "dino__haiku__r0", decision: "failed" });
  const down = applyDecisionKey({ dialog: opened, key: "\x1b[B" });
  const stuck = applyDecisionKey({ dialog: opened, key: "\x1b[A" });
  const chosen = applyDecisionKey({ dialog: down.kind === "stay" ? down.dialog : opened, key: "\r" });

  expect(down).toEqual({ kind: "stay", dialog: { runId: "dino__haiku__r0", selected: 1 } });
  expect(stuck).toEqual({ kind: "stay", dialog: opened });
  expect(chosen).toEqual({ kind: "choose", decision: "partially-failed" });
});

test("1 through 4 choose that decision, and other keys leave the dialog open", () => {
  const opened = openDecisionDialog({ runId: "dino__haiku__r0", decision: "pass" });

  expect(applyDecisionKey({ dialog: opened, key: "1" })).toEqual({ kind: "choose", decision: "failed" });
  expect(applyDecisionKey({ dialog: opened, key: "2" })).toEqual({ kind: "choose", decision: "partially-failed" });
  expect(applyDecisionKey({ dialog: opened, key: "3" })).toEqual({ kind: "choose", decision: "partially-pass" });
  expect(applyDecisionKey({ dialog: opened, key: "4" })).toEqual({ kind: "choose", decision: "pass" });
  expect(applyDecisionKey({ dialog: opened, key: "q" })).toEqual({ kind: "stay", dialog: opened });
});

test("the dialog lists every judge decision", () => {
  const lines = decisionDialogLines({
    dialog: { runId: "dino__haiku__r0", selected: 2 },
    height: 8,
    columns: 40,
  });
  const text = lines.join("\n");

  expect(text).toContain("1  failed");
  expect(text).toContain("2  partially-failed");
  expect(text).toContain("3  partially-pass");
  expect(text).toContain("4  pass");
  expect(lines[2]).toContain("\x1b[7m");
});

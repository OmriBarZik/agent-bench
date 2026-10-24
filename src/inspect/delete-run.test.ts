import { expect, test } from "bun:test";
import { deleteIntent } from "./delete-run";

test("the first ctrl-x arms the run and the second removes it", () => {
  const armed = deleteIntent({ armedRunId: null, action: "delete", runId: "dino__haiku__r0" });
  const removed = deleteIntent({ armedRunId: armed.armedRunId, action: "delete", runId: "dino__haiku__r0" });

  expect(armed).toEqual({ armedRunId: "dino__haiku__r0", remove: false });
  expect(removed).toEqual({ armedRunId: null, remove: true });
});

test("another key, or ctrl-x on a different run, does not remove the armed run", () => {
  const moved = deleteIntent({ armedRunId: "dino__haiku__r0", action: "stay", runId: "dino__haiku__r0" });
  const other = deleteIntent({ armedRunId: "dino__haiku__r0", action: "delete", runId: "dino__haiku__r1" });

  expect(moved).toEqual({ armedRunId: null, remove: false });
  expect(other).toEqual({ armedRunId: "dino__haiku__r1", remove: false });
});

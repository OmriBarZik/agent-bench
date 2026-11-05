import { expect, test } from "bun:test";
import type { Task } from "../../db/db.types";
import { narrowSelection } from "./narrow-selection";

const SELECTION = {
  tasks: [{ taskId: "t1" }, { taskId: "t2" }] as Task[],
  configs: [{ configId: "baseline" }, { configId: "serena" }],
};

test("narrowSelection keeps listed ids in file order", () => {
  const narrowed = narrowSelection({ selection: SELECTION, taskIds: ["t2", "t1"], configIds: ["serena"] });

  expect(narrowed.tasks.map((task) => task.taskId)).toEqual(["t1", "t2"]);
  expect(narrowed.configs.map((config) => config.configId)).toEqual(["serena"]);
});

test("narrowSelection rejects an unknown id", () => {
  expect(() => narrowSelection({ selection: SELECTION, taskIds: ["nope"] })).toThrow("unknown task nope");
});

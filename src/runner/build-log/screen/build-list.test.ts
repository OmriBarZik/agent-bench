import { expect, test } from "bun:test";
import type { AgentBuildView } from "../../../db/db.types";
import { applyBuildListKey, emptyBuildList, syncBuildList } from "./build-list";

const builds: AgentBuildView[] = [
  {
    id: 3,
    run_id: "a",
    build_number: 2,
    status: "building",
    log_path: "/b2",
    started_at: "2026-11-07T12:01:00.000Z",
    task_id: "dino",
    config_id: "baseline",
    repeat: 0,
  },
  {
    id: 2,
    run_id: "a",
    build_number: 1,
    status: "ok",
    log_path: "/b1",
    started_at: "2026-11-07T12:00:00.000Z",
    task_id: "dino",
    config_id: "baseline",
    repeat: 0,
  },
];

test("followLive keeps the selection on a building build", () => {
  const state = syncBuildList({ state: emptyBuildList(), builds });

  expect(state.selected).toBe(0);
  expect(state.builds[0]?.status).toBe("building");
});

test("arrow keys stop following and enter opens the log", () => {
  let state = syncBuildList({ state: emptyBuildList(), builds });
  state = applyBuildListKey({ state, key: "\x1b[B", pageSize: 10 });

  expect(state.followLive).toBe(false);
  expect(state.selected).toBe(1);

  state = applyBuildListKey({ state, key: "\r", pageSize: 10 });

  expect(state.mode).toBe("log");
});

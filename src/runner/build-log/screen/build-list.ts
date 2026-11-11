import type { AgentBuildView } from "../../../db/db.types";
import { colorLine, fit } from "../../../inspect/render/terminal-text";
import type { BuildListState } from "./build-list.types";

const HEADER = 1;
const FOOTER = 1;

/** Empty list state before the first poll. */
export function emptyBuildList(): BuildListState {
  return { builds: [], selected: -1, scroll: 0, followLive: true, mode: "list" };
}

/** Replaces the rows and keeps the selected build when it is still present. */
export function syncBuildList({ state, builds }: { state: BuildListState; builds: AgentBuildView[] }): BuildListState {
  const previousId = state.builds[state.selected]?.id ?? null;
  let selected = previousId == null ? -1 : builds.findIndex((build) => build.id === previousId);

  if (state.followLive) {
    const live = builds.findIndex((build) => build.status === "building");

    if (live >= 0) {
      selected = live;
    } else if (selected < 0 && builds.length > 0) {
      selected = 0;
    }
  } else if (selected < 0 && builds.length > 0) {
    selected = Math.min(state.selected, builds.length - 1);
  }

  if (builds.length === 0) {
    selected = -1;
  }

  return clampList({ ...state, builds, selected });
}

/** ↑↓ move, enter opens the log, f resumes following a live build. */
export function applyBuildListKey({
  state,
  key,
  pageSize,
}: {
  state: BuildListState;
  key: string;
  pageSize: number;
}): BuildListState {
  if (key === "f" || key === "F") {
    return syncBuildList({ state: { ...state, followLive: true }, builds: state.builds });
  }

  if (isUp(key)) {
    return moveSelection({ state, delta: -1 });
  }

  if (isDown(key)) {
    return moveSelection({ state, delta: 1 });
  }

  if (isPageUp(key)) {
    return moveSelection({ state, delta: -pageSize });
  }

  if (isPageDown(key)) {
    return moveSelection({ state, delta: pageSize });
  }

  if (key === "\r" || key === "\n") {
    if (state.selected < 0 || state.builds[state.selected] == null) {
      return state;
    }

    return { ...state, mode: "log", followLive: state.builds[state.selected]?.status === "building" };
  }

  return state;
}

/** ← previous build, → next, while the log is open. */
export function stepBuildSelection({ state, delta }: { state: BuildListState; delta: number }): BuildListState {
  return moveSelection({ state, delta });
}

/** Draws the Build tab list. */
export function renderBuildList({
  state,
  rows,
  columns,
}: {
  state: BuildListState;
  rows: number;
  columns: number;
}): string {
  const width = Math.max(columns, 1);
  const height = Math.max(rows - HEADER - FOOTER, 1);
  const lines = [
    colorLine({
      text: fit({ text: "Builds · past and present", width }),
      kind: "title",
    }),
  ];

  if (state.builds.length === 0) {
    lines.push(colorLine({ text: fit({ text: "No agent builds yet.", width }), kind: "dim" }));

    for (let index = 1; index < height; index++) {
      lines.push(colorLine({ text: "", kind: "plain" }));
    }
  } else {
    for (let index = 0; index < height; index++) {
      const build = state.builds[state.scroll + index];

      if (!build) {
        lines.push(colorLine({ text: "", kind: "plain" }));
        continue;
      }

      const selected = state.scroll + index === state.selected;
      const live = build.status === "building";
      lines.push(
        colorLine({
          text: fit({ text: `${selected ? "›" : " "}${live ? "●" : " "}${buildRow(build)}`, width }),
          kind: selected ? "selected" : live ? "live" : "plain",
        }),
      );
    }
  }

  const follow = state.followLive ? "following live" : "f follows live";
  lines.push(
    colorLine({
      text: fit({ text: `↑↓ move  enter log  ${follow}  tab switches  esc quits`, width }),
      kind: "hint",
    }),
  );

  return lines.slice(0, rows).join("\r\n");
}

function moveSelection({ state, delta }: { state: BuildListState; delta: number }): BuildListState {
  if (state.builds.length === 0) {
    return state;
  }

  const selected = Math.min(Math.max((state.selected < 0 ? 0 : state.selected) + delta, 0), state.builds.length - 1);

  return clampList({ ...state, selected, followLive: false });
}

function clampList(state: BuildListState): BuildListState {
  if (state.builds.length === 0) {
    return { ...state, selected: -1, scroll: 0 };
  }

  const selected = Math.min(Math.max(state.selected, 0), state.builds.length - 1);

  return { ...state, selected, scroll: state.scroll };
}

/** Keeps the highlight on screen for the next paint. */
export function scrollBuildList({ state, pageSize }: { state: BuildListState; pageSize: number }): BuildListState {
  if (state.selected < 0) {
    return { ...state, scroll: 0 };
  }

  const height = Math.max(pageSize, 1);
  let scroll = state.scroll;

  if (state.selected < scroll) {
    scroll = state.selected;
  }

  if (state.selected >= scroll + height) {
    scroll = state.selected - height + 1;
  }

  const maxScroll = Math.max(0, state.builds.length - height);

  return { ...state, scroll: Math.min(Math.max(scroll, 0), maxScroll) };
}

function buildRow(build: AgentBuildView): string {
  const status = build.status === "ok" ? "passed" : build.status;
  const when = shortTime(build.started_at);
  const run =
    build.task_id != null && build.config_id != null
      ? `${build.task_id} × ${build.config_id} r${build.repeat ?? 0}`
      : (build.run_id ?? "manual");

  return `#${build.build_number} · ${status} · ${run}${when ? ` · ${when}` : ""}`;
}

function shortTime(startedAt: string | null): string {
  if (startedAt == null || startedAt.length < 16) {
    return "";
  }

  return startedAt.slice(5, 16).replace("T", " ");
}

function isUp(key: string): boolean {
  return key === "\x1b[A" || key === "k";
}

function isDown(key: string): boolean {
  return key === "\x1b[B" || key === "j";
}

function isPageUp(key: string): boolean {
  return key === "\x1b[5~";
}

function isPageDown(key: string): boolean {
  return key === "\x1b[6~";
}

import { scoreLabel } from "./format-run";
import type { RunChoice, SelectResult, SelectState } from "./select-state.types";

/** Applies one keypress. Letters always filter, including q; ctrl-c quits. */
export function applyKey({
  state,
  key,
  matchCount,
  pageSize,
}: {
  state: SelectState;
  key: string;
  matchCount: number;
  pageSize: number;
}): SelectResult {
  if (key === "\x03") {
    return { state, action: "quit" };
  }

  if (key === "\r" || key === "\n") {
    return { state, action: matchCount === 0 ? "stay" : "transcript" };
  }

  if (isRight(key)) {
    return { state, action: matchCount === 0 ? "stay" : "judge" };
  }

  if (key === "\t") {
    return { state, action: matchCount === 0 ? "stay" : "checkout" };
  }

  if (key === "\x7f" || key === "\b" || key === "\x1b[3~") {
    return { state: { query: withoutLast(state.query), selected: 0, scroll: 0 }, action: "stay" };
  }

  if (key === "\x15") {
    return { state: { query: "", selected: 0, scroll: 0 }, action: "stay" };
  }

  if (isUp(key)) {
    return move({ state, matchCount, delta: -1 });
  }

  if (isDown(key)) {
    return move({ state, matchCount, delta: 1 });
  }

  if (isPageUp(key)) {
    return move({ state, matchCount, delta: -pageStep(pageSize) });
  }

  if (isPageDown(key)) {
    return move({ state, matchCount, delta: pageStep(pageSize) });
  }

  if (isHome(key)) {
    return moveTo({ state, selected: 0 });
  }

  if (isEnd(key)) {
    return moveTo({ state, selected: Math.max(matchCount - 1, 0) });
  }

  if (isText(key)) {
    return { state: { query: state.query + key, selected: 0, scroll: 0 }, action: "stay" };
  }

  return { state, action: "stay" };
}

/** Keeps the highlight inside the filtered list and on screen. */
export function clampSelection({
  state,
  matchCount,
  pageSize,
}: {
  state: SelectState;
  matchCount: number;
  pageSize: number;
}): SelectState {
  const height = Math.max(pageSize, 1);
  const selected = matchCount === 0 ? 0 : Math.min(Math.max(state.selected, 0), matchCount - 1);
  let scroll = state.scroll;

  if (selected < scroll) {
    scroll = selected;
  }

  if (selected >= scroll + height) {
    scroll = selected - height + 1;
  }

  const maxScroll = Math.max(matchCount - height, 0);

  if (scroll > maxScroll) {
    scroll = maxScroll;
  }

  if (scroll < 0) {
    scroll = 0;
  }

  return { query: state.query, selected, scroll };
}

/** Case-insensitive match on task, config, model, status, branch, title, and changed paths. */
export function matchingChoices({ choices, query }: { choices: RunChoice[]; query: string }): RunChoice[] {
  const needle = query.trim().toLowerCase();

  if (needle === "") {
    return choices;
  }

  return choices.filter((choice) => haystack(choice).includes(needle));
}

function move({ state, matchCount, delta }: { state: SelectState; matchCount: number; delta: number }): SelectResult {
  const selected = clampIndex({ index: state.selected + delta, count: matchCount });

  return { state: { ...state, selected }, action: "stay" };
}

function moveTo({ state, selected }: { state: SelectState; selected: number }): SelectResult {
  return { state: { ...state, selected }, action: "stay" };
}

function clampIndex({ index, count }: { index: number; count: number }): number {
  if (count === 0) {
    return 0;
  }

  return Math.min(count - 1, Math.max(0, index));
}

function pageStep(pageSize: number): number {
  return Math.max(pageSize - 1, 1);
}

function withoutLast(query: string): string {
  const characters = [...query];
  characters.pop();

  return characters.join("");
}

function haystack(choice: RunChoice): string {
  const paths = choice.changedFiles.map((file) => `${file.path} ${file.previousPath ?? ""}`).join(" ");

  return [
    choice.taskId,
    choice.configId,
    choice.title ?? "",
    choice.status,
    choice.model,
    choice.branch,
    choice.runId,
    scoreLabel(choice.score).trim(),
    choice.judgeNote ?? "",
    paths,
  ]
    .join("\n")
    .toLowerCase();
}

function isText(key: string): boolean {
  return key.length === 1 && key >= " " && key !== "\x7f";
}

function isUp(key: string): boolean {
  return key === "\x1b[A" || key === "\x1bOA";
}

function isDown(key: string): boolean {
  return key === "\x1b[B" || key === "\x1bOB";
}

function isRight(key: string): boolean {
  return key === "\x1b[C" || key === "\x1bOC";
}

function isPageUp(key: string): boolean {
  return key === "\x1b[5~";
}

function isPageDown(key: string): boolean {
  return key === "\x1b[6~";
}

function isHome(key: string): boolean {
  return key === "\x1b[H" || key === "\x1b[1~" || key === "\x1bOH";
}

function isEnd(key: string): boolean {
  return key === "\x1b[F" || key === "\x1b[4~" || key === "\x1bOF";
}

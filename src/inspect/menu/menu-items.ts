import type { RunChoice } from "../list/select-state.types";
import type { MenuItem, MenuScope, MenuScreen } from "./action-menu.types";

/** The rows of one menu page for this selection. Rows that do not fit a multi selection are left out. */
export function menuItems({ screen, choices }: { screen: MenuScreen; choices: RunChoice[] }): MenuItem[] {
  return itemsForScreen({ screen, choices }).filter((item) => showsItem({ scope: item.scope, count: choices.length }));
}

/** The title over a menu page. */
export function menuTitle({ screen, choices }: { screen: MenuScreen; choices: RunChoice[] }): string {
  const run = selectionLabel(choices);

  if (screen === "build") {
    return `Build ${run} on`;
  }

  if (screen === "remove") {
    return `Remove ${run} from the database? The branch and run files stay.`;
  }

  return `Actions for ${run}`;
}

function itemsForScreen({ screen, choices }: { screen: MenuScreen; choices: RunChoice[] }): MenuItem[] {
  if (screen === "build") {
    return buildItems(choices);
  }

  if (screen === "remove") {
    return removeItems(choices);
  }

  return actionItems(choices);
}

function actionItems(choices: RunChoice[]): MenuItem[] {
  const choice = choices[0];

  if (!choice) {
    return [];
  }

  const missingBranch = choice.present ? null : "branch not in the checkout";

  return [
    {
      label: "Open run transcript",
      shortcut: "^O",
      unavailable: choice.transcriptPath ? null : "no transcript saved",
      scope: "one",
      target: { kind: "command", command: "transcript" },
    },
    {
      label: "Open judge transcript",
      shortcut: "^E",
      unavailable: choice.judgeTranscriptPath ? null : "no judge transcript saved",
      scope: "one",
      target: { kind: "command", command: "judge" },
    },
    {
      label: "Set judge decision…",
      shortcut: "^F",
      unavailable: null,
      scope: "one",
      target: { kind: "command", command: "decide" },
    },
    {
      label: "Build…",
      shortcut: "^B",
      unavailable: missingBranch,
      scope: "one",
      target: { kind: "screen", screen: "build" },
    },
    {
      label: "Open Chromium",
      shortcut: "^P",
      unavailable: choice.chromiumAppPath ? null : "not built",
      scope: "one",
      target: { kind: "command", command: "open-chromium" },
    },
    {
      label: "Queue on the build Mac",
      shortcut: "^B r",
      unavailable: queueUnavailable(choices),
      scope: "many",
      target: { kind: "command", command: "build-remote" },
    },
    {
      label: "Check out branch and quit",
      shortcut: "^G",
      unavailable: missingBranch,
      scope: "one",
      target: { kind: "command", command: "checkout" },
    },
    {
      label: "Remove from database…",
      shortcut: "^X ^X",
      unavailable: null,
      scope: "one",
      target: { kind: "screen", screen: "remove" },
    },
  ];
}

function buildItems(choices: RunChoice[]): MenuItem[] {
  const choice = choices[0];
  const missingBranch = choice?.present ? null : "branch not in the checkout";

  return [
    {
      label: "This Mac",
      shortcut: "^B l",
      unavailable: missingBranch,
      scope: "one",
      target: { kind: "command", command: "build-local" },
    },
    {
      label: "The build Mac",
      shortcut: "^B r",
      unavailable: missingBranch,
      scope: "one",
      target: { kind: "command", command: "build-remote" },
    },
  ];
}

function removeItems(choices: RunChoice[]): MenuItem[] {
  const choice = choices[0];

  return [
    { label: "No, keep it", shortcut: "", unavailable: null, scope: "one", target: { kind: "back" } },
    {
      label: `Yes, remove ${choice?.runId ?? "this run"}`,
      shortcut: "",
      unavailable: null,
      scope: "one",
      target: { kind: "command", command: "remove" },
    },
  ];
}

function selectionLabel(choices: RunChoice[]): string {
  const choice = choices[0];

  if (choices.length > 1) {
    return `${choices.length} runs`;
  }

  if (!choice) {
    return "this run";
  }

  return `${choice.taskId} × ${choice.configId}`;
}

/** A queue needs one branch that is actually in the checkout. The build skips the rest. */
function queueUnavailable(choices: RunChoice[]): string | null {
  if (choices.some((choice) => choice.present)) {
    return null;
  }

  return "branches not in the checkout";
}

/** `many` and `any` stay when several runs are checked. One run shows `one` and `any`. */
function showsItem({ scope, count }: { scope: MenuScope; count: number }): boolean {
  if (scope === "any") {
    return true;
  }

  if (count > 1) {
    return scope === "many";
  }

  return scope === "one";
}

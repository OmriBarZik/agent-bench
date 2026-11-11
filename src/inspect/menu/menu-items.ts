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

  if (screen === "clear-app") {
    return `Delete Chromium.app ${choices.length > 1 ? "copies" : "copy"} for ${run}? Frees disk; the run row stays.`;
  }

  if (screen === "clear-all-apps") {
    return "Delete every per-run Chromium.app copy under the build directory? out/Default is kept.";
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

  if (screen === "clear-app") {
    return clearAppItems(choices);
  }

  if (screen === "clear-all-apps") {
    return clearAllAppsItems();
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
    ...liveLogItems(choice),
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
      label: "Delete Chromium.app copy…",
      shortcut: "",
      unavailable: choice.hasAppCopy ? null : "no copy on disk",
      scope: "one",
      target: { kind: "screen", screen: "clear-app" },
    },
    {
      label: "Queue on the build Mac",
      shortcut: "^B r",
      unavailable: queueUnavailable(choices),
      scope: "many",
      target: { kind: "command", command: "build-remote" },
    },
    {
      label: "Delete Chromium.app copies…",
      shortcut: "",
      unavailable: choices.some((item) => item.hasAppCopy) ? null : "no copies on disk",
      scope: "many",
      target: { kind: "screen", screen: "clear-app" },
    },
    {
      label: "Clear all Chromium.app copies…",
      shortcut: "",
      unavailable: null,
      scope: "any",
      target: { kind: "screen", screen: "clear-all-apps" },
    },
    {
      label: "Check out branch",
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

/** Only while this run's agent is working: the row goes away when the agent finishes. */
function liveLogItems(choice: RunChoice): MenuItem[] {
  if (!choice.liveLogPath) {
    return [];
  }

  return [
    {
      label: "View live agent log",
      shortcut: "",
      unavailable: null,
      scope: "one",
      target: { kind: "command", command: "live-log" },
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

function clearAppItems(choices: RunChoice[]): MenuItem[] {
  const count = choices.filter((choice) => choice.hasAppCopy).length;
  const label = count > 1 ? `Yes, delete ${count} Chromium.app copies` : "Yes, delete the Chromium.app copy";

  return [
    { label: "No, keep them", shortcut: "", unavailable: null, scope: "any", target: { kind: "back" } },
    {
      label,
      shortcut: "",
      unavailable: count > 0 ? null : "no copies on disk",
      scope: "any",
      target: { kind: "command", command: "clear-app" },
    },
  ];
}

function clearAllAppsItems(): MenuItem[] {
  return [
    { label: "No, keep them", shortcut: "", unavailable: null, scope: "any", target: { kind: "back" } },
    {
      label: "Yes, delete every per-run Chromium.app copy",
      shortcut: "",
      unavailable: null,
      scope: "any",
      target: { kind: "command", command: "clear-all-apps" },
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

import type { RunChoice } from "../list/select-state.types";
import type { MenuItem, MenuScreen } from "./action-menu.types";

/** The rows of one menu page for this run, with the ones it can't use marked and explained. */
export function menuItems({ screen, choice }: { screen: MenuScreen; choice: RunChoice }): MenuItem[] {
  if (screen === "build") {
    return buildItems(choice);
  }

  if (screen === "remove") {
    return removeItems(choice);
  }

  return actionItems(choice);
}

/** The title over a menu page. */
export function menuTitle({ screen, choice }: { screen: MenuScreen; choice: RunChoice }): string {
  const run = `${choice.taskId} × ${choice.configId}`;

  if (screen === "build") {
    return `Build ${run} on`;
  }

  if (screen === "remove") {
    return `Remove ${run} from the database? The branch and run files stay.`;
  }

  return `Actions for ${run}`;
}

function actionItems(choice: RunChoice): MenuItem[] {
  const missingBranch = choice.present ? null : "branch not in the checkout";

  return [
    {
      label: "Open run transcript",
      shortcut: "^O",
      unavailable: choice.transcriptPath ? null : "no transcript saved",
      target: { kind: "command", command: "transcript" },
    },
    {
      label: "Open judge transcript",
      shortcut: "→",
      unavailable: choice.judgeTranscriptPath ? null : "no judge transcript saved",
      target: { kind: "command", command: "judge" },
    },
    {
      label: "Set judge decision…",
      shortcut: "^F",
      unavailable: null,
      target: { kind: "command", command: "decide" },
    },
    {
      label: "Build…",
      shortcut: "^B",
      unavailable: missingBranch,
      target: { kind: "screen", screen: "build" },
    },
    {
      label: "Check out branch and quit",
      shortcut: "tab",
      unavailable: missingBranch,
      target: { kind: "command", command: "checkout" },
    },
    {
      label: "Remove from database…",
      shortcut: "^X ^X",
      unavailable: null,
      target: { kind: "screen", screen: "remove" },
    },
  ];
}

function buildItems(choice: RunChoice): MenuItem[] {
  const missingBranch = choice.present ? null : "branch not in the checkout";

  return [
    {
      label: "This Mac",
      shortcut: "^B l",
      unavailable: missingBranch,
      target: { kind: "command", command: "build-local" },
    },
    {
      label: "The build Mac",
      shortcut: "^B r",
      unavailable: missingBranch,
      target: { kind: "command", command: "build-remote" },
    },
  ];
}

function removeItems(choice: RunChoice): MenuItem[] {
  return [
    { label: "No, keep it", shortcut: "", unavailable: null, target: { kind: "back" } },
    {
      label: `Yes, remove ${choice.runId}`,
      shortcut: "",
      unavailable: null,
      target: { kind: "command", command: "remove" },
    },
  ];
}

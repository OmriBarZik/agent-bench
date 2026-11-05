import process from "node:process";
import type { TuiControls, TuiScreen } from "../../tui/open-tui.types";
import { buildSession } from "../build/build-session";
import type { BuildTarget } from "../build/build-session.types";
import { applyDecisionKey, openDecisionDialog } from "../decision/decision-dialog";
import type { DecisionDialog } from "../decision/decision-dialog.types";
import { setListedDecision } from "../decision/set-decision";
import { deleteIntent, removeListedRun } from "../delete/delete-run";
import { applyMenuKey, backMenu, openActionMenu } from "../menu/action-menu";
import type { ActionMenu, MenuCommand } from "../menu/action-menu.types";
import { frameLayout, renderFrame } from "../render/render-frame";
import { openTranscript } from "../transcript/open-transcript";
import { resumeList } from "./restore-list";
import { applyKey, buildTarget, clampSelection, matchingChoices } from "./select-state";
import type { RunChoice, SelectAction, SelectState } from "./select-state.types";

const LEAVE_SCREEN = "\x1b[?25h\x1b[?1049l";

/**
 * The Runs tab: a filterable list of runs. Enter opens a menu of everything the list can do to the highlighted run,
 * with submenus for building and removing, so no shortcut needs remembering. ← or esc steps back out of it.
 * Ctrl-o opens that run's transcript in the browser and stays here. Right arrow opens the judge session the same way.
 * Ctrl-b asks where to build the highlighted run: l on this Mac, r on the build Mac.
 * Ctrl-f opens the four judge decisions. 1–4 or enter sets the highlighted one.
 * Ctrl-x twice removes the highlighted run from the database. The branch and artifact files stay.
 * Ctrl-g calls `onDone` with the highlighted run so the caller can check its branch out; ctrl-c calls it with null.
 * Esc closes the build question, the decision dialog, or a menu page; otherwise it is left to the TUI, which quits.
 */
export function createRunsScreen({
  choices,
  chromiumSrc,
  force,
  controls,
  onDone,
}: {
  choices: RunChoice[];
  chromiumSrc: string;
  force: boolean;
  controls: TuiControls;
  onDone: (choice: RunChoice | null) => void;
}): TuiScreen {
  let state: SelectState = { query: "", selected: 0, scroll: 0 };
  let notice = "";
  let armedRunId: string | null = null;
  let decisionDialog: DecisionDialog | null = null;
  let actionMenu: ActionMenu | null = null;
  let choosingBuild = false;
  let busy = false;
  let cancelBuild: (() => void) | null = null;

  const pageSize = () => frameLayout(controls.size().rows).listHeight;
  const matches = () => matchingChoices({ choices, query: state.query });
  const highlighted = (): RunChoice | undefined => matches()[state.selected];

  /** Gives the terminal to `work` (a browser opener or a build log), then takes it back and repaints. */
  const handOff = (work: (signal: AbortSignal) => Promise<string>) => {
    busy = true;
    choosingBuild = false;
    process.stdin.setRawMode(false);
    process.stdout.write(LEAVE_SCREEN);
    const abort = new AbortController();
    cancelBuild = () => abort.abort();
    void work(abort.signal)
      .then((workNotice) => {
        notice = workNotice;
      })
      .finally(() => {
        cancelBuild = null;
        busy = false;

        if (controls.isClosed()) {
          return;
        }

        resumeList();
        controls.repaint();
      });
  };

  const openChosen = (action: "transcript" | "judge") => {
    const chosen = highlighted();
    const judge = action === "judge";
    const transcriptPath = judge ? chosen?.judgeTranscriptPath : chosen?.transcriptPath;
    const label = judge ? "judge transcript" : "run transcript";

    if (!chosen || !transcriptPath) {
      notice = chosen ? `no ${label} for this run` : "";

      return;
    }

    handOff(async () => {
      process.stdout.write(`Opening ${label}…\n`);

      try {
        await openTranscript(transcriptPath);

        return `opened the ${label} in the browser`;
      } catch (error) {
        return error instanceof Error ? error.message : `could not open the ${label}`;
      }
    });
  };

  const startBuild = (target: BuildTarget) => {
    const session = buildSession({ choice: highlighted(), target, chromiumSrc, force });

    if (typeof session === "string") {
      notice = session;
    } else {
      handOff(session);
    }
  };

  const checkoutHighlighted = () => {
    const chosen = highlighted();

    if (chosen?.present) {
      onDone(chosen);
    } else {
      notice = chosen ? `branch ${chosen.branch} is not in ${chromiumSrc}` : "";
    }
  };

  const removeHighlighted = () => {
    const chosen = highlighted();

    if (!chosen) {
      return;
    }

    notice = removeListedRun({ choices, chosen });
    state = clampSelection({ state, matchCount: matches().length, pageSize: pageSize() });
  };

  const openDecision = () => {
    const chosen = highlighted();

    if (chosen) {
      decisionDialog = openDecisionDialog({ runId: chosen.runId, decision: chosen.decision });
      notice = "";
    }
  };

  const onBuildKey = (key: string): boolean => {
    choosingBuild = false;
    const target = buildTarget(key);

    if (!target) {
      notice = "";

      return false;
    }

    startBuild(target);

    return true;
  };

  const onDialogKey = ({ dialog, key }: { dialog: DecisionDialog; key: string }) => {
    const outcome = applyDecisionKey({ dialog, key });

    if (outcome.kind === "stay") {
      decisionDialog = outcome.dialog;

      return;
    }

    decisionDialog = null;
    actionMenu = null;
    const chosen = choices.find((choice) => choice.runId === dialog.runId);

    if (chosen) {
      notice = setListedDecision({ chosen, decision: outcome.decision });
    }
  };

  /** Runs what the Enter menu chose. */
  const runMenuCommand = (command: MenuCommand) => {
    if (command === "decide") {
      // The menu stays under the dialog, so esc from the dialog lands back on the menu.
      openDecision();

      return;
    }

    actionMenu = null;

    if (command === "transcript" || command === "judge") {
      openChosen(command);

      return;
    }

    if (command === "build-local" || command === "build-remote") {
      startBuild(command === "build-local" ? "local" : "remote");

      return;
    }

    if (command === "checkout") {
      checkoutHighlighted();

      return;
    }

    removeHighlighted();
  };

  const onMenuKey = ({ menu, key }: { menu: ActionMenu; key: string }) => {
    const menuChoice = choices.find((choice) => choice.runId === menu.runId);
    const outcome = menuChoice ? applyMenuKey({ menu, key, choice: menuChoice }) : { kind: "close" as const };

    if (outcome.kind === "stay") {
      actionMenu = outcome.menu;

      return;
    }

    if (outcome.kind === "close") {
      actionMenu = null;

      return;
    }

    runMenuCommand(outcome.command);
  };

  const onListAction = (action: SelectAction) => {
    if (action === "quit") {
      onDone(null);

      return;
    }

    if (action === "menu") {
      armedRunId = null;
      const chosen = highlighted();

      if (chosen) {
        actionMenu = openActionMenu(chosen.runId);
        notice = "";
      }

      return;
    }

    if (action === "checkout") {
      checkoutHighlighted();

      return;
    }

    if (action === "transcript" || action === "judge") {
      openChosen(action);

      return;
    }

    if (action === "build") {
      armedRunId = null;
      choosingBuild = true;
      notice = "l builds on this Mac, r builds on the other Mac";

      return;
    }

    if (action === "decide") {
      armedRunId = null;
      openDecision();

      return;
    }

    if (action === "delete") {
      const chosen = highlighted();
      const intent = deleteIntent({ armedRunId, action, runId: chosen?.runId ?? null });
      armedRunId = intent.armedRunId;

      if (intent.remove && chosen) {
        removeHighlighted();
      } else {
        notice = chosen ? "press ^X again to remove this run from the database" : "";
      }

      return;
    }

    armedRunId = null;
    notice = "";
  };

  return {
    render: ({ rows, columns }) =>
      renderFrame({ choices, state, chromiumSrc, notice, decisionDialog, actionMenu, rows, columns }),
    onKey: (key) => {
      if (key === "\x03") {
        onDone(null);

        return;
      }

      if (decisionDialog) {
        onDialogKey({ dialog: decisionDialog, key });

        return;
      }

      if (actionMenu) {
        onMenuKey({ menu: actionMenu, key });

        return;
      }

      if (choosingBuild && onBuildKey(key)) {
        return;
      }

      const result = applyKey({ state, key, matchCount: matches().length, pageSize: pageSize() });
      const nextCount = matchingChoices({ choices, query: result.state.query }).length;
      state = clampSelection({ state: result.state, matchCount: nextCount, pageSize: pageSize() });
      onListAction(result.action);
    },
    onEscape: () => {
      if (choosingBuild || decisionDialog) {
        choosingBuild = false;
        decisionDialog = null;
        notice = "";

        return true;
      }

      if (actionMenu) {
        actionMenu = backMenu(actionMenu);

        return true;
      }

      return false;
    },
    onInterrupt: () => {
      if (cancelBuild) {
        cancelBuild();

        return true;
      }

      return busy;
    },
    onResize: () => {
      state = clampSelection({ state, matchCount: matches().length, pageSize: pageSize() });
    },
    isBusy: () => busy,
  };
}

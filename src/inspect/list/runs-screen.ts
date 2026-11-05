import process from "node:process";
import type { TuiControls, TuiScreen } from "../../tui/open-tui.types";
import { buildSession, remoteBuildSession } from "../build/build-session";
import type { BuildTarget, BuildWork } from "../build/build-session.types";
import { applyDecisionKey, openDecisionDialog } from "../decision/decision-dialog";
import type { DecisionDialog } from "../decision/decision-dialog.types";
import { setListedDecision } from "../decision/set-decision";
import { deleteIntent, removeListedRun } from "../delete/delete-run";
import { applyMenuKey, backMenu, openActionMenu } from "../menu/action-menu";
import type { ActionMenu, MenuCommand } from "../menu/action-menu.types";
import { frameLayout, renderFrame } from "../render/render-frame";
import { openTranscript } from "../transcript/open-transcript";
import { loadChoices } from "./load-choices";
import { refreshNotice, reselect } from "./refresh-list";
import { resumeList } from "./restore-list";
import { actionRuns, applyKey, buildTarget, clampSelection, matchingChoices, runsInOrder } from "./select-state";
import type { RunChoice, SelectAction, SelectState } from "./select-state.types";

const LEAVE_SCREEN = "\x1b[?25h\x1b[?1049l";

/**
 * The Runs tab: a filterable list of runs. Space checks the highlighted run. Enter opens a menu for the checked runs,
 * or the highlighted run when none are checked. Two or more checked runs narrow that menu to actions that take a
 * multi selection (Queue builds them on the build Mac, one after another). Esc steps back out of a menu.
 * Ctrl-o opens the highlighted run's transcript in the browser and stays here. Ctrl-e opens the judge session the same way.
 * Arrow keys only move the highlight; every action is enter, esc or a ctrl key.
 * Ctrl-b asks where to build: l builds the highlighted run on this Mac, r builds the selection on the build Mac.
 * Ctrl-f opens the four judge decisions. 1–4 or enter sets the highlighted one.
 * Ctrl-x twice removes the highlighted run from the database. The branch and artifact files stay.
 * Ctrl-r reloads the runs from the database and the branches from Chromium, so new runs show without a restart.
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
  let state: SelectState = { query: "", selected: 0, scroll: 0, marked: [] };
  let notice = "";
  let armedRunId: string | null = null;
  let decisionDialog: DecisionDialog | null = null;
  let actionMenu: ActionMenu | null = null;
  let choosingBuild = false;
  let busy = false;
  let refreshing = false;
  let cancelBuild: (() => void) | null = null;

  const pageSize = () => frameLayout(controls.size().rows).listHeight;
  const matches = () => matchingChoices({ choices, query: state.query });
  const highlighted = (): RunChoice | undefined => matches()[state.selected];
  const selectedRuns = () => actionRuns({ choices, highlighted: highlighted(), marked: state.marked });

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

  const openTranscriptChoice = ({ choice, judge }: { choice: RunChoice | undefined; judge: boolean }) => {
    const transcriptPath = judge ? choice?.judgeTranscriptPath : choice?.transcriptPath;
    const label = judge ? "judge transcript" : "run transcript";

    if (!choice || !transcriptPath) {
      notice = choice ? `no ${label} for this run` : "";

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

  const beginSession = (session: BuildWork | string) => {
    if (typeof session === "string") {
      notice = session;
    } else {
      handOff(session);
    }
  };

  const highlightedOnly = (): RunChoice[] => {
    const choice = highlighted();

    return choice ? [choice] : [];
  };

  /** Local builds the highlighted run. Remote builds the checked runs, queued when there are several. */
  const startBuild = (target: BuildTarget) => {
    const selected = target === "local" ? highlightedOnly() : selectedRuns();

    if (target === "remote" && selected.length > 1) {
      beginSession(remoteBuildSession({ choices: selected, chromiumSrc }));

      return;
    }

    beginSession(buildSession({ choice: selected[0], target, chromiumSrc, force }));
  };

  const checkoutChoice = (chosen: RunChoice | undefined) => {
    if (chosen?.present) {
      onDone(chosen);
    } else {
      notice = chosen ? `branch ${chosen.branch} is not in ${chromiumSrc}` : "";
    }
  };

  const removeChoice = (chosen: RunChoice | undefined) => {
    if (!chosen) {
      return;
    }

    notice = removeListedRun({ choices, chosen });
    const live = new Set(choices.map((choice) => choice.runId));
    state = clampSelection({
      state: { ...state, marked: state.marked.filter((runId) => live.has(runId)) },
      matchCount: matches().length,
      pageSize: pageSize(),
    });
  };

  /** Swaps in freshly loaded runs, keeping the filter and the highlighted run. Ignores a second ctrl-r mid-load. */
  const refresh = () => {
    if (refreshing) {
      return;
    }

    refreshing = true;
    notice = "refreshing…";
    const highlightedRunId = highlighted()?.runId ?? null;
    const before = choices.length;
    void loadChoices()
      .then((fresh) => {
        // In place, because the caller and the delete helper hold this same array.
        choices.splice(0, choices.length, ...fresh);
        state = reselect({ state, choices, highlightedRunId, pageSize: pageSize() });
        armedRunId = null;
        notice = refreshNotice({ before, after: fresh.length });
      })
      .catch((error: unknown) => {
        notice = error instanceof Error ? error.message : "could not reload the runs";
      })
      .finally(() => {
        refreshing = false;

        if (!controls.isClosed() && !busy) {
          controls.repaint();
        }
      });
  };

  const openDecision = (chosen: RunChoice | undefined) => {
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

  /** Runs what the Enter menu chose, on the runs that menu was opened for. */
  const runMenuCommand = ({ command, runIds }: { command: MenuCommand; runIds: string[] }) => {
    const chosen = runsInOrder({ choices, runIds });
    const first = chosen[0];

    if (command === "decide") {
      // The menu stays under the dialog, so esc from the dialog lands back on the menu.
      openDecision(first);

      return;
    }

    actionMenu = null;

    if (command === "transcript" || command === "judge") {
      openTranscriptChoice({ choice: first, judge: command === "judge" });

      return;
    }

    if (command === "build-remote" && chosen.length > 1) {
      beginSession(remoteBuildSession({ choices: chosen, chromiumSrc }));

      return;
    }

    if (command === "build-local" || command === "build-remote") {
      beginSession(
        buildSession({ choice: first, target: command === "build-local" ? "local" : "remote", chromiumSrc, force }),
      );

      return;
    }

    if (command === "checkout") {
      checkoutChoice(first);

      return;
    }

    removeChoice(first);
  };

  const onMenuKey = ({ menu, key }: { menu: ActionMenu; key: string }) => {
    const menuChoices = runsInOrder({ choices, runIds: menu.runIds });
    const outcome =
      menuChoices.length > 0 ? applyMenuKey({ menu, key, choices: menuChoices }) : { kind: "close" as const };

    if (outcome.kind === "stay") {
      actionMenu = outcome.menu;

      return;
    }

    if (outcome.kind === "close") {
      actionMenu = null;

      return;
    }

    runMenuCommand({ command: outcome.command, runIds: menu.runIds });
  };

  const onListAction = (action: SelectAction) => {
    if (action === "quit") {
      onDone(null);

      return;
    }

    if (action === "menu") {
      armedRunId = null;
      const chosen = selectedRuns();

      if (chosen.length > 0) {
        actionMenu = openActionMenu(chosen.map((choice) => choice.runId));
        notice = "";
      }

      return;
    }

    if (action === "checkout") {
      checkoutChoice(highlighted());

      return;
    }

    if (action === "transcript" || action === "judge") {
      openTranscriptChoice({ choice: highlighted(), judge: action === "judge" });

      return;
    }

    if (action === "build") {
      armedRunId = null;
      choosingBuild = true;
      const count = selectedRuns().length;
      notice =
        count > 1
          ? `l builds the highlighted run here, r queues ${count} runs on the other Mac`
          : "l builds on this Mac, r builds on the other Mac";

      return;
    }

    if (action === "decide") {
      armedRunId = null;
      openDecision(highlighted());

      return;
    }

    if (action === "refresh") {
      armedRunId = null;
      refresh();

      return;
    }

    if (action === "delete") {
      const chosen = highlighted();
      const intent = deleteIntent({ armedRunId, action, runId: chosen?.runId ?? null });
      armedRunId = intent.armedRunId;

      if (intent.remove && chosen) {
        removeChoice(chosen);
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

      const result = applyKey({
        state,
        key,
        matchCount: matches().length,
        pageSize: pageSize(),
        highlightedRunId: highlighted()?.runId ?? null,
      });
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

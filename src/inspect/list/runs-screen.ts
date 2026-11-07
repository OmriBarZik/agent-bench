import type { TuiControls, TuiScreen } from "../../tui/open-tui.types";
import type { ChromiumJobController } from "../../start/jobs/chromium-job.types";
import { attachChromiumApps, chromiumBuildDirectory, openBuiltChromium } from "../build/app/chromium-app";
import { buildSession, remoteBuildSession } from "../build/build-session";
import type { BuildFinish, BuildTarget, BuildWork } from "../build/build-session.types";
import { applyDecisionKey, openDecisionDialog } from "../decision/decision-dialog";
import type { DecisionDialog } from "../decision/decision-dialog.types";
import { applyMarkFailedKey, openMarkFailedPrompt } from "../decision/mark-failed-prompt";
import type { MarkFailedPrompt } from "../decision/mark-failed-prompt.types";
import { setListedDecision } from "../decision/set-decision";
import { deleteIntent, removeListedRun } from "../delete/delete-run";
import { applyMenuKey, backMenu, openActionMenu } from "../menu/action-menu";
import type { ActionMenu, MenuCommand } from "../menu/action-menu.types";
import { frameLayout, renderFrame } from "../render/render-frame";
import { openTranscript } from "../transcript/open-transcript";
import { loadChoices } from "./load-choices";
import { refreshNotice, reselect } from "./refresh-list";
import { actionRuns, applyKey, buildTarget, clampSelection, matchingChoices, runsInOrder } from "./select-state";
import type { RunChoice, SelectAction, SelectState } from "./select-state.types";

/**
 * The Runs tab: a filterable list of runs. Space checks the highlighted run. Enter opens a menu for the checked runs,
 * or the highlighted run when none are checked. Two or more checked runs narrow that menu to actions that take a
 * multi selection (Queue builds them on the build Mac, one after another). Esc steps back out of a menu.
 * Ctrl-o opens the highlighted run's transcript in the browser and stays here. Ctrl-e opens the judge session the same way.
 * Arrow keys only move the highlight; every action is enter, esc or a ctrl key.
 * Ctrl-b asks where to build: l builds the highlighted run on this Mac, r builds the selection on the build Mac.
 * Builds and checkout run as background Chromium jobs so other tabs stay usable. A failed compile asks whether to
 * mark that run failed: y marks it, n keeps the decision, and esc dismisses.
 * Ctrl-p opens the highlighted run's Chromium.app when a build left one on disk.
 * The Enter menu can delete that run's Chromium.app copy (or every per-run copy under the build directory)
 * as the shared Chromium job (shown like build/checkout; progress on the job line; list stays usable).
 * out/Default is never removed.
 * Ctrl-f opens the four judge decisions. 1–4 or enter sets the highlighted one.
 * Ctrl-x twice removes the highlighted run from the database. The branch and artifact files stay.
 * Ctrl-r reloads the runs from the database and the branches from Chromium. The list also refreshes on its own
 * while a matrix job is running, and while this tab is on screen, so a `running` row appears once startRun writes it.
 * Ctrl-g checks the highlighted run's branch out without leaving the TUI.
 * Esc closes the build question, the failed-build question, the decision dialog, or a menu page; otherwise it is left to the TUI, which quits.
 */
export function createRunsScreen({
  choices,
  chromiumSrc,
  force,
  controls,
  jobs,
  onQuit,
  buildFinishSlot,
}: {
  choices: RunChoice[];
  chromiumSrc: string;
  force: boolean;
  controls: TuiControls;
  jobs: ChromiumJobController;
  onQuit: () => void;
  /** The host sets `handle` so the job controller can deliver build finishes here. */
  buildFinishSlot: { handle: (finish: BuildFinish) => void };
}): TuiScreen {
  let state: SelectState = { query: "", selected: 0, scroll: 0, marked: [] };
  let notice = "";
  let armedRunId: string | null = null;
  let decisionDialog: DecisionDialog | null = null;
  let markFailedPrompt: MarkFailedPrompt | null = null;
  let actionMenu: ActionMenu | null = null;
  let choosingBuild = false;
  let refreshing = false;
  /** Last time the Runs tab was painted; quiet polls only while this is recent or a matrix is running. */
  let shownAt = 0;

  const pageSize = () => frameLayout(controls.size().rows).listHeight;
  const matches = () => matchingChoices({ choices, query: state.query });
  const highlighted = (): RunChoice | undefined => matches()[state.selected];
  const selectedRuns = () => actionRuns({ choices, highlighted: highlighted(), marked: state.marked });

  const applyBuildFinish = (finish: BuildFinish) => {
    notice = finish.notice;
    markFailedPrompt = openMarkFailedPrompt(finish.failedRunIds);
    const asking = markFailedPrompt?.runIds[0];

    if (asking) {
      focusRun(asking);
    }

    try {
      attachChromiumApps({ choices, chromiumSrc });
    } catch {
      // The build already finished. A miss here only hides Open Chromium until the next refresh.
    }

    if (!controls.isClosed()) {
      controls.repaint();
    }
  };

  buildFinishSlot.handle = applyBuildFinish;

  const openTranscriptChoice = ({ choice, judge }: { choice: RunChoice | undefined; judge: boolean }) => {
    const transcriptPath = judge ? choice?.judgeTranscriptPath : choice?.transcriptPath;
    const label = judge ? "judge transcript" : "run transcript";

    if (!choice || !transcriptPath) {
      notice = choice ? `no ${label} for this run` : "";

      return;
    }

    notice = `opening ${label}…`;
    void openTranscript(transcriptPath)
      .then(() => {
        notice = `opened the ${label} in the browser`;
      })
      .catch((error: unknown) => {
        notice = error instanceof Error ? error.message : `could not open the ${label}`;
      })
      .finally(() => {
        if (!controls.isClosed()) {
          controls.repaint();
        }
      });
  };

  const beginSession = (session: BuildWork | string) => {
    if (typeof session === "string") {
      notice = session;

      return;
    }

    choosingBuild = false;
    const refused = jobs.startBuild(session);
    notice = refused ?? "build started · see the Build tab";
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

  const launchChromium = (choice: RunChoice | undefined) => {
    if (!choice) {
      notice = "";

      return;
    }

    try {
      attachChromiumApps({ choices: [choice], chromiumSrc });
    } catch (error) {
      notice = error instanceof Error ? error.message : "could not find Chromium.app";

      return;
    }

    const app = choice.chromiumAppPath;

    if (!app) {
      notice = "no Chromium.app for this run";

      return;
    }

    notice = "opening Chromium…";
    void openBuiltChromium(app)
      .then(() => {
        notice = "opened Chromium.app";
      })
      .catch((error: unknown) => {
        notice = error instanceof Error ? error.message : "could not open Chromium";
      })
      .finally(() => {
        if (!controls.isClosed()) {
          controls.repaint();
        }
      });
  };

  const checkoutChoice = (chosen: RunChoice | undefined) => {
    if (!chosen?.present) {
      notice = chosen ? `branch ${chosen.branch} is not in ${chromiumSrc}` : "";

      return;
    }

    const refused = jobs.startCheckout(chosen);
    notice = refused ?? `checking out ${chosen.branch}…`;
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

  /**
   * Swaps in freshly loaded runs, keeping the filter and the highlighted run. Ignores a second load mid-flight.
   * `quiet` skips the refreshing/refreshed notices so a poll does not hide the job status line.
   */
  const refresh = ({ quiet = false }: { quiet?: boolean } = {}) => {
    if (refreshing) {
      return;
    }

    refreshing = true;

    if (!quiet) {
      notice = "refreshing…";
    }

    const highlightedRunId = highlighted()?.runId ?? null;
    const before = choices.length;
    void loadChoices()
      .then((fresh) => {
        // In place, because the caller and the delete helper hold this same array.
        choices.splice(0, choices.length, ...fresh);
        state = reselect({ state, choices, highlightedRunId, pageSize: pageSize() });
        armedRunId = null;

        if (!quiet) {
          notice = refreshNotice({ before, after: fresh.length });
        }
      })
      .catch((error: unknown) => {
        if (!quiet) {
          notice = error instanceof Error ? error.message : "could not reload the runs";
        }
      })
      .finally(() => {
        refreshing = false;

        if (!controls.isClosed()) {
          controls.repaint();
        }
      });
  };

  const POLL_MS = 2000;
  const SHOWN_MS = 4000;
  const timer = setInterval(() => {
    if (controls.isClosed()) {
      clearInterval(timer);

      return;
    }

    const matrixRunning = jobs.status().kind === "matrix";
    const tabShown = Date.now() - shownAt <= SHOWN_MS;

    if (!matrixRunning && !tabShown) {
      return;
    }

    refresh({ quiet: true });
  }, POLL_MS);
  timer.unref();

  const focusRun = (runId: string) => {
    const index = matches().findIndex((choice) => choice.runId === runId);

    if (index < 0) {
      return;
    }

    state = clampSelection({
      state: { ...state, selected: index },
      matchCount: matches().length,
      pageSize: pageSize(),
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

  const onMarkFailedKey = ({ prompt, key }: { prompt: MarkFailedPrompt; key: string }) => {
    const outcome = applyMarkFailedKey({ prompt, key });

    if (outcome.kind === "stay") {
      markFailedPrompt = outcome.prompt;

      return;
    }

    markFailedPrompt = outcome.prompt;
    const nextRunId = outcome.prompt?.runIds[0];

    if (nextRunId) {
      focusRun(nextRunId);
    }

    if (!outcome.markFailed) {
      return;
    }

    const chosen = choices.find((choice) => choice.runId === outcome.runId);

    if (!chosen) {
      return;
    }

    notice = setListedDecision({ chosen, decision: "failed" });
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

    if (command === "open-chromium") {
      launchChromium(first);

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

    if (command === "clear-app") {
      beginClearApps({
        runIds: chosen.filter((choice) => choice.hasAppCopy).map((choice) => choice.runId),
        mode: "listed",
      });

      return;
    }

    if (command === "clear-all-apps") {
      beginClearApps({ runIds: [], mode: "all" });

      return;
    }

    if (command === "remove") {
      removeChoice(first);

      return;
    }
  };

  /**
   * Starts a Chromium.app delete as the shared Chromium job so every tab shows it as running.
   * `mode: "all"` ignores `runIds` and clears every removable folder under the build directory.
   */
  function beginClearApps({ runIds, mode }: { runIds: string[]; mode: "listed" | "all" }) {
    actionMenu = null;
    const refused = jobs.startClearApps({
      buildDirectory: chromiumBuildDirectory(),
      mode,
      runIds,
      onFinish: () => {
        try {
          attachChromiumApps({ choices, chromiumSrc });
        } catch {
          // Paths may stay stale until the next refresh.
        }
      },
    });

    notice =
      refused ??
      (mode === "all" ? "deleting every Chromium.app copy…" : `deleting ${runIds.length} Chromium.app copies…`);
  }

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
      onQuit();

      return;
    }

    if (action === "menu") {
      armedRunId = null;
      const chosen = selectedRuns();

      if (chosen.length > 0) {
        try {
          attachChromiumApps({ choices: chosen, chromiumSrc });
          notice = "";
        } catch (error) {
          notice = error instanceof Error ? error.message : "could not find Chromium.app";
        }

        actionMenu = openActionMenu(chosen.map((choice) => choice.runId));
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

    if (action === "chromium") {
      armedRunId = null;
      launchChromium(highlighted());

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
    render: ({ rows, columns }) => {
      shownAt = Date.now();
      const job = jobs.status();
      const line = job.kind !== "idle" ? `${job.kind}: ${job.label}` : notice || job.label;

      return renderFrame({
        choices,
        state,
        chromiumSrc,
        notice: line,
        decisionDialog,
        markFailedPrompt,
        actionMenu,
        rows,
        columns,
      });
    },
    onKey: (key) => {
      if (key === "\x03") {
        if (jobs.cancel()) {
          notice = "cancelling…";

          return;
        }

        onQuit();

        return;
      }

      if (decisionDialog) {
        onDialogKey({ dialog: decisionDialog, key });

        return;
      }

      if (markFailedPrompt) {
        onMarkFailedKey({ prompt: markFailedPrompt, key });

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
      if (markFailedPrompt) {
        markFailedPrompt = null;

        return true;
      }

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
      if (jobs.cancel()) {
        notice = "cancelling…";

        return true;
      }

      return false;
    },
    onResize: () => {
      state = clampSelection({ state, matchCount: matches().length, pageSize: pageSize() });
    },
    isBusy: () => false,
  };
}

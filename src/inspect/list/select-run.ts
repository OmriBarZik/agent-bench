import process from "node:process";
import { builderConfig } from "../build/builder-config";
import { presentLocalBuild } from "../build/local-build";
import { applyDecisionKey, openDecisionDialog } from "../decision/decision-dialog";
import type { DecisionDialog } from "../decision/decision-dialog.types";
import { setListedDecision } from "../decision/set-decision";
import { deleteIntent, removeListedRun } from "../delete/delete-run";
import { applyMenuKey, backMenu, openActionMenu } from "../menu/action-menu";
import type { ActionMenu, MenuCommand } from "../menu/action-menu.types";
import { presentBuild } from "../remote/remote-build";
import { frameLayout, renderFrame } from "../render/render-frame";
import { openTranscript } from "../transcript/open-transcript";
import { resumeList } from "./restore-list";
import { applyKey, buildTarget, clampSelection, matchingChoices } from "./select-state";
import type { RunChoice, SelectState } from "./select-state.types";

const ENTER_SCREEN = "\x1b[?1049h\x1b[?25l";
const LEAVE_SCREEN = "\x1b[?25h\x1b[?1049l";

/**
 * Full-screen list of runs. Enter opens a menu of everything the list can do to the highlighted run,
 * with submenus for building and removing, so no shortcut needs remembering. ← or esc steps back out of it.
 * Ctrl-o opens that run's transcript in the browser and stays here. Right arrow opens the judge session the same way.
 * Ctrl-b asks where to build the highlighted run: l on this Mac, r on the build Mac.
 * Ctrl-f opens the four judge decisions. 1–4 or enter sets the highlighted one.
 * Ctrl-x twice removes the highlighted run from the database. The branch and artifact files stay.
 * Tab resolves with the highlighted run so the caller can check its branch out. Esc or ctrl-c resolves with null.
 * A lone escape quits, but arrow keys (which start with the same byte) do not.
 */
export async function selectRun({
  choices,
  chromiumSrc,
  force,
}: {
  choices: RunChoice[];
  chromiumSrc: string;
  force: boolean;
}): Promise<RunChoice | null> {
  if (!process.stdin.isTTY) {
    throw new Error("pass a branch name, or run in a terminal to pick a run");
  }

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  let detach = () => {};

  try {
    process.stdout.write(ENTER_SCREEN);

    return await waitForChoice({
      choices,
      chromiumSrc,
      force,
      onDetach: (detachListeners) => {
        detach = detachListeners;
      },
    });
  } finally {
    detach();
    process.stdin.setRawMode(false);
    // resume() keeps the event loop alive, so Esc and Ctrl+C would return here and then wait for another Ctrl+C.
    process.stdin.pause();
    process.stdout.write(LEAVE_SCREEN);
  }
}

function waitForChoice({
  choices,
  chromiumSrc,
  force,
  onDetach,
}: {
  choices: RunChoice[];
  chromiumSrc: string;
  force: boolean;
  onDetach: (detach: () => void) => void;
}): Promise<RunChoice | null> {
  return new Promise((resolve) => {
    let state: SelectState = { query: "", selected: 0, scroll: 0 };
    let notice = "";
    let armedRunId: string | null = null;
    let decisionDialog: DecisionDialog | null = null;
    let actionMenu: ActionMenu | null = null;
    let settled = false;
    let opening = false;
    let cancelBuild: (() => void) | null = null;
    let choosingBuild = false;
    let escapeTimer: ReturnType<typeof setTimeout> | null = null;

    const finish = (choice: RunChoice | null) => {
      if (settled) {
        return;
      }

      settled = true;

      if (escapeTimer) {
        clearTimeout(escapeTimer);
        escapeTimer = null;
      }

      detach();
      resolve(choice);
    };

    const paint = () => {
      const rows = process.stdout.rows ?? 24;
      const columns = process.stdout.columns ?? 80;
      process.stdout.write(
        renderFrame({ choices, state, chromiumSrc, notice, decisionDialog, actionMenu, rows, columns }),
      );
    };

    const revealTranscript = ({ transcriptPath, label }: { transcriptPath: string; label: string }) => {
      if (opening || settled) {
        return;
      }

      opening = true;
      process.stdin.setRawMode(false);
      process.stdout.write(LEAVE_SCREEN);
      process.stdout.write(`Opening ${label}…\n`);
      void openTranscript(transcriptPath)
        .then(() => {
          notice = `opened the ${label} in the browser`;
        })
        .catch((error: unknown) => {
          notice = error instanceof Error ? error.message : `could not open the ${label}`;
        })
        .finally(() => {
          opening = false;

          if (settled) {
            return;
          }

          resumeList();
          paint();
        });
    };

    const openChosen = (action: "transcript" | "judge"): boolean => {
      const chosen = matchingChoices({ choices, query: state.query })[state.selected];
      const judge = action === "judge";
      const transcriptPath = judge ? chosen?.judgeTranscriptPath : chosen?.transcriptPath;
      const label = judge ? "judge transcript" : "run transcript";

      if (!chosen || !transcriptPath) {
        notice = chosen ? `no ${label} for this run` : "";

        return false;
      }

      revealTranscript({ transcriptPath, label });

      return true;
    };

    const onData = (input: string) => {
      if (opening) {
        return;
      }

      if (escapeTimer) {
        clearTimeout(escapeTimer);
        escapeTimer = null;
      }

      if (input === "\x1b") {
        if (choosingBuild || decisionDialog) {
          choosingBuild = false;
          decisionDialog = null;
          notice = "";
          paint();

          return;
        }

        if (actionMenu) {
          actionMenu = backMenu(actionMenu);
          paint();

          return;
        }

        escapeTimer = setTimeout(() => finish(null), 50);

        return;
      }

      for (const key of keyParts(input)) {
        if (key === "\x03") {
          finish(null);

          return;
        }

        if (decisionDialog) {
          const outcome = applyDecisionKey({ dialog: decisionDialog, key });

          if (outcome.kind === "stay") {
            decisionDialog = outcome.dialog;
            break;
          }

          const runId = decisionDialog.runId;
          decisionDialog = null;
          actionMenu = null;
          const chosen = choices.find((choice) => choice.runId === runId);

          if (chosen) {
            notice = setListedDecision({ chosen, decision: outcome.decision });
          }

          break;
        }

        if (actionMenu) {
          const menu = actionMenu;
          const menuChoice = choices.find((choice) => choice.runId === menu.runId);
          const outcome = menuChoice ? applyMenuKey({ menu, key, choice: menuChoice }) : { kind: "close" as const };

          if (outcome.kind === "stay") {
            actionMenu = outcome.menu;
            break;
          }

          if (outcome.kind === "close") {
            actionMenu = null;
            break;
          }

          if (runMenuCommand(outcome.command)) {
            return;
          }

          break;
        }

        if (choosingBuild) {
          choosingBuild = false;
          const target = buildTarget(key);

          if (target === "local") {
            if (beginLocal()) {
              return;
            }

            break;
          }

          if (target === "remote") {
            if (beginRemote()) {
              return;
            }

            break;
          }

          notice = "";
        }

        const rows = process.stdout.rows ?? 24;
        const pageSize = frameLayout(rows).listHeight;
        const matchCount = matchingChoices({ choices, query: state.query }).length;
        const result = applyKey({ state, key, matchCount, pageSize });
        const nextCount = matchingChoices({ choices, query: result.state.query }).length;
        state = clampSelection({ state: result.state, matchCount: nextCount, pageSize });

        if (result.action === "quit") {
          finish(null);

          return;
        }

        if (result.action === "menu") {
          armedRunId = null;
          const chosen = highlighted();

          if (chosen) {
            actionMenu = openActionMenu(chosen.runId);
            notice = "";
          }

          break;
        }

        if (result.action === "checkout") {
          if (checkoutHighlighted()) {
            return;
          }

          break;
        }

        if (result.action === "transcript" || result.action === "judge") {
          const opened = openChosen(result.action);

          if (opened) {
            return;
          }

          break;
        }

        if (result.action === "build") {
          armedRunId = null;
          decisionDialog = null;
          choosingBuild = true;
          notice = "l builds on this Mac, r builds on the other Mac";
          break;
        }

        if (result.action === "decide") {
          armedRunId = null;
          const chosen = matchingChoices({ choices, query: state.query })[state.selected];

          if (chosen) {
            decisionDialog = openDecisionDialog({ runId: chosen.runId, decision: chosen.decision });
            notice = "";
          }

          break;
        }

        if (result.action === "delete") {
          const chosen = matchingChoices({ choices, query: state.query })[state.selected];
          const intent = deleteIntent({ armedRunId, action: result.action, runId: chosen?.runId ?? null });
          armedRunId = intent.armedRunId;

          if (intent.remove && chosen) {
            removeHighlighted();
          } else {
            notice = chosen ? "press ^X again to remove this run from the database" : "";
          }

          break;
        }

        armedRunId = null;
        decisionDialog = null;
        notice = "";
      }

      if (!settled) {
        paint();
      }
    };

    /** Runs what the Enter menu chose. Returns true when the list left the screen or resolved. */
    const runMenuCommand = (command: MenuCommand): boolean => {
      if (command === "decide") {
        const chosen = highlighted();

        // The menu stays under the dialog, so esc from the dialog lands back on the menu.
        if (chosen) {
          decisionDialog = openDecisionDialog({ runId: chosen.runId, decision: chosen.decision });
        }

        return false;
      }

      actionMenu = null;

      if (command === "transcript" || command === "judge") {
        return openChosen(command);
      }

      if (command === "build-local") {
        return beginLocal();
      }

      if (command === "build-remote") {
        return beginRemote();
      }

      if (command === "checkout") {
        return checkoutHighlighted();
      }

      removeHighlighted();

      return false;
    };

    const checkoutHighlighted = (): boolean => {
      const chosen = highlighted();

      if (!chosen || !chosen.present) {
        notice = chosen ? `branch ${chosen.branch} is not in ${chromiumSrc}` : "";

        return false;
      }

      finish(chosen);

      return true;
    };

    const removeHighlighted = () => {
      const chosen = highlighted();

      if (!chosen) {
        return;
      }

      notice = removeListedRun({ choices, chosen });
      const pageSize = frameLayout(process.stdout.rows ?? 24).listHeight;
      const matchCount = matchingChoices({ choices, query: state.query }).length;
      state = clampSelection({ state, matchCount, pageSize });
    };

    const onResize = () => {
      if (opening || settled) {
        return;
      }

      const pageSize = frameLayout(process.stdout.rows ?? 24).listHeight;
      const matchCount = matchingChoices({ choices, query: state.query }).length;
      state = clampSelection({ state, matchCount, pageSize });
      paint();
    };

    const onSigint = () => {
      if (cancelBuild) {
        cancelBuild();

        return;
      }

      if (opening) {
        return;
      }

      finish(null);
    };

    const beginRemote = (): boolean => {
      const chosen = highlighted();

      if (!chosen) {
        notice = "";

        return false;
      }

      if (!chosen.present) {
        notice = `branch ${chosen.branch} is not in ${chromiumSrc}`;

        return false;
      }

      let config: ReturnType<typeof builderConfig>;

      try {
        config = builderConfig();
      } catch (error) {
        notice = error instanceof Error ? error.message : "builder is not configured";

        return false;
      }

      if (!config) {
        notice = "run bun run setup:remote-build, then fill in configs/builder/remote.yaml";

        return false;
      }

      startSession((signal) => presentBuild({ choice: chosen, config, chromiumSrc, signal }));

      return true;
    };

    const beginLocal = (): boolean => {
      const chosen = highlighted();

      if (!chosen) {
        notice = "";

        return false;
      }

      if (!chosen.present) {
        notice = `branch ${chosen.branch} is not in ${chromiumSrc}`;

        return false;
      }

      startSession((signal) => presentLocalBuild({ choice: chosen, chromiumSrc, force, signal }));

      return true;
    };

    const highlighted = (): RunChoice | undefined => {
      return matchingChoices({ choices, query: state.query })[state.selected];
    };

    const startSession = (run: (signal: AbortSignal) => Promise<string>) => {
      opening = true;
      choosingBuild = false;
      process.stdin.setRawMode(false);
      process.stdout.write(LEAVE_SCREEN);
      const abort = new AbortController();
      cancelBuild = () => abort.abort();
      void run(abort.signal)
        .then((builtNotice) => {
          notice = builtNotice;
        })
        .finally(() => {
          cancelBuild = null;
          opening = false;

          if (settled) {
            return;
          }

          resumeList();
          paint();
        });
    };

    const detach = () => {
      process.stdin.off("data", onData);
      process.stdout.off("resize", onResize);
      process.off("SIGINT", onSigint);
    };

    onDetach(detach);
    process.stdin.on("data", onData);
    process.stdout.on("resize", onResize);
    process.on("SIGINT", onSigint);
    paint();
  });
}

/** Arrow keys arrive as one escape sequence; anything else is typed text, one character at a time. */
function keyParts(input: string): string[] {
  if (input.startsWith("\x1b")) {
    return [input];
  }

  return [...input];
}

import process from "node:process";
import type { BuildFinish } from "../inspect/build/build-session.types";
import { loadChoices } from "../inspect/list/load-choices";
import { createRunsScreen } from "../inspect/list/runs-screen";
import { CHROMIUM_SRC } from "../paths";
import { narrowSelection } from "../runner/bench-config/narrow-selection";
import { createBuildLogScreen } from "../runner/build-log/screen/build-log-screen";
import { openTui } from "../tui/open-tui";
import type { TuiHost, TuiScreen, TuiTab } from "../tui/open-tui.types";
import { createChromiumJobController } from "./jobs/chromium-job";
import type { OpenStartTuiOptions, StartTab } from "./open-start-tui.types";
import { createPickerScreen } from "./picker/picker-screen";
import type { PickerChoices, PickerStartRequest } from "./picker/picker-state.types";
import { createQuitGuard } from "./quit-guard";
import { createSetupsScreen } from "./setups/setups-screen";

const TAB_ORDER: StartTab[] = ["start", "runs", "build", "setups"];

/**
 * Opens the long-lived `bun run start` TUI. Start, builds, and checkout run as one-at-a-time
 * Chromium jobs while tabs stay navigable. Resolves only when the user quits. Quitting stops the running job,
 * so esc and the screens' quit keys ask first while one runs.
 */
export async function openStartTui(options: OpenStartTuiOptions): Promise<null> {
  const runChoices = await loadChoices();
  const pickerChoices = toPickerChoices(options.selection);
  let cancelActiveJob = () => {};

  await openTui<null>({
    initialTab: TAB_ORDER.indexOf(options.initialTab),
    tabs: (host: TuiHost<null>): TuiTab[] => {
      const buildFinishSlot: { handle: (finish: BuildFinish) => void } = {
        handle: () => {},
      };
      const jobs = createChromiumJobController({
        force: options.force,
        onChange: () => {
          if (!host.isClosed()) {
            host.repaint();
          }
        },
        onBuildLog: () => {
          host.setActiveTab(TAB_ORDER.indexOf("build"));
        },
        onBuildFinish: (finish) => {
          buildFinishSlot.handle(finish);
        },
      });
      cancelActiveJob = () => {
        jobs.cancel();
      };

      const quitGuard = createQuitGuard({ jobStatus: jobs.status, quit: () => host.finish(null) });

      const withJobInterrupt = (screen: TuiScreen): TuiScreen => ({
        ...quitGuard.wrap(screen),
        onInterrupt: () => {
          if (jobs.status().stopping) {
            process.exit(130);
          }

          if (jobs.cancel()) {
            return true;
          }

          return screen.onInterrupt();
        },
      });

      const startMatrix = ({ picked, force: startForce }: PickerStartRequest) => {
        const selection = narrowSelection({
          selection: options.selection,
          taskIds: picked.taskIds,
          configIds: picked.configIds,
        });
        const refused = jobs.startMatrix({
          plan: {
            ...selection,
            repeats: picked.repeats,
            timeoutMin: picked.timeoutMin,
            buildTimeoutMin: picked.buildTimeoutMin,
            sync: picked.sync,
            autoReview: picked.autoReview,
          },
          force: startForce ?? options.force,
          judgeModel: options.judgeModel,
        });

        if (refused) {
          return { ok: false, notice: refused };
        }

        return { ok: true, notice: `started · ${options.equivalentCommand(picked)}` };
      };

      return [
        {
          label: "Start",
          screen: withJobInterrupt(
            createPickerScreen({
              choices: pickerChoices,
              defaults: options.defaults,
              savedPath: options.savedPath,
              force: options.force,
              jobs,
              onQuit: quitGuard.requestQuit,
              onStart: startMatrix,
            }),
          ),
        },
        {
          label: "Runs",
          screen: withJobInterrupt(
            createRunsScreen({
              choices: runChoices,
              chromiumSrc: CHROMIUM_SRC,
              force: options.force,
              controls: host,
              jobs,
              onQuit: quitGuard.requestQuit,
              buildFinishSlot,
            }),
          ),
        },
        {
          label: "Build",
          screen: withJobInterrupt(createBuildLogScreen({ controls: host, jobs })),
        },
        {
          label: "Setups",
          screen: withJobInterrupt(
            createSetupsScreen({
              controls: host,
              configs: options.selection.configs.map((config) => ({
                configId: config.configId,
                description: config.description,
              })),
            }),
          ),
        },
      ];
    },
  });

  cancelActiveJob();

  return null;
}

function toPickerChoices(selection: OpenStartTuiOptions["selection"]): PickerChoices {
  return {
    tasks: selection.tasks.map((task) => ({
      id: task.taskId,
      detail: [task.title, task.difficulty ? `(${task.difficulty})` : ""].filter(Boolean).join(" "),
    })),
    configs: selection.configs.map((config) => ({
      id: config.configId,
      detail: [config.model, config.description].filter(Boolean).join("  "),
    })),
  };
}

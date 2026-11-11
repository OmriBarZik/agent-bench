import type { TuiControls, TuiScreen } from "../../tui/open-tui.types";
import { isDown, isEnd, isHome, isUp } from "../picker/picker-keys";
import { loadBuilderCheck } from "./builder-check";
import { loadSetups } from "./load-setups";
import type { SetupConfigRef, SetupReport, SharedCheck } from "./load-setups.types";
import { renderSetups } from "./render-setups";

/**
 * The Setups tab: every config, whether its setup.json checks pass, and whether it has been run.
 * r reloads the checks and the run counts. Esc is left to the TUI, which quits.
 * With `controls`, the build Mac is asked over SSH in the background, and its answer joins the shared line when it arrives.
 */
export function createSetupsScreen({
  configs,
  dbPath,
  controls,
}: {
  configs: SetupConfigRef[];
  dbPath?: string;
  controls?: TuiControls;
}): TuiScreen {
  let report = loadSetups({ configs, dbPath });
  let builderCheck: SharedCheck | null = null;
  let selected = 0;
  let scroll = 0;

  const refreshBuilder = () => {
    if (!controls) {
      return;
    }

    void loadBuilderCheck().then((check) => {
      builderCheck = check;

      if (!controls.isClosed()) {
        controls.repaint();
      }
    });
  };

  refreshBuilder();

  const clamp = (next: SetupReport) => {
    report = next;
    selected = Math.min(selected, Math.max(report.configs.length - 1, 0));
  };

  return {
    render: ({ rows, columns }) => {
      const shared = builderCheck ? [...report.shared, builderCheck] : report.shared;
      const painted = renderSetups({ report: { ...report, shared }, selected, scroll, rows, columns });
      scroll = painted.scroll;

      return painted.body;
    },
    onKey: (key) => {
      if (key === "r") {
        clamp(loadSetups({ configs, dbPath }));
        refreshBuilder();

        return;
      }

      const count = report.configs.length;

      if (count === 0) {
        return;
      }

      if (isUp(key)) {
        selected = Math.max(selected - 1, 0);
      }

      if (isDown(key)) {
        selected = Math.min(selected + 1, count - 1);
      }

      if (isHome(key)) {
        selected = 0;
      }

      if (isEnd(key)) {
        selected = count - 1;
      }
    },
    onEscape: () => false,
    onInterrupt: () => false,
    onResize: () => {},
    isBusy: () => false,
  };
}

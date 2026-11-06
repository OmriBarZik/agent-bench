import type { TuiScreen } from "../../tui/open-tui.types";
import { isDown, isEnd, isHome, isUp } from "../picker/picker-keys";
import { loadSetups } from "./load-setups";
import type { SetupConfigRef, SetupReport } from "./load-setups.types";
import { renderSetups } from "./render-setups";

/**
 * The Setups tab: every config, whether its setup.json checks pass, and whether it has been run.
 * r reloads the checks and the run counts. Esc is left to the TUI, which quits.
 */
export function createSetupsScreen({ configs, dbPath }: { configs: SetupConfigRef[]; dbPath?: string }): TuiScreen {
  let report = loadSetups({ configs, dbPath });
  let selected = 0;
  let scroll = 0;

  const clamp = (next: SetupReport) => {
    report = next;
    selected = Math.min(selected, Math.max(report.configs.length - 1, 0));
  };

  return {
    render: ({ rows, columns }) => {
      const painted = renderSetups({ report, selected, scroll, rows, columns });
      scroll = painted.scroll;

      return painted.body;
    },
    onKey: (key) => {
      if (key === "r") {
        clamp(loadSetups({ configs, dbPath }));

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

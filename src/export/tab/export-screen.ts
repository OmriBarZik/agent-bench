import { relative } from "node:path";
import { BENCH_DIR } from "../../paths";
import { isDown, isEnd, isHome, isUp } from "../../start/picker/picker-keys";
import type { TuiControls, TuiScreen } from "../../tui/open-tui.types";
import { filterRuns } from "../filter/filter-runs";
import { loadExportData, writeFilteredExport } from "../run-export";
import type { ExportResult } from "../run-export.types";
import { copyFileToClipboard, openFolder } from "./export-actions";
import { buildOptions, defaultForm, formToFilter, toggleOption } from "./export-form";
import { renderExport } from "./render-export";

/**
 * The Export tab: the dashboard's filters as checkable lists, with a live count of the runs that match. Enter writes
 * exports/<time>/, c copies that export's bench-export.md (exporting first when nothing was written yet), o opens the
 * folder, and r reloads the runs from the DB. Reads the DB only. Esc is left to the TUI, which quits.
 */
export function createExportScreen({ controls, dbPath }: { controls: TuiControls; dbPath?: string }): TuiScreen {
  let data = loadExportData(dbPath);
  let options = buildOptions(data);
  let form = defaultForm();
  let selected = 0;
  let scroll = 0;
  let notice = "";
  let lastExport: ExportResult | null = null;

  const repaint = () => {
    if (!controls.isClosed()) {
      controls.repaint();
    }
  };

  const runExport = (): ExportResult => {
    lastExport = writeFilteredExport({ data, filter: formToFilter(form) });
    notice = `exported ${lastExport.exported} of ${lastExport.total} runs to ${relative(BENCH_DIR, lastExport.outDir)}`;

    return lastExport;
  };

  const copyBundle = () => {
    const result = lastExport ?? runExport();
    void copyFileToClipboard(result.bundlePath).then((copied) => {
      notice = copied
        ? `copied ${relative(BENCH_DIR, result.bundlePath)} to the clipboard (${result.exported} runs)`
        : "pbcopy failed; open the folder with o and copy bench-export.md by hand";
      repaint();
    });
  };

  const handleAction = (key: string): boolean => {
    if (key === " ") {
      form = toggleOption({ form, option: options[selected]! });
      lastExport = null;
    } else if (key === "\r") {
      runExport();
    } else if (key === "c") {
      copyBundle();
    } else if (key === "o") {
      notice = lastExport
        ? `opened ${relative(BENCH_DIR, lastExport.outDir)}`
        : "nothing exported yet; press enter first";

      if (lastExport) {
        void openFolder(lastExport.outDir);
      }
    } else if (key === "r") {
      data = loadExportData(dbPath);
      options = buildOptions(data);
      selected = Math.min(selected, options.length - 1);
      lastExport = null;
      notice = `reloaded ${data.runs.length} runs`;
    } else {
      return false;
    }

    return true;
  };

  return {
    render: ({ rows, columns }) => {
      const filter = formToFilter(form);
      const matching = filterRuns({ runs: data.runs, tasks: data.tasks, filter }).length;
      const frame = renderExport({
        view: { options, form, selected, scroll, matching, total: data.runs.length, notice },
        rows,
        columns,
      });
      scroll = frame.scroll;

      return frame.body;
    },
    onKey: (key) => {
      if (handleAction(key)) {
        return;
      }

      if (isUp(key)) {
        selected = Math.max(selected - 1, 0);
      }

      if (isDown(key)) {
        selected = Math.min(selected + 1, options.length - 1);
      }

      if (isHome(key)) {
        selected = 0;
      }

      if (isEnd(key)) {
        selected = options.length - 1;
      }
    },
    onEscape: () => false,
    onInterrupt: () => false,
    onResize: () => {},
    isBusy: () => false,
  };
}

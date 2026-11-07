import type { LineKind } from "../../inspect/render/terminal-text.types";

/** Extra footer lines under the summary (matrix status panel). */
export type PickerStatusPanel = {
  /** Short title over the panel. */
  title: string;
  /** Recent status lines, newest last. */
  lines: string[];
};

/** One line of the picker body. `row` is the `pickerRows` index it shows, or null for headers and gaps. */
export type PickerLine = {
  text: string;
  kind: LineKind;
  row: number | null;
};

/** The painted picker lines, and the body scroll they were painted at so the next paint keeps the cursor still. */
export type PickerFrame = {
  /** The lines joined with `\r\n`, without cursor-home or clear codes; the TUI adds those around the tab bar. */
  body: string;
  scroll: number;
};

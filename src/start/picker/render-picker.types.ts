import type { LineKind } from "../../inspect/render/terminal-text.types";

/** One line of the picker body. `row` is the `pickerRows` index it shows, or null for headers and gaps. */
export type PickerLine = {
  text: string;
  kind: LineKind;
  row: number | null;
};

/** A painted picker screen, and the body scroll it was painted at so the next paint keeps the cursor still. */
export type PickerFrame = {
  frame: string;
  scroll: number;
};

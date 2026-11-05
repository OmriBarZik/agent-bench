import type { RunChoice } from "../inspect/list/select-state.types";
import type { PickerResult } from "./picker/picker-state.types";

/** The tab the TUI opens on. */
export type StartTab = "start" | "runs";

/** Enter on the Start tab: run this matrix. */
export type MatrixPicked = {
  kind: "start";
  picked: PickerResult;
};

/** Ctrl-g on the Runs tab (or the Enter menu): check this run's branch out. */
export type CheckoutPicked = {
  kind: "checkout";
  choice: RunChoice;
};

/** What the start TUI closed with. */
export type StartTuiPick = MatrixPicked | CheckoutPicked;

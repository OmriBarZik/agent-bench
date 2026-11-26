import type { BuildLocation } from "../../../validate/build/steps/steps.types";

/** The Start tab selection stored in `data/start-picker.json`, so the next open continues from it. */
export type SavedPicker = {
  taskIds: string[];
  configIds: string[];
  repeats: number;
  timeoutMin: number;
  buildTimeoutMin: number;
  sync: boolean;
  autoReview: boolean;
  /** Absent in files saved before the build location row; read as `remote`. */
  buildLocation: BuildLocation;
  /** Index into `pickerRows` at the time it was saved. */
  cursor: number;
};

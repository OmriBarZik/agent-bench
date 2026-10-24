/** Whether this keypress armed a run or confirmed removing it. */
export type DeleteIntent = {
  /** Run waiting for a second ctrl-x, or null when nothing is armed. */
  armedRunId: string | null;
  /** True when this keypress confirms removing the previously armed run. */
  remove: boolean;
};

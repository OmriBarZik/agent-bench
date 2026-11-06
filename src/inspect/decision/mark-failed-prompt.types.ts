/** A yes/no question for each run whose compile failed. The first run is showing. */
export type MarkFailedPrompt = {
  /** Runs still waiting for an answer, in the order they failed. */
  runIds: string[];
  /** 0 keeps the decision, 1 marks the run failed. */
  selected: number;
};

/** The run name shown on the question. */
export type MarkFailedRun = {
  runId: string;
  taskId: string;
  configId: string;
};

/** One keypress left the question open. */
export type MarkFailedStay = {
  kind: "stay";
  prompt: MarkFailedPrompt;
};

/** One keypress answered the run that is showing, and may leave the next run's question. */
export type MarkFailedAnswer = {
  kind: "answer";
  runId: string;
  /** True when the user chose to set the judge decision to failed. */
  markFailed: boolean;
  /** The question for the remaining runs, or null when this was the last. */
  prompt: MarkFailedPrompt | null;
};

/** What one keypress did inside the failed-build question. */
export type MarkFailedKeyResult = MarkFailedStay | MarkFailedAnswer;

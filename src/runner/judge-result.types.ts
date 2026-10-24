/** The score and explanation parsed from a judge session. */
export type JudgeVerdict = {
  /** 0 means the task was not done. 1 means every requirement was met. */
  score: number;
  reason: string;
};

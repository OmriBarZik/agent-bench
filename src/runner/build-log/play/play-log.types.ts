/** One pass of log text through a terminal: the finished lines, and the line still open. */
export type PlayedLog = {
  line: string;
  column: number;
  finished: string[];
  /** A CSI sequence split across two reads. It is not shown until the rest arrives. */
  held: string;
};

/** A running transcript follower. `stop` copies whatever is left, then stops polling. */
export type TranscriptFollow = {
  stop: () => void;
};

/** How far the session transcript has been read into the live log. */
export type TranscriptReadState = {
  /** The transcript file, once Claude has created it. */
  path: string | null;
  /** Bytes already read, always at the start of a line. */
  offset: number;
};

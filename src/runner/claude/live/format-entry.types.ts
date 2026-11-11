/** One content block of a transcript message, with the fields the live log reads. */
export type TranscriptBlock = {
  type?: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  is_error?: boolean | null;
  content?: unknown;
};

/** The message inside an assistant or user transcript entry. */
export type TranscriptMessage = {
  content?: string | TranscriptBlock[];
};

/** One line of a Claude Code session transcript (`<session-id>.jsonl`). Other entry types are ignored. */
export type TranscriptEntry = {
  type?: string;
  isSidechain?: boolean;
  message?: TranscriptMessage;
};

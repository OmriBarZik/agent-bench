/** The split of cache writes by lifetime that a transcript message's usage reports. */
export type TranscriptCacheCreation = {
  ephemeral_5m_input_tokens?: number;
  ephemeral_1h_input_tokens?: number;
};

/** The usage block on one assistant message of a session transcript. */
export type TranscriptUsage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation?: TranscriptCacheCreation;
};

/** One content block of an assistant message; only tool_use names matter here. */
export type TranscriptContentBlock = {
  type?: string;
  name?: string;
};

/** The assistant message inside a transcript entry. */
export type TranscriptAssistantMessage = {
  id?: string;
  usage?: TranscriptUsage;
  content?: string | TranscriptContentBlock[];
};

/** One line of a session transcript with the fields the phase split reads. */
export type PhaseTranscriptEntry = {
  type?: string;
  isSidechain?: boolean;
  timestamp?: string;
  message?: TranscriptAssistantMessage;
};

/** One API response: its usage, and whether it belongs to the validation phase. */
export type PhaseMessage = {
  usage: TranscriptUsage;
  validation: boolean;
};

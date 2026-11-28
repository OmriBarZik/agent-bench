import type { RoundSegment, ToolKind } from "../../db/db.types";
import type { TranscriptUsage } from "../phases/split-phases.types";

/** The input fields of a tool call that the round split reads. */
export type RoundToolInput = {
  command?: string;
  file_path?: string;
  notebook_path?: string;
};

/** One text part of a tool result. */
export type RoundResultPart = {
  type?: string;
  text?: string;
};

/** One content block of a transcript message, with the tool call and tool result fields the round split reads. */
export type RoundContentBlock = {
  type?: string;
  id?: string;
  name?: string;
  input?: RoundToolInput;
  tool_use_id?: string;
  is_error?: boolean;
  content?: string | RoundResultPart[];
};

/** The message inside a transcript entry, as the round split reads it. */
export type RoundTranscriptMessage = {
  id?: string;
  usage?: TranscriptUsage;
  content?: string | RoundContentBlock[];
};

/** One line of a session transcript with the fields the round split reads. */
export type RoundTranscriptEntry = {
  type?: string;
  isSidechain?: boolean;
  timestamp?: string;
  message?: RoundTranscriptMessage;
};

/** One tool call the agent made. */
export type RoundCall = {
  id: string;
  name: string;
  input: RoundToolInput;
};

/** The result of one tool call: when it came back, its text, and whether it was an error. */
export type RoundCallResult = {
  time: number;
  text: string;
  isError: boolean;
};

/** One API response of the main agent, merged across the transcript lines that repeat it. */
export type RoundMessage = {
  id: string;
  time: number;
  usage: TranscriptUsage;
  calls: RoundCall[];
};

/** The agent's API responses in order, every tool result by call id, and when the session ended. */
export type RoundTranscript = {
  messages: RoundMessage[];
  results: Map<string, RoundCallResult>;
  sessionEnd: number;
};

/** What a message does: it calls a chrome-validate tool, it edits a file, or it does anything else. */
export type MessageKind = "validate" | "edit" | "explore";

/** A message placed in its round and segment. */
export type PlacedMessage = {
  message: RoundMessage;
  round: number;
  segment: RoundSegment;
};

/** One tool a call ran, named for the dashboard, and what kind of work it is. */
export type CallTool = {
  tool: string;
  kind: ToolKind;
};

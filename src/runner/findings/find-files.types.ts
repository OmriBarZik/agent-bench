import type { RunFindings } from "../../db/db.types";
import type { TranscriptUsage } from "../phases/split-phases.types";

/** One content block of an assistant message; only tool calls and their input matter here. */
export type FindingContentBlock = {
  type?: string;
  name?: string;
  input?: unknown;
};

/** The assistant message inside a transcript entry, with the fields the finding search reads. */
export type FindingMessage = {
  id?: string;
  usage?: TranscriptUsage;
  content?: string | FindingContentBlock[];
};

/** One line of a session transcript with the fields the finding search reads. */
export type FindingTranscriptEntry = {
  type?: string;
  isSidechain?: boolean;
  message?: FindingMessage;
};

/** Where in the session the agent first opened a game source and a DevTools panel registration. */
export type FileFindings = Pick<RunFindings, "firstGameSource" | "firstPanelRegistration">;

/** One diagnostic a language server reported for a file. */
export type DiagnosticEntry = {
  severity?: string;
  message?: string;
};

/** The diagnostics for one file inside a diagnostics attachment. */
export type DiagnosticsFile = {
  uri?: string;
  diagnostics?: DiagnosticEntry[];
};

/** A transcript attachment; only `diagnostics` ones are counted. */
export type DiagnosticsAttachment = {
  type?: string;
  files?: DiagnosticsFile[];
};

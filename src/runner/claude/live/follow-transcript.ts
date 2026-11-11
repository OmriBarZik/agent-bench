import {
  appendFileSync,
  closeSync,
  existsSync,
  fstatSync,
  openSync,
  readdirSync,
  readSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { formatTranscriptLine } from "./format-entry";
import type { TranscriptFollow, TranscriptReadState } from "./follow-transcript.types";

const POLL_MS = 500;
/** One read of a growing transcript, so a large burst is copied over a few ticks. */
const MAX_CHUNK = 1024 * 1024;

/**
 * Follows the session transcript Claude writes under ~/.claude/projects while it runs, and appends each
 * message and tool call to `logPath` as readable text. Never throws: the live log must not fail a run.
 */
export function followTranscript({ sessionId, logPath }: { sessionId: string; logPath: string }): TranscriptFollow {
  let state: TranscriptReadState = { path: null, offset: 0 };

  const tick = () => {
    try {
      state = copyNewLines({ state, sessionId, logPath });
    } catch {
      // A missing projects folder or a failed write skips this tick; the next one tries again.
    }
  };

  try {
    writeFileSync(logPath, "");
  } catch {
    // The follower still runs; appends create the file.
  }

  const timer = setInterval(tick, POLL_MS);
  timer.unref();

  return {
    stop: () => {
      clearInterval(timer);
      tick();
    },
  };
}

function copyNewLines({
  state,
  sessionId,
  logPath,
}: {
  state: TranscriptReadState;
  sessionId: string;
  logPath: string;
}): TranscriptReadState {
  const path = state.path ?? findTranscript(sessionId);

  if (path == null) {
    return state;
  }

  const handle = openSync(path, "r");

  try {
    const size = fstatSync(handle).size;

    if (size <= state.offset) {
      return { ...state, path };
    }

    const length = Math.min(size - state.offset, MAX_CHUNK);
    const buffer = Buffer.alloc(length);
    const read = readSync(handle, buffer, 0, length, state.offset);
    // Stop at the last newline so a line (or a UTF-8 character) cut by the read is taken whole next tick.
    const lastNewline = buffer.subarray(0, read).lastIndexOf(10);
    // A full chunk with no newline is one huge line; skip it rather than stall.
    const consumed = lastNewline >= 0 ? lastNewline + 1 : read === MAX_CHUNK ? read : 0;
    const text = buffer.toString("utf8", 0, consumed).split("\n").flatMap(formatTranscriptLine);

    if (text.length > 0) {
      appendFileSync(logPath, `${text.join("\n")}\n`);
    }

    return { path, offset: state.offset + consumed };
  } finally {
    closeSync(handle);
  }
}

function findTranscript(sessionId: string): string | null {
  const projects = join(homedir(), ".claude", "projects");

  for (const projectDir of readdirSync(projects)) {
    const file = join(projects, projectDir, `${sessionId}.jsonl`);

    if (existsSync(file)) {
      return file;
    }
  }

  return null;
}

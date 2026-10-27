/** Args for viewing one session log in the browser. */
export function transcriptCommand(transcriptPath: string): string[] {
  return ["uvx", "claude-code-transcripts", "json", transcriptPath, "--open"];
}

/** Generates HTML for one transcript and opens it in the browser. */
export async function openTranscript(transcriptPath: string): Promise<void> {
  let proc: ReturnType<typeof Bun.spawn>;

  try {
    proc = Bun.spawn(transcriptCommand(transcriptPath), {
      stdin: "ignore",
      stdout: "inherit",
      stderr: "inherit",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to start uvx";

    throw new Error(`could not run uvx claude-code-transcripts: ${message}`);
  }

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(`claude-code-transcripts exited ${exitCode}`);
  }
}

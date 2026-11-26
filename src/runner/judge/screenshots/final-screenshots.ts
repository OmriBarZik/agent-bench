import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TRANSCRIPT_FILE } from "../../../paths";
import type { AgentScreenshot, TranscriptBlock } from "./final-screenshots.types";

/** The folder under a run's artifacts that holds the screenshots the judge may open. */
export const JUDGE_SCREENSHOTS_DIR = "judge-screenshots";
/** Enough for every state at two scales plus a few retries, without flooding the judge's context. */
const MAX_SCREENSHOTS = 24;
const BUILD_PATTERN = /Running build (\d+)/;
const SOURCE_PATTERN = /\[Image: source: ([^\]\s]+)\]/g;

/**
 * Writes the screenshots from the agent's `run_chrome` calls on its newest build into
 * `<outDir>/judge-screenshots/` and returns their paths, oldest first. Returns none when the run has no transcript
 * or took no screenshots. Earlier builds are left out: they show code that is not the final tree.
 */
export async function saveFinalScreenshots(outDir: string): Promise<string[]> {
  const transcript = Bun.file(join(outDir, TRANSCRIPT_FILE));

  if (!(await transcript.exists())) {
    return [];
  }

  const screenshots = newestBuildScreenshots(listScreenshots(await transcript.text())).slice(-MAX_SCREENSHOTS);
  const targetDir = join(outDir, JUDGE_SCREENSHOTS_DIR);
  rmSync(targetDir, { recursive: true, force: true });

  if (screenshots.length === 0) {
    return [];
  }

  mkdirSync(targetDir, { recursive: true });
  const saved: string[] = [];

  for (const screenshot of screenshots) {
    const target = join(targetDir, `${String(saved.length + 1).padStart(2, "0")}-build-${screenshot.build ?? "x"}.png`);

    if (writeScreenshot({ screenshot, target })) {
      saved.push(target);
    }
  }

  return saved;
}

/** Every screenshot in `run_chrome` results of a transcript, in the order the agent got them. */
export function listScreenshots(transcriptText: string): AgentScreenshot[] {
  const runChromeIds = new Set<string>();
  const screenshots: AgentScreenshot[] = [];

  for (const line of transcriptText.split("\n")) {
    for (const block of contentBlocks(line)) {
      if (block.type === "tool_use" && String(block.name ?? "").endsWith("run_chrome")) {
        runChromeIds.add(String(block.id));
      }

      if (block.type === "tool_result" && runChromeIds.has(String(block.tool_use_id))) {
        screenshots.push(...resultScreenshots(block.content));
      }
    }
  }

  return screenshots;
}

/** The screenshots taken on the highest build number any of them names. */
export function newestBuildScreenshots(screenshots: AgentScreenshot[]): AgentScreenshot[] {
  const builds = screenshots.map((screenshot) => screenshot.build ?? -1);
  const newest = Math.max(-1, ...builds);

  return screenshots.filter((screenshot) => (screenshot.build ?? -1) === newest);
}

function resultScreenshots(content: unknown): AgentScreenshot[] {
  if (!Array.isArray(content)) {
    return [];
  }

  const blocks = content as TranscriptBlock[];
  const texts = blocks.filter((block) => block.type === "text").map((block) => String(block.text ?? ""));
  const buildMatch = texts.map((text) => BUILD_PATTERN.exec(text)).find((match) => match != null);
  const build = buildMatch ? Number(buildMatch[1]) : null;
  const inline = blocks
    .filter((block) => block.type === "image" && block.source?.type === "base64" && block.source.data)
    .map((block) => ({ build, base64: block.source?.data }));

  if (inline.length > 0) {
    return inline;
  }

  return texts.flatMap((text) => [...text.matchAll(SOURCE_PATTERN)].map((match) => ({ build, sourcePath: match[1] })));
}

function writeScreenshot({ screenshot, target }: { screenshot: AgentScreenshot; target: string }): boolean {
  if (screenshot.base64) {
    writeFileSync(target, Buffer.from(screenshot.base64, "base64"));

    return true;
  }

  if (screenshot.sourcePath && existsSync(screenshot.sourcePath)) {
    copyFileSync(screenshot.sourcePath, target);

    return true;
  }

  return false;
}

function contentBlocks(line: string): TranscriptBlock[] {
  if (line.trim() === "") {
    return [];
  }

  try {
    const content = (JSON.parse(line) as { message?: { content?: unknown } }).message?.content;

    return Array.isArray(content) ? (content as TranscriptBlock[]) : [];
  } catch {
    // A torn last line of a live transcript is not a reason to drop every screenshot before it.
    return [];
  }
}

/** One screenshot the agent got back from a chrome-validate `run_chrome` call. */
export type AgentScreenshot = {
  /** The build number the `run_chrome` result named ("Running build N"), or null when it named none. */
  build: number | null;
  /** The image bytes when the transcript holds them inline. */
  base64?: string;
  /** A file path when the transcript only refers to the image on disk. */
  sourcePath?: string;
};

/** The source of an image block in a transcript. */
export type TranscriptImageSource = {
  type?: string;
  data?: string;
};

/** A transcript content block, loosely typed: only the fields the screenshot reader uses. */
export type TranscriptBlock = {
  type?: string;
  id?: string;
  name?: string;
  tool_use_id?: string;
  text?: string;
  content?: unknown;
  source?: TranscriptImageSource;
};

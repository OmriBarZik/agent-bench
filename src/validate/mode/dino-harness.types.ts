/** Paths the dino harness needs after a successful light build. */
export type DinoHarnessPaths = {
  /** Copied `gen/components/neterror/resources/tsc` from the build. */
  dinoTsc: string;
  /** Copied `gen/ui/webui/resources/tsc`. */
  chromeResources: string;
  /** Copied lit minified build, when present. */
  litMinified: string | null;
  /** Live Chromium checkout: sprites, sounds, and neterror.css. */
  chromiumSrc: string;
};

/** A local server that hosts the rebuilt dino game so run_chrome can drive it. */
export type DinoHarness = {
  url: string;
  stop: () => void;
};

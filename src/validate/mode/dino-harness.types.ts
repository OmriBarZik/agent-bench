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

/** The game's three sounds from the checkout, each as a `data:audio/mpeg;base64,` URI. */
export type HarnessSounds = {
  press: string;
  hit: string;
  reached: string;
};

/** One URL prefix the harness serves from a directory. */
export type HarnessRoute = {
  prefix: string;
  directory: string;
};

/** A local server that hosts the rebuilt dino game so run_chrome can drive it. */
export type DinoHarness = {
  url: string;
  stop: () => void;
};

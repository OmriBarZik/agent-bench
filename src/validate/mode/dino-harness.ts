import { existsSync } from "node:fs";
import { join } from "node:path";
import type { DinoHarness, DinoHarnessPaths } from "./dino-harness.types";

/**
 * Serves a page that loads the agent's rebuilt dino TypeScript against the real sprites and sounds.
 * The game boots the same way chrome://dino does, without packing resources into Chromium.
 */
export async function startDinoHarness(paths: DinoHarnessPaths): Promise<DinoHarness> {
  for (const path of [paths.dinoTsc, paths.chromeResources]) {
    if (!existsSync(path)) {
      throw new Error(`${path} is missing; the dino build did not copy its TypeScript output`);
    }
  }

  const server = Bun.serve({
    port: 0,
    fetch(request) {
      return handleRequest({ request, paths });
    },
  });

  return {
    url: `http://127.0.0.1:${server.port}/`,
    stop: () => server.stop(true),
  };
}

function handleRequest({ request, paths }: { request: Request; paths: DinoHarnessPaths }): Response {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/" || path === "/index.html") {
    return new Response(harnessHtml(), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  if (path === "/boot.js") {
    return new Response(bootScript(), {
      headers: { "content-type": "text/javascript; charset=utf-8" },
    });
  }

  if (path.startsWith("/dino/")) {
    return fileResponse({ root: paths.dinoTsc, relative: path.slice("/dino/".length) });
  }

  if (path.startsWith("/chrome-resources/")) {
    return fileResponse({ root: paths.chromeResources, relative: path.slice("/chrome-resources/".length) });
  }

  if (path.startsWith("/lit/") && paths.litMinified != null) {
    return fileResponse({ root: paths.litMinified, relative: path.slice("/lit/".length) });
  }

  if (path.startsWith("/neterror/")) {
    return fileResponse({
      root: join(paths.chromiumSrc, "components/neterror/resources"),
      relative: path.slice("/neterror/".length),
    });
  }

  if (path.startsWith("/interstitial/")) {
    return fileResponse({
      root: join(paths.chromiumSrc, "components/security_interstitials/core/common/resources"),
      relative: path.slice("/interstitial/".length),
    });
  }

  return new Response("not found", { status: 404 });
}

function fileResponse({ root, relative }: { root: string; relative: string }): Response {
  if (relative.includes("..")) {
    return new Response("not found", { status: 404 });
  }

  const path = join(root, relative);

  if (!existsSync(path)) {
    return new Response("not found", { status: 404 });
  }

  return new Response(Bun.file(path));
}

function harnessHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>dino harness</title>
  <link rel="stylesheet" href="/interstitial/interstitial_core.css">
  <link rel="stylesheet" href="/interstitial/interstitial_common.css">
  <link rel="stylesheet" href="/neterror/neterror.css">
  <script type="importmap">
  {
    "imports": {
      "chrome://resources/": "/chrome-resources/",
      "//resources/": "/chrome-resources/",
      "chrome://resources/lit/v3_0/": "/lit/",
      "//resources/lit/v3_0/": "/lit/"
    }
  }
  </script>
  <script type="module" src="/boot.js"></script>
</head>
<body class="neterror">
  <div id="main-frame-error" class="interstitial-wrapper">
    <div id="main-content">
      <div class="icon icon-offline"></div>
      <div id="main-message">
        <h1>No internet</h1>
      </div>
    </div>
  </div>
  <div id="offline-resources">
    <img id="offline-resources-1x" src="/neterror/images/default_100_percent/offline/100-offline-sprite.png">
    <img id="offline-resources-2x" src="/neterror/images/default_200_percent/offline/200-offline-sprite.png">
    <template id="audio-resources">
      <audio id="offline-sound-press" src="/neterror/sounds/button-press.mp3"></audio>
      <audio id="offline-sound-hit" src="/neterror/sounds/hit.mp3"></audio>
      <audio id="offline-sound-reached" src="/neterror/sounds/score-reached.mp3"></audio>
    </template>
  </div>
</body>
</html>
`;
}

function bootScript(): string {
  return `import {loadTimeData} from 'chrome://resources/js/load_time_data.js';
import {Runner} from '/dino/dino_game/offline.js';

loadTimeData.data = {
  dinoGameA11yAriaLabel: 'Dino game',
  dinoGameInstructionsKeyboard: 'Press space to play',
};
document.documentElement.classList.add('offline');
Runner.initializeInstance('.interstitial-wrapper');
`;
}

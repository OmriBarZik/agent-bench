import { READ_GAME_STATE } from "../chrome/page/game-state-reader";
import type { HarnessSounds } from "./dino-harness.types";

/**
 * The harness page: neterror's markup, Chromium's own sprites, and the sounds as base64 data URIs, the way the
 * packed neterror page inlines them. `loadSounds` in the game decodes those URIs, so plain file URLs would throw.
 */
export function harnessHtml(sounds: HarnessSounds): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>dino harness</title>
  <link rel="stylesheet" href="/interstitial/interstitial_core.css">
  <link rel="stylesheet" href="/interstitial/interstitial_common.css">
  <link rel="stylesheet" href="/neterror/neterror.css">
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
      <audio id="offline-sound-press" src="${sounds.press}"></audio>
      <audio id="offline-sound-hit" src="${sounds.hit}"></audio>
      <audio id="offline-sound-reached" src="${sounds.reached}"></audio>
    </template>
  </div>
</body>
</html>
`;
}

/**
 * Boots the rebuilt game the way the neterror page does, then exposes `benchGameState`, which the run_chrome
 * `state` action reads. It only reads the game; nothing on the page lets a check drive it.
 */
export function bootScript(): string {
  return `import {loadTimeData} from '/chrome-resources/js/load_time_data.js';
import {Runner} from '/dino/dino_game/offline.js';
import * as trexModule from '/dino/dino_game/trex.js';

loadTimeData.data = {
  dinoGameA11yAriaLabel: 'Dino game',
  dinoGameInstructionsKeyboard: 'Press space to play',
};
document.documentElement.classList.add('offline');
Runner.initializeInstance('.interstitial-wrapper');

window.benchGameState = () => (${READ_GAME_STATE})(Runner.getInstance(), trexModule.Status);
`;
}

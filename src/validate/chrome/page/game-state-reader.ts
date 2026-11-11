/**
 * JavaScript source of `function (runner, statusNames)` that reads the dino game's Runner instance, or returns null
 * when `runner` is not one. The dino harness binds it to `benchGameState`; run_chrome calls it on the Runner it
 * finds on chrome://dino, where Runner is not a global. `statusNames` maps the numeric T-Rex status to its name when
 * the page has the enum; otherwise the number is kept. `playCount` goes up on every start and restart, so two reads
 * show whether the game restarted by itself after a crash.
 */
export const READ_GAME_STATE = `function (runner, statusNames) {
  if (runner == null || typeof runner !== 'object' || !('tRex' in runner) || !('currentSpeed' in runner)) {
    return null;
  }
  const trex = runner.tRex;
  return {
    playing: runner.playing,
    crashed: runner.crashed,
    paused: runner.paused,
    speed: runner.currentSpeed,
    distance: runner.distanceRan,
    playCount: runner.playCount,
    devicePixelRatio: window.devicePixelRatio,
    trex: trex == null ? null : {
      status: statusNames?.[trex.status] ?? trex.status,
      xPos: trex.xPos,
      yPos: trex.yPos,
      jumping: trex.jumping,
      ducking: trex.ducking,
    },
  };
}`;

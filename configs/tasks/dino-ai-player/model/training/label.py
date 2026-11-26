"""Outcome-based labels: simulate every candidate plan ahead and keep the best.

For a state, the target is the first obstacle the T-Rex has not yet passed.
Each plan is simulated from a copy of the state (no new spawns, nominal
60 fps) until the target is behind the T-Rex. A plan scores
(survived, clearance), where clearance is the smallest pixel gap between the
T-Rex and target collision boxes over the simulation (capped at CAP).
Plans (an action means "this key is held this frame", see dino_sim.apply):
  N        nothing on every frame
  J(k)     nothing for k frames, then hold jump until the jump can no longer
           be cut short (or, when airborne, keep holding it), then nothing
  D(k)     nothing for k frames, then duck held until the target is passed
  SJ(k)    (only when airborne) speed drop now until landing, nothing, then
           jump k frames later
The label is the first action of the best plan; ties prefer N, then the
smallest k (act early rather than late), and J/D only when acting now is
strictly better than every later option. No rule about the game picks the
action: only simulated outcomes do.
"""

from dino_sim import JUMP, DUCK, NOTHING, MS_PER_FRAME, DROP_VELOCITY

CAP = 40
MAX_HORIZON = 160


def _target(game):
    upcoming = game.upcoming()
    return upcoming[0] if upcoming else None


def _passed(game, target):
    return target.x + target.width - 1 <= game.trex_x + 1


def _run(game, target_index, actions, start_clear, bound):
    """Simulate `game` in place. actions(frame, game) -> action.

    Returns (survived, clearance). Stops early once clearance <= bound.
    """
    clear = start_clear
    frame = 0
    while frame < MAX_HORIZON:
        target = game.obstacles[target_index] if target_index < len(game.obstacles) else None
        if target is None or _passed(game, target):
            return True, clear
        game.apply(actions(frame, game))
        removed_before = len(game.obstacles)
        game.step(MS_PER_FRAME)
        if game.crashed:
            return False, -1
        target_index -= removed_before - len(game.obstacles)
        if target_index < 0:
            return True, clear
        value = game.clearance(game.obstacles[target_index], CAP)
        if value < clear:
            clear = value
            if clear < bound:
                return True, clear
        frame += 1
    return True, clear


def _nothing_trajectory(game, target_index, start_clear):
    """Run plan N, keeping (snapshot, target_index, prefix_clearance) per frame."""
    snapshots = []
    clear = start_clear
    game = game.copy()
    survived = True
    for _ in range(MAX_HORIZON):
        target = game.obstacles[target_index] if target_index < len(game.obstacles) else None
        if target is None or _passed(game, target):
            break
        snapshots.append((game.copy(), target_index, clear))
        game.apply(NOTHING)
        before = len(game.obstacles)
        game.step(MS_PER_FRAME)
        if game.crashed:
            survived = False
            break
        target_index -= before - len(game.obstacles)
        if target_index < 0:
            break
        clear = min(clear, game.clearance(game.obstacles[target_index], CAP))
    return survived, clear, snapshots


def _hold(action):
    return lambda frame, game: action


def _jump_once():
    """Hold Space until the jump can no longer be cut short, then release."""
    state = {'started': False, 'done': False}

    def act(frame, game):
        if state['done']:
            return NOTHING
        if game.jumping:
            state['started'] = True
            if game.velocity < DROP_VELOCITY:
                return JUMP
            state['done'] = True
            return NOTHING
        if state['started']:
            state['done'] = True
            return NOTHING
        return JUMP
    return act


def _search(game, target_index, start_clear, best):
    """Try N, J(k), D(k) from `game`. best = [survived, clear, label, k]."""
    survived, clear, snapshots = _nothing_trajectory(game, target_index, start_clear)
    if survived and (not best[0] or clear > best[1]):
        best[:] = [True, clear, NOTHING, -1]
    for action in (JUMP, DUCK):
        for k, (snapshot, index, prefix) in enumerate(snapshots):
            if best[0] and prefix <= best[1]:
                break
            if action == JUMP and snapshot.jumping and snapshot.velocity >= DROP_VELOCITY:
                continue
            branch = snapshot.copy()
            plan = _jump_once() if action == JUMP else _hold(DUCK)
            ok, value = _run(branch, index, plan, prefix, best[1] if best[0] else -2)
            if ok and (not best[0] or value > best[1] or (value == best[1] and k < best[3] and best[3] >= 0)):
                best[:] = [True, value, action if k == 0 else NOTHING, k]


def label(game):
    """Return (label, survived, clearance) for the current state."""
    target = _target(game)
    if target is None:
        return NOTHING, True, CAP
    target_index = game.obstacles.index(target)
    start_clear = game.clearance(target, CAP)
    best = [False, -2, NOTHING, -1]
    _search(game, target_index, start_clear, best)
    if game.jumping and not (best[0] and best[1] >= CAP):
        # SJ(k): speed drop until landing, then plan again from the ground.
        branch = game.copy()
        index = target_index
        clear = start_clear
        alive = True
        while branch.jumping and alive:
            target_now = branch.obstacles[index] if index < len(branch.obstacles) else None
            if target_now is None or _passed(branch, target_now):
                break
            branch.apply(DUCK)
            before = len(branch.obstacles)
            branch.step(MS_PER_FRAME)
            if branch.crashed:
                alive = False
                break
            index -= before - len(branch.obstacles)
            if index < 0:
                break
            clear = min(clear, branch.clearance(branch.obstacles[index], CAP))
        if alive and index >= 0 and index < len(branch.obstacles) and not branch.jumping:
            sub = [False, -2, NOTHING, -1]
            if best[0]:
                sub = [True, best[1], NOTHING, -1]
            _search(branch, index, clear, sub)
            if sub[0] and (not best[0] or sub[1] > best[1]):
                best[:] = [True, sub[1], DUCK, 0]
    return best[2], best[0], best[1]

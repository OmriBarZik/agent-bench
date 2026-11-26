"""Pure-stdlib simulator of Chrome's offline T-Rex game (normal mode, desktop).

Ported from components/neterror/resources/dino_game/{offline,trex,obstacle,
horizon,offline_sprite_definitions}.ts at Chromium commit
920e1e66e67c6038a08847aa817a771c5c180ed3. Only the mechanics that affect
play are modelled: T-Rex jump / speed drop / duck physics, obstacle spawning,
movement and removal, collision (outer box then per-box AABB, only against
horizon.obstacles[0], as the game does), speed-up and distanceRan.
Drawing, sound, night mode, clouds and the alt game mode are left out.
"""

import math

# ---- constants (offline.ts defaultBaseConfig / normalModeConfig) ----------
FPS = 60
MS_PER_FRAME = 1000 / FPS
CANVAS_WIDTH = 600
CANVAS_HEIGHT = 150
BOTTOM_PAD = 10
CLEAR_TIME = 3000          # ms of running before obstacles appear
START_SPEED = 6
MAX_SPEED = 13
ACCELERATION = 0.001       # added to currentSpeed every frame
GAP_COEFFICIENT = 0.6
MAX_GAP_COEFFICIENT = 1.5
MAX_OBSTACLE_LENGTH = 3
MAX_OBSTACLE_DUPLICATION = 2

# ---- T-Rex (trex.ts defaultTrexConfig + normalJumpConfig) -------------------
TREX_WIDTH = 44
TREX_HEIGHT = 47
GRAVITY = 0.6
MAX_JUMP_HEIGHT = 30
MIN_JUMP_HEIGHT = 30
INITIAL_JUMP_VELOCITY = -10
DROP_VELOCITY = -5
SPEED_DROP_COEFFICIENT = 3
GROUND_Y = CANVAS_HEIGHT - TREX_HEIGHT - BOTTOM_PAD   # 93
MIN_JUMP_Y = GROUND_Y - MIN_JUMP_HEIGHT                # 63

TREX_BOXES_DUCKING = ((1, 18, 55, 25),)
TREX_BOXES_RUNNING = ((22, 0, 17, 16), (1, 18, 30, 9), (10, 35, 14, 8),
                      (1, 24, 29, 5), (5, 30, 21, 4), (9, 34, 15, 4))

# ---- obstacles (offline_sprite_definitions.ts, collectable excluded) --------
CACTUS_SMALL, CACTUS_LARGE, PTERODACTYL = 0, 1, 2
OBSTACLE_TYPES = (
    dict(name='cactusSmall', width=17, height=35, ypos=(105,), multiple_speed=4,
         min_gap=120, min_speed=0, speed_offset=0,
         boxes=((0, 7, 5, 27), (4, 0, 6, 34), (10, 4, 7, 14))),
    dict(name='cactusLarge', width=25, height=50, ypos=(90,), multiple_speed=7,
         min_gap=120, min_speed=0, speed_offset=0,
         boxes=((0, 12, 7, 38), (8, 0, 7, 49), (13, 10, 10, 38))),
    dict(name='pterodactyl', width=46, height=40, ypos=(100, 75, 50),
         multiple_speed=999, min_gap=150, min_speed=8.5, speed_offset=0.8,
         boxes=((15, 15, 16, 5), (18, 21, 24, 6), (2, 14, 4, 3), (6, 10, 4, 7),
                (10, 8, 6, 9))),
)

# ---- actions (model output order) -------------------------------------------
JUMP, DUCK, NOTHING = 0, 1, 2
ACTION_NAMES = ('jump', 'duck', 'nothing')


def js_round(value):
    """JavaScript Math.round (half rounds toward +infinity)."""
    return math.floor(value + 0.5)


def random_num(rng, low, high):
    """utils.ts getRandomNum: integer in [low, high]."""
    return math.floor(rng.random() * (high - low + 1)) + low


class Obstacle:
    __slots__ = ('kind', 'size', 'width', 'height', 'x', 'y', 'speed_offset',
                 'gap', 'boxes', 'following_created')

    def copy(self):
        other = Obstacle.__new__(Obstacle)
        other.kind = self.kind
        other.size = self.size
        other.width = self.width
        other.height = self.height
        other.x = self.x
        other.y = self.y
        other.speed_offset = self.speed_offset
        other.gap = self.gap
        other.boxes = self.boxes
        other.following_created = self.following_created
        return other


def make_obstacle(rng, kind, speed):
    """obstacle.ts constructor + init()."""
    config = OBSTACLE_TYPES[kind]
    obstacle = Obstacle()
    obstacle.kind = kind
    size = random_num(rng, 1, MAX_OBSTACLE_LENGTH)
    if size > 1 and config['multiple_speed'] > speed:
        size = 1
    obstacle.size = size
    obstacle.width = config['width'] * size
    obstacle.height = config['height']
    obstacle.x = CANVAS_WIDTH + config['width']    # xOffset = type width
    ypos = config['ypos']
    obstacle.y = ypos[random_num(rng, 0, len(ypos) - 1)]
    boxes = [list(box) for box in config['boxes']]
    if size > 1:
        boxes[1][2] = obstacle.width - boxes[0][2] - boxes[2][2]
        boxes[2][0] = obstacle.width - boxes[2][2]
    obstacle.boxes = tuple(tuple(box) for box in boxes)
    obstacle.speed_offset = 0
    if config['speed_offset']:
        obstacle.speed_offset = (config['speed_offset'] if rng.random() > 0.5
                                 else -config['speed_offset'])
    min_gap = js_round(obstacle.width * speed + config['min_gap'] * GAP_COEFFICIENT)
    max_gap = js_round(min_gap * MAX_GAP_COEFFICIENT)
    obstacle.gap = random_num(rng, min_gap, max_gap)
    obstacle.following_created = False
    return obstacle


def box_sep(ax, ay, aw, ah, bx, by, bw, bh):
    """Chebyshev separation of two boxes; < 0 exactly when boxCompare() is true."""
    return max(bx - (ax + aw), ax - (bx + bw), by - (ay + ah), ay - (by + bh))


class Game:
    """One game. step() runs one Runner.update() frame."""

    __slots__ = ('trex_x', 'y', 'jumping', 'ducking', 'speed_drop', 'velocity',
                 'reached_min', 'status_jumping', 'speed', 'running_time',
                 'distance', 'obstacles', 'history', 'crashed', 'frames', 'rng',
                 'spawn')

    def __init__(self, rng, trex_x=50, spawn=True):
        self.rng = rng
        self.spawn = spawn
        self.trex_x = trex_x
        self.y = GROUND_Y
        self.jumping = False
        self.ducking = False
        self.speed_drop = False
        self.velocity = 0.0
        self.reached_min = False
        self.status_jumping = False
        self.speed = START_SPEED
        self.running_time = 0.0
        self.distance = 0.0
        self.obstacles = []
        self.history = []
        self.crashed = False
        self.frames = 0

    def copy(self, spawn=False):
        other = Game.__new__(Game)
        other.rng = None
        other.spawn = spawn
        other.trex_x = self.trex_x
        other.y = self.y
        other.jumping = self.jumping
        other.ducking = self.ducking
        other.speed_drop = self.speed_drop
        other.velocity = self.velocity
        other.reached_min = self.reached_min
        other.status_jumping = self.status_jumping
        other.speed = self.speed
        other.running_time = self.running_time
        other.distance = self.distance
        other.obstacles = [obstacle.copy() for obstacle in self.obstacles]
        other.history = list(self.history)
        other.crashed = self.crashed
        other.frames = self.frames
        return other

    # ---- T-Rex methods (trex.ts) --------------------------------------------
    def start_jump(self):
        if not self.jumping:
            self.status_jumping = True
            self.velocity = INITIAL_JUMP_VELOCITY - self.speed / 10
            self.jumping = True
            self.reached_min = False
            self.speed_drop = False

    def set_speed_drop(self):
        self.speed_drop = True
        self.velocity = 1

    def set_duck(self, ducking):
        if ducking and not self.ducking:
            self.ducking = True
            self.status_jumping = False
        elif not ducking and self.ducking:
            self.ducking = False

    def reset_trex(self):
        self.y = GROUND_Y
        self.velocity = 0.0
        self.jumping = False
        self.ducking = False
        self.status_jumping = False
        self.speed_drop = False

    def update_jump(self, dt):
        frames_elapsed = dt / MS_PER_FRAME
        if self.speed_drop:
            self.y += js_round(self.velocity * SPEED_DROP_COEFFICIENT * frames_elapsed)
        else:
            self.y += js_round(self.velocity * frames_elapsed)
        self.velocity += GRAVITY * frames_elapsed
        if self.y < MIN_JUMP_Y or self.speed_drop:
            self.reached_min = True
        if self.y < MAX_JUMP_HEIGHT or self.speed_drop:
            self.end_jump()
        if self.y > GROUND_Y:
            self.reset_trex()

    # ---- the decision contract (see SPEC.md) --------------------------------
    def end_jump(self):
        if self.reached_min and self.velocity < DROP_VELOCITY:
            self.velocity = DROP_VELOCITY

    def apply(self, action, release_ends_jump=True):
        """Apply one decision as 'this key is held during this frame'.

        jump    = Space held, duck = Down held, nothing = no key held.
        Releasing Space while airborne calls endJump() (short jump) unless
        release_ends_jump is False.
        """
        if action == JUMP:
            if self.ducking or self.speed_drop:
                self.speed_drop = False
                self.set_duck(False)
            if not self.jumping:
                self.start_jump()
        elif action == DUCK:
            if self.jumping:
                if not self.speed_drop:
                    self.set_speed_drop()
            elif not self.ducking:
                self.set_duck(True)
        else:
            if self.jumping and release_ends_jump:
                self.end_jump()
            if self.ducking or self.speed_drop:
                self.speed_drop = False
                self.set_duck(False)

    # ---- horizon.ts ---------------------------------------------------------
    def add_new_obstacle(self):
        rng = self.rng
        while True:
            kind = random_num(rng, 0, len(OBSTACLE_TYPES) - 1)
            duplicate = 0
            for previous in self.history:
                duplicate = duplicate + 1 if previous == kind else 0
            if duplicate >= MAX_OBSTACLE_DUPLICATION or self.speed < OBSTACLE_TYPES[kind]['min_speed']:
                continue
            break
        self.obstacles.append(make_obstacle(rng, kind, self.speed))
        self.history.insert(0, kind)
        del self.history[MAX_OBSTACLE_DUPLICATION:]

    def update_obstacles(self, dt):
        factor = FPS / 1000 * dt
        kept = []
        for obstacle in self.obstacles:
            obstacle.x -= math.floor((self.speed + obstacle.speed_offset) * factor)
            if obstacle.x + obstacle.width > 0:
                kept.append(obstacle)
        self.obstacles = kept
        if not self.spawn:
            return
        if kept:
            last = kept[-1]
            if (not last.following_created and
                    last.x + last.width + last.gap < CANVAS_WIDTH):
                self.add_new_obstacle()
                last.following_created = True
        else:
            self.add_new_obstacle()

    # ---- collision (offline.ts checkForCollision) ---------------------------
    def trex_boxes(self):
        return TREX_BOXES_DUCKING if self.ducking else TREX_BOXES_RUNNING

    def collides(self, obstacle):
        tx = self.trex_x + 1
        ty = self.y + 1
        ox = obstacle.x + 1
        oy = obstacle.y + 1
        if box_sep(tx, ty, TREX_WIDTH - 2, TREX_HEIGHT - 2,
                   ox, oy, obstacle.width - 2, obstacle.height - 2) >= 0:
            return False
        for (bx, by, bw, bh) in self.trex_boxes():
            for (cx, cy, cw, ch) in obstacle.boxes:
                if box_sep(tx + bx, ty + by, bw, bh, ox + cx, oy + cy, cw, ch) < 0:
                    return True
        return False

    def clearance(self, obstacle, cap):
        """Smallest gap in px between T-Rex and obstacle collision boxes, capped."""
        tx = self.trex_x + 1
        ty = self.y + 1
        ox = obstacle.x + 1
        oy = obstacle.y + 1
        outer = box_sep(tx, ty, TREX_WIDTH + 12, TREX_HEIGHT - 2,
                        obstacle.x, obstacle.y, obstacle.width + 2, obstacle.height + 2)
        if outer >= cap:
            return cap
        best = cap
        for (bx, by, bw, bh) in self.trex_boxes():
            for (cx, cy, cw, ch) in obstacle.boxes:
                sep = box_sep(tx + bx, ty + by, bw, bh, ox + cx, oy + cy, cw, ch)
                if sep < best:
                    best = sep
        return best

    # ---- Runner.update() ------------------------------------------------------
    def step(self, dt=MS_PER_FRAME):
        if self.jumping:
            self.update_jump(dt)
        self.running_time += dt
        has_obstacles = self.running_time > CLEAR_TIME
        if has_obstacles:
            self.update_obstacles(dt)
        collision = has_obstacles and self.obstacles and self.collides(self.obstacles[0])
        if collision:
            self.crashed = True
        else:
            self.distance += self.speed * dt / MS_PER_FRAME
            if self.speed < MAX_SPEED:
                self.speed += ACCELERATION
        # Trex.update(): speed drop becomes duck when it reaches the ground.
        if self.speed_drop and self.y == GROUND_Y:
            self.speed_drop = False
            self.set_duck(True)
        self.frames += 1
        return not self.crashed

    def upcoming(self):
        """Obstacles whose right edge is still right of the T-Rex's left edge."""
        return [o for o in self.obstacles if o.x + o.width > self.trex_x]


# ---- model input --------------------------------------------------------------
NUM_FEATURES = 21
FEATURE_NAMES = (
    'trex_y', 'trex_jumping', 'trex_ducking', 'trex_speed_drop', 'speed',
    'o1_present', 'o1_cactus_small', 'o1_cactus_large', 'o1_pterodactyl',
    'o1_dx', 'o1_width', 'o1_height', 'o1_y',
    'o2_present', 'o2_cactus_small', 'o2_cactus_large', 'o2_pterodactyl',
    'o2_dx', 'o2_width', 'o2_height', 'o2_y',
)


def features(game):
    out = [game.y / 150.0,
           1.0 if game.jumping else 0.0,
           1.0 if game.ducking else 0.0,
           1.0 if game.speed_drop else 0.0,
           game.speed / 13.0]
    upcoming = game.upcoming()
    for slot in range(2):
        if slot < len(upcoming):
            obstacle = upcoming[slot]
            onehot = [0.0, 0.0, 0.0]
            onehot[obstacle.kind] = 1.0
            out += [1.0] + onehot + [(obstacle.x - game.trex_x) / 600.0,
                                     obstacle.width / 100.0,
                                     obstacle.height / 50.0,
                                     obstacle.y / 150.0]
        else:
            out += [0.0] * 8
    return out


def frame_dt(rng, hz=60):
    """A realistic requestAnimationFrame delta: jitter plus rare dropped frames."""
    base = 1000.0 / hz
    dt = base + rng.gauss(0.0, 0.25)
    if rng.random() < 0.005:
        dt += base
    return max(dt, base * 0.5)

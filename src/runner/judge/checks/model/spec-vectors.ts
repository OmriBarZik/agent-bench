import type { ApiObstacle, ApiState, SpecVector } from "./model-check.types";

/** Where the bench puts the T-Rex; SPEC.md's distances are relative to it, so any x works. */
const TREX_X = 50;
const OBSTACLE_TYPES = ["cactusSmall", "cactusLarge", "pterodactyl"];
const ROW = /^\|\s*([^|]+?)\s*\|\s*`(\[[^`]+\])`\s*\|\s*`(\[[^`]+\])`/;

/** The test vectors of a SPEC.md table: `| label | \`[inputs]\` | \`[expected]\` ... |`. */
export function parseSpecVectors(specText: string): SpecVector[] {
  const vectors: SpecVector[] = [];

  for (const line of specText.split("\n")) {
    const match = ROW.exec(line);

    if (!match?.[1] || !match[2] || !match[3]) {
      continue;
    }

    const features = JSON.parse(match[2]) as number[];
    const expected = JSON.parse(match[3]) as number[];

    if (features.length === 21 && expected.length === 3) {
      vectors.push({ label: match[1], features, expected });
    }
  }

  return vectors;
}

/** The JS API state whose SPEC features are exactly `features` (the inverse of SPEC.md's feature table). */
export function vectorState(features: number[]): ApiState {
  const feature = (index: number) => features[index] ?? 0;
  const obstacles = [5, 13].flatMap((base) => (feature(base) === 1 ? [slotObstacle({ features, base })] : []));

  return {
    trex: {
      xPos: TREX_X,
      yPos: feature(0) * 150,
      jumping: feature(1) === 1,
      ducking: feature(2) === 1,
      speedDrop: feature(3) === 1,
    },
    currentSpeed: feature(4) * 13,
    obstacles,
  };
}

function slotObstacle({ features, base }: { features: number[]; base: number }): ApiObstacle {
  const feature = (offset: number) => features[base + offset] ?? 0;
  const typeIndex = [1, 2, 3].findIndex((offset) => feature(offset) === 1);

  return {
    type: OBSTACLE_TYPES[typeIndex] ?? "unknown",
    xPos: TREX_X + feature(4) * 600,
    width: feature(5) * 100,
    height: feature(6) * 50,
    yPos: feature(7) * 150,
  };
}

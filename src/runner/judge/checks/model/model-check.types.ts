import type { BenchCheckStatus } from "../bench-checks.types";

/** One SPEC.md test vector: the model input and the probabilities the supplied model returns for it. */
export type SpecVector = {
  label: string;
  features: number[];
  /** `[jump, duck, nothing]`, rounded to 4 decimals in SPEC.md. */
  expected: number[];
};

/** The T-Rex part of the state the JS API takes. */
export type ApiTrex = {
  xPos: number;
  yPos: number;
  jumping: boolean;
  ducking: boolean;
  speedDrop: boolean;
};

/** One obstacle in the state the JS API takes, in `horizon.obstacles` order. */
export type ApiObstacle = {
  type: string;
  xPos: number;
  width: number;
  height: number;
  yPos: number;
};

/** The dictionary `DinoDecisionModel.decide()` takes, as the task prompt fixes it. */
export type ApiState = {
  trex: ApiTrex;
  currentSpeed: number;
  obstacles: ApiObstacle[];
};

/** What `decide()` returned for one vector, or why it could not be read. */
export type ApiAnswer = {
  jump?: number;
  duck?: number;
  nothing?: number;
  decision?: string;
  error?: string;
};

/** The outcome of comparing the API's answers with SPEC.md. */
export type ModelVerdict = {
  status: BenchCheckStatus;
  detail: string;
};

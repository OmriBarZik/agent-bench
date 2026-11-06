/** The alternate screen the runner uses while an agent build's log is streaming. */
export type LogTerminal = {
  show: () => void;
  hide: () => void;
  /** Draws `frame` when it differs from the last paint. */
  paint: (frame: string) => void;
};

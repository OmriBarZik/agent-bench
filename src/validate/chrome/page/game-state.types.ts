/** Work done with the game's Runner while it is still resolved: its remote object id, or null when not found. */
export type GameRunnerUse<Result> = (runnerId: string | null) => Promise<Result>;

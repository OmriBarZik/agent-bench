/** The result of one readiness check before a matrix run. */
export type GuardCheck = {
  ok: boolean;
  /** Why it failed, or what it saw when it passed. */
  detail: string;
};

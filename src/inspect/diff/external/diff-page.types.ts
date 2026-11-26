/** What the browser diff page shows: a heading, the commit range under it, and the run's patch. */
export type DiffPageInput = {
  title: string;
  subtitle: string;
  patch: string;
};

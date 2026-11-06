/** A half-open range in the `.gclient` text. */
export type SourceSpan = {
  start: number;
  end: number;
};

/** Opening bracket the `.gclient` scanner matches. */
export type OpenBracket = "{" | "[";

/** Closing bracket that matches an `OpenBracket`. */
export type CloseBracket = "}" | "]";

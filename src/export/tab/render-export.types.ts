import type { ExportForm, ExportOption } from "./export-form.types";

/** What the Export tab draws: the rows, the picks, the match count, and the last notice. */
export type ExportView = {
  options: ExportOption[];
  form: ExportForm;
  selected: number;
  scroll: number;
  matching: number;
  total: number;
  notice: string;
};

/** One drawn frame and the scroll it settled on. */
export type ExportFrame = {
  body: string;
  scroll: number;
};

/** One line of the option list: a section heading, or the option at `optionIndex`. */
export type ExportListLine = {
  heading: string | null;
  optionIndex: number | null;
};

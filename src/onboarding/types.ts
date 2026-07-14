// §05 — the draft state collected across onboarding's seven screens
// before anything is written to the database. Nothing here is
// optional except provider/apiKey/partnerName — the cue sentence and
// the two books cannot be skipped (§05 sequencing rules).
export interface OnboardingDraft {
  anchor: string;
  anchorValidated: boolean;
  place: string;
  nudgeHour: number | null; // null = "No nudge at all"
  provider: 'niv' | 'esv' | null;
  apiKey: string;
  book: string | null;
  nextBook: string | null;
  partnerName: string;
}

export const EMPTY_DRAFT: OnboardingDraft = {
  anchor: '',
  anchorValidated: false,
  place: '',
  nudgeHour: null,
  provider: null,
  apiKey: '',
  book: null,
  nextBook: null,
  partnerName: '',
};

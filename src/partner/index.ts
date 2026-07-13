// §13.3 — the smallest module in the app, deliberately. It has no
// network calls, no sync, and no way to reach the partner — only to
// reach the OS share sheet. It cannot, by construction, leak state.
//
// FORBIDDEN, and enforced by the absence of any method to do it:
//   notifyPartner() · getPartnerState() · sharePartnerStreak()
// There is no code path from a lapse to another person's phone.
// The import-boundary test asserts this module never imports
// networking, notifications, or /src/lab.

export interface PartnerRef {
  name: string; // display only
  contactRef: string; // OS contact URI. NOT a phone number we store.
  convoAnchor: string; // "after Sunday coffee" — a second cue (§20)
  convoDay: number; // 0–6, for the weekly conversation nudge
}

export interface Partner {
  get(): Promise<PartnerRef | null>;
  set(p: PartnerRef): Promise<void>;
  clear(): Promise<void>;

  /**
   * Opens the OS messages app with an EMPTY body. Never prefilled —
   * "my app told me to text you" is a grim thing to send.
   * Logs handoff_tapped, then forgets: nothing after it is recorded.
   */
  openConversation(): Promise<void>;

  /** Share ONE line of content (§20). Never compliance. */
  shareReflection(text: string): Promise<void>;
}

// Implementation lands in W11b, after the lapse ladder exists.

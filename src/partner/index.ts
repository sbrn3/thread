// §13.3 — the smallest module in the app, deliberately. It has no
// network calls, no sync, and no way to reach the partner — only to
// reach the OS share sheet and the OS messages app, both purely local
// intents. It cannot, by construction, leak state.
//
// FORBIDDEN, and enforced by the absence of any method to do it:
//   notifyPartner() · getPartnerState() · sharePartnerStreak()
// There is no code path from a lapse to another person's phone. The
// import-boundary test (test/boundaries.test.ts) asserts this module
// never imports networking, notifications, /src/lab, or /src/notify.
import type { SqlDb } from '../log/db';
import type { Log } from '../log/log';

export interface PartnerRef {
  name: string; // display only
  contactRef: string; // OS contact URI/number. NOT synced anywhere.
  convoAnchor: string; // "after Sunday coffee" — a second cue (§20)
  convoDay: number; // 0–6, for the weekly conversation nudge
}

export interface Partner {
  get(): Promise<PartnerRef | null>;
  set(p: PartnerRef): Promise<void>;
  clear(): Promise<void>;

  /**
   * Opens the OS messages app with an EMPTY body. Never prefilled —
   * "my app told me to text you" is a grim thing to send. Logs
   * handoff_tapped, then forgets: nothing after it is recorded.
   */
  openConversation(): Promise<void>;

  /** Share ONE line of content (§20). Never compliance. */
  shareReflection(text: string): Promise<void>;
}

// Injectable surface over React Native's Linking/Share — same seam
// pattern as NotificationsLike/CryptoLike/BackupIO, so this class is
// unit-testable under vitest without loading react-native. The real
// adapter lives in nativeIo.ts.
export interface PartnerIO {
  openURL(url: string): Promise<void>;
  share(message: string): Promise<void>;
}

/**
 * §12 "the hand-off" — the app never contacts the partner and never
 * learns whether the conversation happened. `openConversation` opens
 * an empty compose screen and stops; `shareReflection` hands the OS
 * share sheet one string and stops. Neither call reports anything
 * back about what happened next.
 */
export class PartnerService implements Partner {
  constructor(
    private readonly db: SqlDb,
    private readonly log: Log,
    private readonly io: PartnerIO,
  ) {}

  async get(): Promise<PartnerRef | null> {
    const row = this.db.get<{ name: string; contact_ref: string; convo_anchor: string; convo_day: number }>(
      'SELECT name, contact_ref, convo_anchor, convo_day FROM partner WHERE id = 1',
    );
    return row
      ? { name: row.name, contactRef: row.contact_ref, convoAnchor: row.convo_anchor, convoDay: row.convo_day }
      : null;
  }

  async set(p: PartnerRef): Promise<void> {
    this.db.run(
      `INSERT INTO partner (id, name, contact_ref, convo_anchor, convo_day) VALUES (1, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name, contact_ref = excluded.contact_ref,
         convo_anchor = excluded.convo_anchor, convo_day = excluded.convo_day`,
      [p.name, p.contactRef, p.convoAnchor, p.convoDay],
    );
  }

  async clear(): Promise<void> {
    this.db.run('DELETE FROM partner WHERE id = 1');
  }

  async openConversation(): Promise<void> {
    const partner = await this.get();
    if (!partner) return;
    // Not percent-encoded: some Android SMS handlers don't decode
    // %2B back into `+` for this scheme, so a plain leading + and
    // digits (stripping whatever formatting the free-text contact
    // field was entered with — spaces, dashes, parens) is safer than
    // a technically-correct but less broadly-compatible encoding.
    const number = partner.contactRef.trim().replace(/[^\d+]/g, '');
    await this.io.openURL(`sms:${number}`);
    this.log.write({ type: 'handoff_tapped' });
  }

  async shareReflection(text: string): Promise<void> {
    await this.io.share(text);
  }
}

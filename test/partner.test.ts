import { describe, expect, it } from 'vitest';
import { Log } from '../src/log/log';
import { migrate } from '../src/log/schema';
import type { PartnerIO } from '../src/partner';
import { PartnerService } from '../src/partner';
import { openTestDb } from './util/testDb';

function fakeIo(): PartnerIO & { openedUrls: string[]; shared: string[] } {
  const openedUrls: string[] = [];
  const shared: string[] = [];
  return {
    openedUrls,
    shared,
    async openURL(url) {
      openedUrls.push(url);
    },
    async share(message) {
      shared.push(message);
    },
  };
}

function setup() {
  const db = openTestDb();
  migrate(db);
  const log = new Log({ db, buildSha: 'test-sha' });
  const io = fakeIo();
  return { db, log, io, partner: new PartnerService(db, log, io) };
}

describe('PartnerService (§12 — the hand-off, local-only)', () => {
  it('get() is null before set()', async () => {
    const { partner } = setup();
    expect(await partner.get()).toBeNull();
  });

  it('set()/get() round-trips a single dyad', async () => {
    const { partner } = setup();
    await partner.set({ name: 'Sam', contactRef: '+15551234567', convoAnchor: 'after church', convoDay: 0 });
    expect(await partner.get()).toEqual({
      name: 'Sam',
      contactRef: '+15551234567',
      convoAnchor: 'after church',
      convoDay: 0,
    });
  });

  it('set() overwrites the single row rather than creating a second one', async () => {
    const { db, partner } = setup();
    await partner.set({ name: 'Sam', contactRef: 'a', convoAnchor: 'x', convoDay: 0 });
    await partner.set({ name: 'Alex', contactRef: 'b', convoAnchor: 'y', convoDay: 1 });
    expect(db.all('SELECT * FROM partner')).toHaveLength(1);
    expect((await partner.get())?.name).toBe('Alex');
  });

  it('clear() removes the dyad', async () => {
    const { partner } = setup();
    await partner.set({ name: 'Sam', contactRef: 'a', convoAnchor: 'x', convoDay: 0 });
    await partner.clear();
    expect(await partner.get()).toBeNull();
  });

  it('openConversation() opens an sms: URL with no message body, and logs handoff_tapped only', async () => {
    const { db, io, partner } = setup();
    await partner.set({ name: 'Sam', contactRef: '+15551234567', convoAnchor: 'x', convoDay: 0 });

    await partner.openConversation();

    expect(io.openedUrls).toHaveLength(1);
    expect(io.openedUrls[0]).toBe('sms:+15551234567'); // a literal +, not percent-encoded — see index.ts
    expect(io.openedUrls[0]).not.toMatch(/body=|\?/); // no prefilled body — nothing to encode as a message param
    expect(db.all("SELECT type FROM events")).toEqual([{ type: 'handoff_tapped' }]);
  });

  it('openConversation() strips formatting characters from a free-text contact entry', async () => {
    const { io, partner } = setup();
    await partner.set({ name: 'Sam', contactRef: '+1 (555) 123-4567', convoAnchor: 'x', convoDay: 0 });

    await partner.openConversation();

    expect(io.openedUrls[0]).toBe('sms:+15551234567');
  });

  it('openConversation() does nothing when no partner is set', async () => {
    const { db, io, partner } = setup();
    await partner.openConversation();
    expect(io.openedUrls).toHaveLength(0);
    expect(db.all('SELECT * FROM events')).toHaveLength(0);
  });

  it('shareReflection() hands the io the content only', async () => {
    const { io, partner } = setup();
    await partner.shareReflection('Psalm 23 stuck with me today.');
    expect(io.shared).toEqual(['Psalm 23 stuck with me today.']);
  });
});

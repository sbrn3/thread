import { useState } from 'react';
import { meta } from '../log/log';
import { logicalToday } from '../log/time';
import type { Services } from '../services';
import { AnchorScreen } from './screens/AnchorScreen';
import { BooksScreen } from './screens/BooksScreen';
import { DoneScreen } from './screens/DoneScreen';
import { NetScreen } from './screens/NetScreen';
import { PlaceScreen } from './screens/PlaceScreen';
import { PremiseScreen } from './screens/PremiseScreen';
import { SafekeepingScreen } from './screens/SafekeepingScreen';
import { TranslationScreen } from './screens/TranslationScreen';
import { EMPTY_DRAFT, type OnboardingDraft } from './types';

interface OnboardingFlowProps {
  services: Services;
  onDone: () => void;
}

type Step = 'premise' | 'anchor' | 'place' | 'net' | 'translation' | 'books' | 'safekeeping' | 'done';

/**
 * §05 — seven screens, ~100 seconds. Asks only what the app cannot
 * decide or discover. Nothing is written to the database until the
 * final step, except the notification-permission request (which is
 * itself the very last user action).
 */
export function OnboardingFlow({ services, onDone }: OnboardingFlowProps) {
  const [step, setStep] = useState<Step>('premise');
  const [draft, setDraft] = useState<OnboardingDraft>(EMPTY_DRAFT);

  const finish = (partnerName: string, requestNotifications: boolean) => {
    const { db, log, cue, notifier } = services;
    const today = logicalToday();
    const final: OnboardingDraft = { ...draft, partnerName };

    cue.set(
      { anchor: final.anchor, place: final.place, nudgeHour: final.nudgeHour, validated: final.anchorValidated },
      { firstSet: true },
    );

    if (final.provider && final.apiKey) {
      meta.set(db, 'text_provider', final.provider);
      meta.set(db, 'text_provider_key', final.apiKey);
    }

    if (final.book) {
      meta.set(db, 'current_book', final.book);
      meta.set(db, 'current_chapter', '1');
      meta.set(db, 'current_sitting', '0');
      meta.set(db, 'book_started_local_date', today);
      log.write({ type: 'book_start', book: final.book, chapter: 1 });
    }
    if (final.nextBook) meta.set(db, 'next_book', final.nextBook);

    if (final.partnerName) {
      db.run(
        'INSERT INTO partner (id, name) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name',
        [final.partnerName],
      );
    }

    // reconcile() no-ops forever without this — nothing has happened
    // yet, so today is the correct starting point; the first day it
    // will ever walk is tomorrow's app open (§13.4).
    meta.set(db, 'watermark', today);
    meta.set(db, 'onboarded', '1');
    setDraft(final);
    setStep('done');

    // Fire-and-forget: permission is asked last, after the sentence is
    // written, so a cold reflexive denial doesn't happen before the
    // user has a reason to say yes (§05). Doesn't block finishing.
    if (requestNotifications) void notifier.permission();
  };

  switch (step) {
    case 'premise':
      return <PremiseScreen onNext={() => setStep('anchor')} />;

    case 'anchor':
      return (
        <AnchorScreen
          anchor={draft.anchor}
          onNext={(anchor, anchorValidated) => {
            setDraft((d) => ({ ...d, anchor, anchorValidated }));
            setStep('place');
          }}
        />
      );

    case 'place':
      return (
        <PlaceScreen
          place={draft.place}
          onNext={(place) => {
            setDraft((d) => ({ ...d, place }));
            setStep('net');
          }}
        />
      );

    case 'net':
      return (
        <NetScreen
          anchor={draft.anchor}
          place={draft.place}
          onNext={(nudgeHour) => {
            setDraft((d) => ({ ...d, nudgeHour }));
            setStep('translation');
          }}
        />
      );

    case 'translation':
      return (
        <TranslationScreen
          onNext={(provider, apiKey) => {
            setDraft((d) => ({ ...d, provider, apiKey }));
            setStep('books');
          }}
        />
      );

    case 'books':
      return (
        <BooksScreen
          onNext={(book, nextBook) => {
            setDraft((d) => ({ ...d, book, nextBook }));
            setStep('safekeeping');
          }}
        />
      );

    case 'safekeeping':
      return <SafekeepingScreen onNext={finish} />;

    case 'done':
      return <DoneScreen draft={draft} onFinish={onDone} />;
  }
}

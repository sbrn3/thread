import { OnboardingScreen } from '../OnboardingScreen';

interface PremiseScreenProps {
  onNext: () => void;
}

export function PremiseScreen({ onNext }: PremiseScreenProps) {
  return (
    <OnboardingScreen
      step="Thread"
      title="Reading fails at the cue, not at willpower."
      sub={
        'This app has one job: to be there when your cue fires.\n\n' +
        'It will ask you five questions, then get out of the way. It has no feed, ' +
        'no streak to protect, and it will tell you when to close it.'
      }
      primaryLabel="Begin"
      onPrimary={onNext}
    />
  );
}

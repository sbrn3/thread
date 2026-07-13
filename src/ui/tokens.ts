// Design tokens — §04 of the plan. One accent colour, two voices,
// no gradients, no shadows beyond a hairline.
export const tokens = {
  color: {
    paper: '#FBFAF7', // base surface
    ink: '#16161A', // text, seal core
    thread: '#1F3FFF', // the only accent: progress, cue, sealed state
    ink60: '#5E5D66',
    ink40: '#9C9BA3', // secondary text
    ink15: '#E6E5E1', // rules and gaps
  },
  font: {
    display: 'Schibsted Grotesk', // the app's voice (400–900)
    scripture: 'Newsreader', // the text's voice — a different register
    mono: 'JetBrains Mono', // data, timestamps, reports
  },
  seal: {
    holdMs: 1200, // ~1.2s hold — E1 arm B replaces this with a tap
    maxDriftPx: 20, // below this the hold cancels constantly (§05 risk)
  },
} as const;

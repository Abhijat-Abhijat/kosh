// eslint-disable-next-line @typescript-eslint/no-require-imports
const tokens = require('./tokens.js') as {
  colors: Record<
    | 'backdrop' | 'paper' | 'sage' | 'deep' | 'forest' | 'ink' | 'mute' | 'faint' | 'line'
    | 'onDark' | 'alert' | 'alertInk' | 'goal' | 'gain' | 'loss',
    string
  >;
};

export const colors = tokens.colors;

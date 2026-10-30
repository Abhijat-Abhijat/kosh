// Single source of truth for the design palette. Shared by tailwind.config.js and TS code.
const colors = {
  backdrop: '#9fa391', // outer background behind cards
  paper: '#c3c6b0', // primary light surface
  sage: '#65705f', // mid band
  deep: '#4a5244', // dark band
  forest: '#3d4438', // darkest band / icon tiles
  ink: '#1f231c', // primary text
  mute: '#7d826f', // secondary headline text ("Hello," style)
  faint: '#a5a994', // tertiary text on paper
  line: 'rgba(31,35,28,0.35)', // hairlines on paper
  onDark: '#c3c6b0', // text on sage/deep bands
  alert: '#e0714c', // orange: overruns, dues, waste
  alertInk: '#fff3ec',
  goal: '#dfc655', // yellow: savings / goals
  gain: '#b9d39a',
  loss: '#e0714c',
};

const fonts = {
  display: 'FamiljenGrotesk_400Regular',
  displayMedium: 'FamiljenGrotesk_500Medium',
  displaySemiBold: 'FamiljenGrotesk_600SemiBold',
  displayBold: 'FamiljenGrotesk_700Bold',
  num: 'ChakraPetch_400Regular',
  numMedium: 'ChakraPetch_500Medium',
  numSemiBold: 'ChakraPetch_600SemiBold',
};

module.exports = { colors, fonts };

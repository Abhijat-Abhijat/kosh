const { colors, fonts } = require('./src/theme/tokens.js');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  // Light-only app; 'class' stops NativeWind on web from fighting the media query.
  darkMode: 'class',
  theme: {
    extend: {
      colors,
      fontFamily: {
        display: [fonts.display],
        'display-medium': [fonts.displayMedium],
        'display-semibold': [fonts.displaySemiBold],
        'display-bold': [fonts.displayBold],
        num: [fonts.num],
        'num-medium': [fonts.numMedium],
        'num-semibold': [fonts.numSemiBold],
      },
    },
  },
  plugins: [],
};

/**
 * Reanimated's own jest mock, plus the `default` members the design system also imports by name
 * (`createAnimatedComponent`), which the mock keeps only on `Animated`.
 */
const reanimated = require('react-native-reanimated/mock');

module.exports = { ...reanimated, ...reanimated.default, default: reanimated.default };

// NOTE: runs before every test file. `react-native-pulsar` looks its TurboModule up on import,
// which jest has no binary for, so every preset becomes a no-op; the `Haptics` fake is what a test
// asserts on.
jest.mock('react-native-pulsar', () => {
  const noop = () => undefined;
  const presets: Record<string, unknown> = new Proxy({}, { get: (_, key) => (key === 'System' ? presets : noop) });
  return { Presets: presets };
});

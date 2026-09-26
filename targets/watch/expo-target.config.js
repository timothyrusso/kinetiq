/**
 * The Apple Watch app (issue #27). Native SwiftUI, generated into the Xcode project by
 * `@bacons/apple-targets` on every `npm run prebuild`; nothing under `ios/` is edited by hand.
 *
 * Every file in this folder is a member of the watch target (Xcode synchronised group), which
 * is why the Swift package and its tests live beside it in `targets/` rather than inside it.
 *
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = (config) => ({
  type: 'watch',
  name: 'KinetiqWatch',
  displayName: 'Kinetiq',
  bundleIdentifier: `${config.ios.bundleIdentifier}.watchkitapp`,
  deploymentTarget: '10.0',
  // The free personal team the personal build signs with. Carried here so prebuild no longer
  // resets signing on the watch target.
  appleTeamId: config.ios.appleTeamId,
  icon: '../../assets/icon.png',
  colors: {
    $accent: '#C6F24E',
  },
});

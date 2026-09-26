import ExpoModulesCore

/// Activates the watch session as the app launches, before JS (Stability rule 7 in issue #27).
public class WatchBridgeAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    WatchSessionManager.shared.activate()
    return true
  }
}

import Foundation
import UserNotifications
import WatchKit

/// The rest timer's signals when the wrist is down or the app is gone (Stability rule 6 in #27).
///
/// Baseline: a local notification scheduled at the rest's absolute end, which watchOS delivers
/// with a haptic whether the app is running or not. On top of it, a `WKExtendedRuntimeSession`
/// (physical therapy, background mode only, no HealthKit, one hour at most) keeps the app
/// running with the wrist down so the screen is current when it is raised. Either can fail or be
/// refused; neither is needed for correctness, because the timer is an absolute deadline on disk.
@MainActor
final class RestAlerts: NSObject, UNUserNotificationCenterDelegate, WKExtendedRuntimeSessionDelegate {
    private static let restNotification = "kinetiq.rest"
    private let center = UNUserNotificationCenter.current()
    private var runtime: WKExtendedRuntimeSession?

    override init() {
        super.init()
        center.delegate = self
    }

    func workoutStarted(_ workout: Workout) {
        center.requestAuthorization(options: [.alert, .sound]) { _, _ in }
        startRuntime()
        restChanged(workout)
    }

    func workoutResumed(_ workout: Workout) {
        startRuntime()
        restChanged(workout)
    }

    func workoutEnded() {
        center.removePendingNotificationRequests(withIdentifiers: [Self.restNotification])
        runtime?.invalidate()
        runtime = nil
    }

    func setCompleted() {
        WKInterfaceDevice.current().play(.click)
    }

    func restEndedInApp() {
        WKInterfaceDevice.current().play(.success)
    }

    /// Schedules the notification for the current rest, or withdraws it when none is running.
    func restChanged(_ workout: Workout) {
        center.removePendingNotificationRequests(withIdentifiers: [Self.restNotification])
        guard let end = workout.restEndsAt else { return }
        let seconds = end.timeIntervalSinceNow
        guard seconds > 0.5 else { return }
        let content = UNMutableNotificationContent()
        content.title = String(localized: "rest.notification.title")
        let entry = workout.entries[safe: workout.currentEntry]
        content.body = entry.map { String(localized: "rest.notification.body \($0.exerciseName)") } ?? ""
        content.sound = .default
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: seconds, repeats: false)
        center.add(UNNotificationRequest(identifier: Self.restNotification, content: content, trigger: trigger))
    }

    // MARK: Extended runtime

    private func startRuntime() {
        guard runtime == nil else { return }
        let session = WKExtendedRuntimeSession()
        session.delegate = self
        runtime = session
        session.start()
    }

    nonisolated func extendedRuntimeSessionDidStart(_ extendedRuntimeSession: WKExtendedRuntimeSession) {}

    nonisolated func extendedRuntimeSessionWillExpire(_ extendedRuntimeSession: WKExtendedRuntimeSession) {}

    nonisolated func extendedRuntimeSession(
        _ extendedRuntimeSession: WKExtendedRuntimeSession,
        didInvalidateWith reason: WKExtendedRuntimeSessionInvalidationReason,
        error: Error?
    ) {
        Task { @MainActor in
            if self.runtime === extendedRuntimeSession { self.runtime = nil }
        }
    }

    // MARK: UNUserNotificationCenterDelegate

    /// On screen, the rest view plays the haptic itself; the banner would be a second buzz.
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([])
    }
}

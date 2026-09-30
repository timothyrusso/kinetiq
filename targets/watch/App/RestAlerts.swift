import Foundation
import UserNotifications
import WatchKit

/// The rest timer's signals when the wrist is down or the app is gone (Stability rule 6 in #27).
///
/// Baseline: a local notification scheduled just after the rest's absolute end, which watchOS
/// delivers with a haptic whether the app is running or not. On top of it, a
/// `WKExtendedRuntimeSession` (physical therapy, background mode only, no HealthKit, one hour at
/// most) keeps the app running with the wrist down, and a timer in the app plays `.stop` at the
/// end itself (issue #132). Either can fail or be refused; neither is needed for correctness,
/// because the timer is an absolute deadline on disk.
///
/// Exactly one buzz per rest: the notification is due `notificationDelay` after the end, so a
/// process that is running at the end plays the haptic and withdraws the notification before it
/// is due. One that wakes too late for that leaves the haptic to the notification, which buzzed
/// already or is about to. A notification that reaches the app on screen is not presented, and
/// the app plays the haptic instead if it has not yet.
@MainActor
final class RestAlerts: NSObject, UNUserNotificationCenterDelegate, WKExtendedRuntimeSessionDelegate {
    private nonisolated static let restNotification = "kinetiq.rest"
    /// How long after the rest's end the notification is due.
    private static let notificationDelay: TimeInterval = 2
    /// How much of that delay the withdrawal needs to land before the notification is delivered.
    private static let withdrawalMargin: TimeInterval = 0.5
    private let center = UNUserNotificationCenter.current()
    private var runtime: WKExtendedRuntimeSession?
    /// The rest end the timer is set for.
    private var scheduledEnd: Date?
    /// The rest end the pending notification belongs to.
    private var notificationEnd: Date?
    /// The rest end whose haptic has played, so no path plays it a second time.
    private var signalledEnd: Date?
    private var timer: Task<Void, Never>?

    /// Called when the timer reaches the rest's end, to end the rest (`WorkoutSession.restEnded`).
    var onRestDeadline: (() -> Void)?

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
        cancelSchedule()
        withdrawNotification()
        runtime?.invalidate()
        runtime = nil
    }

    /// The finished workout is safely in the outbox.
    func workoutFinished() {
        WKInterfaceDevice.current().play(.success)
        workoutEnded()
    }

    func setCompleted() {
        WKInterfaceDevice.current().play(.start)
    }

    /// The rest that ends at `end` is over, found by the timer or by the rest view. Plays `.stop`
    /// unless the notification has buzzed or will buzz instead.
    func restEnded(_ end: Date) {
        guard signalledEnd != end else { return }
        guard Date() < end.addingTimeInterval(Self.notificationDelay - Self.withdrawalMargin) else { return }
        signalledEnd = end
        withdrawNotification()
        WKInterfaceDevice.current().play(.stop)
    }

    /// Schedules the notification and the timer for the current rest, or withdraws them when none
    /// is running. An edit that leaves the rest's end alone (weight, reps, RPE) changes nothing.
    func restChanged(_ workout: Workout) {
        guard workout.restEndsAt != scheduledEnd else { return }
        cancelSchedule()
        // A rest that ended with its haptic left to the notification keeps it; any other goes.
        if let end = notificationEnd, end > Date() || signalledEnd == end {
            withdrawNotification()
        }
        guard let end = workout.restEndsAt else { return }
        let seconds = end.timeIntervalSinceNow
        guard seconds > 0.5 else { return }
        scheduledEnd = end
        let content = UNMutableNotificationContent()
        content.title = String(localized: "rest.notification.title")
        let entry = workout.entries[safe: workout.currentEntry]
        content.body = entry.map { String(localized: "rest.notification.body \($0.exerciseName)") } ?? ""
        content.sound = .default
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: seconds + Self.notificationDelay, repeats: false)
        center.add(UNNotificationRequest(identifier: Self.restNotification, content: content, trigger: trigger))
        notificationEnd = end
        timer = Task { [weak self] in
            try? await Task.sleep(for: .seconds(seconds))
            guard !Task.isCancelled else { return }
            self?.onRestDeadline?()
        }
    }

    private func cancelSchedule() {
        timer?.cancel()
        timer = nil
        scheduledEnd = nil
    }

    private func withdrawNotification() {
        center.removePendingNotificationRequests(withIdentifiers: [Self.restNotification])
        notificationEnd = nil
    }

    /// A rest notification that reached the app instead of the screen: its haptic is the app's.
    /// With neither end known, it was scheduled by a process that is gone (a relaunch just after
    /// the rest ended), and nothing in this one has played for it.
    private func notificationArrivedInApp() {
        if let end = notificationEnd {
            guard signalledEnd != end else { return }
            signalledEnd = end
            notificationEnd = nil
        } else if signalledEnd != nil {
            return
        }
        WKInterfaceDevice.current().play(.stop)
        onRestDeadline?()
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

    /// The app plays the haptic itself; the banner would be a second buzz.
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        let isRest = notification.request.identifier == Self.restNotification
        completionHandler([])
        guard isRest else { return }
        Task { @MainActor in self.notificationArrivedInApp() }
    }
}

import Foundation
import SwiftUI

/// The workout in progress, and the only writer of `workout.json`.
///
/// Every edit goes through `update`, which writes the whole workout to disk before the view
/// redraws (Stability rule 1 in issue #27): a kill at any moment relaunches on the same exercise
/// and set with every edit kept.
@MainActor
final class WorkoutSession: ObservableObject {
    @Published private(set) var workout: Workout?
    /// False while the user has stepped back to the routine list with the workout still open.
    @Published private(set) var isShowing = true
    /// A one-line outcome for the routine list: saved, discarded, or a file that could not be read.
    @Published var message: LocalizedStringKey?

    private let store: WorkoutStore
    private let outbox: Outbox
    private let alerts: RestAlerts
    let bounds: Bounds

    init(
        files: FileStore = .appSupport(),
        bounds: Bounds = PhoneConnection.shared.bounds,
        alerts: RestAlerts? = nil
    ) {
        store = WorkoutStore(files: files)
        outbox = Outbox(files: files)
        self.bounds = bounds
        self.alerts = alerts ?? RestAlerts()
        switch store.load() {
        case .none:
            workout = nil
        case .discarded:
            workout = nil
            message = "workout.unreadable"
        case .workout(var resumed):
            // A rest that ended while the app was gone is over.
            if resumed.restRemaining(now: Date()) == 0 { resumed.clearRest() }
            workout = resumed
            store.save(resumed)
            self.alerts.workoutResumed(resumed)
        }
        self.alerts.onRestDeadline = { [weak self] in self?.restEnded() }
    }

    func start(_ routine: Routine, unitSystem: UnitSystem) {
        guard workout == nil else { return }
        let started = Workout.start(routine: routine, unitSystem: unitSystem, id: UUID().uuidString, now: Date())
        guard store.save(started) else {
            message = "workout.startFailed"
            return
        }
        message = nil
        workout = started
        isShowing = true
        alerts.workoutStarted(started)
    }

    func minimize() {
        isShowing = false
    }

    func resume() {
        guard workout != nil else { return }
        isShowing = true
    }

    func update(_ change: (inout Workout) -> Void) {
        guard var next = workout else { return }
        change(&next)
        guard let current = workout, next != current else { return }
        store.save(next)
        workout = next
        alerts.restChanged(next)
        // Complete set and a ticked checkbox both land here.
        if next.completedSets > current.completedSets { alerts.setCompleted() }
    }

    /// Complete set on the exercise page: the selected set, not necessarily the next open one.
    func completeSet(_ set: Int, in entry: Int) {
        update { $0.completeSet(set, in: entry, now: Date()) }
    }

    /// The rest reached zero, seen by the rest view on screen or by the rest timer with the wrist
    /// down. `RestAlerts` plays the haptic unless the notification has it.
    func restEnded() {
        guard let current = workout, let end = current.restEndsAt, current.restRemaining(now: Date()) == 0 else {
            return
        }
        alerts.restEnded(end)
        update { $0.clearRest() }
    }

    /// Writes the finished workout to the outbox first; the workout file is removed only once
    /// that write has landed, so a failure leaves the workout open rather than lost.
    func finish() {
        guard let current = workout else { return }
        guard outbox.add(current.document(endedAt: Date())) else {
            message = "workout.saveFailed"
            return
        }
        store.remove()
        workout = nil
        isShowing = true
        message = "workout.finished"
        alerts.workoutFinished()
        onFinished?()
    }

    /// Deletes the local file and sends nothing.
    func discard() {
        store.remove()
        workout = nil
        isShowing = true
        message = "workout.discarded"
        alerts.workoutEnded()
    }

    /// Set by the app to hand finished workouts to the phone.
    var onFinished: (() -> Void)?
}

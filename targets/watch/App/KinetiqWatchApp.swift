import SwiftUI

/// The watch app's entry point.
///
/// Stability first (issue #27): nothing here may crash, and nothing the user did may be lost if
/// watchOS kills the app. The pure logic lives in `Core/` and `Storage/` so it can be unit
/// tested with `swift test` from the command line; this folder only draws it.
@main
struct KinetiqWatchApp: App {
    @StateObject private var routines: RoutineStore
    @StateObject private var session: WorkoutSession

    init() {
        // Before any view: a snapshot the phone sent while the app was closed is delivered as
        // soon as the session activates.
        PhoneConnection.shared.activate()
        _routines = StateObject(wrappedValue: RoutineStore())
        // Reads `workout.json`: a workout open when the app was killed resumes where it was.
        let session = WorkoutSession()
        session.onFinished = { PhoneConnection.shared.sendOutbox() }
        _session = StateObject(wrappedValue: session)
    }

    var body: some Scene {
        WindowGroup {
            Group {
                if let workout = session.workout, session.isShowing {
                    WorkoutView(workout: workout)
                } else {
                    NavigationStack {
                        RoutineListView()
                    }
                }
            }
            .environmentObject(routines)
            .environmentObject(session)
        }
    }
}

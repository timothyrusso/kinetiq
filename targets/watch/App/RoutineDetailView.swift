import SwiftUI

/// One routine's exercises, and the button that starts it.
struct RoutineDetailView: View {
    @EnvironmentObject private var session: WorkoutSession
    let routine: Routine
    let unitSystem: UnitSystem

    var body: some View {
        List {
            Section {
                if session.workout != nil {
                    Button {
                        session.resume()
                    } label: {
                        Label("workout.resume", systemImage: "play.fill")
                    }
                } else {
                    Button {
                        session.start(routine, unitSystem: unitSystem)
                    } label: {
                        Label("routine.start", systemImage: "play.fill")
                    }
                    .disabled(routine.items.isEmpty)
                }
            }
            Section {
                // Names only: sets, reps and weights are on each exercise's page once started.
                ForEach(routine.items) { item in
                    Text(item.exerciseName)
                        .lineLimit(2)
                }
            }
        }
        .navigationTitle(routine.name)
    }
}

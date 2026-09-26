import SwiftUI

/// The last page: how much was done, and Finish or Discard. The confirms are presented by
/// `WorkoutView`: a dialog attached inside a vertical-page `TabView` page never appears.
struct FinishPage: View {
    let workout: Workout
    let onFinish: () -> Void
    let onDiscard: () -> Void

    var body: some View {
        VStack(spacing: 8) {
            Text(workout.title)
                .font(.headline)
                .lineLimit(2)
                .multilineTextAlignment(.center)
            Text("workout.progress \(workout.completedSets) \(workout.plannedSets)")
                .font(.footnote)
                .foregroundStyle(.secondary)
            Button(action: onFinish) {
                Label("workout.finish", systemImage: "flag.checkered")
            }
            .buttonStyle(.primary)
            Button(role: .destructive, action: onDiscard) {
                Label("workout.discard", systemImage: "trash")
            }
        }
    }
}

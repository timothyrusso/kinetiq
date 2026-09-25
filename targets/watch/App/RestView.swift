import SwiftUI

/// The rest countdown after a completed set. Ends with a haptic at zero; -15 / +15 move the end,
/// Skip ends it now.
struct RestView: View {
    @EnvironmentObject private var session: WorkoutSession
    let workout: Workout

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let remaining = workout.restRemaining(now: context.date)
            VStack(spacing: 8) {
                Text("rest.title")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                Text(verbatim: RestFormat.text(remaining))
                    .font(.system(size: 44, weight: .semibold, design: .rounded).monospacedDigit())
                    .accessibilityLabel("rest.remaining")
                    .accessibilityValue(RestFormat.text(remaining))
                HStack {
                    Button("rest.minus15") {
                        session.update { $0.adjustRest(by: -Workout.restStep, now: Date()) }
                    }
                    Button("rest.plus15") {
                        session.update { $0.adjustRest(by: Workout.restStep, now: Date()) }
                    }
                }
                Button("rest.skip") {
                    session.update { $0.clearRest() }
                }
                .buttonStyle(.borderedProminent)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(.black)
            .onChange(of: remaining) { _, value in
                if value == 0 { session.restEnded() }
            }
        }
    }
}

/// Rest for this exercise from the next set on, in 15-second steps like the phone's editor.
struct RestEditor: View {
    @EnvironmentObject private var session: WorkoutSession
    @Environment(\.dismiss) private var dismiss
    let index: Int
    @State var seconds: Int

    var body: some View {
        VStack(spacing: 8) {
            Text("rest.editTitle")
                .font(.headline)
            Text(verbatim: RestFormat.text(seconds))
                .font(.system(size: 36, weight: .semibold, design: .rounded).monospacedDigit())
                .focusable()
                .digitalCrownRotation(
                    Binding(get: { Double(seconds) }, set: { set(Int($0)) }),
                    from: session.bounds.itemBounds.restSeconds.min,
                    through: session.bounds.itemBounds.restSeconds.max,
                    by: Double(Workout.restStep),
                    sensitivity: .low,
                    isContinuous: false,
                    isHapticFeedbackEnabled: true
                )
                .accessibilityLabel("rest.editTitle")
                .accessibilityValue(RestFormat.text(seconds))
                .accessibilityAdjustableAction { direction in
                    set(seconds + (direction == .increment ? Workout.restStep : -Workout.restStep))
                }
            HStack {
                Button("rest.minus15") { set(seconds - Workout.restStep) }
                Button("rest.plus15") { set(seconds + Workout.restStep) }
            }
            Button("common.done") { dismiss() }
                .buttonStyle(.borderedProminent)
        }
    }

    private func set(_ value: Int) {
        seconds = Int(session.bounds.itemBounds.restSeconds.clamp(Double(value)))
        session.update { $0.setRest(seconds, in: index, bounds: session.bounds) }
    }
}

import SwiftUI

/// The rest countdown after a completed set, with that set's RPE under it (issue #132). The
/// Crown turns whichever of the two is picked, the countdown by default; a tap on the other hands
/// it over, and the ring shows which has it. Ends with a haptic at zero; -15 / +15 move the end,
/// Skip ends it now. The RPE is written to the set on every turn, so it is saved however the rest
/// ends and survives a relaunch.
struct RestView: View {
    @EnvironmentObject private var session: WorkoutSession
    let workout: Workout

    private enum Field { case rest, rpe }
    @State private var field: Field = .rest
    /// The Crown's running position. Only whole steps of it are used, so the countdown can tick
    /// under it without the Crown fighting the clock.
    @State private var crown: Double = 0
    @State private var appliedSteps = 0
    @FocusState private var crownFocused: Bool

    private var rpe: Double? {
        workout.lastCompleted.flatMap { workout.rpe(ofSet: $0.set, in: $0.entry) }
    }

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let remaining = workout.restRemaining(now: context.date)
            VStack(spacing: 6) {
                Text("rest.title")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                VStack(spacing: 6) {
                    Button {
                        pick(.rest)
                    } label: {
                        Text(verbatim: RestFormat.text(remaining))
                            .font(.system(size: 40, weight: .semibold, design: .rounded).monospacedDigit())
                            .frame(maxWidth: .infinity)
                            .overlay(highlight(.rest))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("rest.remaining")
                    .accessibilityValue(RestFormat.text(remaining))
                    .accessibilityAdjustableAction { turn($0 == .increment ? 1 : -1, field: .rest) }
                    if workout.lastCompleted != nil {
                        Button {
                            pick(.rpe)
                        } label: {
                            HStack {
                                Text("rest.rpe")
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                                Spacer(minLength: 4)
                                Text(rpeText)
                                    .font(.title3.monospacedDigit().weight(.semibold))
                                    .foregroundStyle(rpe == nil ? .secondary : .primary)
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.6)
                            }
                            .padding(.horizontal, 10)
                            .frame(maxWidth: .infinity, minHeight: 36)
                            .background(RoundedRectangle(cornerRadius: 10).fill(Color.white.opacity(0.1)))
                            .overlay(highlight(.rpe))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("rest.rpe")
                        .accessibilityValue(rpeText)
                        .accessibilityAdjustableAction { turn($0 == .increment ? 1 : -1, field: .rpe) }
                    }
                }
                .focusable()
                .focused($crownFocused)
                .onAppear { crownFocused = true }
                .digitalCrownRotation(
                    $crown,
                    from: -Self.crownRange,
                    through: Self.crownRange,
                    by: 1,
                    sensitivity: .low,
                    isContinuous: false,
                    isHapticFeedbackEnabled: true
                )
                .onChange(of: crown) { _, value in
                    let steps = Int(value.rounded()) - appliedSteps
                    guard steps != 0 else { return }
                    appliedSteps += steps
                    turn(steps, field: field)
                }
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
                .buttonStyle(.primary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(.black)
            .onChange(of: remaining) { _, value in
                if value == 0 { session.restEnded() }
            }
        }
    }

    /// Far more Crown travel than a rest or an RPE can use, so it never runs out.
    private static let crownRange: Double = 10_000

    private var rpeText: String {
        guard let rpe else { return String(localized: "rest.rpe.notSet") }
        return rpe.formatted(.number.precision(.fractionLength(0...1)))
    }

    private func pick(_ picked: Field) {
        field = picked
        crownFocused = true
    }

    private func highlight(_ kind: Field) -> some View {
        RoundedRectangle(cornerRadius: 10)
            .stroke(crownFocused && field == kind ? Color.accentColor : .clear, lineWidth: 2)
    }

    /// One Crown step is 15 seconds of rest or one point of RPE.
    private func turn(_ steps: Int, field: Field) {
        switch field {
        case .rest:
            session.update { $0.adjustRest(by: steps * Workout.restStep, now: Date()) }
        case .rpe:
            guard let done = workout.lastCompleted else { return }
            let value = Workout.nudgedRpe(rpe, by: steps, bounds: session.bounds)
            session.update { $0.setRpe(value, forSet: done.set, in: done.entry, bounds: session.bounds) }
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
                .buttonStyle(.primary)
        }
    }

    private func set(_ value: Int) {
        seconds = Int(session.bounds.itemBounds.restSeconds.clamp(Double(value)))
        session.update { $0.setRest(seconds, in: index, bounds: session.bounds) }
    }
}

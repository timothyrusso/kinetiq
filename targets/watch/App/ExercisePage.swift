import SwiftUI

/// One exercise: the selected set's weight and reps (the Crown edits whichever is picked),
/// Complete set, and every set with a checkbox to tick or untick.
struct ExercisePage: View {
    @EnvironmentObject private var session: WorkoutSession
    let workout: Workout
    let index: Int
    let entry: WorkoutEntry

    private enum Field { case weight, reps }
    @State private var field: Field = .weight
    /// The set the tiles edit. Nil means "the next open one", which moves on as sets are done.
    @State private var picked: Int?
    @State private var editingRest = false
    @FocusState private var crownFocused: Bool

    private var selected: Int {
        if let picked, entry.sets.indices.contains(picked) { return picked }
        return workout.nextSet(in: index) ?? max(0, entry.sets.count - 1)
    }

    private var selectedSet: WorkoutSet? { entry.sets[safe: selected] }

    var body: some View {
        ScrollView {
            VStack(spacing: 6) {
                Text(entry.exerciseName)
                    .font(.headline)
                    .lineLimit(2)
                    .minimumScaleFactor(0.7)
                    .multilineTextAlignment(.center)
                Text("workout.setOf \(selected + 1) \(entry.sets.count)")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                HStack(spacing: 6) {
                    tile(.weight, value: weightText, unit: weightUnit, label: "workout.weight", adjust: adjustWeight)
                    tile(.reps, value: String(selectedSet?.reps ?? 0), unit: String(localized: "workout.repsUnit"),
                         label: "workout.reps", adjust: adjustReps)
                }
                .focusable()
                .focused($crownFocused)
                .digitalCrownRotation(
                    crownBinding,
                    from: field == .weight ? 0 : Double(Workout.repsRange.lowerBound),
                    through: field == .weight
                        ? maxWeightShown
                        : Double(Workout.repsRange.upperBound),
                    by: field == .weight ? Units.crownStep(workout.unitSystem) : 1,
                    sensitivity: .low,
                    isContinuous: false,
                    isHapticFeedbackEnabled: true
                )
                if selectedSet?.completed == false {
                    Button {
                        session.completeSet(selected, in: index)
                        picked = nil
                    } label: {
                        Label("workout.completeSet", systemImage: "checkmark")
                    }
                    .buttonStyle(.primary)
                }
                VStack(spacing: 4) {
                    ForEach(Array(entry.sets.enumerated()), id: \.offset) { setIndex, set in
                        SetRow(
                            number: setIndex + 1,
                            summary: summary(set),
                            completed: set.completed,
                            selected: setIndex == selected,
                            select: { picked = setIndex },
                            toggle: {
                                session.update { $0.toggleSet(setIndex, in: index, now: Date()) }
                                picked = nil
                            }
                        )
                    }
                }
                .padding(.top, 4)
                // Rest for this exercise, below the sets rather than floating over them.
                Button {
                    editingRest = true
                } label: {
                    Label(RestFormat.text(entry.restSeconds), systemImage: "timer")
                        .font(.footnote)
                }
                .accessibilityLabel("workout.restEdit")
                .padding(.top, 4)
            }
            .padding(.bottom, 8)
        }
        .onAppear { crownFocused = true }
        .sheet(isPresented: $editingRest) {
            RestEditor(index: index, seconds: entry.restSeconds)
        }
    }

    // MARK: Values

    private var weightUnit: String { workout.unitSystem == .metric ? "kg" : "lb" }

    private var maxWeightShown: Double {
        Units.displayValue(kilograms: session.bounds.itemBounds.weightKg.max, system: workout.unitSystem)
    }

    /// "70 kg × 5" for a set row.
    private func summary(_ set: WorkoutSet) -> String {
        "\(Units.format(kilograms: set.weightKg, system: workout.unitSystem)) × \(set.reps)"
    }

    private var weightText: String {
        Units.displayText(kilograms: selectedSet?.weightKg ?? 0, system: workout.unitSystem)
    }

    /// What the Crown turns: the picked tile's number, in the unit shown.
    private var crownBinding: Binding<Double> {
        let system = workout.unitSystem
        return Binding(
            get: {
                field == .weight
                    ? Units.displayValue(kilograms: selectedSet?.weightKg ?? 0, system: system)
                    : Double(selectedSet?.reps ?? 0)
            },
            set: { value in
                let set = selected
                if field == .weight {
                    let kilograms = Units.kilograms(fromDisplay: value, system: system)
                    session.update { $0.setWeight(kilograms, set: set, in: index, bounds: session.bounds) }
                } else {
                    session.update { $0.setReps(Int(value.rounded()), set: set, in: index) }
                }
            }
        )
    }

    private func adjustWeight(_ direction: AccessibilityAdjustmentDirection) {
        let system = workout.unitSystem
        let step = Units.crownStep(system)
        let shown = Units.displayValue(kilograms: selectedSet?.weightKg ?? 0, system: system)
        let target = max(0, shown + (direction == .increment ? step : -step))
        let kilograms = Units.kilograms(fromDisplay: target, system: system)
        let set = selected
        session.update { $0.setWeight(kilograms, set: set, in: index, bounds: session.bounds) }
    }

    private func adjustReps(_ direction: AccessibilityAdjustmentDirection) {
        let reps = (selectedSet?.reps ?? 0) + (direction == .increment ? 1 : -1)
        let set = selected
        session.update { $0.setReps(reps, set: set, in: index) }
    }

    /// A tile is a button that hands the Crown to its number; the ring shows which has it.
    private func tile(
        _ kind: Field,
        value: String,
        unit: String,
        label: LocalizedStringKey,
        adjust: @escaping (AccessibilityAdjustmentDirection) -> Void
    ) -> some View {
        Button {
            field = kind
            crownFocused = true
        } label: {
            ValueTile(value: value, unit: unit, focused: field == kind)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityValue(value)
        .accessibilityAdjustableAction(adjust)
    }
}

/// One set: its number and values (tap to edit it) and a checkbox (tap to tick or untick).
struct SetRow: View {
    let number: Int
    let summary: String
    let completed: Bool
    let selected: Bool
    let select: () -> Void
    let toggle: () -> Void

    var body: some View {
        HStack(spacing: 6) {
            Button(action: select) {
                HStack {
                    Text(verbatim: "\(number)")
                        .font(.footnote.monospacedDigit().weight(.semibold))
                        .foregroundStyle(.secondary)
                        .frame(width: 18)
                    Text(verbatim: summary)
                        .font(.footnote.monospacedDigit())
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    Spacer(minLength: 0)
                }
                .padding(.vertical, 6)
                .padding(.horizontal, 8)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.white.opacity(selected ? 0.18 : 0.08))
                )
            }
            .buttonStyle(.plain)
            .accessibilityLabel("workout.setRow \(number) \(summary)")
            Button(action: toggle) {
                Image(systemName: completed ? "checkmark.square.fill" : "square")
                    .font(.title3)
                    .foregroundStyle(completed ? Color.accentColor : Color.secondary)
                    .frame(width: 32, height: 32)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(completed ? "workout.setUntick" : "workout.setTick")
        }
    }
}

struct ValueTile: View {
    let value: String
    let unit: String
    let focused: Bool

    var body: some View {
        VStack(spacing: 0) {
            Text(verbatim: value)
                .font(.title3.monospacedDigit().weight(.semibold))
                .minimumScaleFactor(0.6)
                .lineLimit(1)
            Text(verbatim: unit)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, minHeight: 44)
        .background(RoundedRectangle(cornerRadius: 10).fill(Color.white.opacity(0.1)))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(focused ? Color.accentColor : .clear, lineWidth: 2))
    }
}

/// "1:30", or "0:00" for no rest.
enum RestFormat {
    static func text(_ seconds: Int) -> String {
        let value = max(0, seconds)
        return String(format: "%d:%02d", value / 60, value % 60)
    }
}

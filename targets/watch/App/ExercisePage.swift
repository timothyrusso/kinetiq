import SwiftUI

/// One exercise: the selected set's values for its tracking type (weight and reps, reps alone, or
/// a time; the Crown edits whichever is picked), Complete set, and every set with a checkbox to
/// tick or untick.
struct ExercisePage: View {
    @EnvironmentObject private var session: WorkoutSession
    let workout: Workout
    let index: Int
    let entry: WorkoutEntry

    private enum Field { case weight, reps, duration }
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
                    tiles
                }
                // The rest screen covers the page while it runs and takes the Crown.
                .focusable(workout.restEndsAt == nil)
                .focused($crownFocused)
                .digitalCrownRotation(
                    crownBinding,
                    from: crownRange.lowerBound,
                    through: crownRange.upperBound,
                    by: crownStep,
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
        // Only the page on screen takes the Crown back; the pager keeps its neighbours alive.
        .onChange(of: workout.restEndsAt == nil) { _, free in
            if free && index == workout.currentEntry { crownFocused = true }
        }
        .sheet(isPresented: $editingRest) {
            RestEditor(index: index, seconds: entry.restSeconds)
        }
    }

    /// The tiles this exercise's type records: weight and reps, reps alone, or a time.
    @ViewBuilder private var tiles: some View {
        switch entry.trackingType {
        case .weightReps:
            tile(.weight, value: weightText, unit: weightUnit, label: "workout.weight", adjust: adjustWeight)
            repsTile
        case .repsOnly:
            repsTile
        case .duration:
            tile(.duration, value: RestFormat.text(selectedSet?.durationSeconds ?? 0),
                 unit: String(localized: "workout.durationUnit"), label: "workout.duration", adjust: adjustDuration)
        }
    }

    private var repsTile: some View {
        tile(.reps, value: String(selectedSet?.reps ?? 0), unit: String(localized: "workout.repsUnit"),
             label: "workout.reps", adjust: adjustReps)
    }

    // MARK: Values

    /// The field the Crown turns: the one picked, if this exercise's type records it, otherwise
    /// the type's first.
    private var active: Field {
        switch entry.trackingType {
        case .weightReps: return field == .reps ? .reps : .weight
        case .repsOnly: return .reps
        case .duration: return .duration
        }
    }

    private var crownRange: ClosedRange<Double> {
        let bounds = session.bounds.itemBounds
        switch active {
        case .weight: return 0...maxWeightShown
        case .reps: return bounds.reps.min...bounds.reps.max
        case .duration: return bounds.durationSeconds.min...bounds.durationSeconds.max
        }
    }

    private var crownStep: Double {
        switch active {
        case .weight: return Units.crownStep(workout.unitSystem)
        case .reps: return 1
        case .duration: return Double(Workout.durationStep)
        }
    }

    private var weightUnit: String { workout.unitSystem == .metric ? "kg" : "lb" }

    private var maxWeightShown: Double {
        Units.displayValue(kilograms: session.bounds.itemBounds.weightKg.max, system: workout.unitSystem)
    }

    /// A set row's values: "70 kg × 5", "12 reps" or "0:45".
    private func summary(_ set: WorkoutSet) -> String {
        switch entry.trackingType {
        case .weightReps:
            return "\(Units.format(kilograms: set.weightKg, system: workout.unitSystem)) × \(set.reps)"
        case .repsOnly:
            return "\(set.reps) \(String(localized: "workout.repsUnit"))"
        case .duration:
            return RestFormat.text(set.durationSeconds)
        }
    }

    private var weightText: String {
        Units.displayText(kilograms: selectedSet?.weightKg ?? 0, system: workout.unitSystem)
    }

    /// What the Crown turns: the picked tile's number, in the unit shown.
    private var crownBinding: Binding<Double> {
        let system = workout.unitSystem
        return Binding(
            get: {
                switch active {
                case .weight: return Units.displayValue(kilograms: selectedSet?.weightKg ?? 0, system: system)
                case .reps: return Double(selectedSet?.reps ?? 0)
                case .duration: return Double(selectedSet?.durationSeconds ?? 0)
                }
            },
            set: { value in
                let set = selected
                let bounds = session.bounds
                switch active {
                case .weight:
                    let kilograms = Units.kilograms(fromDisplay: value, system: system)
                    session.update { $0.setWeight(kilograms, set: set, in: index, bounds: bounds) }
                case .reps:
                    session.update { $0.setReps(Int(value.rounded()), set: set, in: index, bounds: bounds) }
                case .duration:
                    session.update { $0.setDuration(Int(value.rounded()), set: set, in: index, bounds: bounds) }
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
        session.update { $0.setReps(reps, set: set, in: index, bounds: session.bounds) }
    }

    private func adjustDuration(_ direction: AccessibilityAdjustmentDirection) {
        let step = direction == .increment ? Workout.durationStep : -Workout.durationStep
        let seconds = (selectedSet?.durationSeconds ?? 0) + step
        let set = selected
        session.update { $0.setDuration(seconds, set: set, in: index, bounds: session.bounds) }
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
            ValueTile(value: value, unit: unit, focused: active == kind)
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

/// Minutes and seconds, `m:ss`: a rest ("1:30", or "0:00" for none) or a timed set ("0:45").
enum RestFormat {
    static func text(_ seconds: Int) -> String {
        let value = max(0, seconds)
        return String(format: "%d:%02d", value / 60, value % 60)
    }
}

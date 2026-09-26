import SwiftUI

/// The workout screen: one exercise per page, then a page to finish or discard. The rest timer
/// covers the page while it runs.
struct WorkoutView: View {
    @EnvironmentObject private var session: WorkoutSession
    let workout: Workout
    @State private var page: Int
    @State private var confirmFinish = false
    @State private var confirmDiscard = false

    init(workout: Workout) {
        self.workout = workout
        _page = State(initialValue: workout.currentEntry)
    }

    var body: some View {
        NavigationStack {
            TabView(selection: $page) {
                ForEach(Array(workout.entries.enumerated()), id: \.offset) { index, entry in
                    ExercisePage(
                        workout: workout,
                        index: index,
                        entry: entry,
                        onFinish: { confirmFinish = true },
                        onDiscard: { confirmDiscard = true }
                    )
                    .tag(index)
                }
                FinishPage(
                    workout: workout,
                    onFinish: { confirmFinish = true },
                    onDiscard: { confirmDiscard = true }
                )
                .tag(workout.entries.count)
            }
            .tabViewStyle(.verticalPage)
            .toolbar {
                // Back to the routine list; the workout stays open and saved, one tap from Resume.
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        session.minimize()
                    } label: {
                        Image(systemName: "chevron.backward")
                    }
                    .accessibilityLabel("workout.back")
                }
            }
            // The page is saved with the workout, so a relaunch opens the same exercise. The
            // finish page is not an exercise and is not saved.
            .onChange(of: page) { _, index in
                session.update { $0.setCurrentEntry(index) }
            }
            // Undo can move to another exercise.
            .onChange(of: workout.currentEntry) { _, index in
                if page < workout.entries.count { page = index }
            }
        }
        .overlay {
            if workout.restEndsAt != nil {
                RestView(workout: workout)
            }
        }
        .confirmationDialog("workout.finish.confirm", isPresented: $confirmFinish, titleVisibility: .visible) {
            Button("workout.finish") { session.finish() }
            Button("common.cancel", role: .cancel) {}
        } message: {
            Text("workout.finish.message")
        }
        .confirmationDialog("workout.discard.confirm", isPresented: $confirmDiscard, titleVisibility: .visible) {
            Button("workout.discard", role: .destructive) { session.discard() }
            Button("common.cancel", role: .cancel) {}
        } message: {
            Text("workout.discard.message")
        }
    }
}

/// One exercise: the next set's weight and reps, the button that completes it, Undo and rest.
struct ExercisePage: View {
    @EnvironmentObject private var session: WorkoutSession
    let workout: Workout
    let index: Int
    let entry: WorkoutEntry
    let onFinish: () -> Void
    let onDiscard: () -> Void

    private enum Field { case weight, reps }
    @FocusState private var focus: Field?
    @State private var editingRest = false

    private var next: Int? { workout.nextSet(in: index) }
    /// The set the tiles show: the next one, or the last one once all are done.
    private var shown: WorkoutSet? { entry.sets[safe: next ?? (entry.sets.count - 1)] }

    var body: some View {
        VStack(spacing: 6) {
            Text(entry.exerciseName)
                .font(.headline)
                .lineLimit(2)
                .minimumScaleFactor(0.7)
                .multilineTextAlignment(.center)
            if let next {
                Text("workout.setOf \(next + 1) \(entry.sets.count)")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else {
                Text("workout.exerciseDone")
                    .font(.footnote)
                    .foregroundStyle(.green)
            }
            if next != nil {
                HStack(spacing: 6) {
                    weightTile
                    repsTile
                }
                Button {
                    session.completeSet(in: index)
                } label: {
                    Label("workout.completeSet", systemImage: "checkmark")
                }
                .buttonStyle(.primary)
            } else {
                // Every set of this exercise is done: the way out is right here, not only on the
                // last page. The next exercise is still one swipe down.
                Button(action: onFinish) {
                    Label("workout.finish", systemImage: "flag.checkered")
                }
                .buttonStyle(.primary)
                Button(role: .destructive, action: onDiscard) {
                    Label("workout.discard", systemImage: "trash")
                }
            }
        }
        // Clear of the Undo and rest buttons in the bottom bar.
        .padding(.bottom, 12)
        .toolbar {
            ToolbarItemGroup(placement: .bottomBar) {
                Button {
                    session.update { $0.undoLastCompleted() }
                } label: {
                    Image(systemName: "arrow.uturn.backward")
                }
                .accessibilityLabel("workout.undo")
                .disabled(!workout.canUndo)
                Spacer()
                Button {
                    editingRest = true
                } label: {
                    Label(RestFormat.text(entry.restSeconds), systemImage: "timer")
                }
                .accessibilityLabel("workout.restEdit")
            }
        }
        .sheet(isPresented: $editingRest) {
            RestEditor(index: index, seconds: entry.restSeconds)
        }
    }

    private var weightTile: some View {
        let system = workout.unitSystem
        let kilograms = shown?.weightKg ?? 0
        return ValueTile(
            value: Units.displayText(kilograms: kilograms, system: system),
            unit: system == .metric ? "kg" : "lb",
            focused: focus == .weight
        )
        .focusable(next != nil)
        .focused($focus, equals: .weight)
        // A tap alone does not move the Crown to another tile; this does.
        .onTapGesture { if next != nil { focus = .weight } }
        .digitalCrownRotation(
            Binding(
                get: { Units.displayValue(kilograms: kilograms, system: system) },
                set: { value in
                    let kilograms = Units.kilograms(fromDisplay: value, system: system)
                    session.update { $0.setWeight(kilograms, in: index, bounds: session.bounds) }
                }
            ),
            from: 0,
            through: Units.displayValue(kilograms: session.bounds.itemBounds.weightKg.max, system: system),
            by: Units.crownStep(system),
            sensitivity: .low,
            isContinuous: false,
            isHapticFeedbackEnabled: true
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("workout.weight")
        .accessibilityValue(Units.format(kilograms: kilograms, system: system))
        .accessibilityAdjustableAction { direction in
            let step = Units.crownStep(system)
            let shown = Units.displayValue(kilograms: kilograms, system: system)
            let target = max(0, shown + (direction == .increment ? step : -step))
            let next = Units.kilograms(fromDisplay: target, system: system)
            session.update { $0.setWeight(next, in: index, bounds: session.bounds) }
        }
    }

    private var repsTile: some View {
        let reps = shown?.reps ?? 0
        return ValueTile(value: String(reps), unit: String(localized: "workout.repsUnit"), focused: focus == .reps)
            .focusable(next != nil)
            .focused($focus, equals: .reps)
            .onTapGesture { if next != nil { focus = .reps } }
            .digitalCrownRotation(
                Binding(
                    get: { Double(reps) },
                    set: { value in session.update { $0.setReps(Int(value.rounded()), in: index) } }
                ),
                from: Double(Workout.repsRange.lowerBound),
                through: Double(Workout.repsRange.upperBound),
                by: 1,
                sensitivity: .low,
                isContinuous: false,
                isHapticFeedbackEnabled: true
            )
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("workout.reps")
            .accessibilityValue(String(reps))
            .accessibilityAdjustableAction { direction in
                session.update { $0.setReps(reps + (direction == .increment ? 1 : -1), in: index) }
            }
    }
}

/// A number the Crown edits once the tile is tapped; the ring shows which one has the Crown.
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

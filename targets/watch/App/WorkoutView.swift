import SwiftUI

/// The workout: an overview of the routine's exercises, and the exercise pages it opens.
///
/// Start (and Resume) lands on the current exercise; back leads to the overview, where any
/// exercise can be picked and the workout finished or discarded; back from there returns to the
/// routine list with the workout still open. Once every set is done the overview comes up by
/// itself. The rest timer covers everything while it runs.
struct WorkoutView: View {
    @EnvironmentObject private var session: WorkoutSession
    let workout: Workout
    @State private var path: [Int]
    @State private var confirmFinish = false
    @State private var confirmDiscard = false

    init(workout: Workout) {
        self.workout = workout
        _path = State(initialValue: workout.allDone ? [] : [workout.currentEntry])
    }

    var body: some View {
        NavigationStack(path: $path) {
            WorkoutOverview(
                workout: workout,
                open: { path = [$0] },
                onFinish: { confirmFinish = true },
                onDiscard: { confirmDiscard = true }
            )
            .navigationDestination(for: Int.self) { start in
                ExercisePager(workout: workout, start: start, allDone: { path = [] })
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

/// Every exercise with its progress, then Finish and Discard.
struct WorkoutOverview: View {
    @EnvironmentObject private var session: WorkoutSession
    let workout: Workout
    let open: (Int) -> Void
    let onFinish: () -> Void
    let onDiscard: () -> Void

    var body: some View {
        List {
            Section {
                ForEach(Array(workout.entries.enumerated()), id: \.offset) { index, entry in
                    Button {
                        open(index)
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(entry.exerciseName)
                                    .lineLimit(2)
                                Text("workout.setsDone \(doneCount(entry)) \(entry.sets.count)")
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            if workout.isDone(index) {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(.tint)
                                    .accessibilityLabel("workout.exerciseDone")
                            }
                        }
                    }
                }
            } footer: {
                Text("workout.progress \(workout.completedSets) \(workout.plannedSets)")
            }
            Section {
                Button(action: onFinish) {
                    Label("workout.finish", systemImage: "flag.checkered")
                }
                .buttonStyle(.primary)
                .listRowBackground(Color.clear)
                Button(role: .destructive, action: onDiscard) {
                    Label("workout.discard", systemImage: "trash")
                }
            }
        }
        .navigationTitle(workout.title)
        .navigationBarTitleDisplayMode(.inline)
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
    }
}

private func doneCount(_ entry: WorkoutEntry) -> Int {
    entry.sets.filter { $0.completed }.count
}

/// The exercises side by side: swipe between them, back to the overview.
struct ExercisePager: View {
    @EnvironmentObject private var session: WorkoutSession
    let workout: Workout
    let allDone: () -> Void
    @State private var page: Int

    init(workout: Workout, start: Int, allDone: @escaping () -> Void) {
        self.workout = workout
        self.allDone = allDone
        _page = State(initialValue: start)
    }

    var body: some View {
        TabView(selection: $page) {
            ForEach(Array(workout.entries.enumerated()), id: \.offset) { index, entry in
                ExercisePage(workout: workout, index: index, entry: entry)
                    .tag(index)
            }
        }
        .tabViewStyle(.page)
        // The page is saved with the workout, so a relaunch opens the same exercise.
        .onAppear { session.update { $0.setCurrentEntry(page) } }
        .onChange(of: page) { _, index in
            session.update { $0.setCurrentEntry(index) }
        }
        // An exercise just finished: on to the next one with work left, or the overview when
        // there is none.
        .onChange(of: workout.completedSets) { before, after in
            guard after > before, workout.isDone(page) else { return }
            if workout.allDone {
                allDone()
            } else if let next = workout.nextUnfinished(after: page) {
                withAnimation { page = next }
            }
        }
    }
}

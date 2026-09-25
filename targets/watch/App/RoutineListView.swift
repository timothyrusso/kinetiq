import SwiftUI

/// The first screen: a Sync button, then the routines synced from the iPhone.
struct RoutineListView: View {
    @EnvironmentObject private var store: RoutineStore
    @EnvironmentObject private var session: WorkoutSession

    var body: some View {
        List {
            if let message = session.message {
                Text(message)
                    .font(.footnote)
                    .listRowBackground(Color.clear)
            }
            Section {
                SyncButton()
            } footer: {
                SyncStatusText(status: store.status)
            }
            if store.routines.isEmpty {
                EmptyRoutinesView()
                    .listRowBackground(Color.clear)
            } else {
                Section {
                    ForEach(store.routines) { routine in
                        NavigationLink(value: routine.id) {
                            RoutineRow(routine: routine)
                        }
                    }
                }
            }
        }
        .navigationTitle("routines.title")
        .navigationDestination(for: String.self) { id in
            if let routine = store.routines.first(where: { $0.id == id }) {
                RoutineDetailView(routine: routine, unitSystem: store.unitSystem)
            }
        }
    }
}

private struct SyncButton: View {
    @EnvironmentObject private var store: RoutineStore

    var body: some View {
        Button {
            store.sync()
        } label: {
            HStack {
                Label("sync.button", systemImage: "arrow.triangle.2.circlepath")
                Spacer()
                if store.status == .syncing {
                    ProgressView()
                        .frame(width: 20, height: 20)
                }
            }
        }
        .disabled(store.status == .syncing)
    }
}

private struct SyncStatusText: View {
    let status: RoutineStore.SyncStatus

    var body: some View {
        switch status {
        case .idle:
            EmptyView()
        case .syncing:
            Text("sync.syncing")
        case .done(let message):
            Text(message)
        case .failed(let message):
            Text(message)
                .foregroundStyle(.orange)
        }
    }
}

private struct RoutineRow: View {
    let routine: Routine

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(routine.name)
                .font(.headline)
                .lineLimit(2)
            Text("routine.exerciseCount \(routine.items.count)")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }
}

/// Shown until the first snapshot arrives from the iPhone.
struct EmptyRoutinesView: View {
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "figure.strengthtraining.traditional")
                .font(.title2)
                .foregroundStyle(.tint)
                .accessibilityHidden(true)
            Text("routines.empty.title")
                .font(.headline)
                .multilineTextAlignment(.center)
            Text("routines.empty.body")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 4)
    }
}

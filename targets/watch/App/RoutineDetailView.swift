import SwiftUI

/// One routine's exercises, and the button that starts it.
struct RoutineDetailView: View {
    let routine: Routine
    let unitSystem: UnitSystem

    var body: some View {
        List {
            Section {
                Button {
                } label: {
                    Label("routine.start", systemImage: "play.fill")
                }
                .disabled(true)
            }
            Section {
                ForEach(routine.items) { item in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.exerciseName)
                            .font(.headline)
                            .lineLimit(2)
                        Text(verbatim: summary(item))
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .navigationTitle(routine.name)
    }

    /// "4 × 8-10 · 60 kg", the phone's routine row in one line.
    private func summary(_ item: RoutineItem) -> String {
        "\(item.sets) × \(item.reps) · \(Units.format(kilograms: item.weightKg, system: unitSystem))"
    }
}

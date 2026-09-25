import SwiftUI

/// The first screen: the routines synced from the iPhone.
struct RoutineListView: View {
    var body: some View {
        EmptyRoutinesView()
            .navigationTitle("routines.title")
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
        .padding(.horizontal, 4)
    }
}

#Preview {
    NavigationStack {
        RoutineListView()
    }
}

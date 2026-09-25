import SwiftUI

/// The watch app's entry point.
///
/// Stability first (issue #27): nothing here may crash, and nothing the user did may be lost if
/// watchOS kills the app. The pure logic lives in `Core/` so it can be unit tested with
/// `swift test` from the command line; this folder only draws it.
@main
struct KinetiqWatchApp: App {
    var body: some Scene {
        WindowGroup {
            NavigationStack {
                RoutineListView()
            }
        }
    }
}

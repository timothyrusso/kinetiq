// swift-tools-version:5.9
//
// The watch app's pure logic (`watch/Core/` and `watch/Storage/`) as a Swift package, so
// `swift test` runs its unit tests from the command line (`npm run check:watch`). The Xcode
// watch target compiles the same files through its synchronised folder; this package never
// builds the SwiftUI app, so neither folder may import SwiftUI or WatchKit.
import PackageDescription

let package = Package(
    name: "KinetiqWatchCore",
    platforms: [.macOS(.v13), .watchOS(.v10)],
    products: [
        .library(name: "KinetiqWatchCore", targets: ["KinetiqWatchCore"]),
    ],
    targets: [
        .target(name: "KinetiqWatchCore", path: "watch", sources: ["Core", "Storage"]),
        .testTarget(
            name: "KinetiqWatchCoreTests",
            dependencies: ["KinetiqWatchCore"],
            path: "watch-tests"
        ),
    ]
)

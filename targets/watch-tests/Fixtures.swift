import Foundation
@testable import KinetiqWatchCore

enum Fixtures {
    /// The bundled `bounds.json`, read from the target folder as the app reads it from its bundle.
    static let bounds: Bounds = {
        let url = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("watch/bounds.json")
        return (try? Data(contentsOf: url)).flatMap(Bounds.decode) ?? .fallback
    }()

    static func item(_ overrides: [String: Any] = [:]) -> [String: Any] {
        var item: [String: Any] = [
            "id": "rit_1",
            "exerciseId": "wger:73",
            "exerciseName": "Bench Press",
            "sets": 4,
            "reps": "8-10",
            "weightKg": 60,
            "restSeconds": 120,
            "notes": NSNull()
        ]
        item.merge(overrides) { _, new in new }
        return item
    }

    static func snapshot(
        items: [[String: Any]] = [item()],
        routines count: Int = 1,
        overrides: [String: Any] = [:]
    ) -> Data {
        var document: [String: Any] = [
            "format": "kinetiq.watch-routines",
            "version": 1,
            "exportedAt": "2026-09-25T10:00:00.000Z",
            "unitSystem": "metric",
            "routines": (0..<count).map { index in
                ["id": "rtn_\(index)", "name": "Push", "items": items] as [String: Any]
            }
        ]
        document.merge(overrides) { _, new in new }
        return (try? JSONSerialization.data(withJSONObject: document)) ?? Data()
    }

    static func temporaryStore() -> FileStore {
        FileStore(directory: FileManager.default.temporaryDirectory
            .appendingPathComponent("kinetiq-tests-\(UUID().uuidString)", isDirectory: true))
    }
}

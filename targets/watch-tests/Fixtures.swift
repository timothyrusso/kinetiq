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

    /// One planned set on the wire.
    static func set(_ overrides: [String: Any] = [:]) -> [String: Any] {
        var set: [String: Any] = ["reps": 8, "weightKg": 60, "targetRpe": NSNull()]
        set.merge(overrides) { _, new in new }
        return set
    }

    /// Bench press on the wire: a pyramid of three sets, the last two with a target RPE.
    static func item(_ overrides: [String: Any] = [:]) -> [String: Any] {
        var item: [String: Any] = [
            "id": "rit_1",
            "exerciseId": "ex:barbell-bench-press",
            "exerciseName": "Bench Press",
            "sets": [
                set(["reps": 10, "weightKg": 60]),
                set(["reps": 8, "weightKg": 65, "targetRpe": 8]),
                set(["reps": 6, "weightKg": 70, "targetRpe": 9.5])
            ],
            "restSeconds": 120,
            "notes": NSNull()
        ]
        item.merge(overrides) { _, new in new }
        return item
    }

    /// `count` planned sets of `reps` at `weightKg`, with no target RPE.
    static func sets(_ count: Int, reps: Int, weightKg: Double) -> [RoutineSet] {
        Array(repeating: RoutineSet(reps: reps, weightKg: weightKg, targetRpe: nil), count: count)
    }

    static func snapshot(
        items: [[String: Any]] = [item()],
        routines count: Int = 1,
        overrides: [String: Any] = [:]
    ) -> Data {
        var document: [String: Any] = [
            "format": "kinetiq.watch-routines",
            "version": 2,
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

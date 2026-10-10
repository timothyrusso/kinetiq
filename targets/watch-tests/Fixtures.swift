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

    /// One planned loaded set on the wire.
    static func set(_ overrides: [String: Any] = [:]) -> [String: Any] {
        var set: [String: Any] = ["type": "weightReps", "reps": 8, "weightKg": 60, "targetRpe": NSNull()]
        set.merge(overrides) { _, new in new }
        return set
    }

    /// One planned reps-only set on the wire.
    static func repsOnlySet(_ overrides: [String: Any] = [:]) -> [String: Any] {
        var set: [String: Any] = ["type": "repsOnly", "reps": 10, "targetRpe": NSNull()]
        set.merge(overrides) { _, new in new }
        return set
    }

    /// One planned timed set on the wire.
    static func durationSet(_ overrides: [String: Any] = [:]) -> [String: Any] {
        var set: [String: Any] = ["type": "duration", "durationSeconds": 45, "targetRpe": NSNull()]
        set.merge(overrides) { _, new in new }
        return set
    }

    /// Bench press on the wire: a pyramid of three sets, the last two with a target RPE.
    static func item(_ overrides: [String: Any] = [:]) -> [String: Any] {
        var item: [String: Any] = [
            "id": "rit_1",
            "exerciseId": "ex:barbell-bench-press",
            "exerciseName": "Bench Press",
            "trackingType": "weightReps",
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

    /// Pull-ups on the wire: two sets counted in reps alone.
    static func repsOnlyItem(_ overrides: [String: Any] = [:]) -> [String: Any] {
        item([
            "id": "rit_2", "exerciseId": "ex:pullups", "exerciseName": "Pull-up", "trackingType": "repsOnly",
            "sets": [repsOnlySet(), repsOnlySet(["reps": 8, "targetRpe": 9])]
        ].merging(overrides) { _, new in new })
    }

    /// A plank on the wire: two timed sets.
    static func durationItem(_ overrides: [String: Any] = [:]) -> [String: Any] {
        item([
            "id": "rit_3", "exerciseId": "ex:plank", "exerciseName": "Plank", "trackingType": "duration",
            "sets": [durationSet(), durationSet(["durationSeconds": 60, "targetRpe": 8])]
        ].merging(overrides) { _, new in new })
    }

    /// `count` planned loaded sets of `reps` at `weightKg`, with no target RPE.
    static func sets(_ count: Int, reps: Int, weightKg: Double) -> [RoutineSet] {
        Array(repeating: .weightReps(reps: reps, weightKg: weightKg), count: count)
    }

    /// A loaded item of `sets`.
    static func weightRepsItem(_ id: String, _ name: String, sets: [RoutineSet], rest: Int = 90) -> RoutineItem {
        RoutineItem(
            id: id, exerciseId: "ex:\(id)", exerciseName: name, trackingType: .weightReps,
            sets: sets, restSeconds: rest, notes: nil
        )
    }

    static func snapshot(
        items: [[String: Any]] = [item()],
        routines count: Int = 1,
        overrides: [String: Any] = [:]
    ) -> Data {
        var document: [String: Any] = [
            "format": "kinetiq.watch-routines",
            "version": 3,
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

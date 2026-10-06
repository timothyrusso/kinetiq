import XCTest
@testable import KinetiqWatchCore

/// Reps-only and timed exercises on the watch (issue #194): planned, edited and sent per type.
final class WorkoutTrackingTypeTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_790_000_000)

    private func workout() -> Workout {
        let routine = Routine(id: "r", name: "Core", items: [
            RoutineItem(
                id: "a", exerciseId: "ex:pullups", exerciseName: "Pull-up", trackingType: .repsOnly,
                sets: [.repsOnly(reps: 10), .repsOnly(reps: 8, targetRpe: 9)], restSeconds: 90, notes: nil
            ),
            RoutineItem(
                id: "b", exerciseId: "ex:plank", exerciseName: "Plank", trackingType: .duration,
                sets: [.duration(seconds: 45), .duration(seconds: 60, targetRpe: 8)], restSeconds: 60, notes: nil
            ),
            Fixtures.weightRepsItem("c", "Bench", sets: Fixtures.sets(1, reps: 5, weightKg: 80))
        ])
        return Workout.start(routine: routine, unitSystem: .metric, id: "w", now: now)
    }

    private func wireEntries(_ workout: Workout) throws -> [[String: Any]] {
        let data = try XCTUnwrap(workout.document(endedAt: now).json())
        let json = try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        return try XCTUnwrap(json["entries"] as? [[String: Any]])
    }

    func testStartCopiesEachItemsTypeAndItsOwnValues() {
        let workout = workout()
        XCTAssertEqual(workout.entries.map(\.trackingType), [.repsOnly, .duration, .weightReps])
        XCTAssertEqual(workout.entries.first?.sets.map(\.type), [.repsOnly, .repsOnly])
        XCTAssertEqual(workout.entries.first?.sets.map(\.reps), [10, 8])
        XCTAssertEqual(workout.entries.first?.sets.map(\.rpe), [nil, 9])
        XCTAssertEqual(workout.entries[safe: 1]?.sets.map(\.type), [.duration, .duration])
        XCTAssertEqual(workout.entries[safe: 1]?.sets.map(\.durationSeconds), [45, 60])
        XCTAssertEqual(workout.entries[safe: 1]?.sets.map(\.rpe), [nil, 8])
    }

    func testATimedSetMovesWithinTheDurationBoundsAndCarriesForward() {
        var workout = workout()
        workout.setDuration(50, set: 0, in: 1, bounds: Fixtures.bounds)
        XCTAssertEqual(workout.entries[safe: 1]?.sets.map(\.durationSeconds), [50, 50])
        workout.completeSet(0, in: 1, now: now)
        workout.setDuration(9999, set: 1, in: 1, bounds: Fixtures.bounds)
        XCTAssertEqual(workout.entries[safe: 1]?.sets.map(\.durationSeconds), [50, 3600])
        workout.setDuration(0, set: 0, in: 1, bounds: Fixtures.bounds)
        XCTAssertEqual(workout.entries[safe: 1]?.sets.map(\.durationSeconds), [5, 3600], "a done set alone")
    }

    func testRepsOnlySetsTakeRepsWithinBounds() {
        var workout = workout()
        workout.setReps(200, set: 0, in: 0, bounds: Fixtures.bounds)
        XCTAssertEqual(workout.entries.first?.sets.map(\.reps), [100, 100])
        workout.setReps(0, set: 1, in: 0, bounds: Fixtures.bounds)
        XCTAssertEqual(workout.entries.first?.sets.map(\.reps), [100, 1])
    }

    func testAnEditATypeDoesNotRecordChangesNothing() {
        var workout = workout()
        let before = workout
        workout.setWeight(60, set: 0, in: 0, bounds: Fixtures.bounds)
        workout.setDuration(30, set: 0, in: 0, bounds: Fixtures.bounds)
        workout.setReps(12, set: 0, in: 1, bounds: Fixtures.bounds)
        workout.setWeight(60, in: 1, bounds: Fixtures.bounds)
        workout.setDuration(30, set: 0, in: 2, bounds: Fixtures.bounds)
        workout.setDuration(30, set: 0, in: 9, bounds: Fixtures.bounds)
        XCTAssertEqual(workout, before)
        XCTAssertTrue(workout.records(.reps, in: 0))
        XCTAssertFalse(workout.records(.weightKg, in: 0))
        XCTAssertTrue(workout.records(.durationSeconds, in: 1))
        XCTAssertFalse(workout.records(.reps, in: 9))
    }

    func testTheWireDocumentCarriesOnlyEachTypesKeys() throws {
        var workout = workout()
        workout.completeSet(0, in: 0, now: now)
        workout.completeSet(0, in: 1, now: now)
        workout.setRpe(7, forSet: 0, in: 1, bounds: Fixtures.bounds)
        let entries = try wireEntries(workout)
        XCTAssertEqual(entries.map { $0["trackingType"] as? String }, ["repsOnly", "duration", "weightReps"])

        let reps = try XCTUnwrap((entries.first?["sets"] as? [[String: Any]])?.first)
        XCTAssertEqual(Set(reps.keys), ["type", "index", "reps", "completed", "rpe"])
        XCTAssertEqual(reps["type"] as? String, "repsOnly")
        XCTAssertEqual(reps["reps"] as? Int, 10)
        XCTAssertEqual(reps["completed"] as? Bool, true)

        let timed = try XCTUnwrap((entries[safe: 1]?["sets"] as? [[String: Any]])?.first)
        XCTAssertEqual(Set(timed.keys), ["type", "index", "durationSeconds", "completed", "rpe"])
        XCTAssertEqual(timed["type"] as? String, "duration")
        XCTAssertEqual(timed["durationSeconds"] as? Int, 45)
        XCTAssertEqual(timed["rpe"] as? Double, 7)
    }

    func testEveryTypeSurvivesARelaunch() {
        let files = Fixtures.temporaryStore()
        var workout = workout()
        workout.setDuration(75, set: 0, in: 1, bounds: Fixtures.bounds)
        XCTAssertTrue(WorkoutStore(files: files).save(workout))
        XCTAssertEqual(WorkoutStore(files: files).load(), .workout(workout))
    }

    func testAWorkoutFileFromTheFirstVersionIsMovedAside() throws {
        let files = Fixtures.temporaryStore()
        XCTAssertTrue(WorkoutStore(files: files).save(workout()))
        let data = try XCTUnwrap(files.readData("workout.json"))
        let text = try XCTUnwrap(String(data: data, encoding: .utf8))
        XCTAssertTrue(text.contains("\"version\":2"))
        let firstVersion = text.replacingOccurrences(of: "\"version\":2", with: "\"version\":1")
        files.writeData(Data(firstVersion.utf8), to: "workout.json")
        XCTAssertEqual(WorkoutStore(files: files).load(), .discarded)
    }

    func testTheBundledBoundsBoundATimedSet() {
        XCTAssertEqual(Fixtures.bounds.itemBounds.durationSeconds, Bounds.Range(min: 5, max: 3600))
    }
}

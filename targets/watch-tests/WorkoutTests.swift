import XCTest
@testable import KinetiqWatchCore

final class WorkoutTests: XCTestCase {
    private let start = Date(timeIntervalSince1970: 1_790_000_000)

    private func routine() -> Routine {
        Routine(id: "rtn_1", name: "Push", items: [
            RoutineItem(
                id: "rit_1", exerciseId: "wger:73", exerciseName: "Bench Press",
                sets: 3, reps: "8-10", weightKg: 60, restSeconds: 90, notes: "Pause"
            ),
            RoutineItem(
                id: "rit_2", exerciseId: "local:dips", exerciseName: "Dips",
                sets: 0, reps: "AMRAP", weightKg: 0, restSeconds: 0, notes: nil
            )
        ])
    }

    private func workout() -> Workout {
        Workout.start(routine: routine(), unitSystem: .metric, id: "0F2C-UUID", now: start)
    }

    func testStartCopiesTheRoutineLikeEntriesFromItems() {
        let workout = workout()
        XCTAssertEqual(workout.entries.count, 2)
        XCTAssertEqual(workout.entries.first?.sets.count, 3)
        XCTAssertEqual(workout.entries.first?.sets.first?.reps, 8)
        XCTAssertEqual(workout.entries.first?.sets.first?.weightKg, 60)
        XCTAssertEqual(workout.entries.last?.sets.count, 1, "max(1, sets)")
        XCTAssertEqual(workout.entries.last?.sets.first?.reps, 8, "AMRAP reads as 8")
        XCTAssertEqual(workout.plannedSets, 4)
        XCTAssertEqual(workout.completedSets, 0)
    }

    func testCompletingASetStartsItsRest() {
        var workout = workout()
        XCTAssertEqual(workout.completeNextSet(in: 0, now: start), 90)
        XCTAssertEqual(workout.nextSet(in: 0), 1)
        XCTAssertEqual(workout.restRemaining(now: start.addingTimeInterval(30)), 60)
        XCTAssertEqual(workout.restRemaining(now: start.addingTimeInterval(200)), 0)
        XCTAssertEqual(workout.completedSets, 1)
    }

    func testZeroRestStartsNoTimerAndAFinishedExerciseCompletesNothing() {
        var workout = workout()
        XCTAssertEqual(workout.completeNextSet(in: 1, now: start), 0)
        XCTAssertNil(workout.restEndsAt)
        XCTAssertNil(workout.completeNextSet(in: 1, now: start))
        XCTAssertNil(workout.completeNextSet(in: 9, now: start))
    }

    func testUndoReopensTheLastCompletedSetInOrder() {
        var workout = workout()
        workout.completeNextSet(in: 0, now: start)
        workout.completeNextSet(in: 1, now: start)
        workout.undoLastCompleted()
        XCTAssertEqual(workout.nextSet(in: 1), 0)
        XCTAssertEqual(workout.currentEntry, 1)
        XCTAssertNil(workout.restEndsAt)
        workout.undoLastCompleted()
        XCTAssertEqual(workout.nextSet(in: 0), 0)
        XCTAssertFalse(workout.canUndo)
        workout.undoLastCompleted()
        XCTAssertEqual(workout.completedSets, 0)
    }

    func testEditsApplyToTheRemainingSetsAndStayInBounds() {
        var workout = workout()
        workout.completeNextSet(in: 0, now: start)
        workout.setWeight(62.5, in: 0, bounds: Fixtures.bounds)
        workout.setReps(6, in: 0)
        XCTAssertEqual(workout.entries.first?.sets.map(\.weightKg), [60, 62.5, 62.5])
        XCTAssertEqual(workout.entries.first?.sets.map(\.reps), [8, 6, 6])
        workout.setWeight(900, in: 0, bounds: Fixtures.bounds)
        workout.setReps(0, in: 0)
        XCTAssertEqual(workout.entries.first?.sets.last?.weightKg, 450)
        XCTAssertEqual(workout.entries.first?.sets.last?.reps, 1)
        workout.setRest(9999, in: 0, bounds: Fixtures.bounds)
        XCTAssertEqual(workout.entries.first?.restSeconds, 600)
        workout.setWeight(.nan, in: 0, bounds: Fixtures.bounds)
        XCTAssertEqual(workout.entries.first?.sets.last?.weightKg, 0)
    }

    func testFinishWritesTheWireDocumentWithExplicitNulls() throws {
        var workout = workout()
        workout.completeNextSet(in: 0, now: start)
        let data = try XCTUnwrap(workout.document(endedAt: start.addingTimeInterval(1800)).json())
        let json = try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(json["format"] as? String, "kinetiq.watch-workout")
        XCTAssertEqual(json["version"] as? Int, 1)
        XCTAssertEqual(json["id"] as? String, "0F2C-UUID")
        XCTAssertEqual(json["routineId"] as? String, "rtn_1")
        XCTAssertTrue(json["notes"] is NSNull)
        XCTAssertEqual(json["startedAt"] as? String, "2026-09-21T14:13:20.000Z")
        XCTAssertEqual(json["endedAt"] as? String, "2026-09-21T14:43:20.000Z")
        let entries = try XCTUnwrap(json["entries"] as? [[String: Any]])
        let sets = try XCTUnwrap(entries.first?["sets"] as? [[String: Any]])
        XCTAssertEqual(sets.first?["completed"] as? Bool, true)
        XCTAssertTrue(sets.first?["rpe"] is NSNull)
        XCTAssertTrue(entries.last?["notes"] is NSNull)
    }

    func testResumesFromDiskExactly() {
        let files = Fixtures.temporaryStore()
        let store = WorkoutStore(files: files)
        XCTAssertEqual(store.load(), .none)
        var workout = workout()
        workout.completeNextSet(in: 0, now: start)
        workout.setCurrentEntry(1)
        XCTAssertTrue(store.save(workout))
        XCTAssertEqual(WorkoutStore(files: files).load(), .workout(workout))
        store.remove()
        XCTAssertEqual(store.load(), .none)
    }

    func testACorruptOrOlderWorkoutFileIsMovedAsideNotCrashedOn() {
        let files = Fixtures.temporaryStore()
        files.writeData(Data("{\"version\": 1, \"id\": ".utf8), to: "workout.json")
        let store = WorkoutStore(files: files)
        XCTAssertEqual(store.load(), .discarded)
        XCTAssertEqual(store.load(), .none)
        XCTAssertEqual(files.list("unreadable").count, 1)
    }

    func testOutboxKeepsOneFilePerFinishedWorkout() {
        let outbox = Outbox(files: Fixtures.temporaryStore())
        let document = workout().document(endedAt: start)
        XCTAssertTrue(outbox.add(document))
        XCTAssertTrue(outbox.add(document))
        XCTAssertEqual(outbox.entries().map(\.id), ["0F2C-UUID"])
        outbox.remove(id: "0F2C-UUID")
        XCTAssertTrue(outbox.entries().isEmpty)
    }
}
